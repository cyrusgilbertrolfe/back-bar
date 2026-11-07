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
import { goneFor, readInvoices, type Gone } from "@/lib/erp/order-dispatch";

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

const STAGE_ORDER = STAGES.map((s) => s.value as string);

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

/** The day it should leave us: the booked pick-up, or failing that the date they asked for. */
export function dispatchDate(
  o: Pick<WholesaleOrder, "collectionOn" | "requestedDeliveryFrom" | "requestedDeliveryTo">,
): string | null {
  return o.collectionOn ?? dueDate(o);
}

export function isOverdue(
  o: Pick<WholesaleOrder, "status" | "planned" | "collectionOn" | "requestedDeliveryFrom" | "requestedDeliveryTo">,
  today: string,
): boolean {
  const due = dispatchDate(o);
  return due !== null && due < today && !o.planned && !GONE.includes(o.status);
}

export type WaitingOn = { text: string; overdue: boolean };

/** What this order needs next, in the words the list shows. */
export function waitingOn(o: OrderRow, today: string): WaitingOn {
  const part = o.gone?.partText;
  if (isOverdue(o, today)) return { text: part ? `${part}: has the rest gone?` : "Date passed: has it gone?", overdue: true };
  if (part) return { text: o.waitingOn ? `${part}. ${o.waitingOn}` : `${part}. The rest to go`, overdue: false };
  if (GONE.includes(o.status)) return { text: STAGES.find((s) => s.value === o.status)?.next ?? "", overdue: false };
  if (o.planned) return { text: o.waitingOn ?? "Planned, not firm yet", overdue: false };
  if (o.palletBuildOn && o.palletBuildOn < today && !o.palletPackedOn)
    return { text: "Pallet build date passed: is it packed?", overdue: true };
  if (o.waitingOn) return { text: o.waitingOn, overdue: false };
  return { text: orderSteps(o).find((s) => !s.done)?.next ?? "", overdue: false };
}

export type OrderLineRow = {
  id: number;
  orderId: number;
  qty: string;
  unitDescription: string | null;
  unitsPerCase: number | null;
  /** A bottle, ex VAT. */
  unitPriceQuoted: string | null;
  customerDescription: string | null;
  customerItemCode: string | null;
  skuId: number | null;
  skuCode: string | null;
  skuDescription: string | null;
};

export type OrderRow = WholesaleOrder & {
  customerName: string;
  customerOrderEmail: string | null;
  paymentTermsDays: number | null;
  lines: OrderLineRow[];
  gone: Gone | null;
};

/** One line, as a person would say it: "2 × Case 12 Negroni 3L". */
export function lineText(l: OrderLineRow): string {
  const qty = Number(l.qty);
  const what = l.customerDescription ?? l.skuDescription ?? l.skuCode ?? "Unnamed item";
  return `${qty} × ${l.unitDescription ? `${l.unitDescription} ` : ""}${what}`;
}

/** Lines still on the order: one at zero moved elsewhere and stays only as history. */
export function liveLines(o: Pick<OrderRow, "lines">): OrderLineRow[] {
  return o.lines.filter((l) => Number(l.qty) > 0);
}

/** A line with no case size is counted in bottles, as the trade portal enters them. */
export function lineBottles(l: Pick<OrderLineRow, "qty" | "unitsPerCase">): number {
  return Number(l.qty) * (l.unitsPerCase ?? 1);
}

export function lineValue(l: Pick<OrderLineRow, "qty" | "unitsPerCase" | "unitPriceQuoted">): number | null {
  return l.unitPriceQuoted === null ? null : lineBottles(l) * Number(l.unitPriceQuoted);
}

/** Goods plus delivery, ex VAT, or null until every line has a price. */
export function orderValue(o: Pick<OrderRow, "lines" | "deliveryCharge">): number | null {
  const lines = liveLines(o);
  if (lines.length === 0 || lines.some((l) => l.unitPriceQuoted === null)) return null;
  return lines.reduce((n, l) => n + (lineValue(l) ?? 0), Number(o.deliveryCharge ?? 0));
}

export type OrderStep = { key: string; label: string; done: boolean; next: string };

/**
 * The steps of an order, in the order they happen (Cyrus, 7 Nov 2026). Stages
 * follow from these facts. Materials and the batch record join in later slices.
 * Once the goods have gone everything before it counts as done, because orders
 * from before the steps existed have none of these dates.
 */
export function orderSteps(o: OrderRow): OrderStep[] {
  const lines = liveLines(o);
  const gone = GONE.includes(o.status) || Boolean(o.gone?.complete);
  const steps = [
    { key: "lines", label: "Lines entered", done: lines.length > 0, next: "Enter what they want" },
    { key: "priced", label: "Prices agreed", done: lines.length > 0 && lines.every((l) => l.unitPriceQuoted !== null), next: "Agree the prices" },
    { key: "confirmed", label: "Confirmation sent", done: Boolean(o.confirmationSentOn), next: "Send the confirmation" },
    ...(o.customerNeeds
      ? [{ key: "customer", label: `From them: ${o.customerNeeds}`, done: Boolean(o.customerNeedsMetOn), next: `Needed from them: ${o.customerNeeds}` }]
      : []),
    { key: "production", label: "Production date set", done: Boolean(o.productionOn), next: "Set a production date" },
    { key: "packing", label: "Packing date set", done: Boolean(o.packingOn), next: "Set a packing date" },
    { key: "pallet", label: "Pallet build date set", done: Boolean(o.palletBuildOn), next: "Set a pallet build date" },
    { key: "carrier", label: "Carrier booked", done: Boolean(o.carrierBookedOn), next: "Book the carrier" },
    { key: "packed", label: "Pallet packed", done: Boolean(o.palletPackedOn), next: "Pack the pallet" },
  ];
  return [
    ...steps.map((s) => ({ ...s, done: s.done || gone })),
    { key: "gone", label: "Gone, on a QuickBooks invoice", done: gone, next: "Goes when it is invoiced in QuickBooks" },
  ];
}

/** The stage the facts have reached. An invoice moves it further, in settleOrders. */
export function factsStage(o: OrderRow, today: string): Stage {
  if (o.planned) return "received";
  if (o.productionOn) return o.productionOn <= today ? "in_production" : "committed";
  if (!o.confirmationSentOn) return "received";
  return orderSteps(o).find((s) => s.key === "priced")?.done ? "priced" : "acknowledged";
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
      unitPriceQuoted: wholesaleOrderLines.unitPriceQuoted,
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
  rows: { order: WholesaleOrder; customerName: string; customerOrderEmail: string | null; paymentTermsDays: number | null }[],
  lines: OrderLineRow[],
): OrderRow[] {
  return rows.map(({ order, ...customer }) => ({
    ...order,
    ...customer,
    lines: lines.filter((l) => l.orderId === order.id),
    gone: null,
  }));
}

/** Overdue first, then soonest date, then undated oldest first. */
export function sortOpen(orders: OrderRow[], today: string): OrderRow[] {
  const rank = (o: OrderRow) => (isOverdue(o, today) ? 0 : dispatchDate(o) ? 1 : 2);
  return [...orders].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (dispatchDate(a) ?? "").localeCompare(dispatchDate(b) ?? "") ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/**
 * Brings each order's stage up to its facts, so no one has to click it: dates
 * and the confirmation move it along, and a QuickBooks invoice for the whole
 * order, the authority, moves it to Invoiced. Only ever moves an order forward,
 * so a stage set by hand further on stays. Returns whether QuickBooks could be
 * read. Portal buyers are only emailed from the portal, so this tells no one.
 */
async function settleOrders(orders: OrderRow[], today: string): Promise<boolean> {
  if (orders.length === 0) return true;
  const earliest = orders.map((o) => o.raisedOn ?? londonToday(o.createdAt)).sort()[0];
  const since = new Date(`${earliest}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 30);
  const invoices = await readInvoices(since.toISOString().slice(0, 10));

  for (const order of orders) {
    if (invoices) order.gone = goneFor(order, invoices, today);
    const stage: Stage = order.gone?.complete ? "invoiced" : factsStage(order, today);
    if (STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(order.status)) {
      order.status = stage;
      await db.update(wholesaleOrders).set({ status: stage }).where(eq(wholesaleOrders.id, order.id));
    }
  }
  return invoices !== null;
}

export type OpenOrders = { orders: OrderRow[]; quickBooksRead: boolean };

export async function listOpenOrders(today: string = londonToday()): Promise<OpenOrders> {
  const rows = await db
    .select({
      order: wholesaleOrders,
      customerName: customers.name,
      customerOrderEmail: customers.orderEmail,
      paymentTermsDays: customers.paymentTermsDays,
    })
    .from(wholesaleOrders)
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .where(notInArray(wholesaleOrders.status, NOT_OPEN));
  const all = assemble(rows, await linesFor(rows.map((r) => r.order.id)));
  const quickBooksRead = await settleOrders(all, today);
  const open = all.filter((o) => !NOT_OPEN.includes(o.status));
  return { orders: sortOpen(open, today), quickBooksRead };
}

export async function getOrder(id: number): Promise<OrderRow | null> {
  const rows = await db
    .select({
      order: wholesaleOrders,
      customerName: customers.name,
      customerOrderEmail: customers.orderEmail,
      paymentTermsDays: customers.paymentTermsDays,
    })
    .from(wholesaleOrders)
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .where(eq(wholesaleOrders.id, id));
  if (rows.length === 0) return null;
  const [order] = assemble(rows, await linesFor([id]));
  await settleOrders([order], londonToday());
  return order;
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

  const overdue = orders.filter((o) => waitingOn(o, today).overdue);
  const toAnswer = orders.filter((o) => o.status === "received" && !o.planned && !o.confirmationSentOn && !o.waitingOn && !overdue.includes(o));
  const undated = orders.filter(
    (o) => !dispatchDate(o) && !o.waitingOn && !o.planned && o.status !== "received" && !GONE.includes(o.status),
  );
  const unmatched = orders.filter((o) => o.lines.some((l) => l.skuId === null));
  const toInvoice = orders.filter((o) => o.status === "dispatched");

  const prompts: OrderPrompt[] = [];
  if (overdue.length)
    prompts.push({
      text:
        overdue.length === 1
          ? `${overdue[0].customerName} ${overdue[0].orderNumber}: ${waitingOn(overdue[0], today).text}`
          : `${overdue.length} orders are past a date. Have they moved?`,
      href: one(overdue),
      urgent: true,
    });
  if (toAnswer.length)
    prompts.push({ text: `${plural(toAnswer.length, "new order", "new orders")} to confirm`, href: one(toAnswer), urgent: false });
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
