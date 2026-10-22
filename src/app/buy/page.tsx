import HubPage, { HubModule } from "@/components/HubPage";
import { listInvoices } from "@/lib/erp/invoice-check/list";

export const dynamic = "force-dynamic";

/**
 * BUY — one of the four surfaces (make, buy, sell, analyse). See
 * the Back Bar roadmap in Lifemaxxing (Domains/Cocktails/Back Bar). Suppliers is listed as live because the screen works, but
 * the description says plainly that nothing has ever been entered into it.
 */
const MODULES: HubModule[] = [
  {
    href: "/finances/invoice-check",
    label: "Invoice check",
    sublabel: "Prices from supplier invoices",
    description:
      "Every price a supplier invoice in cocktails@ implies, landed and referenced, waiting for approval. Worked in the Cocktails Weekly; a rise of 10% or more is flagged to query before paying. Nothing is written until approved.",
    status: "live",
  },
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

/** What the invoice check is waiting on, for its entry here. Never fails the page. */
async function waitingLine(): Promise<string | null> {
  try {
    const invoices = await listInvoices({ includeClosed: false });
    const waiting = invoices.reduce((n, i) => n + i.pending, 0);
    const urgent = invoices.filter((i) => i.urgent && (i.pending > 0 || i.status === "unreadable")).length;
    if (waiting === 0 && urgent === 0) return "Nothing waiting.";
    return `${waiting} price${waiting === 1 ? "" : "s"} waiting${urgent ? `, ${urgent} urgent invoice${urgent === 1 ? "" : "s"}` : ""}.`;
  } catch (err) {
    console.error("[buy] could not count the invoice check", err);
    return null;
  }
}

export default async function BuyPage() {
  const line = await waitingLine();
  const modules = line
    ? MODULES.map((m) => (m.href === "/finances/invoice-check" ? { ...m, sublabel: line } : m))
    : MODULES;
  return (
    <HubPage
      eyebrow="Buy"
      title="What we buy, and what it costs"
      intro="The component master and the costs underneath every price in the business. The cost layer is real and populated; receiving and stock are parked."
      modules={modules}
    />
  );
}
