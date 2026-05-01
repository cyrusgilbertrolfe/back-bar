import { Recipe } from '@/types';

export const RECIPES: Recipe[] = [
  // ═══════════════════════════════════════
  // MFC
  // ═══════════════════════════════════════
  {
    name: 'Baby Otis',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000345', '500ml': '5060665000031' },
    ingredients: [
      { ingredientName: 'Havana Club', parts: 50 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 25 },
      { ingredientName: 'Cocchi Americano', parts: 25 },
    ],
  },
  {
    name: 'Cold Brew Negroni',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000369' },
    ingredients: [
      { ingredientName: 'Gin', parts: 33.3 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 33.3 },
      { ingredientName: 'Campari', parts: 33.3, note: 'Infuse with 3 coffee beans per 700ml for 20 minutes before production' },
    ],
  },
  {
    name: 'Corpse Reviver',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000444' },
    ingredients: [
      { ingredientName: 'Gin', parts: 25 },
      { ingredientName: 'Lillet', parts: 25 },
      { ingredientName: 'Curacao', parts: 25 },
      { ingredientName: 'Sours', parts: 25 },
    ],
  },
  {
    name: 'Dempsey',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000291', '500ml': '5060665000123' },
    ingredients: [
      { ingredientName: 'Gin', parts: 48 },
      { ingredientName: 'Calvados', parts: 48 },
      { ingredientName: 'Absinthe', parts: 2 },
      { ingredientName: 'Grenadine', parts: 2 },
    ],
  },
  {
    name: 'Desert Negroni',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000314', '500ml': '5060665000048' },
    ingredients: [
      { ingredientName: 'Tequila', parts: 33.3 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 33.3 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Espresso Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000246', '500ml': '5060665000017' },
    ingredients: [
      { ingredientName: 'Vodka', parts: 33.3 },
      { ingredientName: 'Kahlua', parts: 33.3 },
      { ingredientName: 'Coffee', parts: 33.3 },
    ],
  },
  {
    name: 'Gibson Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000352' },
    ingredients: [
      { ingredientName: 'Gin', parts: 80, note: 'Infuse with one silverskin pickled onion per 700ml for two hours before production' },
      { ingredientName: 'Noilly Prat', parts: 10 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'Lychee Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000406' },
    ingredients: [
      { ingredientName: 'Gin', parts: 52.2 },
      { ingredientName: 'Lychee', parts: 26.1 },
      { ingredientName: 'Dry Vermouth', parts: 13 },
      { ingredientName: 'Water', parts: 8.7 },
    ],
  },
  {
    name: 'Manhattan',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000277', '500ml': '5060665000055' },
    ingredients: [
      { ingredientName: 'Rye', parts: 66 },
      { ingredientName: 'Carpano Antica Formula Vermouth', parts: 17 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 17 },
    ],
  },
  {
    name: 'Margarita',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000390' },
    ingredients: [
      { ingredientName: 'Tequila', parts: 50 },
      { ingredientName: 'Sours', parts: 22.5 },
      { ingredientName: 'Triple Sec', parts: 22.5 },
      { ingredientName: 'Agave Syrup', parts: 5 },
    ],
  },
  {
    name: 'Naked & Famous',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000437' },
    ingredients: [
      { ingredientName: 'Mezcal', parts: 25 },
      { ingredientName: 'Yellow Chartreuse', parts: 25 },
      { ingredientName: 'Aperol', parts: 25 },
      { ingredientName: 'Sours', parts: 25 },
    ],
  },
  {
    name: 'Negroni',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000253', '500ml': '5060665000062' },
    ingredients: [
      { ingredientName: 'Gin', parts: 33.3 },
      { ingredientName: 'Carpano Antica Formula Vermouth', parts: 16.5 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 16.5 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Pisco Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000260', '500ml': '5060665000079' },
    ingredients: [
      { ingredientName: 'Gin', parts: 25 },
      { ingredientName: 'Pisco', parts: 25 },
      { ingredientName: 'Noilly Prat', parts: 25 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 25 },
    ],
  },
  {
    name: 'Red Hook',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000420' },
    ingredients: [
      { ingredientName: 'Rye', parts: 61 },
      { ingredientName: 'Punt e Mes', parts: 17 },
      { ingredientName: 'Maraschino', parts: 11 },
      { ingredientName: 'Water', parts: 11 },
    ],
  },
  {
    name: 'Rum Old Fashioned',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000307', '500ml': '5060665000086' },
    ingredients: [
      { ingredientName: 'Rum', parts: 88 },
      { ingredientName: 'Simple Syrup', parts: 12 },
      { ingredientName: "Bob's Vanilla Bitters", dashesPerLitre: 20 },
    ],
  },
  {
    name: 'Sakura Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000413' },
    ingredients: [
      { ingredientName: 'Ginjo Sake', parts: 61 },
      { ingredientName: 'Gin', parts: 24 },
      { ingredientName: 'Maraschino', parts: 6 },
      { ingredientName: 'Water', parts: 9 },
    ],
  },
  {
    name: 'Trident',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000338', '500ml': '5060665000093' },
    ingredients: [
      { ingredientName: 'Akvavit', parts: 33.3 },
      { ingredientName: 'Manzanilla', parts: 33.3 },
      { ingredientName: 'Cynar', parts: 33.3 },
    ],
  },
  {
    name: 'Tuxedo',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000376' },
    ingredients: [
      { ingredientName: 'Old Tom', parts: 60 },
      { ingredientName: 'Dry Vermouth', parts: 15 },
      { ingredientName: 'Fino Sherry', parts: 14 },
      { ingredientName: 'Absinthe', parts: 1 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'Vesper Martini',
    clients: ["Myatt's Fields"],
    gtins: { '250ml': '5060665000239', '500ml': '5060665000109' },
    ingredients: [
      { ingredientName: 'Gin', parts: 60 },
      { ingredientName: 'Vodka', parts: 20 },
      { ingredientName: 'Lillet', parts: 11.1 },
      { ingredientName: 'Cocchi Americano', parts: 8.9 },
    ],
  },

  // ═══════════════════════════════════════
  // Fortnum & Mason
  // ═══════════════════════════════════════
  {
    name: 'F&M Vesper 2025',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Gin', parts: 60.6 },
      { ingredientName: 'Vodka', parts: 10.1 },
      { ingredientName: 'Lillet', parts: 10.1 },
      { ingredientName: 'Cocchi Americano', parts: 10.1 },
      { ingredientName: 'Water', parts: 9.1 },
    ],
  },
  {
    name: 'F&M Espresso Daiquiri 2025',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Bimber Rum', parts: 33 },
      { ingredientName: 'Kahlua', parts: 33 },
      { ingredientName: 'Espresso', parts: 33 },
    ],
  },
  {
    name: 'F&M Robin Roy',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'English Whisky', parts: 56 },
      { ingredientName: 'Cocchi Vermouth di Torino', parts: 28 },
      { ingredientName: 'Water', parts: 16 },
    ],
  },
  {
    name: 'F&M Griotte',
    clients: ['Fortnum & Mason'],
    abv: undefined, // ABV stored as metadata — add when known
    notes: 'ABV listed separately',
    ingredients: [
      { ingredientName: 'Mozart', parts: 30 },
      { ingredientName: 'Heering', parts: 20 },
      { ingredientName: 'Kahlua', parts: 20 },
      { ingredientName: 'Jerez', parts: 30 },
      { ingredientName: 'Water', parts: 10 },
    ],
  },
  {
    name: 'F&M Apple Crumble',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Black Button Bourbon', parts: 50 },
      { ingredientName: 'Apple', parts: 25 },
      { ingredientName: 'Oat', parts: 13 },
      { ingredientName: 'Water', parts: 12 },
    ],
  },
  {
    name: 'F&M Autumn Nectar',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Shipwreck Rum', parts: 70 },
      { ingredientName: 'Fernet', parts: 9 },
      { ingredientName: 'Maple Syrup', parts: 9 },
      { ingredientName: 'Water', parts: 12 },
    ],
  },
  {
    name: 'F&M Apples & Pears',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Somerset Cider Brandy', parts: 30 },
      { ingredientName: 'Bramley Apple', parts: 30 },
      { ingredientName: 'Belle de Brillet', parts: 30 },
      { ingredientName: 'Suze', parts: 30 },
      { ingredientName: 'Lime', parts: 5 },
      { ingredientName: 'Water', parts: 20 },
      { ingredientName: 'Angostura Bitters', dashesPerLitre: 14 },
    ],
  },
  {
    name: 'F&M Ginger Cosmo',
    clients: ['Fortnum & Mason'],
    ingredients: [
      { ingredientName: 'Amalthea Gin Ginger Edition', parts: 60 },
      { ingredientName: 'Hibiscus Cranberry Syrup', parts: 30, note: '2:1 syrup — 2 parts sugar to 1 part hibiscus/cranberry liquid' },
      { ingredientName: 'Lime', parts: 60 },
      { ingredientName: 'Passoa', parts: 20 },
      { ingredientName: 'Ginger Liqueur', parts: 15 },
    ],
  },

  // ═══════════════════════════════════════
  // Cripps
  // ═══════════════════════════════════════
  {
    name: 'Cripps Rum Old Fashioned',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Ramskull Rum', parts: 85.7 },
      { ingredientName: 'Simple Syrup', parts: 14.3 },
    ],
  },
  {
    name: 'Salted Caramel Caramba',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Ramskull Rum', parts: 30 },
      { ingredientName: 'Mozart', parts: 20 },
      { ingredientName: 'Kahlua', parts: 30 },
      { ingredientName: 'Saline 1:1', parts: 3 },
      { ingredientName: 'Water', parts: 17 },
    ],
  },
  {
    name: 'Cripps Negroni',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Gin', parts: 33.3 },
      { ingredientName: 'Carpano Antica Formula Vermouth', parts: 16.5 },
      { ingredientName: 'Punt e Mes', parts: 16.5 },
      { ingredientName: 'Campari', parts: 33.3 },
    ],
  },
  {
    name: 'Cripps Espresso Martini',
    clients: ['Cripps'],
    ingredients: [
      { ingredientName: 'Vodka', parts: 33.3 },
      { ingredientName: 'Kahlua', parts: 33.3 },
      { ingredientName: 'Espresso', parts: 33.3 },
    ],
  },
];
