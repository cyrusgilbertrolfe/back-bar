"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { stockCounts, stockCountLines } from "@/db/schema";
import { closeCount, createCount, reopenCount } from "@/lib/erp/stock-count";

function readStr(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

function readDate(form: FormData, key: string, label: string): string {
  const v = readStr(form, key);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${label} must be a date`);
  return v;
}

function readQty(v: string | null): string | null {
  if (v == null) return null;
  const x = Number(v);
  if (!Number.isFinite(x) || x < 0) throw new Error("Quantity must be a non-negative number");
  return v;
}

async function assertDraft(countId: number) {
  const [c] = await db.select().from(stockCounts).where(eq(stockCounts.id, countId));
  if (!c) throw new Error(`No stock count ${countId}`);
  if (c.status !== "draft") throw new Error("This count is closed. Reopen it to change a line.");
}

export async function startCount(form: FormData) {
  const id = await createCount({
    asAt: readDate(form, "asAt", "As at"),
    countedOn: readStr(form, "countedOn"),
    countedBy: readStr(form, "countedBy"),
    basis: readStr(form, "basis"),
  });
  revalidatePath("/production/audit");
  redirect(`/production/audit/${id}`);
}

export async function updateCountDetails(countId: number, form: FormData) {
  await db
    .update(stockCounts)
    .set({
      countedOn: readStr(form, "countedOn"),
      countedBy: readStr(form, "countedBy"),
      basis: readStr(form, "basis"),
      notes: readStr(form, "notes"),
      updatedAt: new Date(),
    })
    .where(eq(stockCounts.id, countId));
  revalidatePath(`/production/audit/${countId}`);
}

/**
 * Saves one line as it is typed. A cleared quantity goes back to "not
 * counted", never to zero: zero is a count.
 */
export async function saveLine(
  countId: number,
  lineId: number,
  patch: { quantity?: string | null; unit?: string; obsolete?: boolean; note?: string | null; location?: string; unitCost?: string | null },
) {
  await assertDraft(countId);
  const set: Partial<typeof stockCountLines.$inferInsert> = { updatedAt: new Date() };
  if ("quantity" in patch) set.quantity = readQty(patch.quantity?.trim() || null);
  if (patch.unit) set.unit = patch.unit;
  if (typeof patch.obsolete === "boolean") set.obsolete = patch.obsolete;
  if ("note" in patch) set.note = patch.note?.trim() || null;
  if (patch.location) set.location = patch.location.trim();
  if ("unitCost" in patch) set.unitCost = readQty(patch.unitCost?.trim() || null);
  await db
    .update(stockCountLines)
    .set(set)
    .where(and(eq(stockCountLines.id, lineId), eq(stockCountLines.countId, countId)));
  revalidatePath(`/production/audit/${countId}`);
}

export async function addLine(countId: number, form: FormData) {
  await assertDraft(countId);
  const kind = readStr(form, "kind");
  const location = readStr(form, "location") ?? "Unit";
  const quantity = readQty(readStr(form, "quantity"));
  const note = readStr(form, "note");
  if (kind === "bulk") {
    const [drinkId, clientId] = (readStr(form, "recipe") ?? "").split(":").map(Number);
    if (!drinkId || !clientId) throw new Error("Choose a drink");
    await db.insert(stockCountLines).values({ countId, kind, drinkId, clientId, location, quantity, unit: "litre", note });
  } else if (kind === "finished") {
    const skuId = Number(readStr(form, "skuId"));
    if (!skuId) throw new Error("Choose a SKU");
    await db.insert(stockCountLines).values({ countId, kind, skuId, location, quantity, unit: "bottle", note });
  } else if (kind === "other") {
    const description = readStr(form, "description");
    if (!description) throw new Error("Say what it is");
    await db.insert(stockCountLines).values({
      countId,
      kind,
      description,
      location,
      quantity,
      unit: readStr(form, "unit") ?? "each",
      unitCost: readQty(readStr(form, "unitCost")),
      note,
    });
  } else {
    throw new Error("Unknown line kind");
  }
  revalidatePath(`/production/audit/${countId}`);
}

export async function removeLine(countId: number, lineId: number) {
  await assertDraft(countId);
  await db.delete(stockCountLines).where(and(eq(stockCountLines.id, lineId), eq(stockCountLines.countId, countId)));
  revalidatePath(`/production/audit/${countId}`);
}

export async function close(countId: number) {
  await closeCount(countId);
  revalidatePath(`/production/audit/${countId}`);
  revalidatePath("/production/audit");
}

export async function reopen(countId: number, form: FormData) {
  const reason = readStr(form, "reason");
  if (!reason) throw new Error("Say why it is being reopened");
  await reopenCount(countId, reason);
  revalidatePath(`/production/audit/${countId}`);
  revalidatePath("/production/audit");
}
