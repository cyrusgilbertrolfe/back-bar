import Nav from "@/components/Nav";
import {
  INGREDIENTS,
  PRICE_HISTORY,
  getRecipesUsingIngredient,
} from "@/lib/ingredients";
import IngredientsClient from "./IngredientsClient";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export default function IngredientsPage() {
  const usageCounts = Object.fromEntries(
    INGREDIENTS.map((i) => [i.id, getRecipesUsingIngredient(i.id).length]),
  );

  const lastUpdated = [...INGREDIENTS]
    .map((i) => i.currentPriceSetAt)
    .concat(PRICE_HISTORY.map((e) => e.date))
    .sort()
    .pop();

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="ingredients-main"
        style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          Finances · Ingredient master
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(44px, 6vw, 56px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
            marginBottom: 18,
            color: COLOR.ink,
          }}
        >
          Ingredient master
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 19,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 720,
            fontWeight: 300,
            marginBottom: 40,
          }}
        >
          The canonical list of everything we buy. Every price change is stamped and stored
          in an append-only history. Click any ingredient to model a change and see which
          drinks it affects before you save. See also{" "}
          <a
            href="/finances/profitability"
            style={{
              color: COLOR.accent,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            COGS reconciliation
          </a>
          . Last updated {lastUpdated}.
        </p>

        <IngredientsClient
          ingredients={INGREDIENTS}
          priceHistory={PRICE_HISTORY}
          usageCounts={usageCounts}
        />
      </main>

      <style>{`
        @media (max-width: 720px) {
          .ingredients-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </div>
  );
}
