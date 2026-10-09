"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, drinks, recipeLines, recipes } from "@/db/schema";
import { abvFromLines, componentAbvById, declaredAbvFor, gateOne } from "@/lib/erp/canon";
import { scheduleCogsSnapshot } from "@/lib/erp/cogs-movement";

export type RecipeLineInput = { componentId: number; percentage: number };

export type SaveState = { error: string } | null;

/**
 * Gate 1, run against the lines about to be written.
 *
 * The new recipe is not in the database yet, so its ABV is summed from the
 * submitted lines with abvFromLines — the same arithmetic the drink page uses,
 * deliberately shared rather than reimplemented here.
 *
 * Three outcomes, and the third is the one that matters:
 *   fail        -> return an error string; the save never happens
 *   pass        -> null; carry on
 *   unverified  -> null; carry on. No declared figure exists, so the gate
 *                  cannot run. The save is allowed and the drink page renders
 *                  the recipe as UNVERIFIED, derived at read time from the
 *                  absent declared_abv. It is never recorded as a pass, and a
 *                  NULL is never permitted to read as agreement.
 *
 * On the day this was switched on it refused twelve of nineteen drinks. That
 * is the intended result: it means twelve drinks carry two numbers that
 * disagree and nobody has established which is right. Nothing should be
 * "fixed" to bring that count down, and in particular neither number should
 * ever be edited to match the other.
 */
async function gateOneCheck(
  drinkId: number,
  clientId: number,
  lines: RecipeLineInput[],
): Promise<string | null> {
  const { value: declared, conflicts } = await declaredAbvFor(drinkId, clientId);
  if (conflicts.length > 1) {
    return (
      `The SKUs for this drink carry disagreeing declared ABVs (${conflicts
        .map((c) => c.toFixed(1))
        .join("%, ")}%). Every size is filled from one batch of one liquid, so ` +
      `they cannot all be right. Resolve the labels before saving a recipe.`
    );
  }

  const { abv, nullAbvComponents } = abvFromLines(lines, await componentAbvById());
  if (nullAbvComponents.length > 0) {
    // A NULL component ABV understates the sum, so gating on it would compare
    // the label against a number known to be too low. Refusing here is not
    // Gate 1 firing — it is Gate 1 declining to run on a figure it cannot trust.
    return (
      `Cannot check this recipe against the label: ` +
      `${nullAbvComponents.map((c) => c.name).join(", ")} ` +
      `${nullAbvComponents.length === 1 ? "has" : "have"} no ABV recorded, which ` +
      `silently understates the computed strength. Record the missing ABV first.`
    );
  }

  const verdict = gateOne(abv, declared?.declared ?? null);
  return verdict.status === "fail" ? verdict.message : null;
}

/**
 * Validate a set of recipe lines against the brief's rules:
 *  - at least one line
 *  - every component unique within the recipe
 *  - percentages sum to exactly 100.0 after rounding the total to one decimal
 * Returns null when valid, or an error string.
 */
function validateLines(lines: RecipeLineInput[]): string | null {
  if (!lines.length) return "A recipe needs at least one ingredient.";
  const seen = new Set<number>();
  for (const l of lines) {
    if (!Number.isFinite(l.componentId)) return "Every line needs an ingredient.";
    if (seen.has(l.componentId)) return "Each ingredient can appear only once in a recipe.";
    seen.add(l.componentId);
    if (!Number.isFinite(l.percentage) || l.percentage <= 0) return "Every percentage must be greater than zero.";
    if (l.percentage > 100) return "No single ingredient can exceed 100%.";
  }
  const total = Math.round(lines.reduce((a, l) => a + l.percentage, 0) * 10) / 10;
  if (total !== 100) return `Percentages must sum to exactly 100% (currently ${total.toFixed(1)}%).`;
  return null;
}

/** Normalise the optional free-text method: trim, and treat blank as null. */
function parseMethod(raw: FormDataEntryValue | null): string | null {
  const v = String(raw ?? "").trim();
  return v === "" ? null : v;
}

function parseLines(raw: string): RecipeLineInput[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed recipe lines.");
  }
  if (!Array.isArray(parsed)) throw new Error("Malformed recipe lines.");
  return parsed.map((p) => ({
    componentId: Number((p as RecipeLineInput).componentId),
    percentage: Number((p as RecipeLineInput).percentage),
  }));
}

async function resolveIds(drinkSlug: string, clientSlug: string) {
  const [drink] = await db.select({ id: drinks.id }).from(drinks).where(eq(drinks.slug, drinkSlug)).limit(1);
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, clientSlug)).limit(1);
  if (!drink) throw new Error(`Unknown drink: ${drinkSlug}`);
  if (!client) throw new Error(`Unknown client: ${clientSlug}`);
  return { drinkId: drink.id, clientId: client.id };
}

/**
 * Save a recipe edit. Creates a NEW version (old + 1) and atomically swaps which
 * row is current — past versions and their lines are never mutated.
 *
 * The neon-http driver has no interactive transactions, so we build the new
 * version + its lines first (as a non-current row), then flip is_current for the
 * old and new rows together via db.batch (one atomic Postgres transaction). If
 * anything fails before the swap, the old recipe simply stays current.
 */
export async function saveRecipeEdit(
  drinkSlug: string,
  clientSlug: string,
  _prev: SaveState,
  form: FormData,
): Promise<SaveState> {
  const lines = parseLines(String(form.get("lines") ?? "[]"));
  const err = validateLines(lines);
  if (err) return { error: err };
  const method = parseMethod(form.get("method"));

  const { drinkId, clientId } = await resolveIds(drinkSlug, clientSlug);

  const gateError = await gateOneCheck(drinkId, clientId, lines);
  if (gateError) return { error: gateError };

  const [current] = await db
    .select({ id: recipes.id, version: recipes.version })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drinkId), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)))
    .limit(1);

  if (!current) {
    // No current recipe — treat as a fresh create at version 1.
    await createRecipe(drinkId, clientId, lines, method, String(form.get("createdBy") ?? "") || null);
  } else {
    const [next] = await db
      .insert(recipes)
      .values({ drinkId, clientId, version: current.version + 1, isCurrent: false, method, createdBy: String(form.get("createdBy") ?? "") || null })
      .returning({ id: recipes.id });

    await db.insert(recipeLines).values(
      lines.map((l, i) => ({ recipeId: next.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: i })),
    );

    // Atomic current-pointer swap.
    await db.batch([
      db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
      db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
    ]);
  }

  scheduleCogsSnapshot(`recipe: ${drinkSlug} (${clientSlug})`);
  revalidatePath(`/drinks/${drinkSlug}`);
  revalidatePath("/drinks");
  redirect(`/drinks/${drinkSlug}?client=${clientSlug}`);
}

/** Create the first recipe for a (drink, client) that has none yet. */
export async function createRecipeForClient(
  drinkSlug: string,
  clientSlug: string,
  _prev: SaveState,
  form: FormData,
): Promise<SaveState> {
  const lines = parseLines(String(form.get("lines") ?? "[]"));
  const err = validateLines(lines);
  if (err) return { error: err };
  const method = parseMethod(form.get("method"));

  const { drinkId, clientId } = await resolveIds(drinkSlug, clientSlug);

  const [existing] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drinkId), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)))
    .limit(1);
  if (existing) return { error: "This client already has a recipe for this drink." };

  const gateError = await gateOneCheck(drinkId, clientId, lines);
  if (gateError) return { error: gateError };

  await createRecipe(drinkId, clientId, lines, method, String(form.get("createdBy") ?? "") || null);

  scheduleCogsSnapshot(`recipe: ${drinkSlug} (${clientSlug})`);
  revalidatePath(`/drinks/${drinkSlug}`);
  revalidatePath("/drinks");
  redirect(`/drinks/${drinkSlug}?client=${clientSlug}`);
}

async function createRecipe(drinkId: number, clientId: number, lines: RecipeLineInput[], method: string | null, createdBy: string | null) {
  const [recipe] = await db
    .insert(recipes)
    .values({ drinkId, clientId, version: 1, isCurrent: true, method, createdBy })
    .returning({ id: recipes.id });
  await db.insert(recipeLines).values(
    lines.map((l, i) => ({ recipeId: recipe.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: i })),
  );
}
