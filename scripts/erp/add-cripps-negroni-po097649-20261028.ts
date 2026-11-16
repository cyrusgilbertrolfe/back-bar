/**
 * PO 097649 from Cripps, dispatching 29 October 2026, carries two products:
 * 228 Espresso Martini (entered by new-dispatch.ts as order 6, line 8) and
 * 24 Negroni 70cl. new-dispatch.ts makes a one-line order, so this adds the
 * Negroni as line 2 of the same order.
 *
 * The 70cl Negroni had no case quantity; Cyrus gave case size 6 on 28 October
 * 2026, so 24 bottles is 4 × case of 6. Its label description follows the
 * Espresso Martini's, "Negroni 70cl".
 *
 *   npx tsx --env-file=.env.local scripts/erp/add-cripps-negroni-po097649-20261028.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/add-cripps-negroni-po097649-20261028.ts --write  # apply
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const PO = "097649";
const SKU = "negroni-700-cripps";
const UNITS_PER_CASE = 6;
const CASES = 4;
const DESCRIPTION = "Negroni 70cl";

async function main() {
  const [customer] = await db.select().from(customers).where(eq(customers.name, "Cripps Barn Group Ltd."));
  const [order] = await db
    .select()
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, customer.id), eq(wholesaleOrders.orderNumber, PO)));
  if (!order) throw new Error(`Order ${PO} not found; enter the Espresso Martini with new-dispatch.ts first`);
  const [sku] = await db.select().from(skus).where(eq(skus.code, SKU));
  if (!sku) throw new Error(`SKU ${SKU} not found`);
  const lines = await db.select().from(wholesaleOrderLines).where(eq(wholesaleOrderLines.orderId, order.id));
  if (lines.some((l) => l.skuId === sku.id)) throw new Error(`${PO} already has a ${SKU} line`);

  console.log(
    `${WRITE ? "APPLYING" : "DRY RUN"}: ${SKU} case quantity ${sku.unitsPerCase ?? "unset"} → ${UNITS_PER_CASE}; ` +
      `${PO} line ${lines.length + 1}: ${CASES} × case of ${UNITS_PER_CASE} (${CASES * UNITS_PER_CASE} bottles)`,
  );
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");

  await db.update(skus).set({ customerDescription: DESCRIPTION, unitsPerCase: UNITS_PER_CASE, updatedAt: new Date() }).where(eq(skus.id, sku.id));
  const [line] = await db
    .insert(wholesaleOrderLines)
    .values({
      orderId: order.id,
      lineNo: lines.length + 1,
      skuId: sku.id,
      qty: String(CASES),
      unitDescription: `Case ${UNITS_PER_CASE}`,
      unitsPerCase: UNITS_PER_CASE,
    })
    .returning();
  console.log(`Created line [${line.id}]. Print with:`);
  console.log(`  npx tsx --env-file=.env.local scripts/erp/make-case-labels.ts ${line.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
