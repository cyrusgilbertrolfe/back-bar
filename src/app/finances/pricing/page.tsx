import Nav from "@/components/Nav";
import { db } from "@/db";
import { skus } from "@/db/schema";
import { computeAllProfitability, getPricingConfig } from "@/lib/erp/pricing";
import type { PricingConfigView, SkuRow } from "../finance-types";
import PricingClient from "./PricingClient";
import { COLOR } from "@/lib/design";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [profitability, config, skuRows] = await Promise.all([
    computeAllProfitability(),
    getPricingConfig(),
    db.select({ id: skus.id, gtin: skus.gtin }).from(skus),
  ]);

  const gtinById = new Map(skuRows.map((s) => [s.id, s.gtin]));

  const rows: SkuRow[] = profitability.map((p) => ({
    skuId: p.skuId,
    code: p.code,
    name: p.drinkName ?? p.code,
    clientName: p.clientName,
    size: `${p.sizeMl}ml`,
    sizeMl: p.sizeMl,
    gtin: gtinById.get(p.skuId) ?? null,
    wholesale: p.wholesale,
    wholesaleEffectiveFrom: p.wholesaleEffectiveFrom,
    rrp: p.rrp,
    shipping: p.shipping,
    cogs: p.cost.total,
    rulePrice: p.rulePrice,
    costSource: p.costSource,
    costAsOf: p.costAsOf,
    invoiceBackedPct: p.invoiceBackedPct,
    unsourced: p.cost.unsourced,
    unsourcedLines: p.cost.unsourcedLines,
    placeholders: p.cost.placeholders,
    problems: p.cost.problems,
  }));

  const configView: PricingConfigView = {
    markup: config.markup,
    retailerMargin: config.retailerMargin,
    vat: config.vat,
    listEffectiveFrom: config.listEffectiveFrom,
  };

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <PricingClient rows={rows} config={configView} />
    </div>
  );
}
