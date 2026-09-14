/**
 * READ-ONLY report: component costs set against Matthew Clark's price-change letter.
 *
 *   npx tsx --env-file=.env.local scripts/erp/report-mc-price-letter-20260302.ts
 *
 * Replaces seed-mc-price-letter-20260302.ts, which wrote to the database and
 * was wrong to. That script used the letter (to account 50900601, dated 11 Feb
 * 2026, prices effective 2 Mar 2026) as a source for what Myatt's Fields pays.
 * It is not. Cyrus, 13 Sept 2026: "Just because we have a price from Matthew
 * Clark doesn't mean we buy from them" — and there are better prices elsewhere.
 * A supplier's list price describes what that supplier would charge. It says
 * nothing about where the business actually buys or at what price.
 *
 * The earlier script's own header said as much ("a price list is not evidence
 * of what was actually paid") and then applied the letter anyway: it moved
 * Chinotto Nero's cost to the letter's new price and gave Rye, Campari and
 * Lillet Blanc a `manual` source citing the letter. Both have been corrected.
 *
 * What the letter IS good for, and all this report does:
 *
 *   - IDENTITY. A recorded cost that equals a Matthew Clark line to the penny
 *     was almost certainly entered from that line, which ties the component to
 *     that product. That is evidence of where a number came from, not of the
 *     current supplier or the current price.
 *   - A PROMPT. A recorded cost that equals the letter's pre-March price is a
 *     cost that has not been looked at since before March. That is worth
 *     asking about. It is not grounds to change it.
 *
 * This script never writes. Costs change only from evidence of an actual
 * purchase: an invoice or receipt from whoever was actually paid.
 */

import { desc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory } from "../../src/db/schema";

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
  console.log(`REPORT ONLY — nothing is written.\n${LETTER}`);
  console.log("A list price is not evidence of what we pay. Matches show where a recorded cost came from.\n");

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));

  for (const line of LINES) {
    const c = byName.get(line.name);
    if (!c) {
      console.log(`  ?  ${line.name}: component not found`);
      continue;
    }
    const [newest] = await db
      .select()
      .from(componentPriceHistory)
      .where(eq(componentPriceHistory.componentId, c.id))
      .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id))
      .limit(1);
    const prov = newest?.source ?? "none";
    const label = `${line.name.padEnd(32)} £${String(c.packCost).padStart(6)} [${prov}]`;

    let verdict: string;
    if (!same(c.packSize, line.packMl)) verdict = `pack differs: ${c.packSize}${c.uom} vs ${line.packMl}ml on the letter`;
    else if (same(c.packCost, line.newPrice)) verdict = `equals MC list from Mar 2026 (${line.description})`;
    else if (same(c.packCost, line.oldPrice)) verdict = `equals MC list from BEFORE Mar 2026 — not reviewed since`;
    else verdict = `matches neither MC list price (£${line.oldPrice} / £${line.newPrice}) — likely bought elsewhere`;
    console.log(`  ${label}  ${verdict}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
