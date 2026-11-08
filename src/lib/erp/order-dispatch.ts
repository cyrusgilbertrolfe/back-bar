/**
 * Whether an order has gone, read from its QuickBooks invoice. The invoice's
 * shipping date is the day the pallet was picked up, not the delivery date, and
 * it outranks anyone clicking a stage (Cyrus, 7 Nov 2026). Nothing is stored:
 * QuickBooks stays the record, and is read each time an order is shown.
 *
 * An invoice belongs to an order when it is the same customer and carries the
 * order's number in Tracking no., the customer memo or the private note. There
 * is deliberately no guessing from dates or quantities. An invoice with no number
 * matches nothing, and the order goes on asking "has it gone?".
 */

import { getAccessToken, qbRequest } from "@/lib/quickbooks";

export type InvoiceFact = {
  invoiceNumber: string;
  customerName: string;
  shippedOn: string | null;
  /** Everything on the invoice that can carry an order number. */
  references: string[];
  /** Bottles, from lines whose item is a drink. */
  bottles: number;
};

export type Dispatch = { invoiceNumber: string; shippedOn: string; bottles: number };

/** What has left against an order, and whether that is all of it. */
export type Gone = {
  dispatches: Dispatch[];
  complete: boolean;
  /** "30 of 63 cases went 29 Oct on MFC3938", for an order only part gone. */
  partText: string | null;
};

type QBInvoiceRow = {
  DocNumber?: string;
  ShipDate?: string;
  TrackingNum?: string;
  PrivateNote?: string;
  CustomerRef: { name: string };
  CustomerMemo?: { value?: string };
  Line: Array<{ SalesItemLineDetail?: { ItemRef?: { name?: string }; Qty?: number } }>;
};

/** QuickBooks items that are not drinks, so carry no bottles. */
const NOT_DRINKS = /^(postage|design):/i;

/** Most items are sold by the bottle; Fortnum's newer ones are "Case of 12". */
function bottlesOn(item: string, qty: number): number {
  if (NOT_DRINKS.test(item)) return 0;
  const perCase = item.match(/case of (\d+)/i);
  return qty * (perCase ? Number(perCase[1]) : 1);
}

export function toFact(row: QBInvoiceRow): InvoiceFact {
  return {
    invoiceNumber: row.DocNumber ?? "(no number)",
    customerName: row.CustomerRef.name,
    shippedOn: row.ShipDate ?? null,
    references: [row.TrackingNum, row.CustomerMemo?.value, row.PrivateNote].filter((r): r is string => Boolean(r)),
    bottles: row.Line.reduce((n, l) => {
      const d = l.SalesItemLineDetail;
      return d ? n + bottlesOn(d.ItemRef?.name ?? "", d.Qty ?? 0) : n;
    }, 0),
  };
}

/**
 * Our dispatch numbers must appear whole. Their POs may be written with or
 * without the letters: PU215780 is "PO 215780" on invoice MFC3930.
 */
export function refersTo(references: string[], orderNumber: string): boolean {
  const number = orderNumber.trim().toUpperCase();
  const text = references.join(" ").toUpperCase();
  const whole = new RegExp(`(^|[^A-Z0-9])${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Z0-9])`);
  if (whole.test(text)) return true;
  if (/-DN\d+$/.test(number)) return false;
  const digits = number.replace(/\D/g, "");
  return digits.length >= 5 && Array.from(text.matchAll(/\d+/g), (m) => m[0]).includes(digits);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

type OrderForMatch = {
  orderNumber: string;
  customerName: string;
  lines: { qty: string; unitsPerCase: number | null }[];
};

/**
 * The invoice raised for an order, whether or not it has gone. A proforma
 * carries the order number and no shipping date until the pallet leaves.
 */
export function invoiceFor(
  order: Pick<OrderForMatch, "orderNumber" | "customerName">,
  invoices: InvoiceFact[],
): string | null {
  const found = invoices.find(
    (i) =>
      i.customerName.trim().toLowerCase() === order.customerName.trim().toLowerCase() &&
      refersTo(i.references, order.orderNumber),
  );
  return found?.invoiceNumber ?? null;
}

/**
 * What has gone against one order, or null if nothing has. An invoice dated
 * ahead of its pick-up does not count until that day. A line with no case size
 * is already counted in bottles.
 */
export function goneFor(order: OrderForMatch, invoices: InvoiceFact[], today: string): Gone | null {
  const dispatches: Dispatch[] = invoices
    .filter(
      (i) =>
        i.shippedOn !== null &&
        i.shippedOn <= today &&
        i.customerName.trim().toLowerCase() === order.customerName.trim().toLowerCase() &&
        refersTo(i.references, order.orderNumber),
    )
    .map((i) => ({ invoiceNumber: i.invoiceNumber, shippedOn: i.shippedOn!, bottles: i.bottles }))
    .sort((a, b) => a.shippedOn.localeCompare(b.shippedOn));
  if (dispatches.length === 0) return null;

  const lines = order.lines.filter((l) => Number(l.qty) > 0);
  const sizes = new Set(lines.map((l) => l.unitsPerCase));
  const shipped = dispatches.reduce((n, d) => n + d.bottles, 0);
  const ordered = lines.reduce((n, l) => n + Number(l.qty) * (l.unitsPerCase ?? 1), 0);
  if (lines.length === 0 || shipped >= ordered) return { dispatches, complete: true, partText: null };

  const last = dispatches[dispatches.length - 1];
  const size = sizes.size === 1 ? [...sizes][0] : null;
  const amount = size
    ? `${shipped / size} of ${ordered / size} cases`
    : `${shipped} of ${ordered} bottles`;
  return {
    dispatches,
    complete: false,
    partText: `${amount} went ${shortDate(last.shippedOn)} on ${dispatches.map((d) => d.invoiceNumber).join(", ")}`,
  };
}

const QB_WAIT_MS = 8000;

/**
 * Invoices raised since a date, or null if QuickBooks cannot be read in time: a
 * slow or lapsed link must not hold up the page, which says so instead.
 */
export async function readInvoices(since: string): Promise<InvoiceFact[] | null> {
  const read = async () => {
    const token = await getAccessToken();
    if (!token) return null;
    const query = `SELECT * FROM Invoice WHERE TxnDate >= '${since}' MAXRESULTS 1000`;
    const res = await qbRequest<{ QueryResponse: { Invoice?: QBInvoiceRow[] } }>(
      token,
      `query?query=${encodeURIComponent(query)}`,
    );
    return (res.QueryResponse.Invoice ?? []).map(toFact);
  };
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), QB_WAIT_MS));
  try {
    return await Promise.race([read(), timeout]);
  } catch (err) {
    console.error("[orders] could not read QuickBooks invoices", err);
    return null;
  }
}
