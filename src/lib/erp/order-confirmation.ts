/** The confirmation for an order: the PDF, and the form message it goes with. */

import { buildOrderConfirmationPdf } from "@/lib/documents/order-confirmation";
import { getPricingConfig } from "@/lib/erp/pricing";
import { dueDate, lineBottles, lineValue, liveLines, londonToday, type OrderRow } from "@/lib/erp/orders";
import { loadBrandFonts } from "@/lib/labels/fonts";

/** The PDF, or null until every line has a price. */
export async function confirmationPdf(order: OrderRow): Promise<Uint8Array | null> {
  const lines = liveLines(order);
  if (lines.length === 0 || lines.some((l) => l.unitPriceQuoted === null)) return null;
  const { vat } = await getPricingConfig();
  return buildOrderConfirmationPdf(
    {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderNumberIsOurs: order.orderNumberIsOurs,
      issuedOn: londonToday(),
      deliverTo: order.deliveryAddress,
      dispatchOn: order.collectionOn,
      deliveryWanted: dueDate(order),
      paymentTermsDays: order.paymentTermsDays,
      priceNote: order.priceNote,
      lines: lines.map((l) => ({
        description: l.customerDescription ?? l.skuDescription ?? l.skuCode ?? "Item",
        packing: l.unitsPerCase ? `${Number(l.qty)} × case of ${l.unitsPerCase}` : "",
        bottles: lineBottles(l),
        unitPrice: Number(l.unitPriceQuoted),
        value: lineValue(l) ?? 0,
      })),
      deliveryCharge: Number(order.deliveryCharge ?? 0),
      vatRate: vat - 1,
    },
    await loadBrandFonts(),
  );
}

export function confirmationSubject(order: Pick<OrderRow, "orderNumber">): string {
  return `Order confirmation ${order.orderNumber}, Myatt's Fields`;
}

export function confirmationMessage(order: Pick<OrderRow, "orderNumber">): string {
  return `Hello,

Thank you for your order ${order.orderNumber}. Our confirmation is attached, with the prices and provisional dates. We will confirm the dates as soon as they are firm.

If anything looks wrong, just reply to this email.

All the best,
Clemency & Cyrus
Myatt's Fields`;
}
