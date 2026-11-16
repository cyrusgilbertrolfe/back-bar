/**
 * Fortnum's PO PU221807 (Vesper Martini, Espresso Daiquiri, Robin Roy,
 * Myatt's Fields Negroni 250ml), and the case labels for the first, part
 * shipment.
 *
 *   npx tsx --env-file=.env.local scripts/erp/enter-fm-pu221807-20261116.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/enter-fm-pu221807-20261116.ts --write  # apply + print
 *
 * Written 16 Nov 2026. Sources:
 *   - PU221807.pdf, Abbie Johnson, 16 Oct 2026, thread 1a1443e6987806bd in
 *     cocktails@myattsfields.london. Four lines, all Case 12; descriptions
 *     copied off the PDF verbatim. Requested delivery 2 to 6 Nov 2026.
 *   - Delivery moved to w/c 16 Nov: Abbie Johnson, 30 Oct 2026, same thread,
 *     "I have amended the PO and pushed the delivery to w/c 16th". The amended
 *     PDF was not sent, so the dates below are hers, not read off a PO.
 *   - Part shipment, Cyrus 16 Nov 2026, while more ingredients arrive:
 *     15 Espresso Daiquiri, 3 Robin Roy, 15 Vesper Martini, 5 Negroni (MF
 *     label). The lines stay at the PO's quantities; each shipment prints its
 *     own labels, CASE n OF this shipment, as PU217633 did.
 *   - The Negroni is our own-brand bottle (MYFL-NEGR-0250), so Fortnum's
 *     identity for it lives on the order line, not on the own-brand SKU,
 *     which every customer buys. Its labels are built from the line.
 *
 * Fills only empty SKU fields; creates the order only if it is not there.
 */

import { writeFile } from "node:fs/promises";

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";
import { getCaseLabelLine } from "../../src/lib/labels/case-label-data";
import { buildCaseLabelsPdf, type CaseLabelFacts } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const WRITE = process.argv.includes("--write");
const PO = "PU221807";

type Line = {
  lineNo: number;
  skuCode: string;
  itemCode: string;
  description: string;
  cases: number;
  price: string;
  shipNow: number;
  /** Fortnum's identity goes on the SKU only when the SKU is theirs. */
  fortnumsSku: boolean;
};

const LINES: Line[] = [
  { lineNo: 1, skuCode: "vesper-martini-350-fm", itemCode: "5086516", description: "Vesper Martini 35cl 34.2% ABV", cases: 25, price: "166.32", shipNow: 15, fortnumsSku: true },
  { lineNo: 2, skuCode: "espresso-daiquiri-350-fm", itemCode: "5086517", description: "Espresso Daiquiri 35cl 20.2% ABV", cases: 25, price: "174.24", shipNow: 15, fortnumsSku: true },
  { lineNo: 3, skuCode: "robin-roy-350-fm", itemCode: "5086518", description: "Robin Roy 35cl 30.8% ABV", cases: 3, price: "175.68", shipNow: 3, fortnumsSku: true },
  { lineNo: 4, skuCode: "negroni-250", itemCode: "5221590", description: "Myatt's Fields Negroni 250ml", cases: 5, price: "124.82", shipNow: 5, fortnumsSku: false },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ${PO}\n`);

  const [fm] = await db.select().from(customers).where(eq(customers.accountCode, "MY010"));
  if (!fm) throw new Error("Customer MY010 not found");

  const skuIds = new Map<string, number>();
  for (const l of LINES) {
    const [s] = await db.select().from(skus).where(eq(skus.code, l.skuCode));
    if (!s) throw new Error(`SKU ${l.skuCode} not found`);
    skuIds.set(l.skuCode, s.id);
    if (!l.fortnumsSku) continue;
    const patch: Partial<typeof skus.$inferInsert> = {};
    if (!s.customerItemCode) patch.customerItemCode = l.itemCode;
    else if (s.customerItemCode !== l.itemCode) throw new Error(`${l.skuCode} has item ${s.customerItemCode}; PO says ${l.itemCode}`);
    if (!s.customerDescription) patch.customerDescription = l.description;
    if (!s.unitsPerCase) patch.unitsPerCase = 12;
    console.log(`  SKU ${l.skuCode}: ${Object.keys(patch).length ? `fill ${JSON.stringify(patch)}` : "already complete"}`);
    if (WRITE && Object.keys(patch).length) await db.update(skus).set(patch).where(eq(skus.id, s.id));
  }

  const existing = await db
    .select()
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, fm.id), eq(wholesaleOrders.orderNumber, PO)));
  let orderId = existing[0]?.id;
  if (orderId) console.log(`  order ${PO} exists [${orderId}] — left untouched`);
  else {
    console.log(`  order ${PO}: CREATE, ${LINES.length} lines`);
    if (WRITE) {
      const [order] = await db
        .insert(wholesaleOrders)
        .values({
          customerId: fm.id,
          orderNumber: PO,
          raisedOn: "2026-10-16",
          sourceThreadId: "1a1443e6987806bd",
          documentRef: "PU221807.pdf",
          status: "in_production",
          requestedDeliveryFrom: "2026-11-16",
          requestedDeliveryTo: "2026-11-20",
          deliveryAddress:
            "iForce House, Unit 1 Ore Lane, Delivery Door D, Midlands Logistics Park, Corby NN18 8ET. Warehouse DC2.",
          notes:
            "PO requested 2 to 6 Nov 2026; Fortnum's moved delivery to w/c 16 Nov (Abbie Johnson, 30 Oct 2026). " +
            "Part shipment 1 (Cyrus, 16 Nov 2026), while more ingredients arrive: 15 Vesper Martini, " +
            "15 Espresso Daiquiri, 3 Robin Roy, 5 Negroni. Balance: 10 Vesper Martini, 10 Espresso Daiquiri.",
        })
        .returning();
      orderId = order.id;
      for (const l of LINES)
        await db.insert(wholesaleOrderLines).values({
          orderId,
          lineNo: l.lineNo,
          customerItemCode: l.itemCode,
          customerDescription: l.description,
          skuId: skuIds.get(l.skuCode)!,
          qty: String(l.cases),
          unitDescription: "Case 12",
          unitsPerCase: 12,
          unitPriceStated: l.price,
        });
      console.log(`  created order [${orderId}]`);
    }
  }

  if (!WRITE || !orderId) {
    console.log("\nDry run only. Re-run with --write to apply and print.");
    return;
  }

  const fonts = await loadBrandFonts();
  const lines = await db.select().from(wholesaleOrderLines).where(eq(wholesaleOrderLines.orderId, orderId));
  for (const l of LINES) {
    const row = lines.find((r) => r.lineNo === l.lineNo)!;
    let facts: CaseLabelFacts;
    if (l.fortnumsSku) {
      const line = await getCaseLabelLine(row.id);
      if (!line?.facts || line.problems.length) throw new Error(`Cannot print line ${l.lineNo}: ${line?.problems.join("; ")}`);
      facts = line.facts;
    } else {
      const [s] = await db.select().from(skus).where(eq(skus.id, row.skuId!));
      facts = {
        orderNumber: PO,
        orderNumberIsOurs: false,
        customerItemCode: l.itemCode,
        customerDescription: l.description,
        supplierSku: s.shortCode!,
        unitsPerCase: 12,
        supplierAccountCode: fm.accountCode,
        clientShortName: "F&M",
      };
    }
    const out = `outputs/Case labels ${PO} ${facts.supplierSku} part 1.pdf`;
    await writeFile(out, await buildCaseLabelsPdf(facts, { count: l.shipNow, startAt: 1 }, fonts));
    console.log(`  wrote ${out}: ${l.shipNow} labels`);
  }
  console.log("\nDONE.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
