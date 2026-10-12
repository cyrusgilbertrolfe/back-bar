import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/finances/ingredients",
    label: "Ingredients",
    sublabel: "Master list & unit cost",
    description:
      "Every ingredient we buy, its current unit cost, and a dated history of every price change. Model an ingredient price rise and see which drinks it hits.",
    status: "live",
  },
  {
    href: "/dashboard",
    label: "Revenue Overview",
    sublabel: "YTD revenue & partners",
    description:
      "Total revenue, DTC vs wholesale split, partner revenue boxes, concentration risk, and Shopify live orders.",
    status: "live",
  },
  {
    href: "/finances/pricing",
    label: "Wholesale Pricing",
    sublabel: "Live COGS → wholesale",
    description:
      "Agreed wholesale prices beside the formula rule price, with database COGS and the retailer test. The opening position for any new or existing wholesale partner.",
    status: "live",
  },
  {
    href: "/finances/price-review",
    label: "Price Review",
    sublabel: "Cost moved since priced",
    description:
      "Every SKU's agreed price beside today's COGS, when the price was set, and a flag where cost has moved under it since. The list to take into the February price review.",
    status: "live",
  },
  {
    href: "/finances/profitability",
    label: "COGS Build",
    sublabel: "Line-level cost of goods",
    description:
      "Every SKU costed line by line from the database: liquid, primary packaging and wastage, with the provenance of every figure. The audit view of the cost engine.",
    status: "live",
  },
  {
    href: "/finances/rrp",
    label: "RRP",
    sublabel: "What we charge",
    description:
      "The canonical recommended retail price across our own channels. Position-led, click-to-edit, with the wholesale floor, retailer test, headroom, and Amazon price all derived automatically.",
    status: "live",
  },
  {
    href: "/finances/pnl",
    label: "Per-drink P&L",
    sublabel: "What we earn",
    description:
      "Contribution margin per drink by channel under three cost scenarios: D2C Shopify vs B2B Wholesale, with basket, density, and the free-shipping hurdle. Scenario-aware so sunk-inventory effects don't hide.",
    status: "live",
  },
  {
    href: "/finances/channel-pnl",
    label: "Channel P&L",
    sublabel: "Every partner × every drink",
    description:
      "Pivot by partner, drink or ingredient to see what you sell to whom, the current deal, and the impact of any cost change.",
    status: "soon",
  },
  {
    href: "/finances/audit",
    label: "Stock Audit",
    sublabel: "Wet goods & value",
    description:
      "Physical stocktake of wet goods by size and quantity, valued for year-end and variance analysis.",
    status: "soon",
  },
  {
    href: "/finances/quickbooks",
    label: "QuickBooks Sales",
    sublabel: "Wholesale invoices",
    description:
      "Historic wholesale invoice data from 2017 onwards, mapped to customers and products.",
    status: "soon",
  },
  {
    href: "/finances/shopify",
    label: "Shopify Sales",
    sublabel: "Direct-to-consumer",
    description:
      "Order-level D2C data with SKU, postcode, week and month breakdowns.",
    status: "soon",
  },
];

export default function FinancesPage() {
  return (
    <HubPage
      eyebrow="Finances"
      title="Money in, money out"
      intro="Profitability, audit, and the live read on where the business makes, and loses, money."
      modules={MODULES}
    />
  );
}
