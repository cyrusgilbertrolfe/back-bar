/**
 * Wholesale orders as the business works them: taken from a PO, a phone call or
 * the back of an envelope, and often with no PO, no date and no SKU match yet.
 * All three are honest states, so none is demanded at entry (Cyrus, 6 Nov 2026).
 *
 * What an order is waiting on is derived from its stage and date. Someone types
 * it only when the real reason is something else, such as another order
 * finishing. A date that has passed with the order not marked dispatched is
 * asked about, because a stage nobody remembered to move is the known failure:
 * on 6 Nov 2026 at least four of the six recorded orders were at the wrong one.
 */

import { asc, eq, inArray, like, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders, type WholesaleOrder } from "@/db/schema";

export const STAGES = [
  { value: "received", label: "Received", next: "Acknowledge it" },
  { value: "acknowledged", label: "Acknowledged", next: "Agree the price" },
  { value: "priced", label: "Priced", next: "Agree a date" },
  { value: "committed", label: "Committed", next: "Make it" },
  { value: "in_production", label: "In production", next: "Dispatch it" },
  { value: "dispatched", label: "Dispatched", next: "Invoice it" },
  { value: "invoiced", label: "Invoiced", next: "Close it" },
  { value: "closed", label: "Closed", next: "Nothing" },
] as const;

export type Stage = (typeof STAGES)[number]["value"];

export const SOURCES = [
  { value: "mailbox", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "in_person", label: "In person" },
  { value: "portal", label: "Trade portal" },
] as const;

/** Invoiced is QuickBooks' from there on, so it leaves the open list. */
const NOT_OPEN: Stage[] = ["invoiced", "closed"];
/** The stages at which the goods have left, so a passed date means nothing. */
const GONE: Stage[] = ["dispatched", "invoiced", "closed"];

export function stageLabel(status: string): string {
  return STAGES.find((s) => s.value === status)?.label ?? status;
}

/** Today in London as YYYY-MM-DD, the form `date` columns come back in. */
export function londonToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

/** The date an order is held to: the end of its window, or its one date. */
export function dueDate(o: Pick<WholesaleOrder, "requestedDeliveryFrom" | "requestedDeliveryTo">): string | null {
  return o.requestedDeliveryTo ?? o.requestedDeliveryFrom;
}

export function isOverdue(
  o: Pick<WholesaleOrder, "status" | "requestedDeliveryFrom" | "requestedDeliveryTo">,
  today: string,
): boolean {
  const due = dueDate(o);
  return due !== null && due < today && !GONE.includes(o.status);
}

export type WaitingOn = { text: string; overdue: boolean };

/** What this order needs next, in the words the list shows. */
export function waitingOn(
  o: Pick<WholesaleOrder, "status" | "requestedDeliveryFrom" | "requestedDeliveryTo" | "waitingOn">,
  today: string,
): WaitingOn {
  if (isOverdue(o, today)) return { text: "Date passed: has it gone?", overdue: true };
  if (o.waitingOn) return { text: o.waitingOn, overdue: false };
  return { text: STAGES.find((s) => s.value === o.status)?.next ?? "", overdue: false };
}

export type OrderLineRow = {
  id: number;
  orderId: number;
  qty: string;
  unitDescription: string | null;
  unitsPerCase: number | null;
  customerDescription: string | null;
  customerItemCode: string | null;
  skuId: number | null;
  skuCode: string | null;
  skuDescription: string | null;
};

export type OrderRow = WholesaleOrder & { customerName: string; lines: OrderLineRow[] };

/** One line, as a person would say it: "2 × Case 12 Negroni 3L". */
export function lineText(l: OrderLineRow): string {
  const qty = Number(l.qty);
  const what = l.customerDescription ?? l.skuDescription ?? l.skuCode ?? "Unnamed item";
  return `${qty} × ${l.unitDescription ? `${l.unitDescription} ` : ""}${what}`;
}

async function linesFor(orderIds: number[]): Promise<OrderLineRow[]> {
  if (orderIds.length === 0) return [];
  return db
    .select({
      id: wholesaleOrderLines.id,
      orderId: wholesaleOrderLines.orderId,
      qty: wholesaleOrderLines.qty,
      unitDescription: wholesaleOrderLines.unitDescription,
      unitsPerCase: wholesaleOrderLines.unitsPerCase,
      customerDescription: wholesaleOrderLines.customerDescription,
      customerItemCode: wholesaleOrderLines.customerItemCode,
      skuId: wholesaleOrderLines.skuId,
      skuCode: skus.code,
      skuDescription: skus.customerDescription,
    })
    .from(wholesaleOrderLines)
    .leftJoin(skus, eq(skus.id, wholesaleOrderLines.skuId))
    .where(inArray(wholesaleOrderLines.orderId, orderIds))
    .orderBy(asc(wholesaleOrderLines.lineNo), asc(wholesaleOrderLines.id));
}

function assemble(
  rows: { order: WholesaleOrder; customerName: string }[],
  lines: OrderLineRow[],
): OrderRow[] {
  return rows.map(({ order, customerName }) => ({
    ...order,
    customerName,
    lines: lines.filter((l) => l.orderId === order.id),
  }));
}

/** Overdue first, then soonest date, then undated oldest first. */
export function sortOpen(orders: OrderRow[], today: string): OrderRow[] {
  const rank = (o: OrderRow) => (isOverdue(o, today) ? 0 : dueDate(o) ? 1 : 2);
  return [...orders].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (dueDate(a) ?? "").localeCompare(dueDate(b) ?? "") ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export async function listOpenOrders(today: string = londonToday()): Promise<OrderRow[]> {
  const rows = await db
    .select({ order: wholesaleOrders, customerName: customers.name })
    .from(wholesaleOrders)
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .where(notInArray(wholesaleOrders.status, NOT_OPEN));
  return sortOpen(assemble(rows, await linesFor(rows.map((r) => r.order.id))), today);
}

export async function getOrder(id: number): Promise<OrderRow | null> {
  const rows = await db
    .select({ order: wholesaleOrders, customerName: customers.name })
    .from(wholesaleOrders)
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .where(eq(wholesaleOrders.id, id));
  if (rows.length === 0) return null;
  return assemble(rows, await linesFor([id]))[0];
}

/**
 * The next dispatch number for an order with no PO: the customer's code, "-DN"
 * and the five-digit serial shared by every customer. The trade portal issues
 * from the same serial, read the same way, so both must keep to this pattern.
 */
export async function nextDispatchNumber(shortCode: string): Promise<string> {
  const taken = await db
    .select({ n: wholesaleOrders.orderNumber })
    .from(wholesaleOrders)
    .where(like(wholesaleOrders.orderNumber, "%-DN_____"));
  const serial = Math.max(0, ...taken.map((r) => Number(r.n.slice(-5))).filter(Number.isFinite)) + 1;
  return `${shortCode}-DN${String(serial).padStart(5, "0")}`;
}

export type OrderPrompt = { text: string; href: string; urgent: boolean };

/** The order lines on the home page's "Needs doing", most pressing first. */
export function orderPrompts(orders: OrderRow[], today: string): OrderPrompt[] {
  const list = "/sell/orders";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const one = (matches: OrderRow[]) => (matches.length === 1 ? `${list}/${matches[0].id}` : list);

  const overdue = orders.filter((o) => isOverdue(o, today));
  const toAnswer = orders.filter((o) => o.status === "received" && !o.waitingOn && !isOverdue(o, today));
  const undated = orders.filter(
    (o) => !dueDate(o) && !o.waitingOn && o.status !== "received" && !GONE.includes(o.status),
  );
  const unmatched = orders.filter((o) => o.lines.some((l) => l.skuId === null));
  const toInvoice = orders.filter((o) => o.status === "dispatched");

  const prompts: OrderPrompt[] = [];
  if (overdue.length)
    prompts.push({
      text:
        overdue.length === 1
          ? "1 order is past its date. Has it gone?"
          : `${overdue.length} orders are past their date. Have they gone?`,
      href: one(overdue),
      urgent: true,
    });
  if (toAnswer.length)
    prompts.push({ text: `${plural(toAnswer.length, "new order", "new orders")} to acknowledge`, href: one(toAnswer), urgent: false });
  if (toInvoice.length)
    prompts.push({ text: `${plural(toInvoice.length, "dispatched order", "dispatched orders")} to invoice`, href: one(toInvoice), urgent: false });
  if (undated.length)
    prompts.push({
      text: `${plural(undated.length, "order has", "orders have")} no date and no reason why`,
      href: one(undated),
      urgent: false,
    });
  if (unmatched.length)
    prompts.push({
      text: `${plural(unmatched.length, "order has", "orders have")} a line with no SKU`,
      href: one(unmatched),
      urgent: false,
    });
  return prompts;
}
