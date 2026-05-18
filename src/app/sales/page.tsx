import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/sales/accounts",
    label: "Wholesale Outreach",
    sublabel: "Sample-box campaign",
    description:
      "Track every retail prospect for the wholesale sample drop — who, what, when, where, and what came back. Accounts, buyers, status, and a touchpoint log.",
    status: "live",
  },
  {
    href: "/sales/crm",
    label: "CRM",
    sublabel: "Contacts & pipeline",
    description:
      "Keep one record of every buyer, caterer, and retailer — stage, next action, and the last conversation — so nothing slips through email.",
    status: "soon",
  },
  {
    href: "/sales/wholesale",
    label: "Wholesale Accounts",
    sublabel: "Retailers & hospitality",
    description:
      "Manage terms, pricing, and order history for every wholesale partner in one place — Fortnum & Mason, Cripps, Liberty, Macknade, Bayley & Sage, Italo, British Airways.",
    status: "soon",
  },
  {
    href: "/sales/caterers",
    label: "Caterers",
    sublabel: "Event-led pipeline",
    description:
      "Price and book caterer events against the five-litre format, and feed the pipeline straight into the production schedule.",
    status: "soon",
  },
  {
    href: "/sales/amazon",
    label: "Amazon",
    sublabel: "Marketplace performance",
    description:
      "See the real per-SKU profit after Amazon fees, so the marketplace is managed on its own terms rather than pooled with wholesale.",
    status: "soon",
  },
  {
    href: "/sales/dtc",
    label: "D2C / Shopify",
    sublabel: "Direct customers",
    description:
      "Drill into Shopify orders, repeat-customer cohorts, and campaign returns to see what is actually driving direct revenue.",
    status: "soon",
  },
  {
    href: "/sales/leads",
    label: "Leads & Outreach",
    sublabel: "New business",
    description:
      "Log prospect conversations, run outreach from a shared template library, and turn leads into accounts without the spreadsheet.",
    status: "soon",
  },
];

export default function SalesPage() {
  return (
    <HubPage
      eyebrow="Sales"
      title="Customers & pipeline"
      intro="Every buyer, every channel, every conversation. The wholesale outreach tracker is live; the rest follows."
      modules={MODULES}
    />
  );
}
