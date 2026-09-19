import { buildCalibrationPdf } from "@/lib/labels/case-labels";
import { loadBrandFonts } from "@/lib/labels/fonts";

export const dynamic = "force-dynamic";

/** GET /api/case-labels/calibration — label outlines on plain paper, to check the printer's registration. */
export async function GET() {
  const pdf = await buildCalibrationPdf(await loadBrandFonts());
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Case label calibration.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
