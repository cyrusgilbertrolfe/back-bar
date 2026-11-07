/**
 * The order confirmation we send a customer, with provisional dates and costs
 * (Cyrus, 7 Nov 2026). In the brand's colours and the newsletter's frame: the
 * wordmark on Myatt's Green at its 0.30em spacing, a brass rule, bone beneath.
 * Pure: takes the facts and the font bytes, returns PDF bytes. It goes to
 * customers, so it carries nothing from internal notes and names no supplier.
 */

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { BrandFontBytes } from "@/lib/labels/fonts";

export type ConfirmationLine = {
  description: string;
  packing: string;
  bottles: number;
  unitPrice: number;
  value: number;
};

export type ConfirmationFacts = {
  customerName: string;
  orderNumber: string;
  orderNumberIsOurs: boolean;
  issuedOn: string;
  deliverTo: string | null;
  dispatchOn: string | null;
  deliveryWanted: string | null;
  paymentTermsDays: number | null;
  priceNote: string | null;
  lines: ConfirmationLine[];
  deliveryCharge: number;
  vatRate: number;
};

const SENDER = {
  line1: "Myatt's Fields Limited, 11 Upstall Street, London SE5 9JE",
  line2: "cocktails@myattsfields.com. Company number 10595404. VAT GB276025407.",
};

const hex = (h: string) =>
  rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const GREEN = hex("#2D3F36");
const BRASS = hex("#A8864C");
const BONE = hex("#EAE6DD");
const INK = hex("#111111");
const SOFT = hex("#5F5F58");

const PAGE = { w: 595.28, h: 841.89, margin: 56, footer: 62 };
/** The wordmark's spacing in the brand kit, and the small captions'. */
const MARK_TRACKING = 0.3;
const CAPTION_TRACKING = 0.14;

const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const trackedWidth = (s: string, font: PDFFont, size: number, tracking: number) =>
  [...s].reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0) + tracking * size * ([...s].length - 1);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(tryLine, size) <= width || !line) line = tryLine;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function buildOrderConfirmationPdf(facts: ConfirmationFacts, bytes: BrandFontBytes): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Order confirmation ${facts.orderNumber}`);
  doc.setAuthor("Myatt's Fields");
  doc.setCreator("Back Bar");
  // ADAMCG is embedded whole: pdf-lib's CFF subsetter scrambles it (lib/labels/case-labels.ts).
  const wordmark = await doc.embedFont(bytes.wordmark, { subset: false });
  const regular = await doc.embedFont(bytes.buch, { subset: true });
  const strong = await doc.embedFont(bytes.kraftig, { subset: true });

  const left = PAGE.margin;
  const right = PAGE.w - PAGE.margin;
  let page!: PDFPage;
  let y = 0;

  const tracked = (s: string, x: number, size: number, font: PDFFont, tracking: number, color = INK) => {
    let cx = x;
    for (const ch of s) {
      page.drawText(ch, { x: cx, y, size, font, color });
      cx += font.widthOfTextAtSize(ch, size) + tracking * size;
    }
  };
  const write = (s: string, x: number, size = 10, font = regular, color = INK) =>
    page.drawText(s, { x, y, size, font, color });
  const writeRight = (s: string, x: number, size = 10, font = regular, color = INK) =>
    write(s, x - font.widthOfTextAtSize(s, size), size, font, color);
  const caption = (s: string, x: number) => tracked(s.toUpperCase(), x, 7.5, strong, CAPTION_TRACKING, BRASS);
  const captionRight = (s: string, x: number) =>
    caption(s, x - trackedWidth(s.toUpperCase(), strong, 7.5, CAPTION_TRACKING));
  const rule = (color = BRASS, thickness = 0.5) =>
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness, color });

  const newPage = () => {
    page = doc.addPage([PAGE.w, PAGE.h]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE.w, height: PAGE.h, color: BONE });

    page.drawRectangle({ x: 0, y: PAGE.h - 92, width: PAGE.w, height: 92, color: GREEN });
    const mark = "MYATT’S FIELDS";
    y = PAGE.h - 55;
    tracked(mark, (PAGE.w - trackedWidth(mark, wordmark, 20, MARK_TRACKING)) / 2, 20, wordmark, MARK_TRACKING, BONE);
    page.drawRectangle({ x: 0, y: PAGE.h - 93, width: PAGE.w, height: 1, color: BRASS });

    page.drawRectangle({ x: 0, y: 0, width: PAGE.w, height: PAGE.footer - 18, color: GREEN });
    page.drawRectangle({ x: 0, y: PAGE.footer - 18, width: PAGE.w, height: 1, color: BRASS });
    y = 26;
    const w1 = regular.widthOfTextAtSize(SENDER.line1, 8);
    write(SENDER.line1, (PAGE.w - w1) / 2, 8, regular, BONE);
    y = 15;
    const w2 = regular.widthOfTextAtSize(SENDER.line2, 8);
    write(SENDER.line2, (PAGE.w - w2) / 2, 8, regular, BONE);

    y = PAGE.h - 93 - 40;
  };
  const room = (needed: number) => {
    if (y - needed < PAGE.footer + 8) newPage();
  };

  newPage();
  write("Order confirmation", left, 24, regular, GREEN);
  y -= 19;
  write("Dates are provisional until we confirm them to you.", left, 10.5, regular, SOFT);
  y -= 32;

  const pairs: [string, string][] = [
    ["For", facts.customerName],
    [facts.orderNumberIsOurs ? "Our dispatch number" : "Your purchase order", facts.orderNumber],
    ["Date", longDate(facts.issuedOn)],
    ["Provisional dispatch", facts.dispatchOn ? longDate(facts.dispatchOn) : "To be agreed"],
    ["Delivery requested", facts.deliveryWanted ? longDate(facts.deliveryWanted) : "To be agreed"],
    ...(facts.paymentTermsDays !== null
      ? ([["Payment terms", `Net ${facts.paymentTermsDays} days from invoice`]] as [string, string][])
      : []),
  ];
  const valueX = left + 138;
  for (const [label, value] of pairs) {
    caption(label, left);
    write(value, valueX, 10.5);
    y -= 18;
  }
  if (facts.deliverTo) {
    caption("Deliver to", left);
    for (const line of wrap(facts.deliverTo, regular, 10.5, right - valueX)) {
      write(line, valueX, 10.5);
      y -= 14.5;
    }
  }
  y -= 20;

  const col = { bottles: right - 170, price: right - 82, value: right };
  caption("Item", left);
  captionRight("Bottles", col.bottles);
  captionRight("£ a bottle", col.price);
  captionRight("Ex VAT", col.value);
  y -= 8;
  rule(GREEN, 1);
  y -= 18;

  for (const line of facts.lines) {
    const rows = wrap(line.description, regular, 10.5, col.bottles - left - 50);
    room(rows.length * 14 + 28);
    write(rows[0], left, 10.5);
    writeRight(line.bottles.toLocaleString("en-GB"), col.bottles, 10.5);
    writeRight(money(line.unitPrice), col.price, 10.5);
    writeRight(money(line.value), col.value, 10.5);
    y -= 14;
    for (const extra of rows.slice(1)) {
      write(extra, left, 10.5);
      y -= 14;
    }
    if (line.packing) {
      write(line.packing, left, 9, regular, SOFT);
      y -= 13;
    }
    y -= 1;
    rule();
    y -= 18;
  }

  const goods = facts.lines.reduce((n, l) => n + l.value, 0);
  const net = goods + facts.deliveryCharge;
  const vat = Math.round(net * facts.vatRate * 100) / 100;
  const totals: [string, number][] = [
    ...(facts.deliveryCharge > 0 ? ([["Delivery", facts.deliveryCharge]] as [string, number][]) : []),
    ["Total ex VAT", net],
    [`VAT at ${Math.round(facts.vatRate * 100)}%`, vat],
  ];
  room(totals.length * 17 + 96);
  for (const [label, amount] of totals) {
    writeRight(label, col.price, 10.5, regular, SOFT);
    writeRight(money(amount), col.value, 10.5);
    y -= 17;
  }
  y += 6;
  page.drawLine({ start: { x: col.price - 90, y }, end: { x: right, y }, thickness: 1, color: GREEN });
  y -= 20;
  writeRight("Total", col.price, 13, strong, GREEN);
  writeRight(money(net + vat), col.value, 13, strong, GREEN);
  y -= 36;

  if (facts.priceNote) {
    for (const line of wrap(facts.priceNote, regular, 10, right - left)) {
      room(16);
      write(line, left, 10, regular, SOFT);
      y -= 14;
    }
  }

  return doc.save();
}
