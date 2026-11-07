"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { customers, skus, wholesaleOrderLines, wholesaleOrders, type NewWholesaleOrder } from "@/db/schema";
import { dueDate, nextDispatchNumber, STAGES, SOURCES, type Stage } from "@/lib/erp/orders";

function text(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

function dateOf(form: FormData, key: string): string | null {
  const v = text(form, key);
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${key} is not a date`);
  return v;
}

function idOf(form: FormData, key: string): number | null {
  const v = text(form, key);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${key} is not valid`);
  return n;
}

function stageOf(form: FormData): Stage {
  const v = text(form, "status");
  const stage = STAGES.find((s) => s.value === v);
  if (!stage) throw new Error("Unknown stage");
  return stage.value;
}

function sourceOf(form: FormData) {
  const v = text(form, "source");
  const source = SOURCES.find((s) => s.value === v);
  if (!source) throw new Error("Unknown source");
  return source.value;
}

/** The form's line fields, or an error to show. Null when the line was left blank. */
async function readLine(form: FormData): Promise<
  | { error: string }
  | {
      skuId: number | null;
      customerDescription: string | null;
      customerItemCode: string | null;
      qty: string;
      unitsPerCase: number | null;
      unitDescription: string | null;
    }
  | null
> {
  const skuId = idOf(form, "skuId");
  const description = text(form, "customerDescription");
  const itemCode = text(form, "customerItemCode");
  const qtyRaw = text(form, "qty");
  if (!skuId && !description && !qtyRaw) return null;

  if (!skuId && !description) return { error: "Say what the line is: choose a SKU or describe it." };
  const qty = Number(qtyRaw);
  if (!qtyRaw || !Number.isFinite(qty) || qty <= 0) return { error: "A line needs a quantity above zero." };

  const typedPerCase = text(form, "unitsPerCase");
  let unitsPerCase: number | null = typedPerCase ? Number(typedPerCase) : null;
  if (unitsPerCase !== null && (!Number.isInteger(unitsPerCase) || unitsPerCase < 1))
    return { error: "Bottles a case must be a whole number." };
  if (unitsPerCase === null && skuId) {
    const [sku] = await db.select({ n: skus.unitsPerCase }).from(skus).where(eq(skus.id, skuId));
    unitsPerCase = sku?.n ?? null;
  }
  return {
    skuId,
    customerDescription: description,
    customerItemCode: itemCode,
    qty: String(qty),
    unitsPerCase,
    unitDescription: unitsPerCase ? `Case ${unitsPerCase}` : null,
  };
}

function backTo(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function refresh(orderId?: number) {
  revalidatePath("/");
  revalidatePath("/sell/orders");
  if (orderId) revalidatePath(`/sell/orders/${orderId}`);
}

export async function createOrder(form: FormData) {
  const path = "/sell/orders/new";
  const po = text(form, "orderNumber");
  const line = await readLine(form);
  if (line && "error" in line) backTo(path, line.error);

  let customerId = idOf(form, "customerId");
  const newName = text(form, "newCustomerName");
  const newCode = text(form, "newCustomerCode")?.toUpperCase() ?? null;
  if (!customerId && !newName) backTo(path, "Choose the customer, or name a new one.");
  if (newCode && !/^[A-Z]{4}$/.test(newCode)) backTo(path, "A customer code is four letters, like CRPS.");

  let shortCode: string | null = newCode;
  if (customerId) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    if (!customer) backTo(path, "That customer no longer exists.");
    shortCode = customer.shortCode;
  } else {
    const [clash] = await db.select({ id: customers.id }).from(customers).where(eq(customers.name, newName!));
    if (clash) backTo(path, `${newName} is already a customer. Choose them from the list.`);
  }
  if (!po && !shortCode) backTo(path, "With no PO we issue a dispatch number, which needs a four-letter customer code.");

  if (!customerId) {
    const [created] = await db.insert(customers).values({ name: newName!, shortCode: newCode }).returning({ id: customers.id });
    customerId = created.id;
  }

  const orderNumber = po ?? (await nextDispatchNumber(shortCode!));
  const [clash] = await db
    .select({ id: wholesaleOrders.id })
    .from(wholesaleOrders)
    .where(and(eq(wholesaleOrders.customerId, customerId), eq(wholesaleOrders.orderNumber, orderNumber)));
  if (clash) backTo(path, `This customer already has an order numbered ${orderNumber}.`);

  const date = dateOf(form, "date");
  const values: NewWholesaleOrder = {
    customerId,
    orderNumber,
    orderNumberIsOurs: !po,
    raisedOn: dateOf(form, "raisedOn"),
    receivedAt: new Date(),
    status: "received",
    source: sourceOf(form),
    requestedDeliveryFrom: date,
    requestedDeliveryTo: date,
    deliveryAddress: text(form, "deliveryAddress"),
    waitingOn: text(form, "waitingOn"),
    notes: text(form, "notes"),
  };
  const [order] = await db.insert(wholesaleOrders).values(values).returning({ id: wholesaleOrders.id });
  if (line) await db.insert(wholesaleOrderLines).values({ orderId: order.id, lineNo: 1, ...line });

  refresh(order.id);
  redirect(`/sell/orders/${order.id}`);
}

export async function updateOrder(orderId: number, form: FormData) {
  const path = `/sell/orders/${orderId}`;
  const [order] = await db.select().from(wholesaleOrders).where(eq(wholesaleOrders.id, orderId));
  if (!order) throw new Error("No such order");

  // Their PO arriving replaces our dispatch number: whose number a shipment
  // carries is the shipment's fact (Cyrus, 15 Oct 2026).
  const typed = text(form, "orderNumber");
  if (!typed) backTo(path, "An order needs a number.");
  const orderNumber = typed!;
  const changed = orderNumber !== order.orderNumber;
  if (changed) {
    const [clash] = await db
      .select({ id: wholesaleOrders.id })
      .from(wholesaleOrders)
      .where(and(eq(wholesaleOrders.customerId, order.customerId), eq(wholesaleOrders.orderNumber, orderNumber)));
    if (clash) backTo(path, `This customer already has an order numbered ${orderNumber}.`);
  }

  // An untouched date keeps a delivery window, such as Fortnum's 26 to 30 Oct.
  const date = dateOf(form, "date");
  const dates =
    date === dueDate(order) ? {} : { requestedDeliveryFrom: date, requestedDeliveryTo: date };
  await db
    .update(wholesaleOrders)
    .set({
      orderNumber,
      orderNumberIsOurs: changed ? false : order.orderNumberIsOurs,
      status: stageOf(form),
      ...dates,
      deliveryAddress: text(form, "deliveryAddress"),
      waitingOn: text(form, "waitingOn"),
      notes: text(form, "notes"),
    })
    .where(eq(wholesaleOrders.id, orderId));

  refresh(orderId);
  redirect(path);
}

export async function addLine(orderId: number, form: FormData) {
  const path = `/sell/orders/${orderId}`;
  const line = await readLine(form);
  if (!line) backTo(path, "Fill in the line first.");
  if ("error" in line!) backTo(path, line.error);
  const existing = await db
    .select({ lineNo: wholesaleOrderLines.lineNo })
    .from(wholesaleOrderLines)
    .where(eq(wholesaleOrderLines.orderId, orderId));
  const lineNo = Math.max(0, ...existing.map((l) => l.lineNo ?? 0)) + 1;
  await db.insert(wholesaleOrderLines).values({ orderId, lineNo, ...line! });
  refresh(orderId);
  redirect(path);
}

export async function removeLine(orderId: number, lineId: number) {
  await db
    .delete(wholesaleOrderLines)
    .where(and(eq(wholesaleOrderLines.id, lineId), eq(wholesaleOrderLines.orderId, orderId)));
  refresh(orderId);
  redirect(`/sell/orders/${orderId}`);
}
