/**
 * What the daily capture hands to the propose step: one supplier message read
 * from cocktails@ and, if it carries an invoice, that invoice read into lines.
 *
 * Claude does the reading; everything after it is code. This file is the
 * contract between the two, checked strictly, because a misread is caught here
 * or not at all. The other guard is arithmetic: the lines must add up to the
 * printed net (rules.ts), or the invoice goes to Cyrus unproposed.
 */

import type { LineKind } from "./rules";

export const MESSAGE_KINDS = [
  "invoice",
  "credit_note",
  "quote",
  "order_confirmation",
  "delivery_note",
  "statement",
  "other",
] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

const LINE_KINDS: readonly LineKind[] = ["goods", "fee", "pallet", "duty", "epr", "zero", "other"];

export interface CapturedMessage {
  messageId: string;
  threadId: string | null;
  mailbox: string;
  from: string;
  subject: string | null;
  /** ISO 8601. */
  receivedAt: string;
  kind: MessageKind;
  supplierName: string | null;
  bodyText: string | null;
  attachmentNames: string[];
}

export interface ExtractedLine {
  lineNo: number;
  code: string | null;
  description: string;
  qty: number | null;
  packUnit: string | null;
  /** Ex VAT, as printed. Always used over price-each, which suppliers print per 1, per 100 or per 1,000. */
  lineTotal: number;
  kind: LineKind;
  /** Fee, pallet or duty only. */
  feeAppliesTo?: number[] | null | "unclear";
  /** Goods only: Claude's reading of which component this is. Unconfirmed until Cyrus approves. */
  match?: {
    componentId: number;
    /** Component packs in one invoice unit of `qty`: 6 for a case of six. */
    packsPerUnit: number;
    /** The pack as bought, in the component's UOM: 700 for a 70cl bottle. */
    packSize: number;
    reason: string;
  } | null;
}

export interface ExtractedInvoice {
  supplierName: string;
  invoiceRef: string;
  /** YYYY-MM-DD. */
  invoiceDate: string;
  orderRef: string | null;
  attachmentName: string | null;
  netTotal: number;
  vat: number | null;
  total: number | null;
  /** Set if the thread or a related one shows the invoice is disputed, e.g. wrong goods sent. */
  disputeNote: string | null;
  lines: ExtractedLine[];
}

export interface Capture {
  message: CapturedMessage;
  invoice: ExtractedInvoice | null;
}

class Bad extends Error {}

function str(o: Record<string, unknown>, k: string, nullable = false): string | null {
  const v = o[k];
  if (v == null && nullable) return null;
  if (typeof v !== "string" || v.trim() === "") throw new Bad(`${k} must be a non-empty string`);
  return v;
}
function num(o: Record<string, unknown>, k: string, nullable = false): number | null {
  const v = o[k];
  if (v == null && nullable) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Bad(`${k} must be a number`);
  return v;
}
function obj(v: unknown, what: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Bad(`${what} must be an object`);
  return v as Record<string, unknown>;
}

function parseLine(raw: unknown, i: number): ExtractedLine {
  const o = obj(raw, `lines[${i}]`);
  const kind = str(o, "kind") as LineKind;
  if (!LINE_KINDS.includes(kind)) throw new Bad(`lines[${i}].kind must be one of ${LINE_KINDS.join(", ")}`);
  const line: ExtractedLine = {
    lineNo: num(o, "lineNo")!,
    code: str(o, "code", true),
    description: str(o, "description")!,
    qty: num(o, "qty", true),
    packUnit: str(o, "packUnit", true),
    lineTotal: num(o, "lineTotal")!,
    kind,
  };
  if (kind === "fee" || kind === "pallet" || kind === "duty") {
    const a = o.feeAppliesTo;
    if (a == null) line.feeAppliesTo = null;
    else if (a === "unclear") line.feeAppliesTo = "unclear";
    else if (Array.isArray(a) && a.every((n) => Number.isInteger(n))) line.feeAppliesTo = a as number[];
    else throw new Bad(`lines[${i}].feeAppliesTo must be null, "unclear" or line numbers`);
  }
  if (kind === "goods" && o.match != null) {
    const m = obj(o.match, `lines[${i}].match`);
    line.match = {
      componentId: num(m, "componentId")!,
      packsPerUnit: num(m, "packsPerUnit")!,
      packSize: num(m, "packSize")!,
      reason: str(m, "reason")!,
    };
    if (line.match.packsPerUnit <= 0 || line.match.packSize <= 0) {
      throw new Bad(`lines[${i}].match packsPerUnit and packSize must be above zero`);
    }
  }
  return line;
}

/** Parse and check one capture file. Throws with the field at fault. */
export function parseCapture(raw: unknown): Capture {
  try {
    const o = obj(raw, "capture");
    const m = obj(o.message, "message");
    const kind = str(m, "kind") as MessageKind;
    if (!MESSAGE_KINDS.includes(kind)) throw new Bad(`message.kind must be one of ${MESSAGE_KINDS.join(", ")}`);
    const receivedAt = str(m, "receivedAt")!;
    if (Number.isNaN(Date.parse(receivedAt))) throw new Bad("message.receivedAt must be a date");
    const message: CapturedMessage = {
      messageId: str(m, "messageId")!,
      threadId: str(m, "threadId", true),
      mailbox: str(m, "mailbox")!,
      from: str(m, "from")!,
      subject: str(m, "subject", true),
      receivedAt,
      kind,
      supplierName: str(m, "supplierName", true),
      bodyText: str(m, "bodyText", true),
      attachmentNames: Array.isArray(m.attachmentNames) ? m.attachmentNames.map(String) : [],
    };

    if (o.invoice == null) return { message, invoice: null };
    const v = obj(o.invoice, "invoice");
    const invoiceDate = str(v, "invoiceDate")!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) throw new Bad("invoice.invoiceDate must be YYYY-MM-DD");
    if (!Array.isArray(v.lines) || v.lines.length === 0) throw new Bad("invoice.lines must be a non-empty array");
    const lines = v.lines.map(parseLine);
    const nos = new Set(lines.map((l) => l.lineNo));
    if (nos.size !== lines.length) throw new Bad("invoice.lines have duplicate lineNo");
    return {
      message,
      invoice: {
        supplierName: str(v, "supplierName")!,
        invoiceRef: str(v, "invoiceRef")!,
        invoiceDate,
        orderRef: str(v, "orderRef", true),
        attachmentName: str(v, "attachmentName", true),
        netTotal: num(v, "netTotal")!,
        vat: num(v, "vat", true),
        total: num(v, "total", true),
        disputeNote: str(v, "disputeNote", true),
        lines,
      },
    };
  } catch (err) {
    if (err instanceof Bad) throw new Error(`Capture rejected: ${err.message}`);
    throw err;
  }
}
