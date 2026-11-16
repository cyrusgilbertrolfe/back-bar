import { boxContentsFacts, loadParcelOrder } from "@/lib/erp/order-parcels";
import { buildCovertBoxLabelsPdf, buildShipmentCaseLabelsPdf } from "@/lib/labels/case-labels";
import { loadBrandFonts } from "@/lib/labels/fonts";

export const dynamic = "force-dynamic";

const plain = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/**
 * GET /api/parcel-labels/:orderId?side=outside|inside
 *
 * The box labels for a parcel order, one Zebra label a box. Outside is the
 * covert label; inside is the contents. Refuses, with the reasons, when the
 * lines do not make whole boxes.
 */
export async function GET(request: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  const side = new URL(request.url).searchParams.get("side") === "inside" ? "inside" : "outside";

  const order = await loadParcelOrder({ id: Number(orderId) });
  if (!order) return plain("No such order.", 404);
  if (order.shippingMethod !== "parcel") return plain(`${order.orderNumber} goes on a pallet, so it has case labels, not box labels.\n`, 409);
  const { plan } = order;
  if (plan.problems.length || !plan.boxes.length)
    return plain(`Cannot print box labels for ${order.orderNumber}:\n\n- ${(plan.problems.length ? plan.problems : ["It has no lines."]).join("\n- ")}\n`, 409);

  const fonts = await loadBrandFonts();
  const pdf =
    side === "outside"
      ? await buildCovertBoxLabelsPdf({ orderNumber: order.orderNumber, recipient: order.customerName, boxes: plan.boxes.length }, {}, fonts)
      : await buildShipmentCaseLabelsPdf(boxContentsFacts(plan, order), {}, fonts);

  const filename = `Box labels ${order.orderNumber} - ${side}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
