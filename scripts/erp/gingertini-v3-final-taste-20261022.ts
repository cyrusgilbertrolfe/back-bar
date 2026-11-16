/**
 * The Christmas Gingertini, version 3: the final taste test on 21 Oct 2026,
 * made with the production gin (AGG-001, 50%) and the production syrup.
 *
 *   npx tsx --env-file=.env.local scripts/erp/gingertini-v3-final-taste-20261022.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/gingertini-v3-final-taste-20261022.ts --write  # apply
 *
 * Source: Cyrus, 22 Oct 2026. Tasted as a 200ml blend; the lines he gave sum
 * to 199ml (gin 71, Kaveri 12, Passoã 28, Sours 59, syrup 29), and the shares
 * are taken over 199 because that is what was poured. Against v2 the Kaveri
 * comes down 6ml and the Passoã goes up 5ml; the rest is unchanged.
 *
 * The syrup's sugar went up at the same tasting, from 1:2 to 6:10 demerara
 * to cranberry and hibiscus water, recorded on component 69.
 *
 * Mirrors saveRecipeEdit: a new version written non-current, then the
 * current pointer swapped in one batch. No declared ABV exists for this
 * drink, so Gate 1 is unverified, not passed.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, components, drinks, recipeLines, recipes } from "../../src/db/schema";
import { abvFromLines, componentAbvById } from "../../src/lib/erp/canon";
import { recordCogsSnapshots } from "../../src/lib/erp/cogs-movement";

const WRITE = process.argv.includes("--write");

// Parts as poured, in v2's display order.
const PARTS = [
  { componentId: 68, name: "Ginger Amalthea Gin", ml: 71 },
  { componentId: 69, name: "Cranberry & Hibiscus Syrup", ml: 29 },
  { componentId: 10, name: "Myatt's Lime Sours", ml: 59 },
  { componentId: 71, name: "Passoã", ml: 28 },
  { componentId: 72, name: "Kaveri Ginger Liqueur", ml: 12 },
];
const TOTAL = PARTS.reduce((a, p) => a + p.ml, 0);

const METHOD =
  "Final taste test 21 Oct 2026, production gin (AGG-001, 50%) and production syrup. " +
  `Parts as poured: gin 71, cranberry and hibiscus syrup 29, Lime Sours 59, Passoa 28, Kaveri ginger liqueur 12, total ${TOTAL} ml. ` +
  "Against v2: Kaveri down 6, Passoa up 5. The gin line carries the 0.001 rounding so the version sums to exactly 100.000. " +
  "Syrup at 6:10 demerara to cranberry and hibiscus water (up from 1:2) at the same tasting. SUPERSEDES v2, reset 28 Aug 2026.";

const SYRUP_NOTES =
  "Christmas Gingertini. House syrup: demerara sugar 6:10 cranberry and hibiscus water " +
  "(raised from 1:2 at the final taste test, 21 Oct 2026). Infusion clarified with pectolase. Per litre. Placeholder.";

async function main() {
  // Shares to 3dp, then the gin takes the rounding so the lines sum to 100.000.
  const lines = PARTS.map((p) => ({ componentId: p.componentId, percentage: Math.round((p.ml / TOTAL) * 100000) / 1000 }));
  const drift = Math.round((100 - lines.reduce((a, l) => a + l.percentage, 0)) * 1000) / 1000;
  lines[0].percentage = Math.round((lines[0].percentage + drift) * 1000) / 1000;

  const { abv } = abvFromLines(lines, await componentAbvById());
  PARTS.forEach((p, i) => console.log(`${p.name.padEnd(28)} ${String(p.ml).padStart(3)} ml  ${lines[i].percentage.toFixed(3)}%`));
  console.log(`Total ${TOTAL} ml, ${lines.reduce((a, l) => a + l.percentage, 0).toFixed(3)}%, computed ABV ${abv.toFixed(4)}%`);

  const [drink] = await db.select({ id: drinks.id }).from(drinks).where(eq(drinks.slug, "christmas-gingertini"));
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, "fm"));
  const [current] = await db
    .select({ id: recipes.id, version: recipes.version })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drink.id), eq(recipes.clientId, client.id), eq(recipes.isCurrent, true)));
  if (current.version !== 2) throw new Error(`Expected v2 current, found v${current.version}; refusing.`);
  console.log(`Current: recipe ${current.id} v${current.version} -> v${current.version + 1}`);

  if (!WRITE) return console.log("Dry run. Pass --write to apply.");

  const [next] = await db
    .insert(recipes)
    .values({ drinkId: drink.id, clientId: client.id, version: current.version + 1, isCurrent: false, method: METHOD, createdBy: "Cyrus" })
    .returning({ id: recipes.id });
  await db.insert(recipeLines).values(
    lines.map((l, i) => ({ recipeId: next.id, componentId: l.componentId, percentage: l.percentage.toFixed(3), displayOrder: i })),
  );
  await db.batch([
    db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
    db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
    db.update(components).set({ notes: SYRUP_NOTES, updatedAt: new Date() }).where(eq(components.id, 69)),
  ]);
  console.log(`Wrote recipe ${next.id} v${current.version + 1}, now current. Syrup notes updated.`);
  console.log(await recordCogsSnapshots("recipe: christmas-gingertini (fm) v3, final taste test"));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
