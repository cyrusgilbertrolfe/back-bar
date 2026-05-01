/**
 * Ingredient master list — source of truth for ingredient names, bottle sizes,
 * and current unit cost.
 *
 * Data lives in src/data/ingredients.json; append-only price history lives in
 * src/data/ingredient-price-history.json. Both are imported as JSON so they
 * work in both server and client components. Writes happen via the Server
 * Action in src/app/actions/ingredients.ts.
 */

import rawIngredients from "@/data/ingredients.json";
import rawPriceHistory from "@/data/ingredient-price-history.json";
import { RECIPES } from "@/data/recipes";
import { Recipe } from "@/types";

export interface IngredientMaster {
  id: string;
  name: string;
  spreadsheetName?: string;
  bottleSizeMl: number;
  currentPrice: number;
  currentPriceSetAt: string; // ISO date (YYYY-MM-DD)
  notes?: string;
}

export interface IngredientPriceHistoryEntry {
  ingredientId: string;
  date: string; // ISO date (YYYY-MM-DD)
  price: number;
  note?: string;
}

export const INGREDIENTS: IngredientMaster[] = rawIngredients as IngredientMaster[];
export const PRICE_HISTORY: IngredientPriceHistoryEntry[] =
  rawPriceHistory as IngredientPriceHistoryEntry[];

/**
 * Map from the ingredient names used inside `src/data/recipes.ts` to canonical
 * ingredient IDs in ingredients.json.
 *
 * `null` means the recipe ingredient has no material cost (water, negligible
 * dashes) or has not yet been assigned a master ingredient.
 */
export const RECIPE_INGREDIENT_MAP: Record<string, string | null> = {
  // Core spirits
  Gin: "gin",
  Vodka: "vodka",
  Rye: "rye",
  Campari: "campari",
  "Cocchi Americano": "cocchi-americano",
  "Cocchi Vermouth di Torino": "cocchi-torino",
  "Carpano Antica Formula Vermouth": "carpano-antica",
  Kahlua: "kahlua",
  Cynar: "cynar",
  Akvavit: "akvavit",
  Tequila: "epsolon-blanco",
  Calvados: "calvados",
  "Havana Club": "havana-club-7",
  "Noilly Prat": "noilly-prat",
  "Dry Vermouth": "noilly-prat", // generic "Dry Vermouth" → Noilly Prat
  Manzanilla: "manzanilla",
  Lillet: "lillet-blanc",
  Pisco: "pisco-aba",
  "Bimber Rum": "bimber-rum",
  Rum: "mount-gay", // generic "Rum" → Mount Gay
  "Old Tom": "old-tom-gin",
  "Fino Sherry": "fino-sherry",
  "Punt e Mes": "punt-e-mes",
  Lychee: "lychee",
  "Agave Syrup": "agave-syrup",
  Absinthe: "la-fee-absinthe",
  Heering: "heering-cherry",
  Maraschino: "luxardo-maraschino",
  Mezcal: "mezcal",
  Aperol: "aperol",
  "Yellow Chartreuse": "yellow-chartreuse",
  Conotto: "chinotto-nero",
  Curacao: "blue-curacao",
  Sours: "sours",
  Grenadine: "monin-grenadine",
  Coffee: "coffee",
  "Yuzu Sake": "yuzu-sake",
  "Ginjo Sake": "ginjo-sake",
  "Triple Sec": "triple-sec",
  "English Whisky": "cotswold-whisky",

  // No-cost / flagged
  Water: null,
  "Simple Syrup": null,
  Espresso: null,
  "Bob's Vanilla Bitters": null,
  Agave: null,
  Apple: null,
  Cherry: null,
  "Maple Syrup": null,
  Oat: null,
  "Peel Infused Gin": null,
  "Saline 1:1": null,
  Mozart: null,
  "Shipwreck Rum": null,
  "Ramskull Rum": null,
  "Black Button Bourbon": null,
  Fernet: null,
  Jerez: null,
  "Sweet Vermouth": null,
  Cranberry: null,
  Verjus: null,
};

export function getIngredient(id: string): IngredientMaster | undefined {
  return INGREDIENTS.find((i) => i.id === id);
}

/** Current unit cost, £ per ml. */
export function pricePerMl(ingredient: IngredientMaster): number {
  return ingredient.currentPrice / ingredient.bottleSizeMl;
}

/** Price history for a single ingredient, newest first. */
export function getPriceHistory(ingredientId: string): IngredientPriceHistoryEntry[] {
  return PRICE_HISTORY.filter((e) => e.ingredientId === ingredientId).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

/** All recipes that reference this ingredient (via RECIPE_INGREDIENT_MAP). */
export function getRecipesUsingIngredient(ingredientId: string): Recipe[] {
  const recipeNames = Object.entries(RECIPE_INGREDIENT_MAP)
    .filter(([, id]) => id === ingredientId)
    .map(([name]) => name);

  return RECIPES.filter((r) =>
    r.ingredients.some((ri) => recipeNames.includes(ri.ingredientName)),
  );
}

/** The fractional share of a recipe that belongs to a given ingredient. */
function ingredientShareOfRecipe(recipe: Recipe, ingredientId: string): number {
  const totalParts = recipe.ingredients.reduce((s, i) => s + (i.parts ?? 0), 0);
  if (totalParts === 0) return 0;

  const matchingParts = recipe.ingredients
    .filter((ri) => RECIPE_INGREDIENT_MAP[ri.ingredientName] === ingredientId)
    .reduce((s, ri) => s + (ri.parts ?? 0), 0);

  return matchingParts / totalParts;
}

/**
 * For a given recipe, how many ml of the target ingredient fit inside a
 * finished bottle of `bottleSizeMl`?
 */
export function ingredientMlInBottle(
  recipe: Recipe,
  ingredientId: string,
  bottleSizeMl: number,
): number {
  return ingredientShareOfRecipe(recipe, ingredientId) * bottleSizeMl;
}

export interface ImpactRow {
  recipeName: string;
  mlPerBottle500: number;
  mlPerBottle250: number;
  currentCostPer500: number;
  currentCostPer250: number;
  newCostPer500: number;
  newCostPer250: number;
  deltaPer500: number;
  deltaPer250: number;
}

/**
 * Compute the cost impact of changing an ingredient's price. Returns one row
 * per MFC-range recipe that uses this ingredient, with current and projected
 * cost contributions for both 500ml and 250ml formats.
 */
export function computeImpact(
  ingredient: IngredientMaster,
  newPrice: number,
): ImpactRow[] {
  const oldPpm = ingredient.currentPrice / ingredient.bottleSizeMl;
  const newPpm = newPrice / ingredient.bottleSizeMl;

  const recipes = getRecipesUsingIngredient(ingredient.id);

  return recipes
    .map((r) => {
      const ml500 = ingredientMlInBottle(r, ingredient.id, 500);
      const ml250 = ingredientMlInBottle(r, ingredient.id, 250);
      return {
        recipeName: r.name,
        mlPerBottle500: ml500,
        mlPerBottle250: ml250,
        currentCostPer500: ml500 * oldPpm,
        currentCostPer250: ml250 * oldPpm,
        newCostPer500: ml500 * newPpm,
        newCostPer250: ml250 * newPpm,
        deltaPer500: ml500 * (newPpm - oldPpm),
        deltaPer250: ml250 * (newPpm - oldPpm),
      };
    })
    .sort((a, b) => Math.abs(b.deltaPer500) - Math.abs(a.deltaPer500));
}

/** Total current COGS (£) for a recipe at a given bottle size, liquid only. */
export function computeLiquidCogs(recipe: Recipe, bottleSizeMl: number): number {
  let total = 0;
  const totalParts = recipe.ingredients.reduce((s, i) => s + (i.parts ?? 0), 0);
  if (totalParts === 0) return 0;

  for (const ri of recipe.ingredients) {
    const mappedId = RECIPE_INGREDIENT_MAP[ri.ingredientName];
    if (!mappedId || !ri.parts) continue;
    const ing = getIngredient(mappedId);
    if (!ing) continue;
    const mlInBottle = (ri.parts / totalParts) * bottleSizeMl;
    total += mlInBottle * pricePerMl(ing);
  }
  return total;
}
