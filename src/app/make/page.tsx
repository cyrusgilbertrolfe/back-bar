import HubPage, { HubModule } from "@/components/HubPage";

/**
 * MAKE — one of the four surfaces (make, buy, sell, analyse) the top nav is
 * built from. See the Back Bar roadmap in Lifemaxxing (Domains/Cocktails/Back Bar). Statuses here are the real ones: "parked"
 * means we have deliberately stopped, not that it is coming soon.
 */
const MODULES: HubModule[] = [
  {
    href: "/drinks",
    label: "Drinks & recipes",
    sublabel: "The canon",
    description:
      "Every drink, every client's version of it, and the versioned recipe behind each one. 27 drinks and 40 recipes, read live from the database, with the percentages validated to sum to 100.",
    status: "live",
  },
  {
    href: "/calculator",
    label: "Batch calculator",
    sublabel: "Volumes for production",
    description:
      "Pick a client, a drink and a batch size, and get exact ingredient volumes and cost, computed from the live recipe. Mobile-first, for the kitchen bench.",
    status: "live",
  },
  {
    href: "/recipes",
    label: "Recipe reference",
    sublabel: "Ratios & method",
    description:
      "The browsing view of the canon: ratios, production notes and which clients each drink is available to.",
    status: "live",
  },
  {
    href: "/production/schedule",
    label: "Production schedule",
    sublabel: "What to make, when",
    description:
      "Plan batching and bottling days against the wholesale pipeline. Parked: the bedrock comes first, and this needs order data we do not yet keep.",
    status: "parked",
  },
  {
    href: "/production/runs",
    label: "Production runs, batches & serials",
    sublabel: "What we actually made",
    description:
      "Log a batch, consume the inputs, issue bottle serial numbers and print the labels. Parked to the far side of the bedrock — the batch spreadsheet and paper labels continue for now.",
    status: "parked",
  },
];

export default function MakePage() {
  return (
    <HubPage
      eyebrow="Make"
      title="What we make, and how"
      intro="The drinks canon and everything that turns it into liquid: recipes, ratios, batch volumes. The recipe layer is real and audited; the production layer is parked until the bedrock is done."
      modules={MODULES}
    />
  );
}
