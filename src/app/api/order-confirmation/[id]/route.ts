import { confirmationPdf } from "@/lib/erp/order-confirmation";
import { getOrder } from "@/lib/erp/orders";

export const dynamic = "force-dynamic";

/** GET /api/order-confirmation/:id. Refuses, in plain text, a line with no price. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await getOrder(Number(id));
  if (!order) return new Response("No such order.", { status: 404 });

  const pdf = await confirmationPdf(order);
  if (!pdf) {
    return new Response(`Cannot confirm ${order.orderNumber}: every line needs a price first.\n`, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Order confirmation ${order.orderNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
