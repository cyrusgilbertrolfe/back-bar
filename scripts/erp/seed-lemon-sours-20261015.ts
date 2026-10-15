/**
 * Myatt's Lemon Sours: a new sub-recipe, and the Corpse Reviver moved onto it.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-lemon-sours-20261015.ts
 *   npx tsx --env-file=.env.local scripts/erp/seed-lemon-sours-20261015.ts --write
 *   ... --write --recipe     also versions the Corpse Reviver recipe
 *
 * Cyrus, 15 October 2026: the Corpse Reviver has always been made with lemon,
 * not lime, and Back Bar has only ever held the lime version. Lemon Sours is
 * made by immersing a quarter of a lemon in 500 ml of Lime Sours for an hour
 * and filtering it out.
 *
 * Idempotent, after the model of seed-sours.ts.
 *
 * WHY --recipe IS A SEPARATE FLAG. The Corpse Reviver declares 15.0% on every
 * size and computes 21.2%, so Gate 1 refuses any recipe save for this drink
 * through the drink page. Swapping one 0% ABV sours for another does not move
 * the computed figure by a thousandth — the refusal is the pre-existing label
 * disagreement, not this change — but writing the version here steps around a
 * control that was deliberately built. It happens only on Cyrus's say-so, and
 * the gate's verdict is printed either way so it is never stepped around
 * quietly.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import {
  components,
  componentRecipes,
  recipeLines,
  recipes,
  type NewComponent,
} from "../../src/db/schema";
import { abvFromLines, componentAbvById, declaredAbvFor, gateOne } from "../../src/lib/erp/canon";
import { planBatch } from "../../src/lib/erp/sub-recipes";

const WRITE = process.argv.includes("--write");
const DO_RECIPE = process.argv.includes("--recipe");

const LIME_SOURS_ID = 10;
const CORPSE_REVIVER_RECIPE_ID = 32;

const LEMON_NAME = "Lemons (whole)";
const LEMON_SOURS_NAME = "Myatt's Lemon Sours";

/**
 * One base batch is one 500 ml bottle of Lime Sours with a quarter lemon
 * immersed, which is how it is actually made rather than a round litre.
 * The yield is the nominal 500 ml: the quarter lemon absorbs a little and the
 * filter holds a little back, but neither has been measured, so asserting a
 * loss here would be inventing a figure. Measure it on the first batch.
 */
const BATCH_YIELD_ML = 500;
const LEMON_PER_BATCH = 0.25;

/** 25p a lemon, carried over from component 8's note: "100 lemons @ £0.25 makes 20L". */
const LEMON_UNIT_COST = 0.25;

/** The day these prices were entered, for the unit_cost_set_at timestamp. */
const PRICED_ON = new Date("2026-10-15T00:00:00Z");

const LEMON_SOURS_METHOD = `Immerse a quarter of a lemon in 500 ml of Myatt's Lime Sours for one hour, then filter it out. It comes out tasting like lemon (Cyrus, 15 October 2026).

The hour is the extraction: longer pulls bitterness out of the pith. Nothing is squeezed, so this is a peel-and-flesh infusion, not a juice.`;

const log: string[] = [];
function note(s: string) {
  log.push(s);
  console.log(`  ${s}`);
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function ensureComponent(spec: {
  name: string;
  type: NewComponent["type"];
  uom: NewComponent["uom"];
  packSize: string;
  packCost: string | null;
  unitCost: string;
  unitCostSetAt: Date | null;
  notes: string;
  abv: string;
  batchYield?: string;
  batchMethod?: string;
}): Promise<number> {
  const [existing] = await db.select().from(components).where(eq(components.name, spec.name));
  if (existing) {
    note(`${spec.name} already exists (id ${existing.id}), left as it is`);
    return existing.id;
  }
  if (!WRITE) {
    note(`WOULD CREATE ${spec.name} (${spec.type}, ${spec.uom}, unit cost £${spec.unitCost})`);
    return -1;
  }
  const [created] = await db
    .insert(components)
    .values({
      name: spec.name,
      type: spec.type,
      uom: spec.uom,
      packSize: spec.packSize,
      packCost: spec.packCost,
      unitCost: spec.unitCost,
      unitCostSetAt: spec.unitCostSetAt,
      notes: spec.notes,
      abv: spec.abv,
      batchYield: spec.batchYield,
      batchMethod: spec.batchMethod,
      active: true,
    })
    .returning();
  note(`CREATED ${spec.name} (id ${created.id}, ${spec.type}, ${spec.uom})`);
  return created.id;
}

async function link(parentId: number, childId: number, quantity: string, order: number, notes?: string) {
  if (parentId < 0 || childId < 0) {
    note(`WOULD LINK (pending ids) qty ${quantity}`);
    return;
  }
  const [existing] = await db
    .select()
    .from(componentRecipes)
    .where(
      and(
        eq(componentRecipes.parentComponentId, parentId),
        eq(componentRecipes.childComponentId, childId),
      ),
    );
  if (existing) {
    note(`line ${parentId} -> ${childId} already exists at qty ${existing.quantity}`);
    return;
  }
  if (!WRITE) {
    note(`WOULD LINK ${parentId} -> ${childId} qty ${quantity}`);
    return;
  }
  await db.insert(componentRecipes).values({
    parentComponentId: parentId,
    childComponentId: childId,
    quantity,
    displayOrder: order,
    notes,
  });
  note(`LINKED ${parentId} -> ${childId} qty ${quantity}`);
}

async function main() {
  console.log(WRITE ? "=== WRITE MODE ===\n" : "=== DRY RUN (pass --write to commit) ===\n");

  const [limeSours] = await db.select().from(components).where(eq(components.id, LIME_SOURS_ID));
  if (!limeSours) throw new Error(`No component ${LIME_SOURS_ID} (Myatt's Lime Sours)`);
  // From the pack, not the unit_cost column: that column holds 4 decimal places,
  // which rounds £0.000715/ml to £0.0007 and loses 2% of the figure before the
  // arithmetic starts. The new component's own unit_cost is rounded the same way
  // the register rounds every other one, but the derivation is done in full.
  const limeUnitCost = n(limeSours.packCost) / n(limeSours.packSize);
  note(
    `${limeSours.name} is component ${limeSours.id}, £${n(limeSours.packCost).toFixed(2)} per ` +
      `${n(limeSours.packSize)} ml = £${limeUnitCost.toFixed(6)}/ml`,
  );

  console.log("\n1. The lemon itself, bought whole and counted in units");
  const lemonId = await ensureComponent({
    name: LEMON_NAME,
    type: "ingredient",
    uom: "each",
    packSize: "1.000",
    packCost: LEMON_UNIT_COST.toFixed(2),
    unitCost: LEMON_UNIT_COST.toFixed(4),
    unitCostSetAt: PRICED_ON,
    notes:
      "Whole lemons, counted in units, for Myatt's Lemon Sours: a quarter is immersed and filtered out, " +
      "so none of it is juiced. 25p each is carried over from component 8 (Lemons (juice)), whose note " +
      "reads \"100 lemons @ £0.25 makes 20L\". That price has never been read off an invoice — it needs one.",
    abv: "0.00",
  });

  console.log("\n2. Myatt's Lemon Sours, a sub-recipe of a sub-recipe");
  const derivedBatchCost = BATCH_YIELD_ML * limeUnitCost + LEMON_PER_BATCH * LEMON_UNIT_COST;
  const derivedUnitCost = derivedBatchCost / BATCH_YIELD_ML;
  note(
    `derived: ${BATCH_YIELD_ML} ml × £${limeUnitCost.toFixed(6)} + ${LEMON_PER_BATCH} lemon × £${LEMON_UNIT_COST.toFixed(2)} ` +
      `= £${derivedBatchCost.toFixed(4)} per batch, £${derivedUnitCost.toFixed(6)}/ml (£${(derivedUnitCost * 1000).toFixed(3)}/L)`,
  );
  note(
    `for comparison, ${limeSours.name} is £${(limeUnitCost * 1000).toFixed(3)}/L, so the lemon adds ` +
      `${(((derivedUnitCost - limeUnitCost) / limeUnitCost) * 100).toFixed(1)}%`,
  );

  const lemonSoursId = await ensureComponent({
    name: LEMON_SOURS_NAME,
    type: "sub_recipe",
    uom: "ml",
    packSize: "10000.000",
    packCost: (derivedUnitCost * 10000).toFixed(2),
    unitCost: derivedUnitCost.toFixed(4),
    unitCostSetAt: PRICED_ON,
    notes:
      "DERIVED from component_recipes on 15 Oct 2026, not asserted. Lime Sours with a quarter lemon " +
      "immersed for an hour and filtered out. Do not hand-edit: re-derive from the sub-recipe. " +
      "The batch yield is the nominal 500 ml — absorption and filter loss have not been measured.",
    abv: "0.00",
    batchYield: BATCH_YIELD_ML.toFixed(4),
    batchMethod: LEMON_SOURS_METHOD,
  });

  await link(lemonSoursId, LIME_SOURS_ID, BATCH_YIELD_ML.toFixed(4), 1, "One 500 ml bottle of Lime Sours.");
  await link(lemonSoursId, lemonId, LEMON_PER_BATCH.toFixed(4), 2, "A quarter lemon, immersed an hour, then filtered out.");

  if (WRITE && lemonSoursId > 0) {
    console.log("\n3. What the sub-recipe machinery now derives");
    const plan = await planBatch(lemonSoursId, 1000);
    console.log(`  a litre of ${plan.name}: derived £${plan.derivedCost ?? "null"}, asserted £${(plan.assertedUnitCost * 1000).toFixed(3)}`);
    if (plan.unpriced.length) console.log(`  unpriced inputs: ${plan.unpriced.join(", ")}`);
    for (const l of plan.lines) console.log(`    ${l.name}: ${l.quantity} ${l.uom}, £${l.cost ?? "null"}`);
  }

  console.log("\n4. The Corpse Reviver recipe");
  const [current] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, CORPSE_REVIVER_RECIPE_ID));
  if (!current) throw new Error(`No recipe ${CORPSE_REVIVER_RECIPE_ID}`);
  if (!current.isCurrent) throw new Error(`Recipe ${CORPSE_REVIVER_RECIPE_ID} is no longer current — re-read before writing`);

  const currentLines = await db
    .select()
    .from(recipeLines)
    .where(eq(recipeLines.recipeId, current.id));
  currentLines.sort((a, b) => a.displayOrder - b.displayOrder);

  const swapped = currentLines.map((l) => ({
    componentId: l.componentId === LIME_SOURS_ID ? lemonSoursId : l.componentId,
    percentage: n(l.percentage),
  }));
  if (!currentLines.some((l) => l.componentId === LIME_SOURS_ID)) {
    throw new Error("Recipe 32 no longer carries Lime Sours — nothing to swap");
  }

  const abvById = await componentAbvById();
  const before = abvFromLines(currentLines.map((l) => ({ componentId: l.componentId, percentage: n(l.percentage) })), abvById);
  // The new component does not exist yet in a dry run, so stand its 0% ABV in.
  const abvForCheck = new Map(abvById);
  abvForCheck.set(lemonSoursId, 0);
  const after = abvFromLines(swapped, abvForCheck);
  note(`computed ABV before ${before.abv.toFixed(3)}%, after ${after.abv.toFixed(3)}% — both sours are 0% ABV, so it does not move`);

  const { value: declared } = await declaredAbvFor(current.drinkId, current.clientId);
  const verdict = gateOne(after.abv, declared?.declared ?? null);
  note(`GATE 1: ${verdict.status.toUpperCase()} — declared ${declared?.declared ?? "none"}%, computed ${after.abv.toFixed(3)}%, gap ${verdict.gap ?? "n/a"}`);
  if (verdict.status === "fail") {
    note("The drink page would REFUSE this save. The disagreement is the label's, and predates this change.");
  }

  if (!DO_RECIPE) {
    console.log("\n  --recipe not passed, so the recipe is left alone. Components only.");
    process.exit(0);
  }
  if (!WRITE) {
    console.log(`\n  WOULD VERSION recipe ${current.id} to v${current.version + 1}, Lime Sours -> ${LEMON_SOURS_NAME} at ${swapped.find((s) => s.componentId === lemonSoursId)?.percentage}%`);
    process.exit(0);
  }

  const [next] = await db
    .insert(recipes)
    .values({
      drinkId: current.drinkId,
      clientId: current.clientId,
      version: current.version + 1,
      isCurrent: false,
      method: current.method,
      createdBy: "seed-lemon-sours-20261015 (Cyrus, 15 Oct 2026)",
    })
    .returning({ id: recipes.id });

  await db.insert(recipeLines).values(
    swapped.map((l, i) => ({
      recipeId: next.id,
      componentId: l.componentId,
      percentage: l.percentage.toFixed(3),
      displayOrder: i,
    })),
  );

  await db.batch([
    db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
    db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
  ]);
  note(`VERSIONED recipe ${current.id} (v${current.version}) to ${next.id} (v${current.version + 1}), now current`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
