/**
 * MFC Wholesale Pricing — Single Source of Truth
 * Confirmed April 2026 | All 29 SKUs pass retailer test at 40% markup
 *
 * Formula: Wholesale = COGS × markup + shipping
 * Retailer test: wholesale × retailerMargin × vat ≤ rrp
 *
 * To update COGS when ingredient costs change, edit the `cogs` values below
 * and click "Update Prices" in the dashboard to confirm the new wholesale prices.
 */

export interface PricingProduct {
  id: string           // slug for localStorage keys
  name: string
  size: string
  rrp: number          // inc VAT — this is what gets updated in Shopify
  cogs: number         // cost of goods sold (wet + dry ingredients)
  shipping: number     // per-bottle shipping cost
  prevWholesale: number | null  // previous wholesale price (null = new to wholesale)
  notes: string
  gtin?: string        // GS1 GTIN-13 barcode
}

export interface PricingConfig {
  markup: number        // e.g. 1.40 = 40%
  retailerMargin: number  // e.g. 1.30 = retailer adds 30%
  vat: number           // e.g. 1.20
  lastUpdated: string   // ISO date string
}

export const DEFAULT_CONFIG: PricingConfig = {
  markup: 1.40,
  retailerMargin: 1.30,
  vat: 1.20,
  lastUpdated: '2026-04-05',
}

export const PRICING_PRODUCTS: PricingProduct[] = [
  {
    id: 'baby-otis-500',
    name: 'Baby Otis',
    size: '500ml',
    rrp: 37.00,
    cogs: 15.51,
    shipping: 1.74,
    prevWholesale: null,
    notes: 'RRP updated Apr 2026 (+£2.00)',
    gtin: '5060665000031',
  },
  {
    id: 'baby-otis-250',
    name: 'Baby Otis',
    size: '250ml',
    rrp: 20.50,
    cogs: 8.66,
    shipping: 0.93,
    prevWholesale: null,
    notes: 'RRP updated Apr 2026 (+£1.00)',
    gtin: '5060665000345',
  },
  {
    id: 'cold-brew-negroni-250',
    name: 'Cold Brew Negroni',
    size: '250ml',
    rrp: 18.00,
    cogs: 7.38,
    shipping: 0.93,
    prevWholesale: null,
    notes: 'RRP updated Apr 2026 (+£0.50)',
    gtin: '5060665000369',
  },
  {
    id: 'corpse-reviver-250',
    name: 'Corpse Reviver',
    size: '250ml',
    rrp: 15.50,
    cogs: 6.14,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000444',
  },
  {
    id: 'dempsey-500',
    name: 'Dempsey',
    size: '500ml',
    rrp: 35.00,
    cogs: 14.24,
    shipping: 1.74,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000123',
  },
  {
    id: 'dempsey-250',
    name: 'Dempsey',
    size: '250ml',
    rrp: 19.50,
    cogs: 8.03,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000291',
  },
  {
    id: 'desert-negroni-500',
    name: 'Desert Negroni',
    size: '500ml',
    rrp: 37.50,
    cogs: 15.71,
    shipping: 1.74,
    prevWholesale: 23.67,
    notes: 'RRP updated Apr 2026 (+£1.00)',
    gtin: '5060665000048',
  },
  {
    id: 'desert-negroni-250',
    name: 'Desert Negroni',
    size: '250ml',
    rrp: 21.00,
    cogs: 8.76,
    shipping: 0.93,
    prevWholesale: 11.61,
    notes: 'RRP updated Apr 2026 (+£1.00)',
    gtin: '5060665000314',
  },
  {
    id: 'espresso-martini-500',
    name: 'Espresso Martini',
    size: '500ml',
    rrp: 25.00,
    cogs: 8.63,
    shipping: 1.74,
    prevWholesale: 15.26,
    notes: '',
    gtin: '5060665000017',
  },
  {
    id: 'espresso-martini-250',
    name: 'Espresso Martini',
    size: '250ml',
    rrp: 15.00,
    cogs: 5.22,
    shipping: 0.93,
    prevWholesale: 7.95,
    notes: '',
    gtin: '5060665000246',
  },
  {
    id: 'gibson-martini-250',
    name: 'Gibson Martini',
    size: '250ml',
    rrp: 16.50,
    cogs: 6.71,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000352',
  },
  {
    id: 'lychee-martini-250',
    name: 'Lychee Martini',
    size: '250ml',
    rrp: 15.50,
    cogs: 6.19,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000406',
  },
  {
    id: 'manhattan-500',
    name: 'Manhattan',
    size: '500ml',
    rrp: 41.00,
    cogs: 17.35,
    shipping: 1.74,
    prevWholesale: 25.14,
    notes: 'Award winner. RRP updated Apr 2026 (+£2.50)',
    gtin: '5060665000055',
  },
  {
    id: 'manhattan-250',
    name: 'Manhattan',
    size: '250ml',
    rrp: 20.50,
    cogs: 8.68,
    shipping: 0.93,
    prevWholesale: 11.61,
    notes: 'RRP updated Apr 2026 (+£0.50)',
    gtin: '5060665000277',
  },
  {
    id: 'naked-and-famous-250',
    name: 'Naked & Famous',
    size: '250ml',
    rrp: 22.00,
    cogs: 9.20,
    shipping: 0.93,
    prevWholesale: null,
    notes: 'Mezcal & Chartreuse — premium price justified. RRP updated Apr 2026 (+£2.00)',
    gtin: '5060665000437',
  },
  {
    id: 'margarita-250',
    name: 'Margarita',
    size: '250ml',
    rrp: 18.50,
    cogs: 7.74,
    shipping: 0.93,
    prevWholesale: null,
    notes: 'RRP updated Apr 2026 (+£0.50)',
    gtin: '5060665000390',
  },
  {
    id: 'negroni-500',
    name: 'Negroni',
    size: '500ml',
    rrp: 31.00,
    cogs: 12.61,
    shipping: 1.74,
    prevWholesale: 19.65,
    notes: '',
    gtin: '5060665000062',
  },
  {
    id: 'negroni-250',
    name: 'Negroni',
    size: '250ml',
    rrp: 17.00,
    cogs: 6.96,
    shipping: 0.93,
    prevWholesale: 9.05,
    notes: 'RRP updated Apr 2026 (+£0.50)',
    gtin: '5060665000253',
  },
  {
    id: 'pisco-martini-500',
    name: 'Pisco Martini',
    size: '500ml',
    rrp: 33.00,
    cogs: 12.98,
    shipping: 1.74,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000079',
  },
  {
    id: 'pisco-martini-250',
    name: 'Pisco Martini',
    size: '250ml',
    rrp: 17.50,
    cogs: 7.15,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000260',
  },
  {
    id: 'red-hook-250',
    name: 'Red Hook',
    size: '250ml',
    rrp: 20.00,
    cogs: 7.83,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000420',
  },
  {
    id: 'rum-old-fashioned-500',
    name: 'Rum Old Fashioned',
    size: '500ml',
    rrp: 31.50,
    cogs: 12.66,
    shipping: 1.74,
    prevWholesale: 20.02,
    notes: '',
    gtin: '5060665000086',
  },
  {
    id: 'rum-old-fashioned-250',
    name: 'Rum Old Fashioned',
    size: '250ml',
    rrp: 17.50,
    cogs: 7.24,
    shipping: 0.93,
    prevWholesale: 9.78,
    notes: '',
    gtin: '5060665000307',
  },
  {
    id: 'sakura-martini-250',
    name: 'Sakura Martini',
    size: '250ml',
    rrp: 20.00,
    cogs: 8.00,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000413',
  },
  {
    id: 'trident-500',
    name: 'Trident',
    size: '500ml',
    rrp: 33.50,
    cogs: 13.55,
    shipping: 1.74,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000093',
  },
  {
    id: 'trident-250',
    name: 'Trident',
    size: '250ml',
    rrp: 19.00,
    cogs: 7.68,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000338',
  },
  {
    id: 'tuxedo-250',
    name: 'Tuxedo',
    size: '250ml',
    rrp: 18.00,
    cogs: 7.52,
    shipping: 0.93,
    prevWholesale: null,
    notes: '',
    gtin: '5060665000376',
  },
  {
    id: 'vesper-500',
    name: 'Vesper',
    size: '500ml',
    rrp: 31.00,
    cogs: 12.81,
    shipping: 1.74,
    prevWholesale: 18.92,
    notes: 'RRP updated Apr 2026 (+£1.00)',
    gtin: '5060665000109',
  },
  {
    id: 'vesper-250',
    name: 'Vesper',
    size: '250ml',
    rrp: 16.50,
    cogs: 6.78,
    shipping: 0.93,
    prevWholesale: 9.05,
    notes: '',
    gtin: '5060665000239',
  },
  {
    id: 'martini-flight',
    name: 'Martini Flight',
    size: 'set',
    rrp: 198.00,
    cogs: 79.15,
    shipping: 10.78,
    prevWholesale: null,
    notes: '6×250ml assortment',
  },
]

// ─── Pure calculation helpers (no React, usable server + client side) ─────────

export function calcWholesale(product: PricingProduct, config: PricingConfig): number {
  return Math.round((product.cogs * config.markup + product.shipping) * 100) / 100
}

export function calcRetailerPrice(wholesale: number, config: PricingConfig): number {
  return Math.round(wholesale * config.retailerMargin * config.vat * 100) / 100
}

export function passesRetailerTest(product: PricingProduct, config: PricingConfig): boolean {
  const ws = calcWholesale(product, config)
  const rp = calcRetailerPrice(ws, config)
  return rp <= product.rrp
}

export function calcMargin(product: PricingProduct, config: PricingConfig): number {
  const ws = calcWholesale(product, config)
  return Math.round(((ws - product.shipping) / product.cogs - 1) * 1000) / 10
}
