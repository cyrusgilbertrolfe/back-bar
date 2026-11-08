/**
 * The Negroni to exact parts: gin and Campari equal, the two vermouths half each
 * (2:2:1:1). Cyrus, 8 Nov 2026, on seeing the Jeroboam's requirements. It stood
 * at 33.3 / 33.7 / 16.5 / 16.5, for the house recipe and Cripps's alike.
 *
 *   npx tsx --env-file=.env.local scripts/erp/negroni-exact-parts-20261108.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/negroni-exact-parts-20261108.ts --write  # apply
 *
 * Declared label ABVs are not touched. New version written non-current, then
 * the current pointer swapped in one batch, as saveRecipeEdit does.
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { recipeLines, recipes } from "../../src/db/schema";
import { abvFromLines, componentAbvById } from "../../src/lib/erp/canon";
import { recordCogsSnapshots } from "../../src/lib/erp/cogs-movement";

const WRITE = process.argv.includes("--write");
const DRINK = 12;
const CLIENTS = [1, 3];
const GIN = 1;
const CAMPARI = 4;
const METHOD = "Exact parts, 2:2:1:1: gin and Campari equal, two vermouths half each. Cyrus, 8 Nov 2026. SUPERSEDES v1, 33.3 / 33.7 / 16.5 / 16.5.";

async function main() {
  const abvs = await componentAbvById();
  for (const clientId of CLIENTS) {
    const [current] = await db
      .select({ id: recipes.id, version: recipes.version })
      .from(recipes)
      .where(and(eq(recipes.drinkId, DRINK), eq(recipes.clientId, clientId), eq(recipes.isCurrent, true)));
    if (current.version !== 1) throw new Error(`Client ${clientId}: expected v1, found v${current.version}; refusing.`);
    const old = await db.select().from(recipeLines).where(eq(recipeLines.recipeId, current.id)).orderBy(asc(recipeLines.displayOrder));
    if (old.length !== 4 || !old.some((l) => l.componentId === GIN) || !old.some((l) => l.componentId === CAMPARI)) {
      throw new Error(`Client ${clientId}: not the four lines expected; refusing.`);
    }
    const lines = old.map((l) => ({
      componentId: l.componentId,
      percentage: l.componentId === GIN || l.componentId === CAMPARI ? 33.333 : 16.667,
      displayOrder: l.displayOrder,
    }));
    const before = abvFromLines(old.map((l) => ({ componentId: l.componentId, percentage: Number(l.percentage) })), abvs).abv;
    const after = abvFromLines(lines, abvs).abv;
    const sum = lines.reduce((a, l) => a + l.percentage, 0);
    console.log(`Client ${clientId}: recipe ${current.id} v1 -> v2, sum ${sum.toFixed(3)}, computed ABV ${before.toFixed(3)} -> ${after.toFixed(3)}`);
    if (!WRITE) continue;
    const [next] = await db
      .insert(recipes)
      .values({ drinkId: DRINK, clientId, version: 2, isCurrent: false, method: METHOD, createdBy: "Cyrus" })
      .returning({ id: recipes.id });
    await db.insert(recipeLines).values(lines.map((l) => ({ recipeId: next.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: l.displayOrder })));
    await db.batch([
      db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
      db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
    ]);
    console.log(`Wrote recipe ${next.id} v2, now current.`);
  }
  if (WRITE) console.log(await recordCogsSnapshots("recipe: negroni exact parts v2, house and Cripps"));
  else console.log("Dry run. Pass --write to apply.");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
