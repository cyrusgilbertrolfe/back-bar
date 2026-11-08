/**
 * What an order needs bought before it can be made: glass, ingredients, dry
 * goods. Each is a row in purchase_commitments against the order, followed
 * from needed to arrived (Cyrus, 21 Oct 2026). The trigger for building it was
 * the Cripps Jeroboams, which need new bottles (7 Nov 2026), and before that
 * the Gingertini's Kaveri, quoted short with its confirm-by date passing
 * untracked.
 *
 * It answers "have we bought it?", never "do we have it?": stock on hand is
 * parked. A supplier named here is internal and never reaches a customer
 * document.
 */

import { asc, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { componentPriceHistory, purchaseCommitments, suppliers } from "@/db/schema";

export const MATERIAL_STATUSES = [
  { value: "needed", label: "To order" },
  { value: "quoted", label: "Quoted" },
  { value: "placed", label: "Ordered" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "cancelled", label: "Not needed" },
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number]["value"];

export type MaterialRow = {
  id: number;
  orderId: number;
  componentId: number | null;
  description: string;
  qty: string;
  uom: string | null;
  supplierName: string | null;
  reference: string | null;
  orderedOn: string | null;
  expectedOn: string | null;
  status: MaterialStatus;
};

const TO_BUY: MaterialStatus[] = ["needed", "quoted"];
const ON_ORDER: MaterialStatus[] = ["placed", "confirmed"];

export function materialStatusLabel(status: string): string {
  return MATERIAL_STATUSES.find((s) => s.value === status)?.label ?? status;
}

/** "30 bottles Jeroboam glass", or the description alone when no quantity says more. */
export function materialText(m: Pick<MaterialRow, "description" | "qty" | "uom">): string {
  const qty = Number(m.qty);
  return qty > 0 ? `${qty}${m.uom ? ` ${m.uom}` : ""} ${m.description}` : m.description;
}

function names(ms: MaterialRow[]): string {
  const [first, second, ...rest] = ms.map((m) => m.description);
  if (!second) return first;
  if (rest.length === 0) return `${first} and ${second}`;
  return `${first}, ${second} and ${rest.length} more`;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export type MaterialsState = {
  /** Every material is in, or someone looked and nothing needs buying. */
  done: boolean;
  /** What the order is waiting on for its materials, if anything. */
  text: string | null;
  /** Something on order is past its expected date. */
  overdue: boolean;
  toBuy: MaterialRow[];
};

/**
 * Where an order's materials stand. Nothing listed and nobody has looked is
 * not done: the point is that someone asks the question for every order.
 */
export function materialsState(
  materials: MaterialRow[],
  checkedOn: string | null,
  today: string,
): MaterialsState {
  const live = materials.filter((m) => m.status !== "cancelled");
  const toBuy = live.filter((m) => TO_BUY.includes(m.status));
  const onOrder = live.filter((m) => ON_ORDER.includes(m.status));
  const late = onOrder.filter((m) => m.expectedOn !== null && m.expectedOn < today);

  if (late.length)
    return {
      done: false,
      overdue: true,
      toBuy,
      text: `${names(late)} due ${shortDate(late[0].expectedOn!)}: arrived?`,
    };
  if (toBuy.length) return { done: false, overdue: false, toBuy, text: `To order: ${names(toBuy)}` };
  if (onOrder.length) {
    const dates = onOrder.map((m) => m.expectedOn).filter((d): d is string => d !== null).sort();
    const due = dates.length === onOrder.length ? `, due ${shortDate(dates[dates.length - 1])}` : "";
    return { done: false, overdue: false, toBuy, text: `Waiting for ${names(onOrder)}${due}` };
  }
  return { done: live.length > 0 || checkedOn !== null, overdue: false, toBuy, text: null };
}

export async function materialsFor(orderIds: number[]): Promise<MaterialRow[]> {
  if (orderIds.length === 0) return [];
  const rows = await db
    .select({
      id: purchaseCommitments.id,
      orderId: purchaseCommitments.wholesaleOrderId,
      componentId: purchaseCommitments.componentId,
      description: purchaseCommitments.description,
      qty: purchaseCommitments.qty,
      uom: purchaseCommitments.uom,
      supplierName: purchaseCommitments.supplierName,
      reference: purchaseCommitments.reference,
      orderedOn: purchaseCommitments.orderedOn,
      expectedOn: purchaseCommitments.expectedOn,
      status: purchaseCommitments.status,
    })
    .from(purchaseCommitments)
    .where(inArray(purchaseCommitments.wholesaleOrderId, orderIds))
    .orderBy(asc(purchaseCommitments.id));
  return rows.map((r) => ({ ...r, orderId: r.orderId!, description: r.description ?? "Unnamed" }));
}

/**
 * Names to offer in the supplier box: the suppliers table, and whoever we have
 * bought from. Typing a new name still works, so the list grows as we buy.
 */
export async function supplierNames(): Promise<string[]> {
  const [listed, bought, invoiced] = await Promise.all([
    db.select({ name: suppliers.name }).from(suppliers),
    db.select({ name: purchaseCommitments.supplierName }).from(purchaseCommitments).where(isNotNull(purchaseCommitments.supplierName)),
    db.select({ name: componentPriceHistory.invoiceSupplier }).from(componentPriceHistory).where(isNotNull(componentPriceHistory.invoiceSupplier)),
  ]);
  const names = [...listed, ...bought, ...invoiced].map((r) => r.name!.trim()).filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}
