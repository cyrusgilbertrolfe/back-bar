/**
 * DB-backed COGS engine.
 *
 * Replaces the file-shadow engine in src/lib/cogs.ts, which read three
 * disagreeing JSON masters, computed liquid only, and could not see any
 * partner SKU at all.
 *
 * COGS rule (Cyrus, 30 Jul 2026): liquid, bottle, cap, label and box are ALL
 * in. Carriage is the only thing out, because the delivery method flexes
 * between hand delivery, pallet and Royal Mail. The include_in_cogs flag on
 * each bill-of-materials row is what decides, so the rule lives in the data
 * and not buried in this file.
 *
 * Every figure carries its provenance. A cost whose price history names the
 * invoice it was read from is 'inbound' (shown as Invoice); one typed in with
 * nothing to point to is 'manual'. The rollup reports the split
 * so nobody can mistake a hand-loaded April figure for a verified one.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  clients,
  drinks,
  recipes,
  recipeLines,
  skus,
  skuComponents,
  skuSetLines,
  systemSettings,
  SETTING_KEYS,
} from "@/db/schema";
import {
  historySource,
  invoiceLabel,
  landedSplit,
  newestByComponent,
  operativeProvenance,
  perUomCost,
  type LandedSplit,
} from "@/lib/erp/ingredients";
import { summariseProvenance, type CostSource } from "@/lib/erp/provenance";

export type { CostSource };

export interface CostLine {
  /** 'liquid' for recipe ingredients, otherwise the bill-of-materials role. */
  kind: string;
  componentId: number;
  name: string;
  /** £ per unit of measure (per ml for liquid, per each for dry goods). */
  unitCost: number;
  /** ml for liquid lines, count for dry goods. */
  quantity: number;
  cost: number;
  source: CostSource;
  setAt: string | null;
  /** The invoice behind the price in use, e.g. "Matthew Clark 4417302", or null. */
  invoice: string | null;
  /** The pack price split into goods and fees, when the price was entered that way. */
  landed: LandedSplit | null;
  /** The component's unit of measure: ml, g, each or m. */
  uom: string;
  /** How the supplier sells it, e.g. 700 (ml) at £15.41. Null when not recorded. */
  packSize: number | null;
  packCost: number | null;
  /** Liquid lines only: the recipe percentage this line's ml was taken from. */
  percentage?: number;
  /** True when we make this component from others (a sub-recipe). */
  isSubRecipe: boolean;
  /**
   * True when the customer supplies this component and we never pay for it.
   * Such a line is excluded from COGS but kept visible, so the absence is a
   * recorded fact rather than a gap. Added 19 Aug 2026.
   */
  suppliedByCustomer?: boolean;
}

/**
 * One SKU inside a set, e.g. the Vesper 50ml in the Martini Flight, at its own
 * full COGS: liquid, packaging and wastage, exactly as if it were sold alone.
 */
export interface SetItemCost {
  skuId: number;
  code: string;
  name: string;
  /** How many go in one set. */
  quantity: number;
  /** The child's own COGS per unit. */
  unitTotal: number;
  /** quantity x unitTotal. */
  cost: number;
  source: CostSource | null;
  setAt: string | null;
}

export interface SkuCost {
  skuId: number;
  skuCode: string;
  drinkName: string | null;
  clientName: string | null;
  sizeMl: number;

  liquid: CostLine[];
  liquidTotal: number;

  packaging: CostLine[];
  packagingTotal: number;

  /** Bill-of-materials rows deliberately excluded from COGS, e.g. carriage. */
  excluded: CostLine[];

  /**
   * A set's contents (sku_set_lines), each at its own COGS. Empty for
   * anything that is not a set. Added 28 Oct 2026.
   */
  items: SetItemCost[];
  itemsTotal: number;

  /**
   * Liquid + packaging + items. Wastage is applied to liquid and packaging
   * only: an item's total already carries its own wastage.
   */
  subtotal: number;
  wastagePct: number;
  wastage: number;
  total: number;

  /** Share of `subtotal` that traces to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  /** Worst source across the in-COGS lines: placeholder > unsourced > manual > inbound. Null with no lines. */
  costSource: CostSource | null;
  /**
   * The OLDEST setAt among the in-COGS lines, because a total is only as
   * current as its stalest input. Null when any in-COGS line has no date.
   */
  costAsOf: string | null;
  /**
   * Lines whose price in use has no record behind it. Named, never silently
   * absorbed. Manual prices are NOT here: entering the best figure we have by
   * hand is the standard way of working, not a defect (Cyrus, 2 Oct 2026).
   */
  unsourced: string[];
  /**
   * Lines standing on a placeholder. Separated from `unsourced` because a
   * placeholder is a known stand-in with someone actively working on it, not
   * an oversight, and the two deserve different attention.
   */
  placeholders: string[];
  /**
   * How many in-COGS lines read "unsourced": no price history, or a price in
   * use that its newest history row does not describe. Equal to
   * `unsourced.length`. Placeholder lines are `placeholders.length`.
   */
  unsourcedLines: number;
  /** Structural problems, e.g. no current recipe for this client. */
  problems: string[];
}

/** Internal: the sets being costed above this one, to refuse a set inside itself. */
interface CostContext {
  path: number[];
}

function n(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

/** The pack a component is bought in, and whether we make it, for a CostLine. */
function packOf(c: typeof components.$inferSelect) {
  return {
    uom: c.uom,
    packSize: c.packSize === null ? null : n(c.packSize),
    packCost: c.packCost === null ? null : n(c.packCost),
    isSubRecipe: c.type === "sub_recipe",
  };
}

type PriceHistoryRow = typeof componentPriceHistory.$inferSelect;

/** Rows grouped by a key, each group in the order the rows were read. */
function groupBy<T>(rows: T[], key: (r: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const r of rows) {
    const k = key(r);
    const g = out.get(k);
    if (g) g.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/**
 * Everything a cost rollup reads, loaded in one go.
 *
 * Costing a SKU used to issue about ten queries of its own, so a page costing
 * every SKU made over a thousand round trips and took 12 to 18 seconds (16 Nov
 * 2026). These tables are small, so each is read whole, once, in parallel, and
 * every SKU is then costed in memory from the same snapshot. A caller costing
 * many SKUs loads this once and passes it to each call.
 */
export interface CostData {
  skuById: Map<number, typeof skus.$inferSelect>;
  drinkById: Map<number, typeof drinks.$inferSelect>;
  clientById: Map<number, typeof clients.$inferSelect>;
  compById: Map<number, typeof components.$inferSelect>;
  /** Every recipe version, keyed `${drinkId}:${clientId}`. */
  recipesByPair: Map<string, (typeof recipes.$inferSelect)[]>;
  linesByRecipe: Map<number, (typeof recipeLines.$inferSelect)[]>;
  bomBySku: Map<number, (typeof skuComponents.$inferSelect)[]>;
  setLinesBySet: Map<number, (typeof skuSetLines.$inferSelect)[]>;
  history: PriceHistoryRow[];
  wastagePct: number;
  /** Price lookups derived from `history`, worked out once per date. */
  pricesAtCache: Map<string, ReturnType<typeof pricesFrom>>;
  newestCache?: Map<number, PriceHistoryRow>;
}

export async function loadCostData(): Promise<CostData> {
  const [skuRows, drinkRows, clientRows, compRows, recipeRows, lineRows, bomRows, setRows, history, wastageRows] =
    await Promise.all([
      db.select().from(skus),
      db.select().from(drinks),
      db.select().from(clients),
      db.select().from(components),
      db.select().from(recipes),
      db.select().from(recipeLines),
      db.select().from(skuComponents),
      db.select().from(skuSetLines),
      db.select().from(componentPriceHistory),
      db.select().from(systemSettings).where(eq(systemSettings.key, SETTING_KEYS.WASTAGE_PCT)),
    ]);
  const recipesByPair = new Map<string, (typeof recipes.$inferSelect)[]>();
  for (const r of recipeRows) {
    const k = `${r.drinkId}:${r.clientId}`;
    const g = recipesByPair.get(k);
    if (g) g.push(r);
    else recipesByPair.set(k, [r]);
  }
  return {
    skuById: new Map(skuRows.map((s) => [s.id, s])),
    drinkById: new Map(drinkRows.map((d) => [d.id, d])),
    clientById: new Map(clientRows.map((c) => [c.id, c])),
    compById: new Map(compRows.map((c) => [c.id, c])),
    recipesByPair,
    linesByRecipe: groupBy(lineRows, (l) => l.recipeId),
    bomBySku: groupBy(bomRows, (b) => b.skuId),
    setLinesBySet: groupBy(setRows, (s) => s.setSkuId),
    history,
    wastagePct: wastageRows.length > 0 ? n(wastageRows[0].value) : 0,
    pricesAtCache: new Map(),
  };
}

function newestOf(data: CostData): Map<number, PriceHistoryRow> {
  return (data.newestCache ??= newestByComponent(data.history));
}

/** Newest price-history source for each component id in the set. */
function sourcesFor(
  data: CostData,
  ids: number[],
): Map<number, ReturnType<typeof operativeProvenance>> {
  const comps = data.compById;
  const out = new Map<number, ReturnType<typeof operativeProvenance>>();
  if (ids.length === 0) return out;
  const newest = newestOf(data);
  // The same rule as the ingredients list: the newest row counts only while it
  // matches the price in use, otherwise the line reads unsourced.
  for (const id of ids) {
    const c = comps.get(id);
    if (c) out.set(id, operativeProvenance(c, newest.get(id)));
  }
  return out;
}

/**
 * Options for costing a SKU.
 *
 * `asOf` (YYYY-MM-DD) reconstructs the COGS as it stood at the end of that day,
 * for the movement report's history (added 9 Oct 2026): each component at its
 * newest price-history row dated on or before it, and the recipe version
 * created by then. The bill of materials and the wastage rate are not dated,
 * so today's are used; a reconstructed figure is therefore approximate, and
 * says so in `problems` wherever a price had to be borrowed from today.
 */
export interface CostOptions {
  asOf?: string;
  /**
   * Under `asOf`, cost a SKU whose recipe was not yet recorded by then from
   * its current recipe rather than as liquid-free. The stock count sets it
   * (21 Oct 2026); the movement report does not, so its history is unchanged.
   */
  currentRecipeBeforeRecords?: boolean;
  /**
   * Under `asOf`, a line whose price is borrowed from today takes today's
   * source too. Without it the line reads unsourced, which for a count dated
   * before price tracking began marks nearly everything unsourced, invoiced
   * or not (Cyrus, 1 Nov 2026). The stock count sets it; the movement report
   * does not, so its history is unchanged.
   */
  borrowedTakeTodaysSource?: boolean;
}

/** The newest price-history row per component dated on or before `asOf`, and the newest of all. */
function pricesFrom(rows: PriceHistoryRow[], asOf: string, newest?: Map<number, PriceHistoryRow>) {
  return {
    at: newestByComponent(rows.filter((r) => r.effectiveDate <= asOf)),
    newest: newest ?? newestByComponent(rows),
  };
}

async function pricesAt(asOf: string) {
  return pricesFrom(await db.select().from(componentPriceHistory), asOf);
}

function pricesAtFrom(data: CostData, asOf: string) {
  let p = data.pricesAtCache.get(asOf);
  if (!p) {
    p = pricesFrom(data.history, asOf, newestOf(data));
    data.pricesAtCache.set(asOf, p);
  }
  return p;
}

/**
 * £ per UOM for a component: the price in use, or under `asOf` the price
 * recorded by then. Shared with the stock count, so a count valued as at a
 * date reads the same prices as COGS reconstructed to that date. Each price
 * borrowed from today is named in `problems`.
 */
export async function unitCostResolver(
  asOf: string | undefined,
  problems: string[],
): Promise<(c: typeof components.$inferSelect) => number> {
  return resolverFrom(asOf ? await pricesAt(asOf) : null, asOf, problems);
}

function resolverFrom(
  historic: ReturnType<typeof pricesFrom> | null,
  asOf: string | undefined,
  problems: string[],
): (c: typeof components.$inferSelect) => number {
  return (c) => {
    if (!historic) return perUomCost(c);
    const newest = historic.newest.get(c.id);
    // A price in use with no record behind it cannot be dated, so it stands
    // throughout rather than appearing to jump on the day tracking began.
    if (operativeProvenance(c, newest).source === "unsourced") return perUomCost(c);
    const h = historic.at.get(c.id);
    if (!h) {
      problems.push(`No price recorded for ${c.name} by ${asOf}, so today's is used`);
      return perUomCost(c);
    }
    // History keeps 4dp, which over a 5 litre format is pence. While the row is
    // the one still in use, take the exact figure the live COGS uses.
    return h.id === newest?.id ? perUomCost(c) : n(h.unitCost);
  };
}

/**
 * Costs one SKU. Pass `data` from loadCostData when costing several, so they
 * share one read of the tables; without it this loads its own.
 */
export async function computeSkuCost(
  skuId: number,
  opts: CostOptions = {},
  data?: CostData,
): Promise<SkuCost> {
  return costFrom(data ?? (await loadCostData()), skuId, opts, { path: [] });
}

/** computeSkuCost over an already-loaded snapshot: no queries. */
export function costFrom(
  data: CostData,
  skuId: number,
  opts: CostOptions = {},
  ctx: CostContext = { path: [] },
): SkuCost {
  const problems: string[] = [];
  const asOf = opts.asOf;
  const historic = asOf ? pricesAtFrom(data, asOf) : null;
  const unitCostOf = resolverFrom(historic, asOf, problems);

  const sku = data.skuById.get(skuId);
  if (!sku) throw new Error(`No SKU with id ${skuId}`);

  const drink = sku.drinkId ? data.drinkById.get(sku.drinkId) : undefined;
  const client = sku.clientId ? data.clientById.get(sku.clientId) : undefined;

  const setLines = data.setLinesBySet.get(skuId) ?? [];

  const compById = data.compById;

  // ── Liquid ───────────────────────────────────────────────────────────────
  const liquid: CostLine[] = [];
  let liquidTotal = 0;

  if (sku.drinkId && sku.clientId) {
    const pair = data.recipesByPair.get(`${sku.drinkId}:${sku.clientId}`) ?? [];
    const versions = asOf ? pair : [];
    // The latest version that existed by the end of `asOf`.
    let atDate = versions
      .filter((r) => r.createdAt.toISOString().slice(0, 10) <= asOf!)
      .sort((a, b) => b.version - a.version)
      .slice(0, 1);
    if (asOf && atDate.length === 0 && opts.currentRecipeBeforeRecords) {
      // Recipes were first entered in June 2026, so a date before that finds
      // none. The drink was still made to a recipe, and recipes are set by
      // flavour and not changed (Cyrus, 19 Sep 2026): the later versions
      // corrected how a recipe was entered, so the current one is the best
      // evidence of what was made, better than the first one typed in.
      atDate = versions.filter((r) => r.isCurrent).slice(0, 1);
      if (atDate[0]) {
        problems.push(`No recipe recorded by ${asOf}, so the current one (v${atDate[0].version}) is used`);
      }
    }
    const recipeRows = asOf ? atDate : pair.filter((r) => r.isCurrent);

    if (recipeRows.length === 0) {
      problems.push(
        `No current recipe for drink ${sku.drinkId} under client ${sku.clientId}, so liquid cost is zero`,
      );
    } else {
      const lines = data.linesByRecipe.get(recipeRows[0].id) ?? [];

      const pctTotal = lines.reduce((s, l) => s + n(l.percentage), 0);
      if (Math.abs(pctTotal - 100) > 0.01) {
        problems.push(`Recipe lines sum to ${round(pctTotal, 3)}%, not 100%`);
      }

      for (const l of lines) {
        const c = compById.get(l.componentId);
        if (!c) {
          problems.push(`Recipe line references missing component ${l.componentId}`);
          continue;
        }
        const ml = (n(l.percentage) / 100) * sku.sizeMl;
        const unit = unitCostOf(c);
        const cost = ml * unit;
        liquidTotal += cost;
        liquid.push({
          kind: "liquid",
          componentId: c.id,
          name: c.name,
          unitCost: unit,
          quantity: ml,
          cost,
          source: "unsourced",
          setAt: c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null,
          invoice: null,
          landed: null,
          ...packOf(c),
          percentage: n(l.percentage),
        });
      }
    }
  } else if (setLines.length === 0) {
    // A set has no recipe of its own: its liquid is in its items.
    problems.push("SKU has no drink or no client, so no recipe can be resolved");
  }

  // ── Packaging ────────────────────────────────────────────────────────────
  const bom = data.bomBySku.get(skuId) ?? [];
  const packaging: CostLine[] = [];
  const excluded: CostLine[] = [];
  let packagingTotal = 0;

  for (const b of bom) {
    const c = compById.get(b.componentId);
    if (!c) {
      problems.push(`Bill of materials references missing component ${b.componentId}`);
      continue;
    }
    const unit = unitCostOf(c);
    const qty = n(b.quantity);
    const cost = unit * qty;
    const line: CostLine = {
      kind: b.role,
      componentId: c.id,
      name: c.name,
      unitCost: unit,
      quantity: qty,
      cost,
      source: "unsourced",
      setAt: c.unitCostSetAt ? c.unitCostSetAt.toISOString().slice(0, 10) : null,
      invoice: null,
      landed: null,
      ...packOf(c),
      suppliedByCustomer: b.suppliedByCustomer,
    };
    // A customer-supplied component never enters COGS, whatever its role says,
    // because we do not buy it. It stays on the bill of materials as a visible
    // zero so the absence reads as a decision rather than an omission.
    if (b.includeInCogs && !b.suppliedByCustomer) {
      packagingTotal += cost;
      packaging.push(line);
    } else {
      excluded.push(line);
    }
  }

  // ── Set contents ─────────────────────────────────────────────────────────
  const items: SetItemCost[] = [];
  const itemCosts: SkuCost[] = [];
  let itemsTotal = 0;

  for (const sl of setLines) {
    if (ctx.path.includes(sl.childSkuId)) {
      problems.push(`Set contains SKU ${sl.childSkuId}, which contains this set, so it is left out`);
      continue;
    }
    const child = costFrom(data, sl.childSkuId, opts, { path: [...ctx.path, skuId] });
    const qty = n(sl.quantity);
    const cost = child.total * qty;
    itemsTotal += cost;
    itemCosts.push(child);
    items.push({
      skuId: child.skuId,
      code: child.skuCode,
      name: child.drinkName ? `${child.drinkName} ${child.sizeMl}ml` : child.skuCode,
      quantity: qty,
      unitTotal: child.total,
      cost,
      source: child.costSource,
      setAt: child.costAsOf,
    });
    for (const p of child.problems) problems.push(`${child.skuCode}: ${p}`);
  }

  // ── Provenance ───────────────────────────────────────────────────────────
  const all = [...liquid, ...packaging, ...excluded];
  const srcMap = historic
    ? new Map(
        [...historic.at].map(([id, h]) => [
          id,
          { source: historySource(h), setAt: h.effectiveDate, invoice: invoiceLabel(h), landed: landedSplit(h) },
        ]),
      )
    : sourcesFor(data, all.map((l) => l.componentId));
  if (historic && opts.borrowedTakeTodaysSource) {
    const borrowed = all.map((l) => l.componentId).filter((id) => !srcMap.has(id));
    for (const [id, s] of sourcesFor(data, borrowed)) srcMap.set(id, s);
  }
  for (const l of all) {
    const s = srcMap.get(l.componentId);
    if (s) {
      l.source = s.source;
      l.setAt = s.setAt;
      l.invoice = s.invoice;
      l.landed = s.landed;
    }
  }

  const inCogs = [...liquid, ...packaging];
  const own = liquidTotal + packagingTotal;
  const subtotal = own + itemsTotal;
  // An item's invoice-backed share is taken of its whole cost, wastage included.
  const invoiceBacked =
    inCogs.filter((l) => l.source === "inbound").reduce((s, l) => s + l.cost, 0) +
    items.reduce((s, it, i) => s + (itemCosts[i].invoiceBackedPct / 100) * it.cost, 0);
  // An item's gaps are named under its code, so a set never hides one.
  const unsourced = [
    ...inCogs
      .filter((l) => l.source === "unsourced")
      .map((l) => `${l.name} (£${round(l.cost, 2).toFixed(2)})`),
    ...itemCosts.flatMap((c) => c.unsourced.map((u) => `${c.skuCode}: ${u}`)),
  ];
  const placeholders = [
    ...inCogs
      .filter((l) => l.source === "placeholder")
      .map((l) => `${l.name} (£${round(l.cost, 2).toFixed(2)})`),
    ...itemCosts.flatMap((c) => c.placeholders.map((u) => `${c.skuCode}: ${u}`)),
  ];

  const { costSource, costAsOf } = summariseProvenance([
    ...inCogs,
    ...items.map((it) => ({ source: it.source ?? ("unsourced" as const), setAt: it.setAt })),
  ]);

  const pct = data.wastagePct;
  const wastage = own * pct;

  return {
    skuId: sku.id,
    skuCode: sku.code,
    drinkName: drink?.name ?? null,
    clientName: client?.name ?? null,
    sizeMl: sku.sizeMl,
    liquid,
    liquidTotal: round(liquidTotal),
    packaging,
    packagingTotal: round(packagingTotal),
    excluded,
    items,
    itemsTotal: round(itemsTotal),
    subtotal: round(subtotal),
    wastagePct: pct,
    wastage: round(wastage),
    total: round(subtotal + wastage),
    invoiceBackedPct: subtotal > 0 ? round((invoiceBacked / subtotal) * 100, 1) : 0,
    costSource,
    costAsOf,
    unsourced,
    placeholders,
    unsourcedLines:
      inCogs.filter((l) => l.source === "unsourced").length +
      itemCosts.reduce((s, c) => s + c.unsourcedLines, 0),
    problems,
  };
}

/**
 * Every active SKU, costed, from one read of the tables (see CostData). The
 * per-SKU version this replaced took 7.2s sequentially on 19 Aug 2026 and
 * still 12s at eight at a time from Washington on 16 Nov 2026.
 */
export async function computeAllSkuCosts(opts: CostOptions = {}, data?: CostData): Promise<SkuCost[]> {
  const d = data ?? (await loadCostData());
  const out = [...d.skuById.values()].filter((s) => s.active).map((s) => costFrom(d, s.id, opts));

  return out.sort(
    (a, b) =>
      (a.clientName ?? "").localeCompare(b.clientName ?? "") ||
      (a.drinkName ?? "").localeCompare(b.drinkName ?? "") ||
      b.sizeMl - a.sizeMl,
  );
}
