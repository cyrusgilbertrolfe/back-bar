/**
 * Read helpers for the Drinks / Recipes layer.
 *
 * Single source of truth shared by the /drinks pages and the /calculator. All
 * queries read the *current* recipe (is_current = true) live — nothing here is
 * cached, so an edit on /drinks/[slug] shows up on the next calculator run.
 *
 * Recipes are internal-only (spec §7.3) — these helpers are server-side and
 * must never be exposed through an unauthenticated route.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, components, drinks, recipeLines, recipes, skus } from "@/db/schema";
import { abvComputed, declaredAbvFor, gateOne } from "@/lib/erp/canon";
import { priceProvenanceFor } from "@/lib/erp/ingredients";
import type { CostSource } from "@/lib/erp/provenance";

/** True when a Postgres connection string is configured. Lets pages degrade to
 * a setup state instead of throwing when the DB isn't wired yet. */
export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Current recipe lines (component id + percentage) + method for a (drink,
 * client), or null if that pair has no current recipe. Feeds the editor and the
 * "add from MFC default" prefill. */
export async function getRecipeLines(
  drinkSlug: string,
  clientSlug: string,
): Promise<{ lines: { componentId: number; percentage: number }[]; method: string | null } | null> {
  const [row] = await db
    .select({ recipeId: recipes.id, method: recipes.method })
    .from(recipes)
    .innerJoin(drinks, eq(drinks.id, recipes.drinkId))
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(and(eq(drinks.slug, drinkSlug), eq(clients.slug, clientSlug), eq(recipes.isCurrent, true)))
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select({ componentId: recipeLines.componentId, percentage: recipeLines.percentage })
    .from(recipeLines)
    .where(eq(recipeLines.recipeId, row.recipeId))
    .orderBy(asc(recipeLines.displayOrder));
  return {
    lines: lines.map((l) => ({ componentId: l.componentId, percentage: Number(l.percentage) })),
    method: row.method,
  };
}

/** Active ingredient components, for the recipe-editor dropdown. */
export async function listIngredientComponents() {
  return db
    .select({ id: components.id, name: components.name })
    .from(components)
    .where(and(eq(components.type, "ingredient"), eq(components.active, true)))
    .orderBy(asc(components.name));
}

export type ClientRow = { id: number; slug: string; name: string; isDefault: boolean; displayOrder: number };

/** All clients, ordered for pickers/tabs. */
export async function listAllClients(): Promise<ClientRow[]> {
  return db
    .select({ id: clients.id, slug: clients.slug, name: clients.name, isDefault: clients.isDefault, displayOrder: clients.displayOrder })
    .from(clients)
    .orderBy(asc(clients.displayOrder));
}

export type DrinkListRow = {
  slug: string;
  name: string;
  status: "active" | "archived";
  clientNames: string[];
  updatedAt: Date | null;
};

/** All drinks with the clients that have a current recipe, for the index. */
export async function listDrinks(): Promise<DrinkListRow[]> {
  const drinkRows = await db
    .select({ id: drinks.id, slug: drinks.slug, name: drinks.name, status: drinks.status })
    .from(drinks)
    .orderBy(asc(drinks.name));

  const recipeRows = await db
    .select({
      drinkId: recipes.drinkId,
      clientName: clients.name,
      clientOrder: clients.displayOrder,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(eq(recipes.isCurrent, true));

  const byDrink = new Map<number, { names: { name: string; order: number }[]; updatedAt: Date | null }>();
  for (const r of recipeRows) {
    const e = byDrink.get(r.drinkId) ?? { names: [], updatedAt: null };
    e.names.push({ name: r.clientName, order: r.clientOrder });
    if (!e.updatedAt || (r.updatedAt && r.updatedAt > e.updatedAt)) e.updatedAt = r.updatedAt;
    byDrink.set(r.drinkId, e);
  }

  return drinkRows.map((d) => {
    const e = byDrink.get(d.id);
    return {
      slug: d.slug,
      name: d.name,
      status: d.status,
      clientNames: (e?.names ?? []).sort((a, b) => a.order - b.order).map((n) => n.name),
      updatedAt: e?.updatedAt ?? null,
    };
  });
}

export type RecipeLineView = { componentName: string; percentage: number };
export type RecipeVersionView = { version: number; isCurrent: boolean; createdAt: Date; createdBy: string | null };
/**
 * The label figure beside the computed one, and the verdict between them.
 *
 * `declared: null` is a first-class state, not a missing value to be papered
 * over: it means nobody has read the bottle. The page must render it as
 * "not recorded" and the recipe as unverified — never as a blank, never as a
 * zero, and never as agreement.
 */
export type AbvView = {
  /** Summed from the current recipe. Always present. */
  computed: number;
  /** What the physical label says, or null when nobody has read it. */
  declared: number | null;
  /** |computed - declared| at label precision, or null when declared is null. */
  gap: number | null;
  status: "pass" | "fail" | "unverified";
  declaredSource: string | null;
  declaredNoted: string | null;
  /** Components with no ABV recorded — these understate `computed`. */
  nullAbvComponents: string[];
};

export type ClientRecipeView = {
  clientId: number;
  clientSlug: string;
  clientName: string;
  clientOrder: number;
  recipeId: number;
  version: number;
  method: string | null;
  lines: RecipeLineView[];
  history: RecipeVersionView[];
  abv: AbvView;
};
export type DrinkDetail = {
  id: number;
  slug: string;
  name: string;
  status: "active" | "archived";
  notes: string | null;
  recipesByClient: ClientRecipeView[];
};

/** Full detail for /drinks/[slug]: each client's current recipe + version history. */
export async function getDrinkDetail(slug: string): Promise<DrinkDetail | null> {
  const [drink] = await db.select().from(drinks).where(eq(drinks.slug, slug)).limit(1);
  if (!drink) return null;

  // All recipe rows for this drink (every version), with client info.
  const allRecipes = await db
    .select({
      recipeId: recipes.id,
      clientId: clients.id,
      clientSlug: clients.slug,
      clientName: clients.name,
      clientOrder: clients.displayOrder,
      version: recipes.version,
      isCurrent: recipes.isCurrent,
      method: recipes.method,
      createdAt: recipes.createdAt,
      createdBy: recipes.createdBy,
    })
    .from(recipes)
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(eq(recipes.drinkId, drink.id))
    .orderBy(asc(clients.displayOrder), desc(recipes.version));

  const currentRecipeIds = allRecipes.filter((r) => r.isCurrent).map((r) => r.recipeId);
  const lineRows = currentRecipeIds.length
    ? await db
        .select({
          recipeId: recipeLines.recipeId,
          componentName: components.name,
          percentage: recipeLines.percentage,
          displayOrder: recipeLines.displayOrder,
        })
        .from(recipeLines)
        .innerJoin(components, eq(components.id, recipeLines.componentId))
        .where(inArray(recipeLines.recipeId, currentRecipeIds))
        .orderBy(asc(recipeLines.displayOrder))
    : [];

  const linesByRecipe = new Map<number, RecipeLineView[]>();
  for (const l of lineRows) {
    const arr = linesByRecipe.get(l.recipeId) ?? [];
    arr.push({ componentName: l.componentName, percentage: Number(l.percentage) });
    linesByRecipe.set(l.recipeId, arr);
  }

  // Group versions by client.
  const byClient = new Map<number, ClientRecipeView>();
  for (const r of allRecipes) {
    let cv = byClient.get(r.clientId);
    if (!cv) {
      cv = {
        clientId: r.clientId,
        clientSlug: r.clientSlug,
        clientName: r.clientName,
        clientOrder: r.clientOrder,
        recipeId: -1,
        version: 0,
        method: null,
        lines: [],
        history: [],
        abv: {
          computed: 0,
          declared: null,
          gap: null,
          status: "unverified",
          declaredSource: null,
          declaredNoted: null,
          nullAbvComponents: [],
        },
      };
      byClient.set(r.clientId, cv);
    }
    cv.history.push({ version: r.version, isCurrent: r.isCurrent, createdAt: r.createdAt, createdBy: r.createdBy });
    if (r.isCurrent) {
      cv.recipeId = r.recipeId;
      cv.version = r.version;
      cv.method = r.method;
      cv.lines = linesByRecipe.get(r.recipeId) ?? [];
    }
  }

  // Computed vs declared, per client. Read at request time and never stored,
  // on the same principle as the rest of canon.ts: the moment a derived figure
  // gets a column of its own it can drift from the recipe that produced it.
  for (const cv of byClient.values()) {
    const computed = await abvComputed(drink.id, cv.clientSlug);
    const { value: declared } = await declaredAbvFor(drink.id, cv.clientId);
    const verdict = gateOne(computed.abv, declared?.declared ?? null);
    cv.abv = {
      computed: verdict.computed,
      declared: verdict.declared,
      gap: verdict.gap,
      status: verdict.status,
      declaredSource: declared?.source ?? null,
      declaredNoted: declared?.noted ?? null,
      nullAbvComponents: computed.nullAbvComponents.map((c) => c.name),
    };
  }

  return {
    id: drink.id,
    slug: drink.slug,
    name: drink.name,
    status: drink.status,
    notes: drink.notes,
    recipesByClient: [...byClient.values()].sort((a, b) => a.clientOrder - b.clientOrder),
  };
}

/** Clients that have at least one current recipe — the calculator's step 1. */
export async function listClientsWithRecipes() {
  const rows = await db
    .selectDistinct({ id: clients.id, slug: clients.slug, name: clients.name, order: clients.displayOrder })
    .from(clients)
    .innerJoin(recipes, and(eq(recipes.clientId, clients.id), eq(recipes.isCurrent, true)))
    .orderBy(asc(clients.displayOrder));
  return rows;
}

/** Drinks that have a current recipe for the given client — calculator step 2. */
export async function listDrinksForClient(clientSlug: string) {
  const rows = await db
    .select({ slug: drinks.slug, name: drinks.name, status: drinks.status })
    .from(recipes)
    .innerJoin(drinks, eq(drinks.id, recipes.drinkId))
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(and(eq(clients.slug, clientSlug), eq(recipes.isCurrent, true)))
    .orderBy(asc(drinks.name));
  return rows;
}

export type CalcRecipe = {
  drinkSlug: string;
  drinkName: string;
  clientSlug: string;
  method: string | null;
  lines: {
    componentName: string;
    percentage: number;
    unitCost: number;
    uom: string;
    /** Where unitCost came from, and the date it applies from. */
    source: CostSource;
    setAt: string | null;
  }[];
  skus: { sizeMl: number; code: string }[];
};

/** The current recipe for (drink, client) with live component unit costs + the
 * drink's SKU sizes — everything the calculator needs to price a batch. */
export async function getCalcRecipe(clientSlug: string, drinkSlug: string): Promise<CalcRecipe | null> {
  const [row] = await db
    .select({ recipeId: recipes.id, drinkId: drinks.id, drinkName: drinks.name, method: recipes.method })
    .from(recipes)
    .innerJoin(drinks, eq(drinks.id, recipes.drinkId))
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(and(eq(clients.slug, clientSlug), eq(drinks.slug, drinkSlug), eq(recipes.isCurrent, true)))
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select({
      componentId: components.id,
      componentName: components.name,
      percentage: recipeLines.percentage,
      unitCost: components.unitCost,
      uom: components.uom,
    })
    .from(recipeLines)
    .innerJoin(components, eq(components.id, recipeLines.componentId))
    .where(eq(recipeLines.recipeId, row.recipeId))
    .orderBy(asc(recipeLines.displayOrder));

  const provenance = await priceProvenanceFor(lines.map((l) => l.componentId));

  const skuRows = await db
    .select({ sizeMl: skus.sizeMl, code: skus.code })
    .from(skus)
    .where(and(eq(skus.drinkId, row.drinkId), eq(skus.active, true)))
    .orderBy(asc(skus.sizeMl));

  return {
    drinkSlug,
    drinkName: row.drinkName,
    clientSlug,
    method: row.method,
    lines: lines.map((l) => ({
      componentName: l.componentName,
      percentage: Number(l.percentage),
      unitCost: Number(l.unitCost),
      uom: l.uom,
      source: provenance.get(l.componentId)?.source ?? "unsourced",
      setAt: provenance.get(l.componentId)?.setAt ?? null,
    })),
    skus: skuRows,
  };
}
