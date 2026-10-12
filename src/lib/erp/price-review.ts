/**
 * The price review: every SKU's cost, agreed price and margin, when the price
 * was set, and how far its COGS has moved since (roadmap week 5).
 *
 * An agreed price holds until the annual review (Cyrus, 11 Oct 2026: trade
 * price lists run to 28 Feb 2027, and every wholesale price is reset at the
 * end of February). So this is not a prompt to reprice; it is the list taken
 * into that review: which prices have had their cost move under them, and by
 * how much.
 *
 * "COGS when the price was set" is read from sku_cogs_snapshots: the newest
 * snapshot on or before the day the price took effect. History begins 2 Jun
 * 2026, when the recipes were seeded, so a price set earlier is compared from
 * the first snapshot instead, and says so (Cyrus, 12 Oct 2026). COGS now is
 * the live figure, not the last snapshot.
 */

import { and, isNull, eq } from "drizzle-orm";

import { db } from "@/db";
import { skuCogsSnapshots, skuPrices, type SkuCogsSnapshot } from "@/db/schema";
import { explain, linesOf, type LineMovement, type SnapshotLine } from "@/lib/erp/cogs-movement";
import { computeAllProfitability, type SkuProfitability } from "@/lib/erp/pricing";

/** A move of a penny a bottle or more, either way, is flagged (Cyrus, 12 Oct 2026). */
export const MOVE_FLAG = 0.01;

export interface PriceReviewRow {
  p: SkuProfitability;
  /** Which agreed price the review is read against: wholesale if there is one, else RRP. */
  basis: "wholesale" | "rrp" | null;
  /** The day that price took effect. */
  priceSetOn: string | null;
  /** COGS when the price was set, from the snapshot it is measured from. Null with no snapshot. */
  then: {
    total: number;
    asOf: string;
    reconstructed: boolean;
    /** True when the price predates tracking, so `asOf` is later than `priceSetOn`. */
    beforeTracking: boolean;
  } | null;
  /** Live COGS minus `then.total`. Null without a baseline. */
  delta: number | null;
  deltaPct: number | null;
  flagged: boolean;
  /** The lines that moved it, largest first. */
  lines: LineMovement[];
  /** The part of the move that is wastage on the moved subtotal. */
  wastageDelta: number;
}

export interface PriceReview {
  rows: PriceReviewRow[];
  /** When cost tracking begins: the earliest snapshot. */
  trackingFrom: string | null;
}

function r4(x: number): number {
  return Math.round(x * 10000) / 10000;
}

export async function priceReview(): Promise<PriceReview> {
  const [profit, snaps, rrpRows] = await Promise.all([
    computeAllProfitability(),
    db
      .select()
      .from(skuCogsSnapshots)
      .orderBy(skuCogsSnapshots.asOf, skuCogsSnapshots.takenAt, skuCogsSnapshots.id),
    db
      .select({ skuId: skuPrices.skuId, effectiveFrom: skuPrices.effectiveFrom })
      .from(skuPrices)
      .where(and(eq(skuPrices.priceType, "rrp"), isNull(skuPrices.effectiveTo))),
  ]);
  const rrpFrom = new Map(rrpRows.map((r) => [r.skuId, r.effectiveFrom]));
  const bySku = new Map<number, SkuCogsSnapshot[]>();
  for (const s of snaps) {
    const list = bySku.get(s.skuId) ?? [];
    list.push(s);
    bySku.set(s.skuId, list);
  }

  const rows = profit.map((p): PriceReviewRow => {
    const basis = p.wholesale !== null ? "wholesale" : p.rrp !== null ? "rrp" : null;
    const priceSetOn =
      basis === "wholesale" ? p.wholesaleEffectiveFrom : basis === "rrp" ? (rrpFrom.get(p.skuId) ?? null) : null;
    const list = bySku.get(p.skuId) ?? [];
    const base = priceSetOn ? (list.filter((s) => s.asOf <= priceSetOn).at(-1) ?? list[0]) : undefined;
    if (!basis || !base) {
      return { p, basis, priceSetOn, then: null, delta: null, deltaPct: null, flagged: false, lines: [], wastageDelta: 0 };
    }
    const from = Number(base.total);
    const delta = r4(p.cost.total - from);
    return {
      p,
      basis,
      priceSetOn,
      then: {
        total: from,
        asOf: base.asOf,
        reconstructed: base.reconstructed,
        beforeTracking: priceSetOn! < base.asOf,
      },
      delta,
      deltaPct: from > 0 ? Math.round((delta / from) * 1000) / 10 : null,
      flagged: Math.abs(delta) >= MOVE_FLAG,
      lines: explain(base.lines as SnapshotLine[], linesOf(p.cost)),
      wastageDelta: r4(p.cost.wastage - Number(base.wastage)),
    };
  });

  // Flagged first, largest move as a share of COGS first, so a 5L jerrycan's
  // pounds do not bury a 500ml bottle's percent; then the rest by margin, as
  // Pricing does.
  rows.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    if (a.flagged) return Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0);
    return 0;
  });

  return { rows, trackingFrom: snaps[0]?.asOf ?? null };
}
