/**
 * Record the price-history rows the 20 Jul 2026 price reconciliation never
 * wrote, for the three components whose price in use is right but whose newest
 * history row still describes the old price.
 *
 *   npx tsx --env-file=.env.local scripts/erp/backfill-price-history-20261002.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/backfill-price-history-20261002.ts --write  # apply
 *
 * Written 2 Oct 2026, during the week 3 review (cost provenance). A read of the
 * live data found 4 of 91 active components whose price in use differs from
 * their newest history row. The reconciliation record
 * (Lifemaxxing, Projects/Cocktails/Back Bar/2026-07-17 Ingredient price
 * reconciliation [Back Bar to Books standard, working].md) settles three:
 *
 *   - Luxardo Maraschino: £27.03 per 700ml. The history row is £27.03 over
 *     500ml, the bottle-size error the reconciliation corrected.
 *   - Manzanilla (La Guita): £11.25 per 750ml, up 15.4% from £9.75, which is
 *     what the history row still says.
 *   - Gin (in-house): £22.50 per litre, MFC's own recipe made by 58 & Co.
 *
 * Each gets one `manual` row at the price already in use, dated 20 Jul 2026,
 * with a note naming the reconciliation. No price in use changes, so no COGS
 * changes; only the record behind the price does.
 *
 * Deliberately left alone: Cotswold Whisky (Fortnum's English Single Malt).
 * Nothing records its current price, so it stays unsourced until an invoice is
 * found (Cyrus, 2 Oct 2026). The week 3 guard already shows it as unsourced.
 *
 * Refuses rather than guesses: a component is written only if its price in use
 * still equals the figure the reconciliation gives, and a row already recorded
 * on 20 Jul at that price is not written twice.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { componentPriceHistory, components } from "../../src/db/schema";
import { perUomCost } from "../../src/lib/erp/ingredients";

const WRITE = process.argv.includes("--write");
const EFFECTIVE = "2026-07-20";
const RECORD =
  "2026-07-17 Ingredient price reconciliation [Back Bar to Books standard, working].md";

const FIXES: { name: string; expectPerUom: number; note: string }[] = [
  {
    name: "Luxardo Maraschino",
    expectPerUom: 27.03 / 700,
    note: `£27.03 per 700ml. The 20 Jul 2026 reconciliation corrected the bottle size from 500ml to 700ml and updated the price in use without writing this row; backfilled 2 Oct 2026. Source: ${RECORD}`,
  },
  {
    name: "Manzanilla",
    expectPerUom: 11.25 / 750,
    note: `La Guita, £11.25 per 750ml, up 15.4% from £9.75. Set by the 20 Jul 2026 reconciliation without writing this row; backfilled 2 Oct 2026. Source: ${RECORD}`,
  },
  {
    name: "Gin (in-house)",
    expectPerUom: 22.5 / 1000,
    note: `£22.50 per litre, MFC's own recipe made by 58 & Co. Set by the 20 Jul 2026 reconciliation without writing this row; backfilled 2 Oct 2026. Source: ${RECORD}`,
  },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: price-history backfill, effective ${EFFECTIVE}\n`);
  let written = 0;

  for (const f of FIXES) {
    const found = await db.select().from(components).where(eq(components.name, f.name));
    if (found.length !== 1) {
      console.log(`REFUSED  ${f.name}: expected one component, found ${found.length}`);
      continue;
    }
    const c = found[0];
    const inUse = perUomCost(c);
    if (Math.abs(inUse - f.expectPerUom) > 0.0001) {
      console.log(
        `REFUSED  ${f.name} (#${c.id}): price in use ${inUse.toFixed(5)} is not the reconciled ${f.expectPerUom.toFixed(5)}`,
      );
      continue;
    }
    const unitCost = inUse.toFixed(4);
    const already = await db
      .select()
      .from(componentPriceHistory)
      .where(
        and(
          eq(componentPriceHistory.componentId, c.id),
          eq(componentPriceHistory.effectiveDate, EFFECTIVE),
          eq(componentPriceHistory.unitCost, unitCost),
        ),
      );
    if (already.length > 0) {
      console.log(`SKIPPED  ${f.name} (#${c.id}): already recorded at ${unitCost} on ${EFFECTIVE}`);
      continue;
    }
    console.log(`${WRITE ? "WRITE   " : "WOULD   "} ${f.name} (#${c.id}): manual ${unitCost}/${c.uom}, ${EFFECTIVE}`);
    if (WRITE) {
      await db.insert(componentPriceHistory).values({
        componentId: c.id,
        supplierId: c.defaultSupplierId,
        unitCost,
        uom: c.uom,
        effectiveDate: EFFECTIVE,
        source: "manual",
        notes: f.note,
      });
      written++;
    }
  }

  console.log(`\n${WRITE ? `${written} row(s) written.` : "Dry run: nothing written. Re-run with --write to apply."}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
