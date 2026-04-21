// Source of truth for the 50ml minis offered in the Choose Six box builder on mfc.london/products/boxset.
// When a new mini launches (limited edition, seasonal, etc.) add it here and redeploy.

export type ChooseSixCategory = 'negroni' | 'martini' | 'manhattan' | 'sours' | 'other'

export type ChooseSixDrink = {
  handle: string
  name: string
  tagline: string
  image: string
  categories: ChooseSixCategory[]
  abv?: number
}

export type ChooseSixPreset = {
  id: string
  label: string
  tagline: string
  drinks: string[] // length 6, handles (duplicates allowed)
}

const CDN = '//cdn.shopify.com/s/files/1/2172/9393/files'
const CDN_PRODUCTS = '//cdn.shopify.com/s/files/1/2172/9393/products'

export const CHOOSE_SIX_DRINKS: ChooseSixDrink[] = [
  {
    handle: 'espresso-martini',
    name: 'Espresso Martini',
    tagline: 'Vodka, coffee liqueur, Monmouth Coffee.',
    image: `${CDN}/Espresso_Martini_bac1d12e-9524-48c4-b96f-dceb9a95c6af.webp?v=1742761056`,
    categories: ['martini'],
    abv: 20,
  },
  {
    handle: 'negroni',
    name: 'Negroni',
    tagline: '58 & Co gin, Campari, two Italian sweet vermouths.',
    image: `${CDN}/Negroni_2.webp?v=1742744463`,
    categories: ['negroni'],
  },
  {
    handle: 'cold-brew-negroni',
    name: 'Cold Brew Negroni',
    tagline: 'A classic Negroni cold-brewed with Monmouth Coffee.',
    image: `${CDN}/Cold_Brew_Negroni_d4ab2f72-2c41-418f-99f9-22c290ba9827.webp?v=1742749124`,
    categories: ['negroni'],
  },
  {
    handle: 'desert-negroni',
    name: 'Desert Negroni',
    tagline: 'Tequila in place of gin, sweet vermouth, Campari.',
    image: `${CDN}/Desert_Negroni_2d734777-0416-456b-96a4-873bdf329a35.webp?v=1742750794`,
    categories: ['negroni'],
  },
  {
    handle: 'manhattan',
    name: 'Manhattan',
    tagline: 'Rye whiskey, two vermouths, bitters. Aged six weeks.',
    image: `${CDN}/Manhattan_c4513144-d2e7-40b9-ae5e-4a0fc0f352e8.webp?v=1742761120`,
    categories: ['manhattan'],
  },
  {
    handle: 'baby-otis-cuban-rum-manhattan',
    name: 'Cuban Manhattan',
    tagline: 'Aged Cuban rum, two vermouths, grapefruit.',
    image: `${CDN}/Baby_Otis_36003512-2105-4daf-9c08-39ecf3e71614.webp?v=1742750287`,
    categories: ['manhattan'],
  },
  {
    handle: 'red-hook',
    name: 'Red Hook',
    tagline: 'A Manhattan–Brooklyn hybrid: rye, Punt e Mes, maraschino.',
    image: `${CDN}/Red_Hook_ceffc88f-25e1-4a73-87c5-05b0c62d515d.webp?v=1742761696`,
    categories: ['manhattan'],
  },
  {
    handle: 'margarita',
    name: 'Margarita',
    tagline: 'Tequila, Myatt’s Sours, agave, triple sec.',
    image: `${CDN}/Maragrita.webp?v=1742751211`,
    categories: ['sours'],
    abv: 28,
  },
  {
    handle: 'vesper',
    name: 'Vesper Martini',
    tagline: 'Gin, vodka, aromatised wine, quinquina. The Bond one.',
    image: `${CDN}/Vesper_Martini.webp?v=1742749515`,
    categories: ['martini'],
  },
  {
    handle: 'lychee',
    name: 'Lychee Martini',
    tagline: 'Gin, lychee, vermouth. Delicate and crisp.',
    image: `${CDN}/Lychee_Martini_58e7b1d6-b57a-4876-a559-855c4bd64772.webp?v=1743361714`,
    categories: ['martini'],
    abv: 30.5,
  },
  {
    handle: 'gibson-martini',
    name: 'Gibson Martini',
    tagline: 'Gin, vermouth, pickled onion. A savoury Martini.',
    image: `${CDN}/Gibson_41fbbca9-4bf4-4a12-bec2-f8419fbaf7eb.webp?v=1743358225`,
    categories: ['martini'],
  },
  {
    handle: 'piscomartini',
    name: 'Pisco Martini',
    tagline: 'Audrey Saunders’ floral, distinctive Pisco twist.',
    image: `${CDN}/Pisco_Martini_fcecd87d-1692-4676-8555-d8e62d244317.webp?v=1743357841`,
    categories: ['martini'],
  },
  {
    handle: 'sakura-martini',
    name: 'Sakura Martini',
    tagline: 'Sake, maraschino, salted cherry blossom.',
    image: `${CDN}/Sakura_Martini_5027bc7a-dae9-4dbe-a122-754cbe62096b.webp?v=1742761870`,
    categories: ['martini'],
  },
  {
    handle: 'tuxedo',
    name: 'Tuxedo',
    tagline: 'Refined 1890s classic from the Tuxedo Club, New York.',
    image: `${CDN}/Tuxedo_f1b872c1-7179-4812-8048-c809888d4fb7.webp?v=1743360803`,
    categories: ['martini', 'other'],
  },
  {
    handle: 'corpse-reviver-no-blue',
    name: 'Corpse Reviver No. Blue',
    tagline: 'A modern classic, faithful to its 19th-century roots.',
    image: `${CDN}/Corpse_Reviver_No_Blue.webp?v=1742749976`,
    categories: ['sours'],
  },
  {
    handle: 'dempsey',
    name: 'Dempsey',
    tagline: 'Gin, Calvados, absinthe, grenadine. Aged six weeks.',
    image: `${CDN}/Dempsey_a42221fb-169b-4d47-b3fd-41b4999f79fc.webp?v=1742750538`,
    categories: ['other'],
  },
  {
    handle: 'naked-famous',
    name: 'Naked & Famous',
    tagline: 'Mezcal, Chartreuse, Aperol, lemon. Smoky and sharp.',
    image: `${CDN}/Naked_and_Famous_9c540e2f-c0ca-429f-b52c-275d9c342497.webp?v=1742761381`,
    categories: ['sours'],
  },
  {
    handle: 'trident',
    name: 'Trident',
    tagline: 'Aquavit, Manzanilla, Cynar, peach bitters.',
    image: `${CDN}/Trident_462e5c5f-c9a3-4110-ae25-f23f7828be8f.webp?v=1742762074`,
    categories: ['other'],
  },
  {
    handle: 'rumoldfashioned',
    name: 'Rum Old Fashioned',
    tagline: 'Barbadian rum, cardamom, demerara, vanilla.',
    image: `${CDN}/ROF.webp?v=1742750324`,
    categories: ['other'],
  },
  {
    handle: 'limoncello',
    name: 'Limoncello',
    tagline: 'Ten times the lemons, half the sugar. The proper stuff.',
    image: `${CDN_PRODUCTS}/limoncello-762570.jpg?v=1701037499`,
    categories: ['other'],
  },
]

export const CHOOSE_SIX_PRESETS: ChooseSixPreset[] = [
  {
    id: 'negroni',
    label: 'Negroni box',
    tagline: 'Three Negroni interpretations, two each.',
    drinks: [
      'negroni', 'negroni',
      'cold-brew-negroni', 'cold-brew-negroni',
      'desert-negroni', 'desert-negroni',
    ],
  },
  {
    id: 'martini',
    label: 'Martini flight',
    tagline: 'The full Martini range, one of each.',
    drinks: [
      'espresso-martini',
      'vesper',
      'lychee',
      'gibson-martini',
      'piscomartini',
      'sakura-martini',
    ],
  },
  {
    id: 'sours',
    label: 'Sours trio',
    tagline: 'Three bold sours, two each.',
    drinks: [
      'margarita', 'margarita',
      'naked-famous', 'naked-famous',
      'corpse-reviver-no-blue', 'corpse-reviver-no-blue',
    ],
  },
]
