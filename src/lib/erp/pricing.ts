/**
 * Pricing and profitability, read from the database.
 *
 * Replaces src/lib/pricing-data.ts, which held agreed prices, hand-typed COGS
 * and the markup rules in a checked-in TypeScript file.
 *
 * The distinction this module exists to keep straight, and it is Cyrus's rule
 * (30 Jul 2026): an AGREED price is a commitment to a retailer, reissued once a
 * year after the government's duty rise. A RULE price is what the markup
 * formula says it ought to be today. They are different things. The agreed
 * price is stored; the rule price is computed on every read and never written.
 *
 * The gap between them is the point. Between annual reviews costs move and the
 * agreed price does not, so that gap is the margin erosion, and it is the list
 * you take into the next review.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  clients,
  drinks,
  skuPrices,
  skus,
  systemSettings,
  SETTING_KEYS,
} from "@/db/schema";
import { computeSkuCost, type SkuCost } from "@/lib/erp/cogs";
import type { CostSource } from "@/lib/erp/provenance";

export interface PricingConfig {
  /** Wholesale markup on COGS, e.g. 1.40. */
  markup: number;
  /** Margin a retailer is assumed to add, e.g. 1.30. */
  retailerMargin: number;
  /** VAT multiplier, e.g. 1.20. */
  vat: number;
  /** When the current wholesale price list took effect. */
  listEffectiveFrom: string | null;
}

export interface SkuProfitability {
  skuId: number;
  code: string;
  drinkName: string | null;
  clientName: string | null;
  sizeMl: number;

  /** Agreed wholesale price, ex VAT. Null when none is recorded. */
  wholesale: number | null;
  /** Agreed RRP, inc VAT. Null when none is recorded. */
  rrp: number | null;
  /** Per-bottle shipping assumed when the wholesale price was agreed. */
  shipping: number;
  wholesaleEffectiveFrom: string | null;

  cost: SkuCost;
  /** Provenance of `cost.total`, lifted from the cost rollup. See SkuCost. */
  costSource: CostSource | null;
  costAsOf: string | null;
  invoiceBackedPct: number;

  /** wholesale - COGS - shipping. Null without an agreed price. */
  margin: number | null;
  marginPct: number | null;

  /** COGS x markup + shipping. Always computable. */
  rulePrice: number;
  /** wholesale - rulePrice. Negative means the agreed price has fallen behind. */
  gapToRule: number | null;

  /**
   * Retailer test: wholesale x retailerMargin x vat must be at or under RRP,
   * otherwise a retailer cannot make their margin without breaking the RRP.
   */
  retailerShelfPrice: number | null;
  retailerTestPasses: boolean | null;
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const rows = await db.select().from(systemSettings);
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return {
    markup: Number(get(SETTING_KEYS.PRICING_MARKUP) ?? 1.4),
    retailerMargin: Number(get(SETTING_KEYS.PRICING_RETAILER_MARGIN) ?? 1.3),
    vat: Number(get(SETTING_KEYS.PRICING_VAT) ?? 1.2),
    listEffectiveFrom: get(SETTING_KEYS.PRICING_LIST_EFFECTIVE_FROM) ?? null,
  };
}

/** The price in force now for a SKU, or null. */
export async function getCurrentPrice(
  skuId: number,
  priceType: "wholesale" | "rrp",
) {
  const [row] = await db
    .select()
    .from(skuPrices)
    .where(
      and(
        eq(skuPrices.skuId, skuId),
        eq(skuPrices.priceType, priceType),
        isNull(skuPrices.effectiveTo),
      ),
    );
  return row ?? null;
}

export async function computeSkuProfitability(
  skuId: number,
  config?: PricingConfig,
): Promise<SkuProfitability> {
  const cfg = config ?? (await getPricingConfig());

  const [sku] = await db.select().from(skus).where(eq(skus.id, skuId));
  if (!sku) throw new Error(`No SKU ${skuId}`);

  const [drink] = sku.drinkId
    ? await db.select().from(drinks).where(eq(drinks.id, sku.drinkId))
    : [undefined];
  const [client] = sku.clientId
    ? await db.select().from(clients).where(eq(clients.id, sku.clientId))
    : [undefined];

  const cost = await computeSkuCost(skuId);

  const wholesaleRow = await getCurrentPrice(skuId, "wholesale");
  const rrpRow = await getCurrentPrice(skuId, "rrp");

  const wholesale = wholesaleRow ? n(wholesaleRow.amount) : null;
  const rrp = rrpRow ? n(rrpRow.amount) : null;
  const shipping = wholesaleRow ? n(wholesaleRow.shipping) : 0;

  const rulePrice = round(cost.total * cfg.markup + shipping);
  const margin = wholesale === null ? null : round(wholesale - cost.total - shipping);
  const shelf = wholesale === null ? null : round(wholesale * cfg.retailerMargin * cfg.vat);

  return {
    skuId: sku.id,
    code: sku.code,
    drinkName: drink?.name ?? null,
    clientName: client?.name ?? null,
    sizeMl: sku.sizeMl,
    wholesale,
    rrp,
    shipping,
    wholesaleEffectiveFrom: wholesaleRow?.effectiveFrom ?? null,
    cost,
    costSource: cost.costSource,
    costAsOf: cost.costAsOf,
    invoiceBackedPct: cost.invoiceBackedPct,
    margin,
    marginPct:
      wholesale === null || wholesale === 0 || margin === null
        ? null
        : round((margin / wholesale) * 100, 1),
    rulePrice,
    gapToRule: wholesale === null ? null : round(wholesale - rulePrice),
    retailerShelfPrice: shelf,
    retailerTestPasses: shelf === null || rrp === null ? null : shelf <= rrp,
  };
}

/** How many SKUs to roll up at once. Matches ROLLUP_CONCURRENCY in cogs.ts. */
const PROFIT_CONCURRENCY = 8;

/** Every active SKU, costed and priced. Worst margin first. */
export async function computeAllProfitability(): Promise<SkuProfitability[]> {
  const cfg = await getPricingConfig();
  const rows = await db.select().from(skus).where(eq(skus.active, true));

  // Bounded parallelism, as in computeAllSkuCosts: each rollup is a run of
  // round trips, so the wall time is latency and not work. Written back by
  // index so the order does not depend on which finishes first.
  const out: SkuProfitability[] = new Array(rows.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PROFIT_CONCURRENCY, rows.length) }, async () => {
      for (let i = next++; i < rows.length; i = next++) {
        out[i] = await computeSkuProfitability(rows[i].id, cfg);
      }
    }),
  );
  return out.sort((a, b) => {
    if (a.marginPct === null && b.marginPct === null) return a.code.localeCompare(b.code);
    if (a.marginPct === null) return 1;
    if (b.marginPct === null) return -1;
    return a.marginPct - b.marginPct;
  });
}
