import { eq } from "drizzle-orm";

import Nav from "@/components/Nav";
import { db } from "@/db";
import {
  clients,
  componentPriceHistory,
  drinks,
  recipeLines,
  recipes,
  skuComponents,
} from "@/db/schema";
import { listIngredients } from "@/lib/erp/ingredients";
import IngredientsClient, {
  type ClientIngredient,
  type ClientPriceHistoryRow,
  type RecipeUsageRow,
} from "./IngredientsClient";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export const dynamic = "force-dynamic";

export default async function IngredientsPage() {
  const ingredients = await listIngredients({ includeInactive: false });

  // Full price history in one query; the client filters per selection.
  const historyRows = await db.select().from(componentPriceHistory);
  const priceHistory: ClientPriceHistoryRow[] = historyRows
    .map((h) => ({
      componentId: h.componentId,
      date: h.effectiveDate,
      unitCost: Number(h.unitCost),
      source: h.source,
      note: h.notes,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Which current recipes use each component, and at what share. Drives both
  // the "used in" count and the price-impact preview.
  const usageRows = await db
    .select({
      componentId: recipeLines.componentId,
      percentage: recipeLines.percentage,
      drinkName: drinks.name,
      clientName: clients.name,
    })
    .from(recipeLines)
    .innerJoin(recipes, eq(recipeLines.recipeId, recipes.id))
    .innerJoin(drinks, eq(recipes.drinkId, drinks.id))
    .innerJoin(clients, eq(recipes.clientId, clients.id))
    .where(eq(recipes.isCurrent, true));

  const recipeUsage: RecipeUsageRow[] = usageRows.map((u) => ({
    componentId: u.componentId,
    drinkName: u.drinkName,
    clientName: u.clientName,
    percentage: Number(u.percentage),
  }));

  // Bill-of-materials usage (dry goods and packaging on SKUs) counts towards
  // "used in" so a bottle or label does not look orphaned.
  const bomRows = await db
    .select({ componentId: skuComponents.componentId })
    .from(skuComponents);

  const usageCounts: Record<number, number> = {};
  for (const u of recipeUsage) {
    usageCounts[u.componentId] = (usageCounts[u.componentId] ?? 0) + 1;
  }
  for (const b of bomRows) {
    usageCounts[b.componentId] = (usageCounts[b.componentId] ?? 0) + 1;
  }

  const clientIngredients: ClientIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    uom: i.uom,
    packSize: i.packSize,
    packCost: i.packCost,
    unitCost: i.unitCost,
    unitCostSetAt: i.unitCostSetAt,
    provenance: i.provenance,
    invoice: i.invoice,
    isSubRecipe: i.isSubRecipe,
    notes: i.notes,
  }));

  const lastUpdated = priceHistory[0]?.date ?? null;

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
          The register, read live from the database. Every price carries its
          provenance and an append-only dated history. Click any ingredient to
          model a change and see which drinks it affects before you save. See also{" "}
          <a
            href="/finances/profitability"
            style={{
              color: COLOR.accent,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            the COGS build
          </a>
          {lastUpdated ? `. Last price movement ${lastUpdated}.` : "."}
        </p>

        <IngredientsClient
          ingredients={clientIngredients}
          priceHistory={priceHistory}
          recipeUsage={recipeUsage}
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
