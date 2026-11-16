/**
 * Four warning labels for the Fortnum's Gingertini cases shipped without
 * tamper seals (Cyrus, 28 Oct 2026: Fortnum's fault, not ours). They say
 * PICCADILLY DISTILLERY ONLY, for the attention of Adam Lock, GINGERTINI and
 * NO TAMPER SEALS, one to a case, on the same
 * 4-up stock as the case labels. A one-off, so it draws for itself rather than
 * adding a builder to src/lib/labels.
 *
 *   npx tsx scripts/erp/make-piccadilly-no-seals-labels-20261028.ts [--out=path.pdf]
 */

import { writeFile } from "node:fs/promises";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { SHEET } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const MM = 72 / 25.4;
const INK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const PAD_X = 8;
const CAPTION_SIZE = 6.5;
const CAPTION_TRACKING = 0.14;
const out =
  process.argv.find((a) => a.startsWith("--out="))?.slice("--out=".length) ??
  "outputs/Piccadilly Distillery only - Gingertini - no tamper seals labels.pdf";

function trackedWidth(s: string, font: PDFFont, size: number, tracking: number) {
  return (font.widthOfTextAtSize(s, size) + tracking * size * (s.length - 1)) / MM;
}

/** The largest size up to max at which s fits width (mm). */
function fitSize(s: string, font: PDFFont, max: number, width: number, tracking: number) {
  return Math.min(max, (max * width) / trackedWidth(s, font, max, tracking));
}

function drawLabel(page: PDFPage, ox: number, oy: number, f: Record<"wordmark" | "kraftig", PDFFont>) {
  const width = SHEET.labelW - 2 * PAD_X;
  const cx = SHEET.labelW / 2;
  const centred = (s: string, y: number, font: PDFFont, size: number, tracking = 0) => {
    let x = (ox + cx - trackedWidth(s, font, size, tracking) / 2) * MM;
    for (const ch of s) {
      page.drawText(ch, { x, y: (SHEET.pageH - oy - y) * MM, font, size, color: INK });
      x += font.widthOfTextAtSize(ch, size) + tracking * size;
    }
  };
  const rule = (y: number, weight: number) =>
    page.drawLine({
      start: { x: (ox + PAD_X) * MM, y: (SHEET.pageH - oy - y) * MM },
      end: { x: (ox + SHEET.labelW - PAD_X) * MM, y: (SHEET.pageH - oy - y) * MM },
      thickness: weight,
      color: INK,
    });

  const box = (y: number, h: number, fill: boolean) =>
    page.drawRectangle({
      x: (ox + PAD_X) * MM,
      y: (SHEET.pageH - oy - y - h) * MM,
      width: width * MM,
      height: h * MM,
      ...(fill ? { color: INK } : { borderColor: INK, borderWidth: 1.5 }),
    });
  const caption = (s: string, y: number) => centred(s, y, f.kraftig, CAPTION_SIZE, CAPTION_TRACKING);

  centred("MYATT'S FIELDS", 13, f.wordmark, 11, 0.3);
  rule(18, 0.75);

  // ── Who it is for, reversed out of a black band so it is read first ─────
  box(23, 31, true);
  const where = fitSize("DISTILLERY ONLY", f.kraftig, 30, width - 10, 0.04);
  centredIn("PICCADILLY", 36.5, where, WHITE);
  centredIn("DISTILLERY ONLY", 48, where, WHITE);

  caption("FOR THE ATTENTION OF", 63);
  centred("ADAM LOCK", 73.5, f.kraftig, 20, 0.06);
  rule(80, 0.75);

  caption("PRODUCT", 88);
  centred("GINGERTINI", 101, f.kraftig, fitSize("GINGERTINI", f.kraftig, 34, width - 6, 0.04), 0.04);

  // ── The warning, in an outline box ──────────────────────────────────────
  box(108, 17, false);
  const warning = "NO TAMPER SEALS";
  centred(warning, 119.5, f.kraftig, fitSize(warning, f.kraftig, 24, width - 10, 0.06), 0.06);

  rule(129.5, 0.5);
  caption("MYATT'S FIELDS LTD · 11 UPSTALL STREET, LONDON SE5 9JE", 134);

  function centredIn(s: string, y: number, size: number, color: typeof INK) {
    let x = (ox + cx - trackedWidth(s, f.kraftig, size, 0.04) / 2) * MM;
    for (const ch of s) {
      page.drawText(ch, { x, y: (SHEET.pageH - oy - y) * MM, font: f.kraftig, size, color });
      x += f.kraftig.widthOfTextAtSize(ch, size) + 0.04 * size;
    }
  }
}

async function main() {
  const bytes = await loadBrandFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle("Piccadilly Distillery only - Gingertini - no tamper seals");
  doc.setAuthor("Myatt's Fields");
  const fonts = {
    wordmark: await doc.embedFont(bytes.wordmark, { subset: false }),
    kraftig: await doc.embedFont(bytes.kraftig, { subset: true }),
  };
  const page = doc.addPage([SHEET.pageW * MM, SHEET.pageH * MM]);
  for (let i = 0; i < SHEET.perSheet; i++) {
    drawLabel(page, SHEET.marginLeft + (i % 2) * SHEET.colPitch, SHEET.marginTop + Math.floor(i / 2) * SHEET.rowPitch, fonts);
  }
  await writeFile(out, await doc.save());
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
