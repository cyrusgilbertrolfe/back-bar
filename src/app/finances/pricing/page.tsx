import Nav from "@/components/Nav";
import { getPricingProductsWithLiveCogs } from "@/lib/cogs";
import { DEFAULT_CONFIG } from "@/lib/pricing-data";
import rrpOverridesRaw from "@/data/rrp-overrides.json";
import wholesaleOverridesRaw from "@/data/wholesale-overrides.json";
import PricingClient from "./PricingClient";
import { COLOR } from "@/lib/design";

export default function PricingPage() {
  const products = getPricingProductsWithLiveCogs();
  const rrpOverrides: Record<string, number> = rrpOverridesRaw as Record<string, number>;
  const wholesaleOverrides: Record<string, number> = wholesaleOverridesRaw as Record<string, number>;

  const productsWithOverrides = products.map((p) => ({
    ...p,
    rrp: rrpOverrides[p.id] ?? p.rrp,
    wholesaleOverride: wholesaleOverrides[p.id],
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <PricingClient
        products={productsWithOverrides}
        defaultConfig={DEFAULT_CONFIG}
        rrpOverrides={rrpOverrides}
        wholesaleOverrides={wholesaleOverrides}
      />
    </div>
  );
}
