import HubPage, { HubModule } from "@/components/HubPage";

/**
 * ANALYSE — one of the four surfaces (make, buy, sell, analyse). See
 * the Back Bar roadmap in Lifemaxxing (Domains/Cocktails/Back Bar).
 *
 * Every figure on this surface is governed by docs/revenue-provenance.md: a
 * number that cannot be traced to a source system does not get shown. The
 * channel split is parked because it is genuinely blocked, and saying which
 * is more useful than showing a number nobody can stand behind.
 */
const MODULES: HubModule[] = [
  {
    href: "/dashboard",
    label: "Revenue overview",
    sublabel: "What came in",
    description:
      "Revenue by year and channel, sourced from Shopify and QuickBooks, with the age of every snapshot on the face of it and partial years labelled as partial.",
    status: "live",
  },
  {
    href: "/finances/profitability",
    label: "COGS build",
    sublabel: "Line-level cost of goods",
    description:
      "Every SKU costed line by line from the database — liquid, primary packaging, wastage — with the provenance of every figure. The audit view of the cost engine.",
    status: "live",
  },
  {
    href: "/finances/pnl",
    label: "Per-drink P&L",
    sublabel: "What we earn",
    description:
      "Contribution margin per drink by channel under three cost scenarios, with basket, density and the free-shipping hurdle.",
    status: "live",
  },
  {
    href: "/strategy",
    label: "Strategy",
    sublabel: "The written position",
    description:
      "The standing argument about where the business is going. Prose, not data — it cites the numbers rather than computing them.",
    status: "live",
  },
  {
    href: "/analyse/channel-mix",
    label: "Revenue by channel",
    sublabel: "The unanswered question",
    description:
      "The single number the original spec most wanted, and still blocked: £92k of 2025 revenue sits in an unclassified QuickBooks account, larger than every classified channel combined. It is a bookkeeping job, not a build job.",
    status: "parked",
  },
];

export default function AnalysePage() {
  return (
    <HubPage
      eyebrow="Analyse"
      title="Is any of it working"
      intro="Cost, margin and revenue, with a rule underneath: Back Bar will not show a number it cannot trace to a source system. Where something cannot honestly be known, it says so instead."
      modules={MODULES}
    />
  );
}
