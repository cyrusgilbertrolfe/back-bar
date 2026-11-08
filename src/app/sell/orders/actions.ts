"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { components, customers, purchaseCommitments, skus, suppliers, wholesaleOrderLines, wholesaleOrders, type NewWholesaleOrder } from "@/db/schema";
import { MATERIAL_STATUSES, type MaterialStatus } from "@/lib/erp/order-materials";
import { dueDate, londonToday, nextDispatchNumber, STAGES, SOURCES, type Stage } from "@/lib/erp/orders";
import { getCurrentPrice } from "@/lib/erp/pricing";
import { confirmationPdf, confirmationSubject } from "@/lib/erp/order-confirmation";
import { getOrder } from "@/lib/erp/orders";
import { buyingQty, orderRequirements, shortName } from "@/lib/erp/order-requirements";
import { sendOrderMail } from "@/lib/email/send";

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
      unitPriceQuoted: string | null;
      quotedOn: string | null;
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

  // Most orders come in bottles (Cyrus, 7 Nov 2026). A count of bottles that
  // fills whole cases is kept as cases, so case labels can still be printed;
  // otherwise the packing is not known yet, as with "30 x Jeroboam".
  const inCases = form.get("countedIn") === "cases";
  const typedPerCase = text(form, "unitsPerCase");
  const typed = typedPerCase ? Number(typedPerCase) : null;
  if (typed !== null && (!Number.isInteger(typed) || typed < 1)) return { error: "Bottles a case must be a whole number." };
  if (!Number.isInteger(qty)) return { error: "The quantity must be a whole number." };
  let perCase = typed;
  if (perCase === null && skuId) {
    const [sku] = await db.select({ n: skus.unitsPerCase }).from(skus).where(eq(skus.id, skuId));
    perCase = sku?.n ?? null;
  }
  let cases = qty;
  let unitsPerCase: number | null = perCase;
  if (inCases) {
    if (perCase === null) return { error: "Say how many bottles a case, or count it in bottles." };
  } else if (perCase !== null && qty % perCase === 0) {
    cases = qty / perCase;
  } else if (typed !== null) {
    return { error: `${qty} bottles do not fill cases of ${typed} evenly.` };
  } else {
    unitsPerCase = null;
  }
  const typedPrice = moneyOf(form, "unitPrice", "The price a bottle");
  if ("error" in typedPrice) return { error: typedPrice.error };
  const listed = typedPrice.value === null && skuId ? await getCurrentPrice(skuId, "wholesale") : null;
  const price = typedPrice.value ?? listed?.amount ?? null;
  return {
    skuId,
    unitPriceQuoted: price,
    quotedOn: price === null ? null : londonToday(),
    customerDescription: description,
    customerItemCode: itemCode,
    qty: String(cases),
    unitsPerCase,
    unitDescription: unitsPerCase ? `Case ${unitsPerCase}` : null,
  };
}

/** A money field: null when blank, or what to complain about. */
function moneyOf(form: FormData, key: string, what: string): { value: string | null } | { error: string } {
  const raw = text(form, key)?.replace(/[£,]/g, "") ?? null;
  if (raw === null) return { value: null };
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? { value: raw } : { error: `${what} must be a price, like 111.50.` };
}

const ANCHOR = { line: "add-line", materials: "materials" } as const;

function backTo(path: string, error: string, at?: keyof typeof ANCHOR): never {
  redirect(`${path}?error=${encodeURIComponent(error)}${at ? `&at=${at}#${ANCHOR[at]}` : ""}`);
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
    planned: form.get("planned") === "on",
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
  const delivery = moneyOf(form, "deliveryCharge", "The delivery charge");
  if ("error" in delivery) backTo(path, delivery.error);
  await db
    .update(wholesaleOrders)
    .set({
      orderNumber,
      orderNumberIsOurs: changed ? false : order.orderNumberIsOurs,
      status: stageOf(form),
      ...dates,
      planned: form.get("planned") === "on",
      deliveryCharge: "value" in delivery ? delivery.value : null,
      priceNote: text(form, "priceNote"),
      confirmationSentOn: dateOf(form, "confirmationSentOn"),
      customerNeeds: text(form, "customerNeeds"),
      customerSuppliedComponentsDue: dateOf(form, "customerNeedsDue"),
      customerNeedsMetOn: dateOf(form, "customerNeedsMetOn"),
      productionOn: dateOf(form, "productionOn"),
      packingOn: dateOf(form, "packingOn"),
      palletBuildOn: dateOf(form, "palletBuildOn"),
      carrier: text(form, "carrier"),
      carrierBookedOn: dateOf(form, "carrierBookedOn"),
      collectionOn: dateOf(form, "collectionOn"),
      palletPackedOn: dateOf(form, "palletPackedOn"),
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
  if (!line) backTo(path, "Fill in the line first: what it is, and how many.", "line");
  if ("error" in line!) backTo(path, line.error, "line");
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

export async function setLinePrice(orderId: number, lineId: number, form: FormData) {
  const path = `/sell/orders/${orderId}`;
  const price = moneyOf(form, "unitPrice", "The price a bottle");
  if ("error" in price) backTo(path, price.error);
  const value = "value" in price ? price.value : null;
  await db
    .update(wholesaleOrderLines)
    .set({ unitPriceQuoted: value, quotedOn: value === null ? null : londonToday() })
    .where(and(eq(wholesaleOrderLines.id, lineId), eq(wholesaleOrderLines.orderId, orderId)));
  refresh(orderId);
  redirect(path);
}

/** One click after review: the PDF and the message go, then the step is done. */
export async function sendConfirmation(orderId: number, form: FormData) {
  const path = `/sell/orders/${orderId}/confirmation`;
  const to = text(form, "to");
  const message = text(form, "message");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) backTo(path, "Enter the email address it goes to.");
  if (!message) backTo(path, "The message is empty.");

  const order = await getOrder(orderId);
  if (!order) throw new Error("No such order");
  const pdf = await confirmationPdf(order);
  if (!pdf) backTo(path, "Every line needs a price first.");

  const failure = await sendOrderMail({
    to: to!,
    subject: confirmationSubject(order),
    text: message!,
    attachment: { filename: `Order confirmation ${order.orderNumber}.pdf`, content: pdf! },
  });
  if (failure) backTo(path, `Not sent: ${failure}`);

  await db.update(wholesaleOrders).set({ confirmationSentOn: londonToday() }).where(eq(wholesaleOrders.id, orderId));
  if (to !== order.customerOrderEmail) await db.update(customers).set({ orderEmail: to }).where(eq(customers.id, order.customerId));
  refresh(orderId);
  redirect(`/sell/orders/${orderId}`);
}

/** For a confirmation that went some other way, such as by hand from a phone. */
export async function markConfirmationSent(orderId: number) {
  await db.update(wholesaleOrders).set({ confirmationSentOn: londonToday() }).where(eq(wholesaleOrders.id, orderId));
  refresh(orderId);
  redirect(`/sell/orders/${orderId}`);
}

// ─── Materials: what an order needs bought ──────────────────────────────────

function materialStatusOf(form: FormData): MaterialStatus {
  const v = text(form, "status");
  return MATERIAL_STATUSES.find((s) => s.value === v)?.value ?? "needed";
}

/** The day it was ordered: today, the first time it moves past quoted. */
function orderedOnFor(status: MaterialStatus, before: string | null): string | null {
  if (before) return before;
  return status === "needed" || status === "quoted" || status === "cancelled" ? null : londonToday();
}

export async function addMaterial(orderId: number, form: FormData) {
  const path = `/sell/orders/${orderId}`;
  const description = text(form, "description");
  if (!description) backTo(path, "Say what needs buying.", "materials");
  const qtyRaw = text(form, "qty");
  const qty = qtyRaw === null ? 0 : Number(qtyRaw);
  if (!Number.isFinite(qty) || qty < 0) backTo(path, "The quantity must be a number.", "materials");
  const status = materialStatusOf(form);
  await db.insert(purchaseCommitments).values({
    wholesaleOrderId: orderId,
    description: description!,
    qty: String(qty),
    uom: text(form, "uom"),
    supplierName: text(form, "supplierName"),
    status,
    orderedOn: orderedOnFor(status, null),
    expectedOn: dateOf(form, "expectedOn"),
  });
  refresh(orderId);
  redirect(`${path}#materials`);
}

/** A worked-out requirement goes on the list to buy, once. Its quantity is worked out here, not sent by the page. */
export async function addRequirement(orderId: number, componentId: number) {
  const path = `/sell/orders/${orderId}`;
  const order = await getOrder(orderId);
  if (!order) throw new Error("No such order");
  if (order.materials.some((m) => m.componentId === componentId && m.status !== "cancelled")) {
    redirect(`${path}#materials`);
  }
  const { items } = await orderRequirements(order);
  const item = items.find((i) => i.componentId === componentId);
  if (!item || item.suppliedByCustomer || item.madeHere) backTo(path, "That is not something this order needs bought.", "materials");
  const { qty, uom } = buyingQty(item!.need, item!.uom);
  const [supplier] = await db
    .select({ name: suppliers.name })
    .from(components)
    .innerJoin(suppliers, eq(suppliers.id, components.defaultSupplierId))
    .where(eq(components.id, componentId));
  await db.insert(purchaseCommitments).values({
    wholesaleOrderId: orderId,
    componentId,
    description: shortName(item!.name),
    qty: String(qty),
    uom,
    supplierName: supplier?.name ?? null,
    status: "needed",
  });
  refresh(orderId);
  redirect(`${path}#materials`);
}

export async function updateMaterial(orderId: number, materialId: number, form: FormData) {
  const where = and(eq(purchaseCommitments.id, materialId), eq(purchaseCommitments.wholesaleOrderId, orderId));
  const [before] = await db.select().from(purchaseCommitments).where(where);
  if (!before) throw new Error("No such material");
  const status = materialStatusOf(form);
  await db
    .update(purchaseCommitments)
    .set({
      status,
      supplierName: text(form, "supplierName"),
      reference: text(form, "reference"),
      orderedOn: orderedOnFor(status, before.orderedOn),
      expectedOn: dateOf(form, "expectedOn"),
    })
    .where(where);
  refresh(orderId);
  redirect(`/sell/orders/${orderId}#materials`);
}

export async function removeMaterial(orderId: number, materialId: number) {
  await db
    .delete(purchaseCommitments)
    .where(and(eq(purchaseCommitments.id, materialId), eq(purchaseCommitments.wholesaleOrderId, orderId)));
  refresh(orderId);
  redirect(`/sell/orders/${orderId}#materials`);
}

/** "Nothing to buy": someone looked. Undone the same way. */
export async function setMaterialsChecked(orderId: number, checked: boolean) {
  await db
    .update(wholesaleOrders)
    .set({ materialsCheckedOn: checked ? londonToday() : null })
    .where(eq(wholesaleOrders.id, orderId));
  refresh(orderId);
  redirect(`/sell/orders/${orderId}#materials`);
}
