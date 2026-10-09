/**
 * The ingredient register, read from the database.
 *
 * Replaces src/lib/ingredients.ts (which read src/data/ingredients.json) and
 * src/data/ingredients.ts (MASTER_INGREDIENTS). Those were two of the four
 * disagreeing registers: 45 and 72 entries respectively against the database's
 * 93, joined to each other by matching names as strings, which is why they
 * drifted apart and why the same ingredient could cost two different amounts
 * depending on which list a calculation happened to read.
 *
 * Everything here carries an id, a price, a date and a provenance, because a
 * number without those is not data.
 */

import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { components, componentPriceHistory, type Component } from "@/db/schema";
import { toCostSource, type CostSource } from "@/lib/erp/provenance";

/** The shared cost vocabulary. A component with no history reads "unsourced". */
export type PriceProvenance = CostSource;

export interface IngredientRow {
  id: number;
  name: string;
  type: Component["type"];
  uom: Component["uom"];
  /** How the supplier sells it, e.g. 700 (ml) at £15.17. */
  packSize: number | null;
  packCost: number | null;
  /** £ per UOM. The operative figure for costing. */
  unitCost: number;
  /**
   * When the operative price took effect: the newest price-history date when
   * there is history (the same row `provenance` comes from), else the date the
   * cached unit cost was set.
   */
  unitCostSetAt: string | null;
  abv: number | null;
  active: boolean;
  notes: string | null;
  provenance: PriceProvenance;
  /** The invoice behind the price in use, e.g. "Matthew Clark 4417302", or null. */
  invoice: string | null;
  /** True when this is a sub-recipe we make rather than buy. */
  isSubRecipe: boolean;
}

function n(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/**
 * Cost per UOM. Prefers pack_cost / pack_size for bulk lines because pack_cost
 * is numeric(12,2) while the cached unit_cost is numeric(12,4): on a £15.41
 * litre that rounding is a fifth of a penny per 700ml bottle. For each-priced
 * dry goods the pack columns round sub-penny costs the wrong way, so the
 * cached unit cost wins there.
 */
export function perUomCost(c: {
  packSize: string | null;
  packCost: string | null;
  unitCost: string | null;
}): number {
  const size = n(c.packSize) ?? 0;
  const cost = n(c.packCost) ?? 0;
  if (size > 1 && cost > 0) return cost / size;
  return n(c.unitCost) ?? 0;
}

/**
 * Where the operative price came from, and when. The newest history row
 * decides both, but only while it describes the price actually in use: a price
 * changed without a history row (the 20 Jul 2026 reconciliation did this to
 * four components) would otherwise borrow an older row's source and date. When
 * the two disagree, the price in use has no record behind it, so it reads
 * "unsourced", dated from when the cached cost was set. Added 2 Oct 2026.
 *
 * A row that names its invoice (supplier and number) reads "inbound", shown as
 * Invoice, whatever its stored source: the price was copied from an invoice,
 * and that is what invoice-backed means (Cyrus, 2 Oct 2026; built 9 Oct 2026).
 * A placeholder stays a placeholder even with an invoice beside it.
 */
export function operativeProvenance(
  c: { packSize: string | null; packCost: string | null; unitCost: string | null; unitCostSetAt: Date | null },
  h:
    | {
        unitCost: string;
        source: string;
        effectiveDate: string;
        invoiceSupplier?: string | null;
        invoiceRef?: string | null;
        goodsCost?: string | null;
        feesCost?: string | null;
        feesNote?: string | null;
      }
    | undefined,
): { source: CostSource; setAt: string | null; invoice: string | null; landed: LandedSplit | null } {
  const cachedDate = c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null;
  if (!h) return { source: "unsourced", setAt: cachedDate, invoice: null, landed: null };
  const inUse = perUomCost(c);
  const recorded = n(h.unitCost) ?? 0;
  // History is stored to 4dp; the operative figure may be pack/size unrounded.
  const tolerance = Math.max(0.0001, recorded * 0.005);
  if (Math.abs(inUse - recorded) > tolerance) return { source: "unsourced", setAt: cachedDate, invoice: null, landed: null };
  return { source: historySource(h), setAt: h.effectiveDate, invoice: invoiceLabel(h), landed: landedSplit(h) };
}

/** A pack price split into goods and fees, per pack, ex VAT. */
export interface LandedSplit {
  goods: number;
  fees: number;
  note: string | null;
}

/** The goods and fees a history row records, or null for a row entered before the split. */
export function landedSplit(h: { goodsCost?: string | null; feesCost?: string | null; feesNote?: string | null }): LandedSplit | null {
  if (h.goodsCost == null || h.feesCost == null) return null;
  return { goods: Number(h.goodsCost), fees: Number(h.feesCost), note: h.feesNote ?? null };
}

/** A history row's source as the cost vocabulary reads it: naming an invoice makes it Invoice. */
export function historySource(h: { source: string; invoiceSupplier?: string | null; invoiceRef?: string | null }): CostSource {
  const stored = toCostSource(h.source);
  return invoiceLabel(h) && stored !== "placeholder" ? "inbound" : stored;
}

/** "Matthew Clark 4417302", or null unless the row names both supplier and number. */
export function invoiceLabel(h: { invoiceSupplier?: string | null; invoiceRef?: string | null }): string | null {
  const supplier = h.invoiceSupplier?.trim();
  const ref = h.invoiceRef?.trim();
  return supplier && ref ? `${supplier} ${ref}` : null;
}

/**
 * The newest price-history row per component. Two rows on the same date are
 * settled by id, so the one written later wins (espresso has two on 4 Aug 2026:
 * the measured yield, then the fully loaded figure).
 */
export function newestByComponent<T extends { id: number; componentId: number; effectiveDate: string }>(
  history: T[],
): Map<number, T> {
  const newest = new Map<number, T>();
  for (const h of history) {
    const prev = newest.get(h.componentId);
    if (
      !prev ||
      prev.effectiveDate < h.effectiveDate ||
      (prev.effectiveDate === h.effectiveDate && prev.id < h.id)
    ) {
      newest.set(h.componentId, h);
    }
  }
  return newest;
}

/**
 * Source and as-of date for the operative price of each component, on the same
 * rule listIngredients uses: the newest history row decides both, and a
 * component with no history falls back to the date its cached unit cost was set
 * and reads as unsourced. For callers that already hold their own cost figures
 * (the calculators) and only need to say where those figures came from.
 */
export async function priceProvenanceFor(
  ids: number[],
): Promise<Map<number, ReturnType<typeof operativeProvenance>>> {
  const out = new Map<number, ReturnType<typeof operativeProvenance>>();
  if (ids.length === 0) return out;
  const [comps, history] = await Promise.all([
    db
      .select({
        id: components.id,
        packSize: components.packSize,
        packCost: components.packCost,
        unitCost: components.unitCost,
        unitCostSetAt: components.unitCostSetAt,
      })
      .from(components)
      .where(inArray(components.id, ids)),
    db.select().from(componentPriceHistory).where(inArray(componentPriceHistory.componentId, ids)),
  ]);
  const newest = newestByComponent(history);
  for (const c of comps) {
    out.set(c.id, operativeProvenance(c, newest.get(c.id)));
  }
  return out;
}

export async function listIngredients(opts?: { includeInactive?: boolean }): Promise<IngredientRow[]> {
  const all = await db.select().from(components);
  const history = await db.select().from(componentPriceHistory);

  // The newest history row per component decides both the source and the
  // date, so the two can never describe different prices, and it counts only
  // while it matches the price in use (operativeProvenance).
  const newest = newestByComponent(history);

  return all
    .filter((c) => opts?.includeInactive || c.active)
    .map((c) => ({ c, prov: operativeProvenance(c, newest.get(c.id)) }))
    .map(({ c, prov }) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      uom: c.uom,
      packSize: n(c.packSize),
      packCost: n(c.packCost),
      unitCost: perUomCost(c),
      unitCostSetAt: prov.setAt,
      abv: n(c.abv),
      active: c.active,
      notes: c.notes,
      provenance: prov.source,
      invoice: prov.invoice,
      isSubRecipe: c.type === "sub_recipe",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getIngredient(id: number): Promise<IngredientRow | null> {
  const rows = await listIngredients({ includeInactive: true });
  return rows.find((r) => r.id === id) ?? null;
}

export interface PriceHistoryRow {
  effectiveDate: string;
  unitCost: number;
  source: string;
  invoice: string | null;
  notes: string | null;
}

export async function getPriceHistory(componentId: number): Promise<PriceHistoryRow[]> {
  const rows = await db
    .select()
    .from(componentPriceHistory)
    .where(eq(componentPriceHistory.componentId, componentId))
    .orderBy(desc(componentPriceHistory.effectiveDate));
  return rows.map((r) => ({
    effectiveDate: r.effectiveDate,
    unitCost: Number(r.unitCost),
    source: historySource(r),
    invoice: invoiceLabel(r),
    notes: r.notes,
  }));
}

/** Ingredients with no sourced price, the standing gap list. */
export async function listUnsourced(): Promise<IngredientRow[]> {
  const rows = await listIngredients();
  return rows.filter((r) => r.provenance === "unsourced" || r.provenance === "placeholder");
}
