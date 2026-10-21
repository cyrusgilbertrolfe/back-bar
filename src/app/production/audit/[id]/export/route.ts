import { countCsv, valueCount } from "@/lib/erp/stock-count";

export const dynamic = "force-dynamic";

/** The count as a CSV, for the accountant: every counted line and the total. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await valueCount(Number(id));
  if (!v) return new Response("No such stock count", { status: 404 });
  const name = `Stock as at ${v.count.asAt}${v.count.status === "closed" ? "" : " (draft)"}.csv`;
  return new Response(countCsv(v), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
