/**
 * The stock count and its valuation: the year-end stock figure for the
 * accounts (unparked by Cyrus, 21 Oct 2026). Replaces the AUDIT tabs in the
 * buying spreadsheet, whose costs were typed in or pointed at the wrong cells.
 *
 * Nothing here is costed afresh. A finished bottle is valued at its COGS as at
 * the count's date, wastage included (Cyrus, 21 Oct 2026), exactly as
 * computeSkuCost gives it; a component at the price recorded by that date, on
 * the same rule COGS uses; bulk liquid at its recipe's liquid cost per litre,
 * with wastage, from the same rollup. So the stock figure cannot disagree with
 * the COGS pages.
 *
 * A draft is valued live. Closing writes each line's unit cost, value and
 * source onto the line and freezes the total, so the figure the accountant has
 * does not move when a price is corrected later.
 *
 * Obsolete stock is written down to nil (Cyrus, 21 Oct 2026): the line stays,
 * with its quantity, and is valued at £0.
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  clients,
  drinks,
  skus,
  stockCounts,
  stockCountLines,
  type StockCount,
  type StockCountLine,
} from "@/db/schema";
import { computeSkuCost, unitCostResolver, type SkuCost } from "@/lib/erp/cogs";
import { historySource, newestByComponent, operativeProvenance } from "@/lib/erp/ingredients";
import type { CostSource } from "@/lib/erp/provenance";

export type LineKind = StockCountLine["kind"];

export const KIND_LABEL: Record<LineKind, string> = {
  finished: "Finished goods",
  bulk: "Bulk liquid",
  component: "Ingredients, dry goods and packaging",
  other: "Not in the register",
};

export const KIND_ORDER: LineKind[] = ["finished", "bulk", "component", "other"];

export interface ValuedLine {
  line: StockCountLine;
  /** What the line is, in words: "Negroni 500ml (Myatt's Fields)", "Campari". */
  name: string;
  /** Grouping within its kind: the client for a SKU, the type and store for a component. */
  group: string;
  /** Units the quantity may be entered in, the first being the default. */
  units: string[];
  /** £ per `line.unit`, or null when it cannot be valued. */
  unitCost: number | null;
  /** £, or null when not counted or not valued. 0 when obsolete. */
  value: number | null;
  source: CostSource | null;
  /** The working, and any caveat, e.g. a price borrowed from today. */
  costNote: string | null;
}

export interface ValuedCount {
  count: StockCount;
  lines: ValuedLine[];
  total: number;
  byKind: Record<LineKind, { lines: number; counted: number; value: number }>;
  /** Share of the total traced to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  /** Counted lines that carry no value: no cost could be found. */
  unvalued: number;
  writtenDown: number;
}

function n(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function qtyOf(l: StockCountLine): number | null {
  return l.quantity == null ? null : n(l.quantity);
}

type Component = typeof components.$inferSelect;

/** Units a component can be counted in. Packs first where the supplier sells in packs. */
function componentUnits(c: Component): string[] {
  const pack = n(c.packSize);
  const base = c.uom === "ml" ? ["litre", "ml"] : c.uom === "g" ? ["kg", "g"] : [c.uom];
  return pack > 1 ? ["pack", ...base] : base;
}

/** How many of the component's own uom one `unit` holds. */
function perUnit(c: Component, unit: string): number | null {
  if (unit === c.uom) return 1;
  if (unit === "pack") return n(c.packSize) > 0 ? n(c.packSize) : null;
  if (unit === "litre" && c.uom === "ml") return 1000;
  if (unit === "kg" && c.uom === "g") return 1000;
  return null;
}

function packWords(c: Component): string {
  const pack = n(c.packSize);
  return pack > 1 ? `pack of ${pack}${c.uom === "each" ? "" : c.uom}` : c.uom;
}

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredients",
  sub_recipe: "Made in house",
  dry_good: "Dry goods",
  packaging: "Packaging",
};

function skuName(sku: typeof skus.$inferSelect, drinkName: string | undefined, clientName: string | undefined) {
  return `${drinkName ?? sku.code} ${sku.sizeMl >= 1000 ? `${sku.sizeMl / 1000}L` : `${sku.sizeMl}ml`}${clientName ? ` (${clientName})` : ""}`;
}

/** Runs `fn` over `items` eight at a time, as computeAllSkuCosts does, keeping order. */
async function bounded<T, R>(items: T[], fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
    }),
  );
  return out;
}

/**
 * Starts a count: one line per active SKU and per active component, all
 * uncounted, so the count is walked from a complete list rather than built
 * from memory. Bulk liquid and anything the register lacks are added by hand.
 */
export async function createCount(input: {
  asAt: string;
  countedOn: string | null;
  countedBy: string | null;
  basis: string | null;
}): Promise<number> {
  const [count] = await db.insert(stockCounts).values(input).returning({ id: stockCounts.id });
  const [skuRows, compRows] = await Promise.all([
    db.select().from(skus).where(eq(skus.active, true)),
    db.select().from(components).where(eq(components.active, true)),
  ]);
  const lines = [
    ...skuRows.map((s) => ({ countId: count.id, kind: "finished" as const, skuId: s.id, unit: "bottle" })),
    ...compRows.map((c) => ({
      countId: count.id,
      kind: "component" as const,
      componentId: c.id,
      unit: componentUnits(c)[0],
    })),
  ];
  if (lines.length > 0) await db.insert(stockCountLines).values(lines);
  return count.id;
}

export async function listCounts(): Promise<StockCount[]> {
  return db.select().from(stockCounts).orderBy(asc(stockCounts.asAt));
}

/**
 * Values every line of a count. A closed count reads its frozen figures; a
 * draft is valued live from Back Bar as at the count's date.
 */
export async function valueCount(countId: number): Promise<ValuedCount | null> {
  const [count] = await db.select().from(stockCounts).where(eq(stockCounts.id, countId));
  if (!count) return null;
  const asOf = count.asAt;
  const closed = count.status === "closed";

  const [lines, skuRows, compRows, drinkRows, clientRows, history] = await Promise.all([
    db.select().from(stockCountLines).where(eq(stockCountLines.countId, countId)).orderBy(asc(stockCountLines.id)),
    db.select().from(skus),
    db.select().from(components),
    db.select().from(drinks),
    db.select().from(clients),
    db.select().from(componentPriceHistory),
  ]);
  const skuById = new Map(skuRows.map((s) => [s.id, s]));
  const compById = new Map(compRows.map((c) => [c.id, c]));
  const drinkName = new Map(drinkRows.map((d) => [d.id, d.name]));
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));

  // ── Costs as at the count's date (drafts only) ─────────────────────────────
  const skuCost = new Map<number, SkuCost>();
  const bulkSku = new Map<string, number>();
  let unitCostOf: ((c: Component) => number) | null = null;
  let compProblems: string[] = [];
  const compSource = new Map<number, { source: CostSource; borrowed: boolean }>();

  if (!closed) {
    // Bulk liquid is costed from a SKU of the same drink and client: its
    // liquid per ml is the recipe's, whatever the bottle size.
    for (const l of lines) {
      if (l.kind !== "bulk" || !l.drinkId || !l.clientId) continue;
      const key = `${l.drinkId}:${l.clientId}`;
      if (bulkSku.has(key)) continue;
      const s = skuRows
        .filter((s) => s.drinkId === l.drinkId && s.clientId === l.clientId)
        .sort((a, b) => Number(b.active) - Number(a.active) || b.sizeMl - a.sizeMl)[0];
      if (s) bulkSku.set(key, s.id);
    }
    const toCost = [
      ...new Set([
        ...lines.filter((l) => l.kind === "finished" && l.skuId).map((l) => l.skuId!),
        ...bulkSku.values(),
      ]),
    ];
    const costs = await bounded(toCost, (id) => computeSkuCost(id, { asOf }));
    for (const c of costs) skuCost.set(c.skuId, c);

    compProblems = [];
    unitCostOf = await unitCostResolver(asOf, compProblems);
    const at = newestByComponent(history.filter((h) => h.effectiveDate <= asOf));
    const newest = newestByComponent(history);
    for (const c of compRows) {
      const now = operativeProvenance(c, newest.get(c.id));
      if (now.source === "unsourced") compSource.set(c.id, { source: "unsourced", borrowed: false });
      else {
        const h = at.get(c.id);
        compSource.set(c.id, h ? { source: historySource(h), borrowed: false } : { source: now.source, borrowed: true });
      }
    }
  }

  const valued: ValuedLine[] = lines.map((l) => {
    const qty = qtyOf(l);
    let name = l.description ?? "Unnamed line";
    let group = "";
    let units = [l.unit];
    let unitCost: number | null = null;
    let source: CostSource | null = null;
    let costNote: string | null = null;

    if (l.kind === "finished" && l.skuId) {
      const s = skuById.get(l.skuId);
      if (s) {
        name = skuName(s, drinkName.get(s.drinkId ?? -1), clientName.get(s.clientId ?? -1));
        group = clientName.get(s.clientId ?? -1) ?? "No client";
      }
      units = ["bottle"];
      const c = skuCost.get(l.skuId);
      if (c) {
        unitCost = c.total;
        source = c.costSource;
        costNote = [
          `COGS as at ${asOf}: liquid £${c.liquidTotal.toFixed(2)} + packaging £${c.packagingTotal.toFixed(2)} + wastage £${c.wastage.toFixed(2)}`,
          ...c.problems,
        ].join(". ");
      }
    } else if (l.kind === "bulk") {
      name = `${drinkName.get(l.drinkId ?? -1) ?? "Unknown drink"} (${clientName.get(l.clientId ?? -1) ?? "no client"})`;
      group = "Bulk liquid";
      units = ["litre"];
      const id = bulkSku.get(`${l.drinkId}:${l.clientId}`);
      const c = id ? skuCost.get(id) : undefined;
      if (c && c.sizeMl > 0) {
        const perLitre = (c.liquidTotal / c.sizeMl) * 1000 * (1 + c.wastagePct);
        unitCost = perLitre;
        source = c.liquid.length ? c.costSource : null;
        costNote = [
          `Recipe liquid as at ${asOf}, from ${c.skuCode}: £${((c.liquidTotal / c.sizeMl) * 1000).toFixed(2)}/L + ${(c.wastagePct * 100).toFixed(0)}% wastage`,
          ...c.problems,
        ].join(". ");
      } else if (!closed) {
        costNote = "No SKU of this drink and client to cost the recipe from";
      }
    } else if (l.kind === "component" && l.componentId) {
      const c = compById.get(l.componentId);
      if (c) {
        name = c.name;
        group = `${TYPE_LABEL[c.type] ?? c.type}${c.storageLocation ? ` · ${c.storageLocation}` : ""}`;
        units = componentUnits(c);
        if (!units.includes(l.unit)) units = [l.unit, ...units];
        if (unitCostOf) {
          const per = perUnit(c, l.unit);
          const base = unitCostOf(c);
          const s = compSource.get(c.id);
          source = s?.source ?? null;
          if (per != null) {
            unitCost = base * per;
            costNote = [
              `£${base.toFixed(base < 0.1 ? 4 : 2)} per ${c.uom}${l.unit === "pack" ? `, ${packWords(c)}` : ""}`,
              s?.borrowed ? `No price recorded by ${asOf}, so today's is used` : null,
            ]
              .filter(Boolean)
              .join(". ");
          } else {
            costNote = `Cannot convert ${l.unit} to ${c.uom}`;
          }
        }
      }
    } else if (l.kind === "other") {
      group = "Not in the register";
      unitCost = l.unitCost == null ? null : n(l.unitCost);
      source = unitCost == null ? null : "manual";
      costNote = unitCost == null ? "No unit cost entered" : "Unit cost typed on the line";
    }

    // A closed count reads what was frozen, never today's figures.
    if (closed) {
      unitCost = l.unitCost == null ? null : n(l.unitCost);
      source = (l.costSource as CostSource | null) ?? null;
      costNote = l.costNote;
    }

    const value =
      qty == null ? null : l.obsolete ? 0 : closed ? (l.value == null ? null : n(l.value)) : unitCost == null ? null : qty * unitCost;
    return { line: l, name, group, units, unitCost, value, source, costNote };
  });

  const byKind = Object.fromEntries(
    KIND_ORDER.map((k) => [k, { lines: 0, counted: 0, value: 0 }]),
  ) as ValuedCount["byKind"];
  let total = 0;
  let invoiced = 0;
  let unvalued = 0;
  let writtenDown = 0;
  for (const v of valued) {
    const k = byKind[v.line.kind];
    k.lines += 1;
    if (v.line.quantity == null) continue;
    k.counted += 1;
    if (v.line.obsolete) writtenDown += 1;
    if (v.value == null) {
      unvalued += 1;
      continue;
    }
    k.value += v.value;
    total += v.value;
    if (v.source === "inbound") invoiced += v.value;
  }

  return {
    count,
    lines: valued,
    total: closed && count.closedTotal != null ? n(count.closedTotal) : total,
    byKind,
    invoiceBackedPct: total > 0 ? (invoiced / total) * 100 : 0,
    unvalued,
    writtenDown,
  };
}

/** Freezes every line's cost and value onto the line, and the total onto the count. */
export async function closeCount(countId: number): Promise<void> {
  const v = await valueCount(countId);
  if (!v) throw new Error(`No stock count ${countId}`);
  if (v.count.status === "closed") return;
  // The Neon HTTP driver has no interactive transactions, so the lines are
  // written first and the count marked closed last: a failure part way leaves
  // a draft, which revalues live and can simply be closed again.
  await bounded(v.lines, (l) =>
    db
      .update(stockCountLines)
      .set({
        unitCost: l.unitCost == null ? null : l.unitCost.toFixed(4),
        value: l.value == null ? null : l.value.toFixed(2),
        costSource: l.source,
        costNote: l.costNote,
        updatedAt: new Date(),
      })
      .where(eq(stockCountLines.id, l.line.id)),
  );
  await db
    .update(stockCounts)
    .set({ status: "closed", closedAt: new Date(), closedTotal: v.total.toFixed(2), updatedAt: new Date() })
    .where(eq(stockCounts.id, countId));
}

/**
 * Reopens a closed count. The frozen figures are cleared so it revalues live,
 * and the reopening is noted on the count: the total given to the accountant
 * should not change silently.
 */
export async function reopenCount(countId: number, reason: string): Promise<void> {
  const [count] = await db.select().from(stockCounts).where(eq(stockCounts.id, countId));
  if (!count || count.status !== "closed") return;
  const stamp = new Date().toISOString().slice(0, 10);
  const note = `Reopened ${stamp} (was £${count.closedTotal} at close): ${reason}`;
  // An "other" line's unit cost is typed, not frozen, so it is kept.
  const lines = await db.select().from(stockCountLines).where(eq(stockCountLines.countId, countId));
  await bounded(lines, (l) =>
    db
      .update(stockCountLines)
      .set({
        unitCost: l.kind === "other" ? l.unitCost : null,
        value: null,
        costSource: null,
        costNote: null,
        updatedAt: new Date(),
      })
      .where(eq(stockCountLines.id, l.id)),
  );
  await db
    .update(stockCounts)
    .set({
      status: "draft",
      closedAt: null,
      closedTotal: null,
      notes: count.notes ? `${count.notes}\n${note}` : note,
      updatedAt: new Date(),
    })
    .where(eq(stockCounts.id, countId));
}

/** Drinks and clients that have a SKU, for the add-bulk-liquid picker. */
export async function bulkOptions(): Promise<{ drinkId: number; clientId: number; label: string }[]> {
  const rows = await db
    .select({ drinkId: skus.drinkId, clientId: skus.clientId, drink: drinks.name, client: clients.name })
    .from(skus)
    .innerJoin(drinks, eq(drinks.id, skus.drinkId))
    .innerJoin(clients, eq(clients.id, skus.clientId))
    .where(and(eq(skus.active, true)));
  const seen = new Map<string, { drinkId: number; clientId: number; label: string }>();
  for (const r of rows) {
    if (r.drinkId == null || r.clientId == null) continue;
    const key = `${r.drinkId}:${r.clientId}`;
    if (!seen.has(key)) seen.set(key, { drinkId: r.drinkId, clientId: r.clientId, label: `${r.drink} (${r.client})` });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Every line, for the accountant. Uncounted lines are left out; a counted zero stays in. */
export function countCsv(v: ValuedCount): string {
  const head = [
    "Kind", "Group", "Item", "Location", "Quantity", "Unit", "Unit cost (GBP)", "Value (GBP)",
    "Written down", "Cost source", "Cost working", "Note",
  ];
  const rows = v.lines
    .filter((l) => l.line.quantity != null)
    .sort((a, b) => KIND_ORDER.indexOf(a.line.kind) - KIND_ORDER.indexOf(b.line.kind) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    .map((l) => [
      KIND_LABEL[l.line.kind], l.group, l.name, l.line.location, n(l.line.quantity), l.line.unit,
      l.unitCost == null ? "" : l.unitCost.toFixed(4), l.value == null ? "" : l.value.toFixed(2),
      l.line.obsolete ? "Obsolete, nil" : "", l.source ?? "", l.costNote, l.line.note,
    ]);
  const footer = [
    [],
    ["Total", "", "", "", "", "", "", v.total.toFixed(2)],
    ["As at", v.count.asAt],
    ["Counted on", v.count.countedOn ?? ""],
    ["Basis", v.count.basis ?? ""],
    ["Status", v.count.status],
  ];
  return [head, ...rows, ...footer].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
