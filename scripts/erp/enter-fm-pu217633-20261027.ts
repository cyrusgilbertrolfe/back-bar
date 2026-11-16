/**
 * Fortnum's PO PU217633, the Christmas Gingertini, so its case labels print.
 *
 *   npx tsx --env-file=.env.local scripts/erp/enter-fm-pu217633-20261027.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/enter-fm-pu217633-20261027.ts --write  # apply
 *
 * Written 27 Oct 2026, when wave 1 was ready to go. Held until after the run
 * on Cyrus's ruling of 19 Sep 2026, so the labels could not be printed early.
 * Sources:
 *   - PU217633 amend.pdf, Abbie Johnson, 4 Sep 2026: one line, F&M item
 *     5246820, "Gingertini Christmas Cocktail 17.6% 50cl", 63 x Case 12,
 *     £0.00, to iForce Corby DC2 between 26 and 30 Oct 2026. Read off the
 *     Lifemaxxing BoM of 29 Sep 2026, which copied it from the PDF.
 *   - The description is entered as "Christmas Gingertini", not the PO's
 *     word order: the drink is officially Christmas Gingertini (Cyrus,
 *     27 Oct 2026). The SKU carries the same, so the label prints.
 *   - The split delivery agreed with Fortnum's (Cyrus, 22 Oct 2026). The line
 *     stays at the PO's 63; each shipment prints its own labels with
 *     make-case-labels.ts --cases=N.
 *
 * Creates the order only if it is not there; never edits one that is.
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — PU217633\n`);

  const [sku] = await db.select().from(skus).where(eq(skus.code, "christmas-gingertini-500-fm"));
  if (!sku) throw new Error("SKU christmas-gingertini-500-fm not found");
  const [fm] = await db.select().from(customers).where(eq(customers.accountCode, "MY010"));
  if (!fm) throw new Error("Customer MY010 not found");

  const existing = await db
    .select()
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, fm.id), eq(wholesaleOrders.orderNumber, "PU217633")));
  if (existing.length) {
    console.log(`  order PU217633 exists [${existing[0].id}] — left untouched`);
    return;
  }

  console.log(`  order PU217633: CREATE, 1 line, Gingertini 63 x Case 12, SKU [${sku.id}]`);
  if (WRITE) {
    const [order] = await db
      .insert(wholesaleOrders)
      .values({
        customerId: fm.id,
        orderNumber: "PU217633",
        raisedOn: "2026-09-04",
        documentRef: "PU217633 amend.pdf",
        status: "in_production",
        requestedDeliveryFrom: "2026-10-26",
        requestedDeliveryTo: "2026-10-30",
        deliveryAddress:
          "iForce House, Unit 1 Ore Lane, Delivery Door D, Midlands Logistics Park, Corby NN18 8ET. Warehouse DC2.",
        notes:
          "As amended 4 Sep 2026; the Gingertini line moved here from PU215780 on 2 Sep. Delivery split in " +
          "two, agreed 22 Oct 2026 because the gin came short. Wave 1: 30 cases (Cyrus, 27 Oct 2026).",
      })
      .returning();
    const [line] = await db
      .insert(wholesaleOrderLines)
      .values({
        orderId: order.id,
        lineNo: 1,
        customerItemCode: "5246820",
        customerDescription: "Christmas Gingertini Cocktail 17.6% 50cl",
        skuId: sku.id,
        qty: "63",
        unitDescription: "Case 12",
        unitsPerCase: 12,
        unitPriceStated: "0",
      })
      .returning();
    console.log(`  created order [${order.id}], line [${line.id}]`);
  }

  console.log(WRITE ? "\nDONE." : "\nDry run only. Re-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
