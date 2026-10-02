/**
 * Plain serialisable shapes shared by the Finances server pages and their
 * client components. Only a type-only import, which is erased: these must be
 * safe on both sides of the server/client boundary.
 *
 * The one distinction that matters everywhere here: `wholesale` and `rrp` are
 * AGREED prices, read from sku_prices, and are null when nothing has been
 * agreed. `rulePrice` is what the markup formula says today. They are never
 * interchangeable and no view may substitute one for the other.
 */

import type { CostSource } from "@/lib/erp/provenance";

export type SkuRow = {
  skuId: number;
  code: string;
  name: string;
  clientName: string | null;
  size: string;
  sizeMl: number;
  gtin: string | null;

  /** Agreed wholesale price, ex VAT. Null when none has been agreed. */
  wholesale: number | null;
  wholesaleEffectiveFrom: string | null;
  /** Agreed RRP, inc VAT. Null when none has been agreed. */
  rrp: number | null;
  /** Per-bottle shipping assumed when the wholesale price was agreed. */
  shipping: number;

  /** Full COGS: liquid + primary packaging + wastage. */
  cogs: number;
  /** COGS x markup + shipping at the stored config. Computed, never stored. */
  rulePrice: number;

  /** Worst source across the in-COGS lines. Null with no lines. */
  costSource: CostSource | null;
  /** Oldest date among the in-COGS lines; null when any has no date. */
  costAsOf: string | null;
  /** Share of the COGS subtotal that traces to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  /** Cost lines with no invoice or manual entry behind them. */
  unsourced: string[];
  /** In-COGS lines with no price history at all (strictly "unsourced", not manual). */
  unsourcedLines: number;
  /** Cost lines standing on a declared placeholder. */
  placeholders: string[];
  /** Structural problems, e.g. no current recipe. */
  problems: string[];
};

export type PricingConfigView = {
  markup: number;
  retailerMargin: number;
  vat: number;
  listEffectiveFrom: string | null;
};
