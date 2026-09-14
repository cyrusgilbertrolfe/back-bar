import HubPage, { HubModule } from "@/components/HubPage";

/**
 * BUY — one of the four surfaces (make, buy, sell, analyse). See
 * the Back Bar roadmap in Lifemaxxing (Domains/Cocktails/Back Bar). Suppliers is listed as live because the screen works, but
 * the description says plainly that nothing has ever been entered into it.
 */
const MODULES: HubModule[] = [
  {
    href: "/finances/ingredients",
    label: "Ingredient master",
    sublabel: "What we buy & what it costs",
    description:
      "Every ingredient with its current unit cost and a dated history of every price change. Model a price rise and see which drinks it hits. 110 components, 116 recorded price changes.",
    status: "live",
  },
  {
    href: "/erp/components",
    label: "Components",
    sublabel: "Ingredients, dry goods, packaging",
    description:
      "The full component master across all four types, each with its latest cost, unit of measure and price history. This is the bottom of the costing chain everything else stands on.",
    status: "live",
  },
  {
    href: "/erp/settings",
    label: "Costing settings",
    sublabel: "Wastage & labour",
    description:
      "The global wastage percentage and labour rate that every cost rollup applies. Two numbers, but they move every price in the business.",
    status: "live",
  },
  {
    href: "/erp/suppliers",
    label: "Suppliers",
    sublabel: "Who we buy from",
    description:
      "The screen works, but nothing has ever been entered: zero suppliers on file since it shipped in May. It becomes useful when deliveries are recorded, which is parked, so treat this as empty by design rather than broken.",
    status: "live",
  },
  {
    href: "/buy/inbounds",
    label: "Inbounds & deliveries",
    sublabel: "Receiving stock",
    description:
      "Receive a delivery, update the cost, increment stock. Parked: this is the loop that would give suppliers a purpose, and it is the first thing to unpark once the bedrock is trusted.",
    status: "parked",
  },
  {
    href: "/buy/stock",
    label: "Stock on hand",
    sublabel: "What we hold",
    description:
      "Lot-level inventory and what it is worth. Parked with the rest of the operations surface.",
    status: "parked",
  },
];

export default function BuyPage() {
  return (
    <HubPage
      eyebrow="Buy"
      title="What we buy, and what it costs"
      intro="The component master and the costs underneath every price in the business. The cost layer is real and populated; receiving and stock are parked."
      modules={MODULES}
    />
  );
}
