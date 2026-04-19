import HubPage, { HubModule } from "@/components/HubPage";

const MODULES: HubModule[] = [
  {
    href: "/recipes",
    label: "Recipes",
    sublabel: "Cocktail specifications",
    description:
      "Browse and edit the canonical spec for every cocktail — ratios, production notes, and the drinks available to each client.",
    status: "soon",
  },
  {
    href: "/drinks/range",
    label: "The Range",
    sublabel: "Active SKUs",
    description:
      "See every drink currently on sale in one place, with format, price, and channel availability at a glance.",
    status: "soon",
  },
  {
    href: "/drinks/nd",
    label: "New Product Development",
    sublabel: "What we are building",
    description:
      "Track drinks through R&D from first idea to launch, with tasting notes, costings, and decision dates.",
    status: "soon",
  },
  {
    href: "/drinks/assets",
    label: "Photo & Video Assets",
    sublabel: "Creative library",
    description:
      "Find the right photograph or pour video for any drink and hand it to Amazon, Shopify, or press without a search party.",
    status: "soon",
  },
  {
    href: "/drinks/content-plan",
    label: "Content Plan",
    sublabel: "Marketing calendar",
    description:
      "Plan launches, drops, press moments, and social content on a single calendar so the year reads as a story, not a scramble.",
    status: "soon",
  },
  {
    href: "/drinks/press",
    label: "Press",
    sublabel: "Release & coverage",
    description:
      "Draft press releases, track coverage as it lands, and hand journalists exactly the assets they need.",
    status: "soon",
  },
];

export default function DrinksPage() {
  return (
    <HubPage
      eyebrow="Drinks"
      title="Range & content"
      intro="The drinks themselves — what we sell, what we are developing, and how we tell the story."
      modules={MODULES}
    />
  );
}
