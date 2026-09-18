/**
 * Correct the method field on recipe 36, the Gibson (client mfc, version 2).
 *
 *   npx tsx --env-file=.env.local scripts/erp/fix-gibson-method-20260916.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/fix-gibson-method-20260916.ts --write  # apply
 *
 * Written 16 Sept 2026 from the change note in Lifemaxxing
 * ("2026-09-16 Recipe 36 Gibson - method field correction [Change note]").
 * The description in the field said the onions soak into the gin and dry
 * vermouth in the freezer. They do not: the infusion is in the gin alone,
 * before the blend exists. The narrative is deleted rather than corrected, so
 * copy has only the instruction to quote. The filtration order was closed by
 * Cyrus the same day: gin filtered first, then added to the vermouth and water,
 * then bottled straight away.
 *
 * Guarded: the row must still be recipe 36 and still hold the exact old text.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { recipes } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const RECIPE_ID = 36;

const OLD = `Pickled onions are soaked into the gin and dry vermouth in the freezer, then very finely filtered out. Nothing goes in the bottle or the glass. Onion cost is immaterial and is not carried in the recipe.

Infuse with one silverskin pickled onion per 700ml for two hours before production`;

const NEW = `Infuse one silverskin pickled onion per 700ml of gin, for two hours, before production. Not in the freezer. Filter the onions out of the gin very finely, then add the gin to the vermouth and the water, and bottle straight away. Nothing is added at bottling and nothing goes in the glass.

Onion cost is immaterial and carries no component line. That is deliberate, not an omission.`;

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — Gibson method, recipe ${RECIPE_ID}\n`);
  const [row] = await db.select().from(recipes).where(eq(recipes.id, RECIPE_ID));
  if (!row) throw new Error(`recipe ${RECIPE_ID} not found`);
  console.log(`  drink ${row.drinkId}, version ${row.version}, current ${row.isCurrent}`);

  if (row.method === NEW) {
    console.log("  already corrected — nothing to do");
    return;
  }
  if ((row.method ?? "").trim() !== OLD.trim()) {
    console.log("  !! method is not the expected old text — refused. It reads:\n");
    console.log(row.method);
    process.exitCode = 1;
    return;
  }

  console.log("  old text matches; new text:\n");
  console.log(NEW);
  if (!WRITE) return;

  await db.update(recipes).set({ method: NEW, updatedAt: new Date() }).where(eq(recipes.id, RECIPE_ID));
  const [after] = await db.select().from(recipes).where(eq(recipes.id, RECIPE_ID));
  console.log(`\n  written. "freezer" occurrences: ${(after.method?.match(/freezer/gi) ?? []).length} (expect 1, in "Not in the freezer")`);
}

main().then(() => process.exit());
