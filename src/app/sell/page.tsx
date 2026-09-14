import HubPage, { HubModule } from "@/components/HubPage";

/**
 * SELL — one of the four surfaces (make, buy, sell, analyse). See
 * the Back Bar roadmap in Lifemaxxing (Domains/Cocktails/Back Bar). CRM is parked with a stated interim answer (a spreadsheet),
 * so it reads as a decision rather than a gap.
 */
const MODULES: HubModule[] = [
  {
    href: "/finances/pricing",
    label: "Wholesale pricing",
    sublabel: "What stockists pay",
    description:
      "Agreed wholesale prices beside the formula rule price, with COGS derived live from the database and the retailer test applied. The opening position for any wholesale conversation.",
    status: "live",
  },
  {
    href: "/finances/rrp",
    label: "RRP",
    sublabel: "What we charge",
    description:
      "The canonical recommended retail price across our own channels, click-to-edit, with the wholesale floor, retailer test, headroom and Amazon price all derived automatically.",
    status: "live",
  },
  {
    href: "/sales/accounts",
    label: "Wholesale outreach",
    sublabel: "Prospects & touchpoints",
    description:
      "Every retail prospect for the sample-box campaign: who, what, when, and what came back. Accounts, buyers, status and a touchpoint log.",
    status: "live",
  },
  {
    href: "/sell/crm",
    label: "CRM & pipeline",
    sublabel: "Contacts & next actions",
    description:
      "Parked, with a decision behind it: outbound is tracked in a spreadsheet for now. Building a CRM here would cost the bedrock months, and a spreadsheet genuinely does this job at our size.",
    status: "parked",
  },
  {
    href: "/sell/orders",
    label: "Wholesale orders",
    sublabel: "Who ordered what",
    description:
      "Order capture, terms and history per partner. The tables exist and hold nothing; parked until the bedrock is done and we know what shape orders should take.",
    status: "parked",
  },
];

export default function SellPage() {
  return (
    <HubPage
      eyebrow="Sell"
      title="What we sell, to whom, at what price"
      intro="Pricing is the live half of this surface and the half that matters most: every price derived from a real cost. Customers and orders are parked, and a spreadsheet carries outreach meanwhile."
      modules={MODULES}
    />
  );
}
