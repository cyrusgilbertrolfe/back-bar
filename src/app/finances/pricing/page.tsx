import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import PricingClient from "./PricingClient";
import { COLOR } from "@/lib/design";

export default function PricingPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides: Record<string, number> = rrpOverridesRaw as Record<string, number>;

  const productsWithRrp = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <PricingClient
        products={productsWithRrp}
        defaultConfig={DEFAULT_CONFIG}
        rrpOverrides={rrpOverrides}
      />
    </div>
  );
}
