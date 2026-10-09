"use server";

/**
 * Server Action for updating ingredient prices.
 *
 * Writes to the database, not to a JSON file: the `components` row is updated
 * (pack cost, cached unit cost, set-at stamp) and a `component_price_history`
 * row is appended with source "manual", so the append-only audit trail lives
 * in the same place as the price itself.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  type NewComponentPriceHistoryRow,
} from "@/db/schema";
import { scheduleCogsSnapshot } from "@/lib/erp/cogs-movement";

export interface UpdatedIngredient {
  id: number;
  name: string;
  packSize: number | null;
  packCost: number | null;
  unitCost: number;
  unitCostSetAt: string;
}

export type UpdatePriceResult =
  | { ok: true; ingredient: UpdatedIngredient }
  | { ok: false; error: string };

/**
 * Set a new price for a component.
 *
 * `newPrice` is the PACK cost when the component has a pack size greater than
 * one (e.g. £15.17 for a 700ml bottle), otherwise it is the unit cost
 * directly (each-priced dry goods). The cached per-UOM unit cost is re-derived
 * and a manual price-history row is appended either way.
 *
 * `invoice` names the invoice the price was read from. With it the row counts
 * as invoice-backed; it may be given at an unchanged price, which records that
 * a new invoice confirms the price in use. Supplier and number go together.
 */
export async function updateIngredientPrice(
  componentId: number,
  newPrice: number,
  note?: string,
  invoice?: { supplier?: string | null; ref?: string | null },
): Promise<UpdatePriceResult> {
  if (!Number.isInteger(componentId) || componentId <= 0) {
    return { ok: false, error: "componentId must be a positive integer." };
  }
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return { ok: false, error: "Price must be a non-negative number." };
  }
  const invoiceSupplier = invoice?.supplier?.trim() || null;
  const invoiceRef = invoice?.ref?.trim() || null;
  if (!invoiceSupplier !== !invoiceRef) {
    return {
      ok: false,
      error: "Give both the supplier and the invoice number, or neither, so the invoice can be found again.",
    };
  }

  try {
    const [existing] = await db
      .select()
      .from(components)
      .where(eq(components.id, componentId));
    if (!existing) {
      return { ok: false, error: `No component with id ${componentId}.` };
    }

    const packSize = Number(existing.packSize ?? 0);
    const pricedByPack = Number.isFinite(packSize) && packSize > 1;
    /**
     * A pack size of exactly 1 means pack cost and unit cost are the SAME
     * FACT, so both have to move together.
     *
     * They did not, until 19 Aug 2026. `pricedByPack` was the only thing
     * gating the packCost write, and it is false at packSize 1, so every
     * each-priced dry good written through this action or the MCP kept its
     * original packCost for ever while unitCost moved underneath it. Found
     * when the 500ml bottle went to £1.0616 and sat next to a packCost of
     * £0.54, the retired China price, on the same row. That is the
     * one-place-per-fact rule broken by the function whose job is to
     * maintain it.
     *
     * A null pack size is different and is left alone: there is no pack, so
     * there is no pack cost to keep true.
     */
    const hasUnitPack = Number.isFinite(packSize) && packSize === 1;

    const rounded = Math.round(newPrice * 10000) / 10000;
    const newUnitCost = pricedByPack ? rounded / packSize : rounded;
    const unitCostStr = newUnitCost.toFixed(4);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    await db
      .update(components)
      .set({
        ...(pricedByPack || hasUnitPack ? { packCost: rounded.toFixed(2) } : {}),
        unitCost: unitCostStr,
        unitCostSetAt: now,
        updatedAt: now,
      })
      .where(eq(components.id, componentId));

    const before = pricedByPack
      ? `pack £${Number(existing.packCost ?? 0).toFixed(2)}`
      : `£${Number(existing.unitCost ?? 0).toFixed(4)}/${existing.uom}`;
    const after = pricedByPack
      ? `pack £${rounded.toFixed(2)}`
      : `£${unitCostStr}/${existing.uom}`;

    const historyRow: NewComponentPriceHistoryRow = {
      componentId,
      supplierId: existing.defaultSupplierId ?? null,
      unitCost: unitCostStr,
      currency: "GBP",
      uom: existing.uom,
      effectiveDate: today,
      source: "manual",
      invoiceSupplier,
      invoiceRef,
      notes: [note?.trim(), `Back Bar ingredient editor: ${before} to ${after}`]
        .filter(Boolean)
        .join(" | "),
    };
    await db.insert(componentPriceHistory).values(historyRow);
    scheduleCogsSnapshot(`price: ${existing.name}`);

    revalidatePath("/finances/ingredients");
    revalidatePath("/finances/pricing");
    revalidatePath("/finances/profitability");
    revalidatePath("/finances/pnl");
    revalidatePath("/finances/rrp");
    revalidatePath("/erp/components");

    return {
      ok: true,
      ingredient: {
        id: existing.id,
        name: existing.name,
        // Report what the row now actually holds. Until 19 Aug 2026 these two
        // reported null for any component not priced by pack, so a packSize-1
        // dry good came back as `packSize: null, packCost: null` while the
        // database held 1 and a real cost. A write confirmation that misstates
        // the row it just wrote is worse than a terse one, because it is the
        // thing a caller checks the write against.
        packSize: existing.packSize === null ? null : packSize,
        packCost: pricedByPack || hasUnitPack ? rounded : null,
        unitCost: newUnitCost,
        unitCostSetAt: today,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
