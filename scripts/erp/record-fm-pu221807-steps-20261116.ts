/**
 * Fortnum's PU221807 (order 13): the order steps, filled in after the fact.
 *
 *   npx tsx --env-file=.env.local scripts/erp/record-fm-pu221807-steps-20261116.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/record-fm-pu221807-steps-20261116.ts --write  # apply
 *
 * Written 16 Nov 2026. The run was under way before order work was in Back
 * Bar, and enter-fm-pu221807-20261116.ts entered the order from a branch whose
 * schema predated the order steps, so none were set. Sources:
 *   - Prices agreed as the PO states them: Cyrus, 16 Nov 2026.
 *   - Production ongoing; shipment 1 completed 16 Nov 2026: Cyrus. Packing,
 *     pallet build and pallet packed are taken as the same day.
 *   - iForce delivery slot FM131209, Thursday 19 Nov 2026 13:30, Corby
 *     Geddington Road: FandM.Bookings@iforcegroup.com, 11 Nov 2026, thread
 *     1a1ca4f9647f4d86 in cocktails@. Clemency asked for it as "single pallet
 *     delivered via Pallet Track" (thread 1a1ca3fcbff36ca5).
 *   - The balance: 10 Vesper Martini, held for production time before the
 *     Tangier trip (we shipped what was finished); 10 Espresso Daiquiri, the
 *     rum has not arrived. Cyrus, 16 Nov 2026.
 * Not set, no source: the confirmation date, and the Pallet Track collection
 * booking and date.
 *
 * Fills only empty fields; changes nothing already set.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const PO = "PU221807";
const SHIPPED_1 = "2026-11-16";

const FILL = {
  productionOn: SHIPPED_1,
  packingOn: SHIPPED_1,
  palletBuildOn: SHIPPED_1,
  palletPackedOn: SHIPPED_1,
  carrier: "Pallet Track",
  shippingMethod: "pallet",
  waitingOn:
    "The balance: 10 Vesper Martini (production time before the Tangier trip; shipment 1 took what was finished) " +
    "and 10 Espresso Daiquiri (the rum has not arrived).",
} as const;

const BOOKING_NOTE =
  "Shipment 1: iForce delivery slot FM131209, Thu 19 Nov 2026 13:30, Corby Geddington Road (booked 11 Nov); " +
  "one pallet by Pallet Track, collection not recorded. Prices agreed as stated on the PO (Cyrus, 16 Nov 2026).";

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${PO}\n`);
  const [fm] = await db.select().from(customers).where(eq(customers.accountCode, "MY010"));
  const [order] = await db
    .select()
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, fm.id), eq(wholesaleOrders.orderNumber, PO)));
  if (!order) throw new Error(`${PO} not found`);
  console.log(`  order [${order.id}] status ${order.status}`);

  const patch: Partial<typeof wholesaleOrders.$inferInsert> = {};
  for (const [k, v] of Object.entries(FILL) as [keyof typeof FILL, string][]) {
    if (order[k] === null) (patch as Record<string, string>)[k] = v;
    else console.log(`  ${k} already ${order[k]}, left`);
  }
  if (!order.notes?.includes("FM131209")) patch.notes = [order.notes, BOOKING_NOTE].filter(Boolean).join("\n");
  console.log(`  order fill: ${JSON.stringify(patch, null, 2)}`);

  const lines = await db.select().from(wholesaleOrderLines).where(eq(wholesaleOrderLines.orderId, order.id));
  for (const l of lines)
    console.log(`  line ${l.lineNo}: quoted ${l.unitPriceQuoted ?? "—"} ← stated ${l.unitPriceStated}`);

  if (!WRITE) return console.log("\nDry run only. Re-run with --write to apply.");

  if (Object.keys(patch).length) await db.update(wholesaleOrders).set(patch).where(eq(wholesaleOrders.id, order.id));
  for (const l of lines)
    if (l.unitPriceQuoted === null && l.unitPriceStated !== null)
      await db
        .update(wholesaleOrderLines)
        .set({ unitPriceQuoted: l.unitPriceStated })
        .where(and(eq(wholesaleOrderLines.id, l.id), isNull(wholesaleOrderLines.unitPriceQuoted)));
  console.log("\nDONE.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
