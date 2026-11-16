/**
 * Macknade's PO 1175 (Martini Flight and Rum Old Fashioned), Macknade's first
 * order in Back Bar, and Macknade as a customer.
 *
 *   npx tsx --env-file=.env.local scripts/erp/enter-macknade-po1175-20261116.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/enter-macknade-po1175-20261116.ts --write  # apply
 *
 * Written 16 Nov 2026. Sources, all in cocktails@myattsfields.london:
 *   - Purchase-Order-1175.pdf, Buyer@macknade.com, 14 Nov 2026, thread
 *     1a1da53b97f93fd7. Two lines, EACH; refs and descriptions copied off the
 *     PDF verbatim. Order and delivery date both 14 Nov 2026. £366.72 ex VAT.
 *   - The order itself: Rupert (wines@macknade.com), 12 Nov 2026, thread
 *     1a1844fafba673e7: a box of 12 Martini Flight, and a box of Rum Old
 *     Fashioned in place of the unsold Naked and Famous.
 *   - Delivered by hand 14 Nov 2026; Rupert confirms the PO covers what was
 *     dropped off that morning (thread 1a1da8ff7b8e0340).
 *   - Invoiced on MF-T-3967, 14 Nov 2026, £440.06, which matches the PO.
 *   - Prices: Rum Old Fashioned at Macknade's held £10.56 (ruling of 11 Oct
 *     2026); Martini Flight at the £20 a box offered on 28 Oct 2026.
 *
 * The name is exactly QuickBooks' display name, because invoice matching
 * compares names. Creates the customer and the order only if they are not
 * there.
 */

import { and, eq, ilike } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const PO = "1175";

const LINES = [
  { lineNo: 1, skuCode: "rum-old-fashioned-250", itemCode: "1007665", description: "Myatts Fields Rum Old Fash-ioned", qty: 12, price: "10.56" },
  { lineNo: 2, skuCode: "martini-flight-50", itemCode: "1018139", description: "Myatts Fields Martini Flight Box", qty: 12, price: "20.00" },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — Macknade PO ${PO}\n`);

  let [mk] = await db.select().from(customers).where(ilike(customers.name, "macknade"));
  if (mk) console.log(`  customer Macknade exists [${mk.id}]`);
  else {
    console.log("  customer Macknade: CREATE (short code MCKN, 30 days, orders from wines@macknade.com)");
    if (WRITE)
      [mk] = await db
        .insert(customers)
        .values({
          name: "Macknade",
          shortCode: "MCKN",
          issuesPurchaseOrders: true,
          orderEmail: "wines@macknade.com",
          paymentTermsDays: 30,
          notes:
            "Macknade Fine Foods Ltd, Selling Road, Faversham, Kent ME13 8XF. Buyer Rupert (wines@macknade.com); " +
            "accounts ACCOUNTS@MACKNADE.COM; POs arrive automated from Buyer@macknade.com. Held at its earlier " +
            "prices until the February 2027 review (Cyrus, 11 Oct 2026). Short code MCKN chosen by Claude, 16 Nov 2026.",
        })
        .returning();
  }

  const skuIds = new Map<string, number>();
  for (const l of LINES) {
    const [s] = await db.select().from(skus).where(eq(skus.code, l.skuCode));
    if (!s) throw new Error(`SKU ${l.skuCode} not found`);
    skuIds.set(l.skuCode, s.id);
  }

  const existing = mk
    ? await db
        .select()
        .from(wholesaleOrders)
        .where(and(eq(wholesaleOrders.customerId, mk.id), eq(wholesaleOrders.orderNumber, PO)))
    : [];
  if (existing[0]) {
    console.log(`  order ${PO} exists [${existing[0].id}] — left untouched`);
    return;
  }
  for (const l of LINES) console.log(`  line ${l.lineNo}: ${l.qty} x ${l.skuCode} at £${l.price} (${l.itemCode})`);
  if (!WRITE) {
    console.log("\nDry run only. Re-run with --write to apply.");
    return;
  }

  const [order] = await db
    .insert(wholesaleOrders)
    .values({
      customerId: mk.id,
      orderNumber: PO,
      orderNumberIsOurs: false,
      raisedOn: "2026-11-14",
      receivedAt: new Date("2026-11-14T13:51:17Z"),
      sourceThreadId: "1a1da53b97f93fd7",
      documentRef: "Purchase-Order-1175.pdf",
      status: "invoiced",
      requestedDeliveryFrom: "2026-11-14",
      requestedDeliveryTo: "2026-11-14",
      deliveryAddress: "Macknade Retail, Selling Road, Faversham, Kent ME13 8XF",
      notes:
        "Rupert ordered 12 Nov 2026 (thread 1a1844fafba673e7): 12 Martini Flight, and 12 Rum Old Fashioned " +
        "in place of the unsold Naked and Famous. Delivered by hand 14 Nov 2026; the PO came the same day. " +
        "Invoiced on MF-T-3967 (£440.06), which matches the PO. Unsold stock collected the same day is credited " +
        "against MFC3935: 12 Corpse Reviver No Blue and 11 Naked and Famous, £319.52 (Cyrus, 16 Nov 2026).",
    })
    .returning();
  for (const l of LINES)
    await db.insert(wholesaleOrderLines).values({
      orderId: order.id,
      lineNo: l.lineNo,
      customerItemCode: l.itemCode,
      customerDescription: l.description,
      skuId: skuIds.get(l.skuCode)!,
      qty: String(l.qty),
      unitDescription: "EACH",
      unitPriceStated: l.price,
    });
  console.log(`  created order [${order.id}]`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
