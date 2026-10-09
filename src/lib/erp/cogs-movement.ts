/**
 * COGS movement: record each SKU's COGS when it changes, and explain what moved.
 *
 * Cyrus, 9 Oct 2026: "we definitely want to track COGS movement. There should
 * be a report on that." COGS is computed live, so without a record a figure
 * that moves leaves no trace. A snapshot (sku_cogs_snapshots) is written only
 * when a SKU's figure, or any of its lines, differs from its last one, so the
 * table holds changes rather than a daily copy of everything.
 *
 * Writes come from three places: the price, recipe and wastage saves (through
 * scheduleCogsSnapshot, after the response), a daily check for anything a
 * script changed, and the one-off reconstruction of history.
 */

import { after } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { clients, drinks, skuCogsSnapshots, skus, type SkuCogsSnapshot } from "@/db/schema";
import { computeAllSkuCosts, type CostLine, type SkuCost } from "@/lib/erp/cogs";

/** One in-COGS line as stored in a snapshot. */
export interface SnapshotLine {
  componentId: number;
  name: string;
  kind: string;
  quantity: number;
  unitCost: number;
  cost: number;
  source: string;
  invoice: string | null;
}

/** Below this a difference is rounding, not movement. */
const EPSILON = 0.00005;

function r4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

function linesOf(b: SkuCost): SnapshotLine[] {
  return [...b.liquid, ...b.packaging].map((l: CostLine) => ({
    componentId: l.componentId,
    name: l.name,
    kind: l.kind,
    quantity: Number(l.quantity.toFixed(6)),
    unitCost: Number(l.unitCost.toFixed(8)),
    cost: r4(l.cost),
    source: l.source,
    invoice: l.invoice,
  }));
}

const lineKey = (l: SnapshotLine) => `${l.kind}:${l.componentId}`;

/** True when a fresh costing differs from a snapshot in total or in any line. */
function differs(b: SkuCost, prev: SkuCogsSnapshot | undefined): boolean {
  if (!prev) return true;
  if (Math.abs(b.total - Number(prev.total)) > EPSILON) return true;
  const before = new Map((prev.lines as SnapshotLine[]).map((l) => [lineKey(l), l]));
  const now = linesOf(b);
  if (now.length !== before.size) return true;
  return now.some((l) => {
    const p = before.get(lineKey(l));
    return !p || Math.abs(p.cost - l.cost) > EPSILON || Math.abs(p.quantity - l.quantity) > 1e-6;
  });
}

/** The newest snapshot per SKU, by the day it describes, then by when it was taken. */
async function latestSnapshots(): Promise<Map<number, SkuCogsSnapshot>> {
  const rows = await db
    .select()
    .from(skuCogsSnapshots)
    .orderBy(desc(skuCogsSnapshots.asOf), desc(skuCogsSnapshots.takenAt), desc(skuCogsSnapshots.id));
  const out = new Map<number, SkuCogsSnapshot>();
  for (const r of rows) if (!out.has(r.skuId)) out.set(r.skuId, r);
  return out;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cost every active SKU and write a snapshot for each whose COGS differs from
 * its last one. With `asOf`, the costs are reconstructed as at that day and
 * the rows are marked reconstructed. Returns how many SKUs moved.
 */
export async function recordCogsSnapshots(
  trigger: string,
  opts: {
    asOf?: string;
    /**
     * For a dry run: compare against, and update, this in-memory map instead
     * of the table, and write nothing.
     */
    dryRun?: Map<number, SkuCogsSnapshot>;
    /** Snapshot every SKU, moved or not: for the baseline tracking starts from. */
    all?: boolean;
  } = {},
): Promise<{ written: number; checked: number }> {
  const [costs, latest] = await Promise.all([
    computeAllSkuCosts({ asOf: opts.asOf }),
    opts.dryRun ? Promise.resolve(opts.dryRun) : latestSnapshots(),
  ]);
  const rows = costs
    // A reconstruction from before a SKU's recipe existed would record a COGS
    // with no liquid in it, and then a jump that never happened. Skip it.
    .filter((b) => !(opts.asOf && b.problems.some((p) => p.startsWith("No current recipe"))))
    .filter((b) => opts.all || differs(b, latest.get(b.skuId)))
    .map((b) => ({
      skuId: b.skuId,
      asOf: opts.asOf ?? today(),
      total: b.total.toFixed(4),
      liquidTotal: b.liquidTotal.toFixed(4),
      packagingTotal: b.packagingTotal.toFixed(4),
      wastage: b.wastage.toFixed(4),
      wastagePct: b.wastagePct.toFixed(6),
      lines: linesOf(b),
      trigger,
      reconstructed: opts.asOf !== undefined,
    }));
  if (opts.dryRun) {
    for (const r of rows) {
      opts.dryRun.set(r.skuId, { ...r, id: 0, takenAt: new Date() } as SkuCogsSnapshot);
    }
  } else if (rows.length > 0) {
    await db.insert(skuCogsSnapshots).values(rows);
  }
  return { written: rows.length, checked: costs.length };
}

/**
 * Record snapshots after the current response, so a save is never slowed or
 * failed by it. Called from every action that can move a COGS figure.
 */
export function scheduleCogsSnapshot(trigger: string): void {
  after(async () => {
    try {
      await recordCogsSnapshots(trigger);
    } catch (err) {
      console.error(`[cogs-movement] snapshot after "${trigger}" failed`, err);
    }
  });
}

// ─── The report ─────────────────────────────────────────────────────────────

export type LineCause = "price" | "quantity" | "price and quantity" | "added" | "removed";

export interface LineMovement {
  componentId: number;
  name: string;
  kind: string;
  from: number;
  to: number;
  delta: number;
  cause: LineCause;
  /** £ per UOM before and after, when the price moved. */
  unitFrom?: number;
  unitTo?: number;
  invoiceTo?: string | null;
}

export interface SkuMovement {
  skuId: number;
  code: string;
  drinkName: string | null;
  clientName: string | null;
  sizeMl: number;
  from: { total: number; asOf: string; reconstructed: boolean };
  to: { total: number; asOf: string; reconstructed: boolean };
  delta: number;
  deltaPct: number | null;
  lines: LineMovement[];
  /** The part of the movement that is wastage on the moved subtotal. */
  wastageDelta: number;
  /** What prompted each snapshot in between, oldest first. */
  triggers: string[];
}

export interface ComponentDriver {
  componentId: number;
  name: string;
  /** Summed across every SKU it moved, per bottle of each, before wastage. */
  delta: number;
  skus: number;
  causes: LineCause[];
}

export interface MovementReport {
  since: string;
  /** SKUs whose COGS moved, largest absolute movement first. */
  moved: SkuMovement[];
  drivers: ComponentDriver[];
  /** SKUs with no snapshot on or before `since`, compared from their first one instead. */
  newSinceBaseline: number;
  /** The newest day any snapshot describes. */
  latestAsOf: string | null;
  /** True when no snapshot exists at all yet. */
  empty: boolean;
}

function explain(from: SnapshotLine[], to: SnapshotLine[]): LineMovement[] {
  const before = new Map(from.map((l) => [lineKey(l), l]));
  const after_ = new Map(to.map((l) => [lineKey(l), l]));
  const out: LineMovement[] = [];
  for (const [k, t] of after_) {
    const f = before.get(k);
    if (!f) {
      out.push({ componentId: t.componentId, name: t.name, kind: t.kind, from: 0, to: t.cost, delta: t.cost, cause: "added" });
      continue;
    }
    if (Math.abs(f.cost - t.cost) <= EPSILON) continue;
    const priceMoved = Math.abs(f.unitCost - t.unitCost) > 1e-8;
    const qtyMoved = Math.abs(f.quantity - t.quantity) > 1e-6;
    out.push({
      componentId: t.componentId,
      name: t.name,
      kind: t.kind,
      from: f.cost,
      to: t.cost,
      delta: r4(t.cost - f.cost),
      cause: priceMoved && qtyMoved ? "price and quantity" : qtyMoved ? "quantity" : "price",
      ...(priceMoved ? { unitFrom: f.unitCost, unitTo: t.unitCost, invoiceTo: t.invoice } : {}),
    });
  }
  for (const [k, f] of before) {
    if (!after_.has(k)) {
      out.push({ componentId: f.componentId, name: f.name, kind: f.kind, from: f.cost, to: 0, delta: -f.cost, cause: "removed" });
    }
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/**
 * Every SKU whose COGS differs between its snapshot as at `since` (the newest
 * on or before that day) and its newest snapshot, with the lines that explain
 * the difference and the components that drove it across the range.
 */
export async function cogsMovementSince(since: string): Promise<MovementReport> {
  const [snaps, skuRows, drinkRows, clientRows] = await Promise.all([
    db.select().from(skuCogsSnapshots).orderBy(skuCogsSnapshots.asOf, skuCogsSnapshots.takenAt, skuCogsSnapshots.id),
    db.select().from(skus),
    db.select({ id: drinks.id, name: drinks.name }).from(drinks),
    db.select({ id: clients.id, name: clients.name }).from(clients),
  ]);
  const skuById = new Map(skuRows.map((s) => [s.id, s]));
  const drinkName = new Map(drinkRows.map((d) => [d.id, d.name]));
  const clientName = new Map(clientRows.map((c) => [c.id, c.name]));
  const bySku = new Map<number, SkuCogsSnapshot[]>();
  for (const s of snaps) {
    const list = bySku.get(s.skuId) ?? [];
    list.push(s);
    bySku.set(s.skuId, list);
  }

  const moved: SkuMovement[] = [];
  let newSinceBaseline = 0;
  for (const [skuId, list] of bySku) {
    const sku = skuById.get(skuId);
    if (!sku?.active) continue;
    const atOrBefore = list.filter((s) => s.asOf <= since);
    const base = atOrBefore.at(-1) ?? list[0];
    if (atOrBefore.length === 0) newSinceBaseline++;
    const last = list.at(-1)!;
    const from = Number(base.total);
    const to = Number(last.total);
    if (base.id === last.id || Math.abs(to - from) <= EPSILON) continue;
    const between = list.filter((s) => s.id !== base.id && (s.asOf > base.asOf || (s.asOf === base.asOf && s.takenAt > base.takenAt)));
    moved.push({
      skuId,
      code: sku.code,
      drinkName: sku.drinkId ? (drinkName.get(sku.drinkId) ?? null) : null,
      clientName: sku.clientId ? (clientName.get(sku.clientId) ?? null) : null,
      sizeMl: sku.sizeMl,
      from: { total: from, asOf: base.asOf, reconstructed: base.reconstructed },
      to: { total: to, asOf: last.asOf, reconstructed: last.reconstructed },
      delta: r4(to - from),
      deltaPct: from > 0 ? Math.round(((to - from) / from) * 1000) / 10 : null,
      lines: explain(base.lines as SnapshotLine[], last.lines as SnapshotLine[]),
      wastageDelta: r4(Number(last.wastage) - Number(base.wastage)),
      triggers: [...new Set(between.map((s) => s.trigger))],
    });
  }
  moved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const drivers = new Map<number, ComponentDriver>();
  for (const m of moved) {
    for (const l of m.lines) {
      const d = drivers.get(l.componentId) ?? { componentId: l.componentId, name: l.name, delta: 0, skus: 0, causes: [] };
      d.delta = r4(d.delta + l.delta);
      d.skus++;
      if (!d.causes.includes(l.cause)) d.causes.push(l.cause);
      drivers.set(l.componentId, d);
    }
  }

  return {
    since,
    moved,
    drivers: [...drivers.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    newSinceBaseline,
    latestAsOf: snaps.length > 0 ? snaps.reduce((m, s) => (s.asOf > m ? s.asOf : m), snaps[0].asOf) : null,
    empty: snaps.length === 0,
  };
}
