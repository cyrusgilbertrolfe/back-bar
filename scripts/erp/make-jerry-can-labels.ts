/**
 * Jerry can production labels for the Christmas Gingertini: the drink, each
 * ingredient in pouring order with its volume for one can, and a row of tick
 * boxes so the same can is filled several times off one label. Same 4-up
 * stock as the case labels. Volumes come off the current recipe in Back Bar.
 *
 *   npx tsx --env-file=.env.local scripts/erp/make-jerry-can-labels.ts [--count=4] [--fills=6] [--litres=26.01] [--start=N] [--out=path.pdf]
 */

import { writeFile } from "node:fs/promises";

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, components, drinks, recipeLines, recipes } from "../../src/db/schema";
import { buildJerryCanLabelsPdf } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

// Spirits first, then the Sours and the syrup: the order of the 25L build sheet, 21 Oct 2026.
const POUR_ORDER = [68, 72, 71, 10, 69];

async function main() {
  const litres = Number(arg("litres") ?? 26.01);
  const [drink] = await db.select({ id: drinks.id }).from(drinks).where(eq(drinks.slug, "christmas-gingertini"));
  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, "fm"));
  const [recipe] = await db
    .select({ id: recipes.id, version: recipes.version })
    .from(recipes)
    .where(and(eq(recipes.drinkId, drink.id), eq(recipes.clientId, client.id), eq(recipes.isCurrent, true)));
  const rows = await db
    .select({ componentId: recipeLines.componentId, name: components.name, percentage: recipeLines.percentage })
    .from(recipeLines)
    .innerJoin(components, eq(components.id, recipeLines.componentId))
    .where(eq(recipeLines.recipeId, recipe.id));

  const ids = rows.map((r) => r.componentId).sort();
  if (ids.join() !== [...POUR_ORDER].sort().join()) throw new Error(`v${recipe.version} has different ingredients; update POUR_ORDER.`);
  const ordered = POUR_ORDER.map((id) => rows.find((r) => r.componentId === id)!);

  // To the nearest 10ml; the gin takes the rounding so the can sums exactly.
  const total = Math.round(litres * 1000);
  const ml = ordered.map((r) => Math.round((Number(r.percentage) / 100) * total / 10) * 10);
  ml[0] += total - ml.reduce((a, b) => a + b, 0);
  const fmt = (n: number) => `${n.toLocaleString("en-GB")} ml`;

  const facts = {
    drink: "Gingertini",
    subtitle: `Recipe v${recipe.version} · ${litres} L a can · pour in this order`,
    lines: ordered.map((r, i) => ({ name: r.name.replace(/\s*\(.*\)$/, ""), volume: fmt(ml[i]) })),
  };
  facts.lines.forEach((l) => console.log(`${l.name.padEnd(30)} ${l.volume.padStart(10)}`));

  const count = Number(arg("count") ?? 4);
  const out = arg("out") ?? "Gingertini jerry can labels.pdf";
  const opts = { count, fills: Number(arg("fills") ?? 6), startAt: Number(arg("start") ?? 1) };
  await writeFile(out, await buildJerryCanLabelsPdf(facts, opts, await loadBrandFonts()));
  console.log(`Wrote ${out}: ${count} labels, recipe v${recipe.version}, ${fmt(total)} a can`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
