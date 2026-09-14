/**
 * Reconcile component costs against Matthew Clark's price-change letter.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-mc-price-letter-20260302.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-mc-price-letter-20260302.ts --write  # apply
 *
 * Written 13 Sept 2026. The letter (to account 50900601, dated 11 Feb 2026)
 * lists every product recently bought, with its current price and the price
 * from 2 Mar 2026. It is a primary document addressed to this account, so it
 * can do two jobs for the cost side of the bedrock:
 *
 * 1. SOURCE. A component whose cost already equals the letter's new price, but
 *    which has no price history at all, gets a `manual` history row citing the
 *    letter. The app reads price provenance from the newest history row
 *    (src/lib/erp/ingredients.ts), so until now those costs showed as
 *    unsourced even though they were right. The cost itself does not change.
 *
 * 2. STALE. A component still holding the letter's pre-March price is updated
 *    to the new one, with a history row saying so. The row is dated today
 *    rather than 2 Mar, so it cannot sort behind an older row and leave the
 *    newest history entry disagreeing with the cached cost.
 *
 * Anything that matches neither the old nor the new price is FLAGGED and left
 * alone. It may be bought elsewhere, or entered from a different document, and
 * a price list is not evidence of what was actually paid. Pack-size mismatches
 * are flagged the same way: a different pack is a different line.
 *
 * Idempotent: a component already carrying the new price with a history row is
 * reported and skipped.
 */

import { desc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);
const LETTER =
  "Matthew Clark price-change letter to account 50900601, dated 11 Feb 2026, prices effective 2 Mar 2026";

type Line = {
  /** Back Bar component name. */
  name: string;
  code: string;
  description: string;
  packMl: number;
  oldPrice: string;
  newPrice: string;
};

const LINES: Line[] = [
  { name: "Rye", code: "28548", description: "BULLEIT RYE 70X6", packMl: 700, oldPrice: "27.02", newPrice: "28.02" },
  { name: "Blue Curaçao", code: "43457", description: "BOLS BLUE CURACAO 50X6", packMl: 500, oldPrice: "11.66", newPrice: "11.73" },
  { name: "Kahlua", code: "40723", description: "KAHLUA COFFEE LIQUEUR 70x6", packMl: 700, oldPrice: "13.17", newPrice: "13.43" },
  { name: "Old Tom Gin", code: "36062", description: "HAYMANS OLD TOM 70X6", packMl: 700, oldPrice: "20.33", newPrice: "20.74" },
  { name: "Luxardo Maraschino", code: "36601", description: "LUXARDO MARASCHINO 70X6", packMl: 700, oldPrice: "26.00", newPrice: "27.03" },
  { name: "Lychee Liqueur", code: "15655", description: "KWAI FEH LYCHEE LIQUEUR 70x6", packMl: 700, oldPrice: "17.15", newPrice: "17.85" },
  { name: "Chinotto Nero", code: "39471", description: "MUYU CHINOTTO NERO LIQU 50X6", packMl: 500, oldPrice: "22.57", newPrice: "23.67" },
  { name: "Triple Sec", code: "10637", description: "COINTREAU 70x6", packMl: 700, oldPrice: "21.56", newPrice: "21.62" },
  { name: "Yellow Chartreuse", code: "45607", description: "CHARTREUSE YELLOW 70X6", packMl: 700, oldPrice: "29.37", newPrice: "36.68" },
  { name: "Havana Club 7", code: "15754", description: "HAVANA CLUB 7YO 70x6", packMl: 700, oldPrice: "20.64", newPrice: "21.05" },
  { name: "Mount Gay Rum", code: "47690", description: "MOUNTGAY ECLIPSE RUM 37.5%70X6", packMl: 700, oldPrice: "17.12", newPrice: "17.46" },
  { name: "Tequila Reposado", code: "30852", description: "ESPOLON REPOSADO 70X6", packMl: 700, oldPrice: "26.35", newPrice: "26.88" },
  { name: "Epsolon Blanco Tequila", code: "30858", description: "ESPOLON BLANCO 70X6", packMl: 700, oldPrice: "23.34", newPrice: "23.80" },
  { name: "Mezcal", code: "32397", description: "DEL MAGUEY MEZCAL VIDA 70X6", packMl: 700, oldPrice: "35.10", newPrice: "35.80" },
  { name: "Punt e Mes", code: "15403", description: "PUNT E MES 75x6", packMl: 750, oldPrice: "10.61", newPrice: "10.96" },
  { name: "Lillet Blanc", code: "25953", description: "LILLET BLANC 75x6", packMl: 750, oldPrice: "14.14", newPrice: "14.42" },
  { name: "Noilly Prat", code: "20057", description: "NOILLY PRAT DRY 75x6", packMl: 750, oldPrice: "12.29", newPrice: "12.77" },
  { name: "Carpano Antica Formula Vermouth", code: "30013", description: "ANTICA FORMULA 1LX6", packMl: 1000, oldPrice: "23.85", newPrice: "24.70" },
  { name: "Cocchi Americano", code: "33463", description: "COCCHI VERMOUTH AMERICANO 75x6", packMl: 750, oldPrice: "18.60", newPrice: "19.80" },
  { name: "Campari", code: "15394", description: "CAMPARI 70x6", packMl: 700, oldPrice: "14.71", newPrice: "15.17" },
  { name: "Aperol", code: "20110", description: "APEROL APERITIVO 70x6", packMl: 700, oldPrice: "12.85", newPrice: "13.10" },
];

const same = (a: string | number | null | undefined, b: string | number) =>
  a != null && Number(a) === Number(b);

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${LETTER}\n`);

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));
  let sourced = 0, updated = 0, flagged = 0, fine = 0;

  for (const line of LINES) {
    const c = byName.get(line.name);
    if (!c) {
      console.log(`  !! ${line.name}: component not found`);
      flagged++;
      continue;
    }
    const label = `${line.name.padEnd(32)} ${line.description}`;

    if (!same(c.packSize, line.packMl)) {
      console.log(`  !! ${label}: pack ${c.packSize}${c.uom} in Back Bar vs ${line.packMl}ml on the letter — left alone`);
      flagged++;
      continue;
    }

    const [newest] = await db
      .select()
      .from(componentPriceHistory)
      .where(eq(componentPriceHistory.componentId, c.id))
      .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id))
      .limit(1);

    if (same(c.packCost, line.newPrice)) {
      if (newest) {
        console.log(`  =  ${label}: £${c.packCost} matches, already has history [${newest.source}]`);
        fine++;
        continue;
      }
      console.log(`  +  ${label}: £${c.packCost} matches, but has NO price history — adding source`);
      sourced++;
      if (WRITE) {
        await db.insert(componentPriceHistory).values({
          componentId: c.id,
          supplierId: c.defaultSupplierId,
          unitCost: c.unitCost,
          currency: "GBP",
          uom: c.uom,
          effectiveDate: "2026-03-02",
          source: "manual",
          sourceId: null,
          notes: `Source added 13 Sept 2026: ${LETTER}. Line ${line.code} ${line.description}, £${line.newPrice}. Cost unchanged; it had no recorded source.`,
        });
      }
      continue;
    }

    if (same(c.packCost, line.oldPrice)) {
      const unitCost = (Number(line.newPrice) / line.packMl).toFixed(4);
      console.log(`  ~  ${label}: £${c.packCost} is the PRE-March price -> £${line.newPrice}`);
      updated++;
      if (WRITE) {
        await db.insert(componentPriceHistory).values({
          componentId: c.id,
          supplierId: c.defaultSupplierId,
          unitCost,
          currency: "GBP",
          uom: c.uom,
          effectiveDate: TODAY,
          source: "manual",
          sourceId: null,
          notes: `${LETTER}. Line ${line.code} ${line.description}: £${line.oldPrice} -> £${line.newPrice}. Back Bar still held the pre-change price.`,
        });
        await db
          .update(components)
          .set({ packCost: line.newPrice, unitCost, unitCostSetAt: new Date(), updatedAt: new Date() })
          .where(eq(components.id, c.id));
      }
      continue;
    }

    console.log(`  !! ${label}: Back Bar £${c.packCost} matches neither £${line.oldPrice} (old) nor £${line.newPrice} (new) — left alone`);
    flagged++;
  }

  console.log(`\n${fine} already fine · ${sourced} given a source · ${updated} updated from stale · ${flagged} flagged`);
  console.log(WRITE ? "Done." : "Dry run only — nothing written. Re-run with --write.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
