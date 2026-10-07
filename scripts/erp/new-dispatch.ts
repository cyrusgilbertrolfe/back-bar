/**
 * Number a shipment for a customer who issues no purchase order, so its case
 * labels can be printed from the drink page like any PO.
 *
 *   npx tsx --env-file=.env.local scripts/erp/new-dispatch.ts <sku-code> <cases> <dispatch-date>          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/new-dispatch.ts <sku-code> <cases> <dispatch-date> --write  # apply
 *
 *   e.g. new-dispatch.ts espresso-martini-700-cripps 27 2026-10-09 --write
 *
 * The dispatch number is the SKU's client prefix, "-DN" and a five-digit
 * serial shared by every customer: CRPS-DN00001. Agreed by Cyrus 7 Oct 2026
 * for Cripps, whose orders arrive on demand with no PO. The number goes on the
 * case labels, the delivery note and the QuickBooks invoice memo, so a box can
 * be matched to its invoice. Assigned once, never reused.
 *
 * Cripps ship on demand and only a few times a year, so this is a script
 * rather than a screen. Build a screen if that changes.
 */

import { and, eq, like } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WRITE = process.argv.includes("--write");
const [skuCode, casesRaw, dispatchDate] = args;

/** The customer a client's no-PO shipments are made out to, keyed by client name. */
const CUSTOMER_FOR_CLIENT: Record<string, string> = { Cripps: "Cripps Barn Group Ltd." };

async function main() {
  const cases = Number(casesRaw);
  if (!skuCode || !Number.isInteger(cases) || cases < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate ?? "")) {
    throw new Error("Usage: new-dispatch.ts <sku-code> <cases> <YYYY-MM-DD> [--write]");
  }

  const [sku] = await db
    .select({ id: skus.id, code: skus.code, shortCode: skus.shortCode, unitsPerCase: skus.unitsPerCase, client: clients.name })
    .from(skus)
    .innerJoin(clients, eq(clients.id, skus.clientId))
    .where(eq(skus.code, skuCode));
  if (!sku) throw new Error(`SKU ${skuCode} not found`);
  if (!sku.shortCode || !sku.unitsPerCase) throw new Error(`${skuCode} needs a short code and a case quantity first`);

  const customerName = CUSTOMER_FOR_CLIENT[sku.client];
  if (!customerName) throw new Error(`No no-PO customer is set up for client ${sku.client}`);
  const [customer] = await db.select().from(customers).where(eq(customers.name, customerName));
  if (!customer) throw new Error(`Customer ${customerName} not found; run the Cripps seed first`);
  if (customer.issuesPurchaseOrders) throw new Error(`${customerName} issues purchase orders: enter the PO instead`);

  const prefix = sku.shortCode.split("-")[0];
  const taken = await db
    .select({ n: wholesaleOrders.orderNumber })
    .from(wholesaleOrders)
    .where(like(wholesaleOrders.orderNumber, "%-DN_____"));
  const serial = Math.max(0, ...taken.map((r) => Number(r.n.slice(-5))).filter(Number.isFinite)) + 1;
  const orderNumber = `${prefix}-DN${String(serial).padStart(5, "0")}`;

  console.log(
    `${WRITE ? "APPLYING" : "DRY RUN"}: ${orderNumber} for ${customerName}, ` +
      `${cases} × case of ${sku.unitsPerCase} (${cases * sku.unitsPerCase} bottles) of ${sku.code}, dispatching ${dispatchDate}`,
  );
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
      raisedOn: dispatchDate,
      requestedDeliveryFrom: dispatchDate,
      requestedDeliveryTo: dispatchDate,
      status: "committed",
      notes: `Our dispatch number: ${customerName} issue no purchase order. Dispatch ${dispatchDate}.`,
    })
    .returning();
  const [line] = await db
    .insert(wholesaleOrderLines)
    .values({
      orderId: order.id,
      lineNo: 1,
      skuId: sku.id,
      qty: String(cases),
      unitDescription: `Case ${sku.unitsPerCase}`,
      unitsPerCase: sku.unitsPerCase,
    })
    .returning();
  console.log(`Created order [${order.id}], line [${line.id}]. Print from the drink page, or:`);
  console.log(`  npx tsx --env-file=.env.local scripts/erp/make-case-labels.ts ${line.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
