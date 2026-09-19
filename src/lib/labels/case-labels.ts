/**
 * Outer-case labels for goods inbound to a client's warehouse, first built for
 * Fortnum's (19 Sep 2026). One label per case, four to an A4 sheet.
 *
 * Pure: takes the facts and the font bytes, returns PDF bytes. No database,
 * so the same code serves the download route and the command-line script.
 *
 * Printed on a mono laser, so everything is black and the hierarchy is carried
 * by size and weight alone. Grey text dithers into fuzz at these sizes.
 */

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { BrandFontBytes } from "./fonts";

const MM = 72 / 25.4;

/**
 * The label stock: "The Paper Shop" 4-per-sheet laser labels, which follow the
 * standard L7169 layout. Cyrus measured 9.5 / 139 / 139 / 9.5 down the long
 * side and roughly 5 / 98 / 2 / 98 / 5 across; the published L7169 figures
 * below close to exactly 210 mm, which the measurement did not, so these are
 * used and the calibration page proves them.
 */
export const SHEET = {
  pageW: 210,
  pageH: 297,
  labelW: 99.1,
  labelH: 139,
  marginLeft: 4.65,
  marginTop: 9.5,
  colPitch: 101.6, // 99.1 label + 2.5 gap
  rowPitch: 139, // no gap between rows
  perSheet: 4,
} as const;

/** Top-left corner of label position 1–4 (left to right, then down), in mm from the page's top-left. */
function labelOrigin(position: number): { x: number; y: number } {
  const i = position - 1;
  return {
    x: SHEET.marginLeft + (i % 2) * SHEET.colPitch,
    y: SHEET.marginTop + Math.floor(i / 2) * SHEET.rowPitch,
  };
}

export type CaseLabelFacts = {
  purchaseOrder: string;
  customerItemCode: string;
  customerDescription: string;
  supplierSku: string;
  unitsPerCase: number;
  /** Who we are to them, e.g. "MY010". */
  supplierAccountCode: string | null;
  /** The client's name, for the field captions, e.g. "F&M". */
  clientShortName: string;
};

export type CaseLabelOptions = {
  /** How many labels (cases). */
  count: number;
  /** First label position on the first sheet, 1–4, so a part-used sheet is not wasted. */
  startAt?: number;
};

type Fonts = Record<keyof BrandFontBytes, PDFFont>;

async function newDoc(fontBytes: BrandFontBytes, title: string) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setAuthor("Myatt's Fields");
  doc.setCreator("Back Bar");
  // ADAMCG is a CFF OpenType font and pdf-lib's CFF subsetter scrambles its
  // glyphs, so it is embedded whole. Söhne is TrueType and subsets cleanly.
  const fonts: Fonts = {
    wordmark: await doc.embedFont(fontBytes.wordmark, { subset: false }),
    leicht: await doc.embedFont(fontBytes.leicht, { subset: true }),
    buch: await doc.embedFont(fontBytes.buch, { subset: true }),
    kraftig: await doc.embedFont(fontBytes.kraftig, { subset: true }),
  };
  return { doc, fonts };
}

const INK = rgb(0, 0, 0);

/** Drawing in label-local millimetres, measured from the label's top-left. */
class LabelPen {
  constructor(
    private page: PDFPage,
    private originX: number,
    private originY: number,
  ) {}

  private px(x: number) {
    return (this.originX + x) * MM;
  }
  private py(y: number) {
    return (SHEET.pageH - this.originY - y) * MM;
  }

  /** Text with its baseline at y. Tracking is in ems. */
  text(s: string, x: number, y: number, font: PDFFont, size: number, tracking = 0) {
    if (tracking === 0) {
      this.page.drawText(s, { x: this.px(x), y: this.py(y), font, size, color: INK });
      return;
    }
    let cx = this.px(x);
    for (const ch of s) {
      this.page.drawText(ch, { x: cx, y: this.py(y), font, size, color: INK });
      cx += font.widthOfTextAtSize(ch, size) + tracking * size;
    }
  }

  rule(x1: number, x2: number, y: number, weight = 0.5) {
    this.page.drawLine({
      start: { x: this.px(x1), y: this.py(y) },
      end: { x: this.px(x2), y: this.py(y) },
      thickness: weight,
      color: INK,
    });
  }
}

/** Width in mm of tracked text; the trailing tracking after the last glyph is excluded. */
function trackedWidth(s: string, font: PDFFont, size: number, tracking: number): number {
  const chars = [...s];
  const pts = chars.reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0) + tracking * size * (chars.length - 1);
  return pts / MM;
}

/** Largest size, up to max, at which s fits in width mm. */
function fitSize(s: string, font: PDFFont, max: number, width: number, tracking = 0): number {
  let size = max;
  while (size > 6 && trackedWidth(s, font, size, tracking) > width) size -= 0.5;
  return size;
}

function wrap(s: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) / MM > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const PAD_X = 8;
const CAPTION_SIZE = 6.5;
const CAPTION_TRACKING = 0.14;

function drawLabel(pen: LabelPen, f: Fonts, facts: CaseLabelFacts) {
  const left = PAD_X;
  const right = SHEET.labelW - PAD_X;
  const width = right - left;
  const caption = (s: string, x: number, y: number) =>
    pen.text(s.toUpperCase(), x, y, f.kraftig, CAPTION_SIZE, CAPTION_TRACKING);

  // ── The wordmark, spaced, centred: the brand kit's register ──────────────
  const mark = "MYATT'S FIELDS".replace("'", "’");
  const markTracking = 0.32;
  const markSize = fitSize(mark, f.wordmark, 17, width - 6, markTracking);
  const markW = trackedWidth(mark, f.wordmark, markSize, markTracking);
  pen.text(mark, (SHEET.labelW - markW) / 2, 17, f.wordmark, markSize, markTracking);
  pen.rule(left, right, 22.5, 0.75);

  // ── Purchase order, the thing Goods In reads first ──────────────────────
  caption("Purchase order", left, 30);
  pen.text(facts.purchaseOrder, left, 42, f.kraftig, fitSize(facts.purchaseOrder, f.kraftig, 30, width), 0.01);

  pen.rule(left, right, 48, 0.3);

  // ── Their product reference ──────────────────────────────────────────────
  caption(`${facts.clientShortName} product reference`, left, 55);
  pen.text(facts.customerItemCode, left, 66, f.kraftig, fitSize(facts.customerItemCode, f.kraftig, 24, width), 0.02);

  // ── Their description, wrapped, shrinking rather than overflowing ───────
  caption(`${facts.clientShortName} product description`, left, 75);
  // Large while it fits on two lines; a long description may take a third.
  let descSize = 17;
  let lines = wrap(facts.customerDescription, f.buch, descSize, width);
  while (lines.length > 2 && descSize > 13) {
    descSize -= 0.5;
    lines = wrap(facts.customerDescription, f.buch, descSize, width);
  }
  while (lines.length > 3 && descSize > 9) {
    descSize -= 0.5;
    lines = wrap(facts.customerDescription, f.buch, descSize, width);
  }
  const leading = (descSize * 1.2) / MM;
  lines.slice(0, 3).forEach((l, i) => pen.text(l, left, 81.5 + i * leading, f.buch, descSize));

  pen.rule(left, right, 98, 0.3);

  // ── Supplier SKU and case quantity, side by side ────────────────────────
  const col2 = left + width / 2 + 2;
  caption("Supplier SKU", left, 105);
  pen.text(facts.supplierSku, left, 115, f.leicht, fitSize(facts.supplierSku, f.leicht, 20, width / 2 - 4), 0.02);
  caption("Case quantity", col2, 105);
  pen.text(String(facts.unitsPerCase), col2, 115, f.leicht, 20);

  // ── Who it is from ───────────────────────────────────────────────────────
  pen.rule(left, right, 121, 0.75);
  const from = facts.supplierAccountCode
    ? `Myatt’s Fields Ltd · Supplier ${facts.supplierAccountCode}`
    : "Myatt’s Fields Ltd";
  pen.text(from, left, 126.5, f.buch, 7);
  pen.text("11 Upstall Street, London SE5 9JE", left, 130.5, f.buch, 7);
}

export async function buildCaseLabelsPdf(
  facts: CaseLabelFacts,
  opts: CaseLabelOptions,
  fontBytes: BrandFontBytes,
): Promise<Uint8Array> {
  const count = Math.floor(opts.count);
  if (!(count > 0)) throw new Error("Nothing to print: the label count must be at least 1.");
  const startAt = Math.min(Math.max(Math.floor(opts.startAt ?? 1), 1), SHEET.perSheet);

  const { doc, fonts } = await newDoc(fontBytes, `Case labels ${facts.purchaseOrder} ${facts.supplierSku}`);

  let page: PDFPage | null = null;
  let position = startAt;
  for (let n = 0; n < count; n++) {
    if (!page || position > SHEET.perSheet) {
      page = doc.addPage([SHEET.pageW * MM, SHEET.pageH * MM]);
      if (n > 0) position = 1;
    }
    const o = labelOrigin(position);
    drawLabel(new LabelPen(page, o.x, o.y), fonts, facts);
    position++;
  }
  return doc.save();
}

/**
 * Print this on plain paper at 100% and hold it over a label sheet against a
 * window. Every outline should sit on a label edge. Run it once per printer.
 */
export async function buildCalibrationPdf(fontBytes: BrandFontBytes): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc(fontBytes, "Case label calibration");
  const page = doc.addPage([SHEET.pageW * MM, SHEET.pageH * MM]);
  for (let p = 1; p <= SHEET.perSheet; p++) {
    const o = labelOrigin(p);
    page.drawRectangle({
      x: o.x * MM,
      y: (SHEET.pageH - o.y - SHEET.labelH) * MM,
      width: SHEET.labelW * MM,
      height: SHEET.labelH * MM,
      borderColor: INK,
      borderWidth: 0.4,
    });
    const pen = new LabelPen(page, o.x, o.y);
    pen.text(`POSITION ${p}`, PAD_X, 20, fonts.kraftig, 9, 0.12);
    pen.text(`${SHEET.labelW} × ${SHEET.labelH} mm`, PAD_X, 27, fonts.buch, 9);
    // Crosshair at the label centre.
    const cx = SHEET.labelW / 2;
    const cy = SHEET.labelH / 2;
    pen.rule(cx - 5, cx + 5, cy, 0.4);
    page.drawLine({
      start: { x: (o.x + cx) * MM, y: (SHEET.pageH - o.y - cy + 5) * MM },
      end: { x: (o.x + cx) * MM, y: (SHEET.pageH - o.y - cy - 5) * MM },
      thickness: 0.4,
      color: INK,
    });
  }
  const note = new LabelPen(page, SHEET.marginLeft, SHEET.marginTop);
  const lines = [
    "Print on plain paper at Actual size / 100%, never Fit to page.",
    "Hold it over a label sheet against a window:",
    "each outline should sit on a label edge.",
  ];
  lines.forEach((l, i) => note.text(l, PAD_X, 45 + i * 5, fonts.buch, 9));
  return doc.save();
}
