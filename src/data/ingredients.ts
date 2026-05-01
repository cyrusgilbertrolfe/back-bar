import { Ingredient } from '@/types';

export const MASTER_INGREDIENTS: Ingredient[] = [
  // ——— Jerry Cans ———
  { name: 'Gin', type: 'jerry-can' },
  { name: 'Vodka', type: 'jerry-can' },

  // ——— Bottles (alphabetical) ———
  { name: 'Absinthe', type: 'bottle', bottleSize: 700 },
  { name: 'Akvavit', type: 'bottle', bottleSize: 700 },
  { name: 'Amalthea Gin Ginger Edition', type: 'bottle', bottleSize: 700 },
  { name: 'Carpano Antica Formula Vermouth', type: 'bottle', bottleSize: 750 },
  { name: 'Aperol', type: 'bottle', bottleSize: 1000 },
  { name: 'Belle de Brillet', type: 'bottle', bottleSize: 700 },
  { name: 'Bimber Rum', type: 'bottle', bottleSize: 700 },
  { name: 'Black Button Bourbon', type: 'bottle', bottleSize: 750 },
  { name: 'Calvados', type: 'bottle', bottleSize: 700 },
  { name: 'Campari', type: 'bottle', bottleSize: 700 },
  { name: 'Yellow Chartreuse', type: 'bottle', bottleSize: 700 },
  { name: 'Cocchi Americano', type: 'bottle', bottleSize: 750 },
  { name: 'Cocchi Vermouth di Torino', type: 'bottle', bottleSize: 750 },
  { name: 'Conotto', type: 'bottle', bottleSize: 750 },
  { name: 'Cranberry', type: 'bottle', bottleSize: 1000 },
  { name: 'Curacao', type: 'bottle', bottleSize: 700 },
  { name: 'Cynar', type: 'bottle', bottleSize: 700 },
  { name: 'Dry Vermouth', type: 'bottle', bottleSize: 750 },
  { name: 'English Whisky', type: 'bottle', bottleSize: 700 },
  { name: 'Espresso', type: 'house-made' },
  { name: 'Fernet', type: 'bottle', bottleSize: 700 },
  { name: 'Fino Sherry', type: 'bottle', bottleSize: 750 },
  { name: 'Ginger Liqueur', type: 'bottle', bottleSize: 500 },
  { name: 'Havana Club', type: 'bottle', bottleSize: 700 },
  { name: 'Heering', type: 'bottle', bottleSize: 750 },
  { name: 'Jerez', type: 'bottle', bottleSize: 750 },
  { name: 'Kahlua', type: 'bottle', bottleSize: 700 },
  { name: 'Lillet', type: 'bottle', bottleSize: 750 },
  { name: 'Lychee', type: 'bottle', bottleSize: 700 },
  { name: 'Manzanilla', type: 'bottle', bottleSize: 750 },
  { name: 'Maraschino', type: 'bottle', bottleSize: 500 },
  { name: 'Mezcal', type: 'bottle', bottleSize: 700 },
  { name: 'Mozart', type: 'bottle', bottleSize: 500 },
  { name: 'Noilly Prat', type: 'bottle', bottleSize: 750 },
  { name: 'Old Tom', type: 'bottle', bottleSize: 700 },
  { name: 'Passoa', type: 'bottle', bottleSize: 1000 },
  { name: 'Pisco', type: 'bottle', bottleSize: 700 },
  { name: 'Punt e Mes', type: 'bottle', bottleSize: 750 },
  { name: 'Ramskull Rum', type: 'bottle', bottleSize: 700 },
  { name: 'Rum', type: 'bottle', bottleSize: 700 },
  { name: 'Rye', type: 'bottle', bottleSize: 700 },
  { name: 'Shipwreck Rum', type: 'bottle', bottleSize: 700 },
  { name: 'Somerset Cider Brandy', type: 'bottle', bottleSize: 700 },
  { name: 'Suze', type: 'bottle', bottleSize: 700 },
  { name: 'Sweet Vermouth', type: 'bottle', bottleSize: 750 },
  { name: 'Tequila', type: 'bottle', bottleSize: 700 },
  { name: 'Triple Sec', type: 'bottle', bottleSize: 700 },
  { name: 'Verjus', type: 'bottle', bottleSize: 750 },
  { name: 'Ginjo Sake', type: 'bottle', bottleSize: 300 },
  { name: 'Yuzu Sake', type: 'bottle', bottleSize: 720 },

  // ——— House-made ———
  {
    name: 'Sours',
    type: 'house-made',
    subRecipe: {
      name: "Myatt's Sours",
      baseBatchMl: 326,
      hasPhosphoricBreakdown: true,
      ingredients: [
        { name: 'Citric acid powder', amountPer326ml: 9, unit: 'g' },
        { name: 'Malic acid powder', amountPer326ml: 6, unit: 'g' },
        { name: 'Tartaric acid powder', amountPer326ml: 0.2, unit: 'g' },
        { name: 'Phosphoric acid 1.25% solution', amountPer326ml: 50, unit: 'g' },
        { name: 'Water', amountPer326ml: 260, unit: 'g' },
        { name: 'Salt', amountPer326ml: 1, unit: 'g' },
      ],
    },
  },
  { name: 'Agave', type: 'house-made' },
  { name: 'Agave Syrup', type: 'house-made' },
  { name: 'Apple', type: 'house-made' },
  { name: 'Bramley Apple', type: 'house-made' },
  { name: 'Cherry', type: 'house-made' },
  { name: 'Coffee', type: 'house-made' },
  { name: 'Grenadine', type: 'house-made' },
  { name: 'Hibiscus Cranberry Syrup', type: 'house-made' },
  { name: 'Kecello', type: 'house-made' },
  { name: 'Lime', type: 'house-made' },
  { name: 'Maple Syrup', type: 'house-made' },
  { name: 'Oat', type: 'house-made' },
  { name: 'Peel Infused Gin', type: 'house-made' },
  { name: 'Saline 1:1', type: 'house-made' },
  { name: 'Simple Syrup', type: 'house-made' },
  { name: 'Water', type: 'house-made' },

  // ——— Dashes ———
  { name: 'Angostura Bitters', type: 'dashes' },
  { name: "Bob's Vanilla Bitters", type: 'dashes' },
];

export function getIngredient(name: string): Ingredient | undefined {
  return MASTER_INGREDIENTS.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );
}
