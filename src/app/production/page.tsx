import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/calculator",
    label: "Batch Calculator",
    sublabel: "Volumes for production",
    description:
      "Select a client, choose a recipe, and get precise ingredient volumes for any batch size. Mobile-first for the kitchen.",
    status: "live",
  },
  {
    href: "/production/inventory",
    label: "Inventory",
    sublabel: "Stock & dispatch",
    description:
      "See at a glance how much stock you hold across Amazon, Shopify, and wholesale — and whether you need to batch before the next dispatch.",
    status: "soon",
  },
  {
    href: "/production/master-list",
    label: "Cocktail Master List",
    sublabel: "Recipe ratios",
    description:
      "Look up ratios, batch yields, and sub-recipe dependencies for any drink so the kitchen can make anything without guesswork.",
    status: "soon",
  },
  {
    href: "/production/audit",
    label: "Stock Audit",
    sublabel: "Physical stocktake",
    description:
      "Run a guided quarterly stocktake, reconcile physical count against the system, and produce a valuation ready for year-end.",
    status: "soon",
  },
  {
    href: "/production/schedule",
    label: "Production Schedule",
    sublabel: "What to make, when",
    description:
      "Plan batching and bottling days against the wholesale pipeline and Shopify forecast so the kitchen is never surprised by an order.",
    status: "soon",
  },
  {
    href: "/production/suppliers",
    label: "Suppliers & Purchasing",
    sublabel: "Raw materials",
    description:
      "Track reorder points and lead times for bottles, caps, jerry cans, labels, and spirits — and get flagged before anything runs out.",
    status: "soon",
  },
];

export default function ProductionPage() {
  return (
    <HubPage
      eyebrow="Production"
      title="Kitchen & fulfilment"
      intro="Everything that turns ingredients into bottled cocktails on a shelf — batching, inventory, purchasing, and audit."
      modules={MODULES}
    />
  );
}
