import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import PreviewFrame from "../PreviewFrame";
import PreviewPricingClient from "./PreviewPricingClient";

export const metadata = {
  title: "Wholesale pricing — Preview — The Back Bar",
};

export default function PreviewPricingPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides: Record<string, number> = rrpOverridesRaw as Record<string, number>;

  const productsWithRrp = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
  }));

  return (
    <PreviewFrame currentHref="/finances/pricing" currentLabel="wholesale pricing">
      <PreviewPricingClient
        products={productsWithRrp}
        defaultConfig={DEFAULT_CONFIG}
        rrpOverrides={rrpOverrides}
      />
    </PreviewFrame>
  );
}
