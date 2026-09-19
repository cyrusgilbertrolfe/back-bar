import { getCaseLabelLine } from "@/lib/labels/case-label-data";
import { buildCaseLabelsPdf } from "@/lib/labels/case-labels";
import { loadBrandFonts } from "@/lib/labels/fonts";

export const dynamic = "force-dynamic";

/**
 * GET /api/case-labels/:lineId?start=1..4
 *
 * One label per case on the order line. Refuses, with the reasons in plain
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

  const start = Number(new URL(request.url).searchParams.get("start") ?? "1");
  const pdf = await buildCaseLabelsPdf(line.facts, { count: line.cases, startAt: start }, await loadBrandFonts());

  const filename = `Case labels ${line.orderNumber} ${line.facts.supplierSku}.pdf`;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
