import Nav from "@/components/Nav";
import {
  INGREDIENTS,
  PRICE_HISTORY,
  getRecipesUsingIngredient,
} from "@/lib/ingredients";
import IngredientsClient from "./IngredientsClient";

export default function IngredientsPage() {
  // Precompute usage counts on the server so the client doesn't need recipes.
  const usageCounts = Object.fromEntries(
    INGREDIENTS.map((i) => [i.id, getRecipesUsingIngredient(i.id).length]),
  );

  const lastUpdated = [...INGREDIENTS]
    .map((i) => i.currentPriceSetAt)
    .concat(PRICE_HISTORY.map((e) => e.date))
    .sort()
    .pop();

  return (
    <div className="min-h-screen" style={{ background: "#080808" }}>
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-10">
          <p
            className="text-xs uppercase tracking-[0.6em] mb-3 font-medium"
            style={{ color: "#c9a227" }}
          >
            Finances · Ingredients
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            style={{ color: "#f0f0f0", letterSpacing: "-0.02em", lineHeight: 1.1 }}
          >
            Ingredient Master
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "#4a4a4a" }}>
            The canonical list of everything we buy. Every price change is stamped with a date and
            stored in an append-only history. Click any ingredient to model a price change and see
            which drinks it affects before you save. See also{" "}
            <a
              href="/finances/profitability"
              className="underline transition-colors hover:text-[#c9a227]"
              style={{ color: "#777" }}
            >
              COGS Reconciliation
            </a>{" "}
            for the full SKU-level view. Last updated {lastUpdated}.
          </p>
        </div>

        <IngredientsClient
          ingredients={INGREDIENTS}
          priceHistory={PRICE_HISTORY}
          usageCounts={usageCounts}
        />
      </main>
    </div>
  );
}
