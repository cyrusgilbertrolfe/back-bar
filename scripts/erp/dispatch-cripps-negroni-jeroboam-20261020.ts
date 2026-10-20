/**
 * The Cripps Jeroboam Negroni shipment, 20 Oct 2026: 30 × 3L, packed
 * 2 × case of 12 and 1 × case of 6. No purchase order, so it takes our next
 * dispatch number, CRPS-DN#####, for the delivery note and the labels.
 *
 *   npx tsx --env-file=.env.local scripts/erp/dispatch-cripps-negroni-jeroboam-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/dispatch-cripps-negroni-jeroboam-20261020.ts --write  # apply
 *
 * A one-off rather than new-dispatch.ts, which takes one case size per
 * shipment and needs the SKU's short code and case quantity. The 3L SKU has
 * neither yet, and its cases are mixed: one order line per case size.
 */

import { and, eq, like } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const SKU = "negroni-3000-cripps";
const CUSTOMER = "Cripps Barn Group Ltd.";
const DISPATCH = "2026-10-20";
/** Cases by size, in packing order. */
const PACKING = [
  { cases: 2, unitsPerCase: 12 },
  { cases: 1, unitsPerCase: 6 },
];

async function main() {
  const [sku] = await db.select().from(skus).where(eq(skus.code, SKU));
  if (!sku) throw new Error(`SKU ${SKU} not found`);
  const [customer] = await db.select().from(customers).where(eq(customers.name, CUSTOMER));
  if (!customer) throw new Error(`Customer ${CUSTOMER} not found`);

  const taken = await db
    .select({ n: wholesaleOrders.orderNumber })
    .from(wholesaleOrders)
    .where(like(wholesaleOrders.orderNumber, "%-DN_____"));
  const serial = Math.max(0, ...taken.map((r) => Number(r.n.slice(-5))).filter(Number.isFinite)) + 1;
  const orderNumber = `CRPS-DN${String(serial).padStart(5, "0")}`;

  const bottles = PACKING.reduce((n, p) => n + p.cases * p.unitsPerCase, 0);
  const packed = PACKING.map((p) => `${p.cases} × case of ${p.unitsPerCase}`).join(" + ");
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: ${orderNumber} for ${CUSTOMER}, ${packed} (${bottles} bottles) of ${SKU}`);
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");

  const [dup] = await db
    .select()
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, customer.id), eq(wholesaleOrders.orderNumber, orderNumber)));
  if (dup) throw new Error(`${orderNumber} already exists`);

  const [order] = await db
    .insert(wholesaleOrders)
    .values({
      customerId: customer.id,
      orderNumber,
      orderNumberIsOurs: true,
      raisedOn: DISPATCH,
      requestedDeliveryFrom: DISPATCH,
      requestedDeliveryTo: DISPATCH,
      status: "committed",
      notes: `Our dispatch number: no purchase order. Jeroboam Negroni, ${packed}. Cases must travel upright.`,
    })
    .returning();
  const lines = await db
    .insert(wholesaleOrderLines)
    .values(
      PACKING.map((p, i) => ({
        orderId: order.id,
        lineNo: i + 1,
        skuId: sku.id,
        qty: String(p.cases),
        unitDescription: `Case ${p.unitsPerCase}`,
        unitsPerCase: p.unitsPerCase,
      })),
    )
    .returning();
  console.log(`Created order [${order.id}], lines [${lines.map((l) => l.id).join(", ")}]. Labels:`);
  console.log(`  npx tsx --env-file=.env.local scripts/erp/make-up-labels.ts ${orderNumber}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
