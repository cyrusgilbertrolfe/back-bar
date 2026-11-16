/**
 * Orders that go by parcel rather than on a pallet: boxes by Royal Mail, for an
 * order too small for a pallet (Cyrus, 15 Nov 2026, first DUGD-DN00004 to
 * DuGARD).
 *
 * Boxes come at a fixed count for their bottle: 250ml in boxes of 12, 500ml in
 * boxes of 6, which hold the bottles absolutely still. Each product fills whole
 * boxes of its own first; what is left over of each size goes into mixed boxes
 * of that size, since mixed cases are offered (Cyrus, 15 Nov 2026). The last
 * box of a size may be part full, and says so. The boxes are worked out from
 * the lines, never typed.
 *
 * An order goes by parcel at ten boxes or fewer, and on a pallet above that,
 * unless someone chooses (Cyrus, 15 Nov 2026: a pallet costs at least £80).
 *
 * Each box gets two labels, both on the Zebra: a covert one outside, which
 * says nothing of what is inside or who made it, and a contents label inside,
 * on top of the bottles.
 */

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { customers, drinks, skus, wholesaleOrderLines, wholesaleOrders } from "@/db/schema";
import type { CaseLabelFacts } from "@/lib/labels/case-labels";

export const SHIPPING_METHODS = [
  { value: "pallet", label: "Pallet" },
  { value: "parcel", label: "Parcel, in boxes" },
] as const;

export type ShippingMethod = (typeof SHIPPING_METHODS)[number]["value"];

/** Bottles to a parcel box, by bottle size in ml. */
export const PARCEL_BOX_BOTTLES: Record<number, number> = { 250: 12, 500: 6 };

/** At or below this many boxes an order goes by post; above it, on a pallet. */
export const PARCEL_MAX_BOXES = 10;

/** A packed box, either size (Cyrus, 15 Nov 2026). Used for the carrier booking. */
export const PARCEL_BOX_KG = 7.5;

export type ParcelLine = {
  id: number;
  bottles: number;
  drinkName: string | null;
  sizeMl: number | null;
  shortCode: string | null;
};

export type BoxContent = { lineId: number; drink: string; shortCode: string; bottles: number };

export type ParcelBox = {
  sizeMl: number;
  /** Bottles it is made for: 12 or 6. */
  capacity: number;
  contents: BoxContent[];
};

export type BoxPlan = {
  boxes: ParcelBox[];
  /** Why the order cannot go in parcel boxes at all. */
  problems: string[];
  /** Worth knowing when packing, such as a part-full box. */
  notes: string[];
};

export const boxBottles = (b: ParcelBox) => b.contents.reduce((n, c) => n + c.bottles, 0);
export const isMixed = (b: ParcelBox) => b.contents.length > 1;

/** "Negroni 500ml", or for a mixed box "6 Manhattan, 6 Rum Old Fashioned 250ml". */
export function boxProduct(b: ParcelBox): string {
  if (!isMixed(b)) return `${b.contents[0].drink} ${b.sizeMl}ml`;
  return `${b.contents.map((c) => `${c.bottles} ${c.drink}`).join(", ")} ${b.sizeMl}ml`;
}

export function boxPlan(lines: ParcelLine[]): BoxPlan {
  const problems: string[] = [];
  const bySize = new Map<number, BoxContent[]>();
  for (const l of lines) {
    if (l.bottles <= 0) continue;
    if (!l.drinkName || !l.sizeMl || !l.shortCode) {
      problems.push(`A line of ${l.bottles} bottles has no SKU matched, so its box cannot be worked out.`);
      continue;
    }
    if (!PARCEL_BOX_BOTTLES[l.sizeMl]) {
      problems.push(`${l.drinkName} ${l.sizeMl}ml: there is no parcel box for a ${l.sizeMl}ml bottle, only 250ml (12) and 500ml (6).`);
      continue;
    }
    if (!Number.isInteger(l.bottles)) {
      problems.push(`${l.drinkName} ${l.sizeMl}ml: ${l.bottles} is not a whole number of bottles.`);
      continue;
    }
    const list = bySize.get(l.sizeMl) ?? [];
    list.push({ lineId: l.id, drink: l.drinkName, shortCode: l.shortCode, bottles: l.bottles });
    bySize.set(l.sizeMl, list);
  }

  const boxes: ParcelBox[] = [];
  const notes: string[] = [];
  for (const [sizeMl, items] of [...bySize].sort(([a], [b]) => b - a)) {
    const capacity = PARCEL_BOX_BOTTLES[sizeMl];
    // Whole boxes of one product first, so as few boxes as possible are mixed.
    const left: BoxContent[] = [];
    for (const item of items) {
      for (let i = 0; i < Math.floor(item.bottles / capacity); i++) boxes.push({ sizeMl, capacity, contents: [{ ...item, bottles: capacity }] });
      if (item.bottles % capacity) left.push({ ...item, bottles: item.bottles % capacity });
    }
    // Then what is left of each, in line order, into mixed boxes.
    let box: ParcelBox | null = null;
    for (const item of left) {
      let rest = item.bottles;
      while (rest > 0) {
        if (!box || boxBottles(box) === capacity) {
          box = { sizeMl, capacity, contents: [] };
          boxes.push(box);
        }
        const take = Math.min(rest, capacity - boxBottles(box));
        box.contents.push({ ...item, bottles: take });
        rest -= take;
      }
    }
    if (box && boxBottles(box) < capacity)
      notes.push(`One ${sizeMl}ml box holds ${boxBottles(box)} of ${capacity}: fill the gaps so the bottles cannot move.`);
  }
  return { boxes, problems, notes };
}

/** Parcel at ten boxes or fewer, unless someone chose; pallet when it cannot go in boxes. */
export function shippingMethodFor(chosen: string | null, plan: BoxPlan): ShippingMethod {
  if (chosen === "pallet" || chosen === "parcel") return chosen;
  return plan.problems.length === 0 && plan.boxes.length > 0 && plan.boxes.length <= PARCEL_MAX_BOXES ? "parcel" : "pallet";
}

/** The contents label for each box, CASE n OF N counted across the order. */
export function boxContentsFacts(
  plan: BoxPlan,
  order: { orderNumber: string; orderNumberIsOurs: boolean; customerName: string },
): CaseLabelFacts[] {
  return plan.boxes.map((b) => ({
    orderNumber: order.orderNumber,
    orderNumberIsOurs: order.orderNumberIsOurs,
    customerItemCode: null,
    customerDescription: boxProduct(b),
    supplierSku: isMixed(b) ? "MIXED" : b.contents[0].shortCode,
    unitsPerCase: boxBottles(b),
    supplierAccountCode: null,
    clientShortName: order.customerName,
  }));
}

export type ParcelOrder = {
  id: number;
  orderNumber: string;
  orderNumberIsOurs: boolean;
  shippingMethod: ShippingMethod;
  customerName: string;
  plan: BoxPlan;
};

/**
 * An order and its boxes, by id or number. Reads only: unlike getOrder it
 * neither reads QuickBooks nor moves the order's stage, so a label download
 * or a script has no side effects.
 */
export async function loadParcelOrder(by: { id: number } | { orderNumber: string }): Promise<ParcelOrder | null> {
  const [order] = await db
    .select({
      id: wholesaleOrders.id,
      orderNumber: wholesaleOrders.orderNumber,
      orderNumberIsOurs: wholesaleOrders.orderNumberIsOurs,
      chosen: wholesaleOrders.shippingMethod,
      customerName: customers.name,
    })
    .from(wholesaleOrders)
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .where("id" in by ? eq(wholesaleOrders.id, by.id) : eq(wholesaleOrders.orderNumber, by.orderNumber));
  if (!order) return null;

  const lines = await db
    .select({
      id: wholesaleOrderLines.id,
      qty: wholesaleOrderLines.qty,
      unitsPerCase: wholesaleOrderLines.unitsPerCase,
      drinkName: drinks.name,
      sizeMl: skus.sizeMl,
      shortCode: skus.shortCode,
    })
    .from(wholesaleOrderLines)
    .leftJoin(skus, eq(skus.id, wholesaleOrderLines.skuId))
    .leftJoin(drinks, eq(drinks.id, skus.drinkId))
    .where(eq(wholesaleOrderLines.orderId, order.id))
    .orderBy(asc(wholesaleOrderLines.lineNo), asc(wholesaleOrderLines.id));

  // A line with no case size is counted in bottles (Cyrus, 7 Nov 2026).
  const plan = boxPlan(lines.map((l) => ({ ...l, bottles: Number(l.qty) * (l.unitsPerCase ?? 1) })));
  const { chosen, ...rest } = order;
  return { ...rest, shippingMethod: shippingMethodFor(chosen, plan), plan };
}

/** Tracking numbers typed one a line, blanks dropped. */
export function trackingFrom(text: string | null): string[] | null {
  const numbers = (text ?? "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  return numbers.length ? numbers : null;
}
