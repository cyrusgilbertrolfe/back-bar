/**
 * Give a record to five prices that were in use with nothing behind them, on
 * Cyrus's ruling in the week 3 review (2 Oct 2026): "if these are not present,
 * let's adopt".
 *
 *   npx tsx --env-file=.env.local scripts/erp/adopt-prices-20261002.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/adopt-prices-20261002.ts --write  # apply
 *
 * Each row records the price ALREADY IN USE, so no COGS moves:
 *
 *   - 250ml bottle, £0.62 each including the lid (Cyrus; the Chinese invoices
 *     hold the detail and can replace this when found).
 *   - Rye, which is Bulleit Rye, £28.02 per 700ml: last-known, held per the
 *     17 Jul 2026 reconciliation ("re-check on next order").
 *   - 3L Big Joe bottle, £11.83 landed, and its tapered cork, £0.26: the World
 *     of Bottles basket quoted 14 Aug 2026, as each component's notes record.
 *     The invoices are in the Cocktails mailbox and can replace these.
 *   - EPR on the 3L Big Joe, £0.29: recorded as a PLACEHOLDER, because the
 *     component's own note says it is inferred from shipment weight, not
 *     sourced.
 *
 * The one price that changes, the F&M 12-box carton (£1.35 to £1.60, Cyrus),
 * goes through the app's own price writer instead, so it is not here.
 *
 * Left unsourced on purpose: the 250ml back label (no figure given) and
 * Cotswold Whisky (waiting on an invoice).
 *
 * Refuses rather than guesses: a component is written only if its price in use
 * still equals the figure below, and a row already recorded is not repeated.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { componentPriceHistory, components } from "../../src/db/schema";
import { perUomCost } from "../../src/lib/erp/ingredients";

const WRITE = process.argv.includes("--write");

const ADOPT: {
  id: number;
  name: string;
  expectPerUom: number;
  effective: string;
  source: "manual" | "placeholder";
  note: string;
}[] = [
  {
    id: 11,
    name: "250ml bottle",
    expectPerUom: 0.62,
    effective: "2026-10-02",
    source: "manual",
    note: "£0.62 each including the lid (Cyrus, 2 Oct 2026, week 3 review). From the Chinese supplier invoices, not yet found; replace with the invoice when it is.",
  },
  {
    id: 3,
    name: "Rye",
    expectPerUom: 28.02 / 700,
    effective: "2026-10-02",
    source: "manual",
    note: "Bulleit Rye (Cyrus, 2 Oct 2026). £28.02 per 700ml, last-known, held per the 17 Jul 2026 price reconciliation: re-check on next order.",
  },
  {
    id: 98,
    name: "3L Big Joe bottle (World of Bottles 100017490)",
    expectPerUom: 11.83,
    effective: "2026-08-14",
    source: "manual",
    note: "World of Bottles basket, 30 units, quoted 14 Aug 2026: £10.2083 ex VAT plus £1.6183 inbound freight, landed £11.83 (see component notes). Adopted on Cyrus's ruling, 2 Oct 2026; the WoB invoices are in the Cocktails mailbox.",
  },
  {
    id: 99,
    name: "Tapered cork 25-35 x 27 (World of Bottles 100002310)",
    expectPerUom: 0.26,
    effective: "2026-08-14",
    source: "manual",
    note: "World of Bottles basket, 30 units, quoted 14 Aug 2026, £0.2583 ex VAT. Adopted on Cyrus's ruling, 2 Oct 2026; the WoB invoices are in the Cocktails mailbox.",
  },
  {
    id: 101,
    name: "EPR - 3L Big Joe (glass+cork)",
    expectPerUom: 0.29,
    effective: "2026-08-14",
    source: "placeholder",
    note: "PLACEHOLDER, as the component's own note says: inferred from World of Bottles shipment weight, not sourced. Recorded 2 Oct 2026 so it reads as a placeholder rather than unsourced.",
  },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: adopt prices, week 3 review\n`);
  let written = 0;

  for (const a of ADOPT) {
    const [c] = await db.select().from(components).where(eq(components.id, a.id));
    if (!c || c.name !== a.name) {
      console.log(`REFUSED  #${a.id}: expected "${a.name}", found "${c?.name ?? "nothing"}"`);
      continue;
    }
    const inUse = perUomCost(c);
    if (Math.abs(inUse - a.expectPerUom) > 0.0001) {
      console.log(`REFUSED  ${a.name}: price in use ${inUse.toFixed(5)} is not ${a.expectPerUom.toFixed(5)}`);
      continue;
    }
    const unitCost = inUse.toFixed(4);
    const already = await db
      .select()
      .from(componentPriceHistory)
      .where(
        and(
          eq(componentPriceHistory.componentId, c.id),
          eq(componentPriceHistory.effectiveDate, a.effective),
          eq(componentPriceHistory.unitCost, unitCost),
        ),
      );
    if (already.length > 0) {
      console.log(`SKIPPED  ${a.name}: already recorded at ${unitCost} on ${a.effective}`);
      continue;
    }
    console.log(`${WRITE ? "WRITE   " : "WOULD   "} ${a.name} (#${c.id}): ${a.source} ${unitCost}/${c.uom}, ${a.effective}`);
    if (WRITE) {
      await db.insert(componentPriceHistory).values({
        componentId: c.id,
        supplierId: c.defaultSupplierId,
        unitCost,
        uom: c.uom,
        effectiveDate: a.effective,
        source: a.source,
        notes: a.note,
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
