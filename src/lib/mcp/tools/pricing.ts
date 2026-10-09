/**
 * MCP tools: drinks & wholesale pricing (read).
 *
 * Backed by the database: COGS from the live recipe and bill of materials,
 * agreed prices from sku_prices, config from system_settings. This mirrors
 * exactly what the Finances pages show: COGS total and its quality flags,
 * not the recipe lines behind it. For the recipe itself, see get_recipe in
 * ./recipes.ts.
 *
 * Two prices, never conflated: `wholesale` and `rrp` are AGREED prices and are
 * null when nothing has been agreed; `rulePrice` is what the markup formula
 * says today. A null agreed price is reported as null, not substituted.
 */

import { computeAllProfitability, getPricingConfig } from "@/lib/erp/pricing";
import { db } from "@/db";
import { skus } from "@/db/schema";
import { costCaveat, type CostSource } from "@/lib/erp/provenance";
import type { ToolArgs, ToolDefinition } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One line of a COGS build, as exposed by get_drink. */
interface CostLineView {
  name: string;
  /** 'liquid' for recipe ingredients, otherwise the bill-of-materials role. */
  kind: string;
  cost: number;
  source: CostSource;
  setAt: string | null;
  /** The invoice behind the price, e.g. "Matthew Clark 4417302", or null. */
  invoice: string | null;
}

interface DrinkView {
  skuId: number;
  code: string;
  name: string;
  clientName: string | null;
  size: string;
  ean: string | null;
  /** Agreed RRP inc VAT, or null when none is agreed. */
  rrp: number | null;
  /** Full COGS: liquid + primary packaging + wastage. */
  cogs: number;
  /**
   * Where cogs comes from: the WORST source across its lines (placeholder,
   * then unsourced, then manual, then inbound = supplier invoice). A
   * 'placeholder' means a line is a stand-in known to be wrong, so cogs is too.
   */
  costSource: CostSource | null;
  /** The OLDEST input date behind cogs (YYYY-MM-DD); null if any input is undated. */
  costAsOf: string | null;
  /** Share of the COGS subtotal that traces to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  /** Set when cogs includes placeholder or unsourced lines; null otherwise. */
  costWarning: string | null;
  shipping: number;
  /** Agreed wholesale ex VAT, or null when none is agreed. */
  wholesale: number | null;
  wholesaleEffectiveFrom: string | null;
  /** COGS x markup + shipping. A formula output, never an agreed price. */
  rulePrice: number;
  /** wholesale - rulePrice; negative means the agreed price has fallen behind. */
  gapToRule: number | null;
  retailerShelfPrice: number | null;
  passesRetailerTest: boolean | null;
  marginPct: number | null;
  /** Cost lines with no invoice or manual entry behind them. */
  unsourced: string[];
  /** Cost lines standing on declared placeholders. */
  placeholders: string[];
  problems: string[];
}

/** A DrinkView plus its cost lines, which only get_drink returns. */
type DrinkRecord = DrinkView & { costLines: CostLineView[]; unsourcedLines: number };

/** list_drinks and get_pricing_config do not carry the per-line detail. */
function withoutLines(record: DrinkRecord): DrinkView {
  const { costLines, unsourcedLines, ...view } = record;
  void costLines;
  void unsourcedLines;
  return view;
}

/** Build the DB view of every active SKU. */
async function buildDrinks(): Promise<DrinkRecord[]> {
  const [profitability, skuRows] = await Promise.all([
    computeAllProfitability(),
    db.select({ id: skus.id, gtin: skus.gtin }).from(skus),
  ]);
  const gtinById = new Map(skuRows.map((s) => [s.id, s.gtin]));

  return profitability.map((p) => ({
    skuId: p.skuId,
    code: p.code,
    name: p.drinkName ?? p.code,
    clientName: p.clientName,
    size: `${p.sizeMl}ml`,
    ean: gtinById.get(p.skuId) ?? null,
    rrp: p.rrp,
    cogs: round2(p.cost.total),
    costSource: p.costSource,
    costAsOf: p.costAsOf,
    invoiceBackedPct: p.invoiceBackedPct,
    costWarning: costCaveat({
      placeholders: p.cost.placeholders.length,
      unsourced: p.cost.unsourcedLines,
    }),
    shipping: round2(p.shipping),
    wholesale: p.wholesale,
    wholesaleEffectiveFrom: p.wholesaleEffectiveFrom,
    rulePrice: p.rulePrice,
    gapToRule: p.gapToRule,
    retailerShelfPrice: p.retailerShelfPrice,
    passesRetailerTest: p.retailerTestPasses,
    marginPct: p.marginPct,
    unsourced: p.cost.unsourced,
    placeholders: p.cost.placeholders,
    problems: p.cost.problems,
    unsourcedLines: p.cost.unsourcedLines,
    costLines: [...p.cost.liquid, ...p.cost.packaging].map((l) => ({
      name: l.name,
      kind: l.kind,
      cost: round2(l.cost),
      source: l.source,
      setAt: l.setAt,
      invoice: l.invoice,
    })),
  }));
}

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export const pricingTools: ToolDefinition[] = [
  {
    name: "list_drinks",
    title: "List drinks",
    description:
      "List every drink/SKU with size, EAN barcode, agreed RRP, database COGS, " +
      "agreed wholesale price (null when none is agreed), the formula rule " +
      "price, the gap between them, and the retailer test. Every COGS carries " +
      "its provenance: costSource (worst source across its lines), costAsOf " +
      "(oldest input date) and invoiceBackedPct. A costSource of 'placeholder' " +
      "means COGS includes a stand-in price known to be wrong, so cogs, " +
      "marginPct and rulePrice for that drink are wrong too; costWarning says " +
      "so. Optionally filter by size (e.g. '250ml') or by name substring.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "string",
          description: "Filter by exact size, e.g. '250ml', '500ml', '700ml'.",
        },
        name: {
          type: "string",
          description: "Filter by case-insensitive substring of the drink name.",
        },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      let drinks = (await buildDrinks()).map(withoutLines);
      const size = str(args, "size");
      const name = str(args, "name");
      if (size) {
        drinks = drinks.filter((d) => d.size.toLowerCase() === size.toLowerCase());
      }
      if (name) {
        const needle = name.toLowerCase();
        drinks = drinks.filter((d) => d.name.toLowerCase().includes(needle));
      }
      drinks.sort((a, b) => a.name.localeCompare(b.name) || a.size.localeCompare(b.size));
      return { count: drinks.length, drinks };
    },
  },
  {
    name: "get_drink",
    title: "Get a drink",
    description:
      "Look up a single drink/SKU by its numeric sku id, code (e.g. " +
      "'negroni-250'), EAN barcode, or name. When matched by name, every size " +
      "of that drink is returned. Also returns costLines (name, kind, cost, " +
      "source, setAt for each line in COGS, excluding wastage) so a figure can " +
      "be traced. A costSource of 'placeholder' means COGS includes a stand-in " +
      "price known to be wrong; check costLines for which line.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "SKU code (e.g. 'negroni-250') or numeric sku id." },
        ean: { type: "string", description: "EAN/GTIN barcode number." },
        name: { type: "string", description: "Drink name, e.g. 'Negroni'." },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const idArg = str(args, "id");
      const ean = str(args, "ean");
      const name = str(args, "name");
      if (!idArg && !ean && !name) {
        throw new Error("Provide one of: id, ean, name.");
      }
      const drinks = await buildDrinks();
      let matches: DrinkRecord[] = [];
      if (idArg) {
        const numeric = Number(idArg);
        matches = drinks.filter(
          (d) => d.code === idArg || (Number.isInteger(numeric) && d.skuId === numeric),
        );
      } else if (ean) matches = drinks.filter((d) => d.ean === ean);
      else if (name) {
        const needle = name.toLowerCase();
        matches = drinks.filter((d) => d.name.toLowerCase() === needle);
        if (matches.length === 0) {
          matches = drinks.filter((d) => d.name.toLowerCase().includes(needle));
        }
      }
      if (matches.length === 0) throw new Error("No matching drink found.");
      return { count: matches.length, drinks: matches };
    },
  },
  {
    name: "get_pricing_config",
    title: "Get pricing config",
    description:
      "Return the wholesale pricing assumptions from the database (markup on " +
      "COGS, retailer margin, VAT rate, price-list effective date) and summary " +
      "stats: SKU count, how many have an agreed wholesale price, retailer-test " +
      "pass rate, average agreed wholesale and average margin, plus how many " +
      "SKUs have placeholder or unsourced lines inside their COGS (those SKUs' " +
      "margins are not reliable, and averageMarginPct includes them).",
    access: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const [config, drinks] = await Promise.all([getPricingConfig(), buildDrinks()]);
      const priced = drinks.filter((d) => d.wholesale !== null);
      const testable = drinks.filter((d) => d.passesRetailerTest !== null);
      const passing = testable.filter((d) => d.passesRetailerTest === true).length;
      const avg = (xs: number[]) =>
        xs.length ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
      return {
        config: {
          markupOnCogsPct: round2((config.markup - 1) * 100),
          retailerMarginPct: round2((config.retailerMargin - 1) * 100),
          vatRatePct: round2((config.vat - 1) * 100),
          listEffectiveFrom: config.listEffectiveFrom,
          formula:
            "rule price = COGS x markup + shipping. Computed for comparison; the agreed price is what is actually charged.",
        },
        summary: {
          skuCount: drinks.length,
          withAgreedWholesale: priced.length,
          retailerTestable: testable.length,
          retailerTestPassing: passing,
          retailerTestPassRatePct: testable.length
            ? round2((passing / testable.length) * 100)
            : null,
          averageAgreedWholesale: avg(priced.map((d) => d.wholesale as number)),
          averageMarginPct: avg(
            priced.map((d) => d.marginPct).filter((m): m is number => m !== null),
          ),
          skusWithPlaceholderOrUnsourcedCogs: drinks.filter(
            (d) => d.placeholders.length > 0 || d.unsourcedLines > 0,
          ).length,
          skusWithPlaceholderCogs: drinks.filter((d) => d.placeholders.length > 0).length,
          skusWithUnsourcedCogs: drinks.filter((d) => d.unsourcedLines > 0).length,
        },
      };
    },
  },
];
