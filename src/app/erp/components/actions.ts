"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  components,
  componentAbvHistory,
  componentPriceHistory,
  type Component,
  type NewComponent,
  type NewComponentAbvHistoryRow,
  type NewComponentPriceHistoryRow,
} from "@/db/schema";

const COMPONENT_TYPES = ["ingredient", "sub_recipe", "dry_good", "packaging"] as const;
const UOMS = ["ml", "g", "each", "m"] as const;

const ABV_SOURCES = ["bottle", "manufacturer", "supplier_invoice", "assumed", "placeholder"] as const;
type AbvSource = (typeof ABV_SOURCES)[number];
/** Sources that claim something checkable, so must say what to go and check. */
const NEEDS_REFERENCE: readonly AbvSource[] = ["bottle", "manufacturer", "supplier_invoice"];

function readStr(form: FormData, key: string): string | null {
  const raw = form.get(key);
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed === "" ? null : trimmed;
}

function readNum(form: FormData, key: string): string | null {
  const v = readStr(form, key);
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number`);
  return v;
}

function readPositiveNum(form: FormData, key: string, label: string): string {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero`);
  return v;
}

function readNonNegNum(form: FormData, key: string, label: string): string {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a non-negative number`);
  return v;
}

function readInt(form: FormData, key: string): number | null {
  const v = readStr(form, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative integer`);
  return n;
}

function readEnum<T extends readonly string[]>(
  form: FormData,
  key: string,
  allowed: T,
  label: string,
): T[number] {
  const v = readStr(form, key);
  if (!v) throw new Error(`${label} is required`);
  if (!(allowed as readonly string[]).includes(v)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return v as T[number];
}

function readSupplier(form: FormData): number | null {
  const v = readStr(form, "defaultSupplierId");
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function deriveUnitCost(packSize: string, packCost: string): string {
  const size = Number(packSize);
  const cost = Number(packCost);
  return (cost / size).toFixed(4);
}

function buildPayload(form: FormData): NewComponent {
  const name = readStr(form, "name");
  if (!name) throw new Error("Name is required");

  const type = readEnum(form, "type", COMPONENT_TYPES, "Type");
  const uom = readEnum(form, "uom", UOMS, "UOM");

  const packSize = readPositiveNum(form, "packSize", "Pack size");
  const packCost = readNonNegNum(form, "packCost", "Pack cost");

  return {
    name,
    type,
    uom,
    defaultSupplierId: readSupplier(form),
    packSize,
    packCost,
    unitCost: deriveUnitCost(packSize, packCost),
    unitCostSetAt: new Date(),
    reorderThreshold: readNum(form, "reorderThreshold"),
    reorderQuantity: readNum(form, "reorderQuantity"),
    leadTimeDays: readInt(form, "leadTimeDays"),
    storageLocation: readStr(form, "storageLocation"),
    notes: readStr(form, "notes"),
    abv: readNum(form, "abv"),
    productName: readStr(form, "productName"),
    shelfLifeDays: readInt(form, "shelfLifeDays"),
  };
}

type AbvChange = {
  abv: string;
  productName: string | null;
  source: AbvSource;
  sourceRef: string | null;
  note: string;
};

/** Numeric equality that treats two blanks as equal and a blank as unequal to a number. */
function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Number(a) === Number(b);
}

/**
 * Decide whether this save changes the ABV or the product, and if it does,
 * insist on provenance for the new figure. Returns null when neither changed.
 *
 * Added 13 Sept 2026. Before this, the form wrote `abv` straight onto the row:
 * a price change earned a history entry and an ABV change got an overwrite.
 * Worse, `abv_source` was left untouched, so typing over the in-house gin's
 * invoice-sourced 43% would have left the new number still claiming that
 * invoice. That is why the source fields on the form always start empty — a
 * changed figure must declare its own provenance and can never inherit the last
 * one's. Validation runs before any write, so a refused save changes nothing.
 */
function resolveAbvChange(
  form: FormData,
  existing: Pick<Component, "abv" | "productName"> | null,
  nextAbv: string | null,
  nextProduct: string | null,
): AbvChange | null {
  const abvChanged = !sameNumber(existing?.abv, nextAbv);
  const productChanged = (existing?.productName ?? null) !== nextProduct;
  if (!abvChanged && !productChanged) return null;

  if (existing?.abv != null && nextAbv == null) {
    throw new Error(
      "An ABV can't be removed here. Every recipe treats a blank ABV as 0%, which " +
        "silently understates the drink. Enter the correct figure with its source instead.",
    );
  }
  if (nextAbv == null) {
    throw new Error(
      "Record an ABV alongside the product — 0 for anything non-alcoholic — so the " +
        "change is kept in the ABV history.",
    );
  }
  if (Number(nextAbv) > 100) throw new Error("ABV can't be more than 100%.");

  const rawSource = readStr(form, "abvSource");
  if (!rawSource) {
    throw new Error(
      "You changed the ABV or the product. Choose where the new figure came from — " +
        "a changed ABV can't be saved without a source.",
    );
  }
  if (!(ABV_SOURCES as readonly string[]).includes(rawSource)) {
    throw new Error(`ABV source must be one of: ${ABV_SOURCES.join(", ")}`);
  }
  const source = rawSource as AbvSource;
  const sourceRef = readStr(form, "abvSourceRef");
  if (NEEDS_REFERENCE.includes(source) && !sourceRef) {
    throw new Error(
      "Add a reference for that source — the invoice number, the producer's URL, or " +
        "where the bottle was read — so someone can check it later.",
    );
  }

  const changes: string[] = [];
  if (abvChanged) changes.push(`ABV ${existing?.abv ?? "none"}% → ${nextAbv}%`);
  if (productChanged) {
    changes.push(`product "${existing?.productName ?? "none"}" → "${nextProduct ?? "none"}"`);
  }
  return {
    abv: nextAbv,
    productName: nextProduct,
    source,
    sourceRef,
    note: `${existing ? "Changed" : "Set on creation"} via the component form: ${changes.join("; ")}.`,
  };
}

function abvHistoryRow(componentId: number, change: AbvChange): NewComponentAbvHistoryRow {
  return {
    componentId,
    abv: change.abv,
    productName: change.productName,
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: change.source,
    sourceRef: change.sourceRef,
    notes: change.note,
  };
}

export async function createComponent(form: FormData) {
  const payload = buildPayload(form);
  const abvChange = resolveAbvChange(form, null, payload.abv ?? null, payload.productName ?? null);

  const [inserted] = await db
    .insert(components)
    .values({
      ...payload,
      ...(abvChange ? { abvSource: abvChange.source, abvSetAt: new Date() } : {}),
    })
    .returning({ id: components.id });

  // First price-history entry — manual source, since this is component creation.
  const historyRow: NewComponentPriceHistoryRow = {
    componentId: inserted.id,
    supplierId: payload.defaultSupplierId ?? null,
    unitCost: payload.unitCost!,
    currency: "GBP",
    uom: payload.uom,
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: "manual",
    notes: `Initial price set on creation: pack ${payload.packSize}${payload.uom} @ £${payload.packCost}`,
  };
  await db.insert(componentPriceHistory).values(historyRow);

  if (abvChange) {
    await db.insert(componentAbvHistory).values(abvHistoryRow(inserted.id, abvChange));
  }

  revalidatePath("/erp/components");
  revalidatePath("/erp");
  redirect("/erp/components");
}

export async function updateComponent(id: number, form: FormData) {
  const payload = buildPayload(form);

  const [existing] = await db.select().from(components).where(eq(components.id, id)).limit(1);
  if (!existing) throw new Error(`Component ${id} not found`);

  const abvChange = resolveAbvChange(
    form,
    existing,
    payload.abv ?? null,
    payload.productName ?? null,
  );

  await db
    .update(components)
    .set({
      ...payload,
      ...(abvChange ? { abvSource: abvChange.source, abvSetAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(components.id, id));

  // If pack_cost or pack_size changed (compare numerically — Postgres normalises
  // numeric representation), write a price-history row so the change is auditable.
  const packCostChanged =
    Number(existing.packCost ?? "NaN") !== Number(payload.packCost);
  const packSizeChanged =
    Number(existing.packSize ?? "NaN") !== Number(payload.packSize);

  if (packCostChanged || packSizeChanged) {
    const before = `${existing.packSize ?? "?"}${existing.uom} @ £${existing.packCost ?? "?"}`;
    const after = `${payload.packSize}${payload.uom} @ £${payload.packCost}`;
    const historyRow: NewComponentPriceHistoryRow = {
      componentId: id,
      supplierId: payload.defaultSupplierId ?? null,
      unitCost: payload.unitCost!,
      currency: "GBP",
      uom: payload.uom,
      effectiveDate: new Date().toISOString().slice(0, 10),
      source: "manual",
      notes: `Manual edit: ${before} → ${after}`,
    };
    await db.insert(componentPriceHistory).values(historyRow);
  }

  // The ABV counterpart of the block above: a changed ABV or product is an
  // auditable dated event with a source, never an overwrite.
  if (abvChange) {
    await db.insert(componentAbvHistory).values(abvHistoryRow(id, abvChange));
  }

  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
  redirect("/erp/components");
}

export async function setComponentActive(id: number, active: boolean) {
  await db
    .update(components)
    .set({ active, updatedAt: new Date() })
    .where(eq(components.id, id));
  revalidatePath("/erp/components");
  revalidatePath(`/erp/components/${id}`);
}
