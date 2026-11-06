import { getCaseLabelLine } from "@/lib/labels/case-label-data";
import { buildCaseLabelsPdf } from "@/lib/labels/case-labels";
import { loadBrandFonts } from "@/lib/labels/fonts";

export const dynamic = "force-dynamic";

/**
 * GET /api/case-labels/:lineId?start=1..4&cases=N
 *
 * One label per case on the order line, or per case in this shipment when a
 * line goes in more than one (`cases`), numbered CASE n OF that shipment. Refuses, with the reasons in plain
 * text, when the PO and the SKU disagree: a wrong label on 42 boxes costs more
 * than a refusal.
 */
export async function GET(request: Request, ctx: { params: Promise<{ lineId: string }> }) {
  const { lineId } = await ctx.params;
  const line = await getCaseLabelLine(Number(lineId));
  if (!line) return new Response("No such order line.", { status: 404 });
  if (line.problems.length || !line.facts) {
    return new Response(`Cannot print case labels for ${line.orderNumber}:\n\n- ${line.problems.join("\n- ")}\n`, {
      status: 409,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const params = new URL(request.url).searchParams;
  const start = Number(params.get("start") ?? "1");
  const cases = Number(params.get("cases") || line.cases);
  if (!Number.isInteger(cases) || cases < 1 || cases > line.cases) {
    return new Response(`Cases must be a whole number from 1 to ${line.cases}, the cases on the line.\n`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const pdf = await buildCaseLabelsPdf(line.facts, { count: cases, startAt: start }, await loadBrandFonts());

  const filename = `Case labels ${line.orderNumber} ${line.facts.supplierSku}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
