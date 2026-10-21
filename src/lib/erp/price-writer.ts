/**
 * The one way a component price is written: a dated, sourced row in
 * component_price_history, the component's cached price brought into line, and
 * a COGS snapshot scheduled.
 *
 * Lifted out of the component form on 21 Oct 2026 so the invoice price check's
 * approvals go through exactly the same write as a price typed into the form,
 * and the two cannot drift apart. An approved invoice price is therefore
 * invoice-backed, landed, snapshotted and history-preserving by construction.
 */

import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { components, componentPriceHistory, type NewComponentPriceHistoryRow } from "@/db/schema";
import { scheduleCogsSnapshot } from "@/lib/erp/cogs-movement";

export interface ComponentPriceWrite {
  componentId: number;
  /** For the snapshot's trigger label. */
  componentName: string;
  supplierId?: number | null;
  uom: NewComponentPriceHistoryRow["uom"];
  packSize: string;
  /** Per pack, ex VAT, 4dp. The pack price is their sum. */
  goodsCost: string;
  feesCost: string;
  feesNote: string | null;
  invoice: { invoiceSupplier: string; invoiceRef: string } | null;
  /** YYYY-MM-DD. The form uses today; an approved invoice uses its own date. */
  effectiveDate: string;
  notes: string;
  /**
   * Bring the component's cached pack size and price into line with this row.
   * The form has already written them with the rest of its fields, so it
   * passes false; an approval passes true.
   */
  updateComponent: boolean;
}

export function landedUnitCost(packSize: string, goodsCost: string, feesCost: string): string {
  return ((Number(goodsCost) + Number(feesCost)) / Number(packSize)).toFixed(4);
}

/** The newest price row for a component dated after `date`, if any. */
export async function newerPriceThan(componentId: number, date: string) {
  const [row] = await db
    .select({ id: componentPriceHistory.id, effectiveDate: componentPriceHistory.effectiveDate })
    .from(componentPriceHistory)
    .where(and(eq(componentPriceHistory.componentId, componentId), gt(componentPriceHistory.effectiveDate, date)))
    .orderBy(desc(componentPriceHistory.effectiveDate))
    .limit(1);
  return row ?? null;
}

/** Write one price. Returns the new component_price_history row's id. */
export async function writeComponentPrice(w: ComponentPriceWrite): Promise<number> {
  const unitCost = landedUnitCost(w.packSize, w.goodsCost, w.feesCost);

  if (w.updateComponent) {
    const packCost = (Number(w.goodsCost) + Number(w.feesCost)).toFixed(4);
    await db
      .update(components)
      .set({ packSize: w.packSize, packCost, unitCost, unitCostSetAt: new Date(), updatedAt: new Date() })
      .where(eq(components.id, w.componentId));
  }

  const [row] = await db
    .insert(componentPriceHistory)
    .values({
      componentId: w.componentId,
      supplierId: w.supplierId ?? null,
      unitCost,
      currency: "GBP",
      uom: w.uom,
      effectiveDate: w.effectiveDate,
      source: "manual",
      ...w.invoice,
      goodsCost: w.goodsCost,
      feesCost: w.feesCost,
      feesNote: w.feesNote,
      notes: w.notes,
    })
    .returning({ id: componentPriceHistory.id });

  scheduleCogsSnapshot(`price: ${w.componentName}`);
  return row.id;
}
