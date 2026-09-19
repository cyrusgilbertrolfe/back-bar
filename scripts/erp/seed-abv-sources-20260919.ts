/**
 * Source the 38 alcoholic components still `assumed`, and repoint the recipes
 * whose spirit was recorded as the wrong product.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-sources-20260919.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-sources-20260919.ts --write  # apply
 *
 * Written 19 Sept 2026, finishing week 2 of the Back Bar roadmap in Lifemaxxing
 * (Domains/Cocktails/Back Bar). On 19 Sept, 38 of 51 active alcoholic components
 * still carried an ABV nobody had checked.
 *
 * Five jobs, in this order:
 *
 * 1. SOURCED FIGURES. 34 components, each with the page, invoice or email the
 *    figure was read from. Retail pages were opened and read on 19 Sept 2026 —
 *    Master of Malt refused every request, so most UK listings are from other
 *    retailers. Three figures changed:
 *      - Del Maguey Vida is 42%, not 40%.
 *      - Bob's Grapefruit Bitters is 30%, not 35% (two independent sources).
 *      - Thames NGS varies by batch: 40.1% on 26/AG19, 40.2% on 26/SP16.
 *
 * 2. NEW COMPONENTS for three spirits the recipes had been pointing past:
 *      - 58 & Co Triple Distilled Vodka, 40% — the MFC Vesper's vodka.
 *      - Fortnum's NGS, 40% — the F&M Vesper's vodka, supplied by Fortnum's.
 *      - The Clementini Amalthea, 43% — a different gin from the Vesper
 *        Amalthea at 46% (Cyrus, 19 Sept 2026).
 *
 * 3. RECIPE VERSIONS that swap the wrong spirit for the right one. Each is a
 *    new version exactly as the recipe editor makes one, and each is put
 *    through Gate 1 first: a version the editor would refuse is refused here
 *    too, and reported rather than written — unless it carries a named ruling.
 *    The MFC Vesper does: it computes 36.8% against a 38.2% label, and Cyrus
 *    ruled on 19 Sept 2026 that the recipe stands and the label is wrong.
 *
 * 4. PRICES for the new components, or a placeholder where none is known.
 *
 * 5. NOTE CORRECTIONS for the three discontinued spirits, exact-match only.
 *
 * Deliberately not sourced, and left `assumed`: Bimber vodka (no longer made),
 * Shipwreck Rum (Autumn Nectar only, a past F&M seasonal) and the Pedro Ximénez
 * (Griotte only, abandoned). No document gives their strength, and a guess
 * promoted to a source is the thing this work exists to prevent.
 *
 * Idempotent: a figure already recorded from the same source is not written
 * twice, an existing component is not recreated, and a recipe that no longer
 * carries the old line is left alone.
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import {
  componentAbvHistory,
  componentPriceHistory,
  components,
  drinks,
  recipeLines,
  recipes,
} from "../../src/db/schema";
import { abvFromLines, declaredAbvFor, gateOne } from "../../src/lib/erp/canon";

const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);
const CREATED_BY = "script: seed-abv-sources-20260919";

type AbvSource = "bottle" | "manufacturer" | "supplier_invoice" | "retailer_listing";

type Sourced = {
  name: string;
  abv: string;
  productName: string;
  source: AbvSource;
  sourceRef: string;
  notes?: string;
  /** When the reading applies from. Defaults to today. */
  effectiveDate?: string;
};

// ---- 1. Sourced figures ------------------------------------------------------

const SOURCED: Sourced[] = [
  // In two or more current recipes.
  {
    name: "Campari",
    abv: "25.00",
    productName: "Campari",
    source: "retailer_listing",
    sourceRef: "https://carringtonswines.co.uk/product/campari/ (Campari 70cl 25% ABV)",
    notes: "campari.com/en-gb gives no ABV.",
  },
  {
    name: "Noilly Prat",
    abv: "18.00",
    productName: "Noilly Prat Original Dry",
    source: "retailer_listing",
    sourceRef: "https://www.tanners-wines.co.uk/products/noilly-prat-original-dry-vermouth-18-vol-75cl",
  },
  {
    name: "Lillet Blanc",
    abv: "17.00",
    productName: "Lillet Blanc",
    source: "retailer_listing",
    sourceRef: "https://www.tanners-wines.co.uk/products/lillet-blanc-17-vol-75cl",
  },
  {
    name: "Carpano Antica Formula Vermouth",
    abv: "16.50",
    productName: "Carpano Antica Formula (1L)",
    source: "retailer_listing",
    sourceRef:
      "https://www.farehamwinecellar.co.uk/product/antica-formula-guiseppe-b-carpano-fratelli-branca-16-5-1-litre/",
  },
  {
    name: "La Fée Absinthe",
    abv: "68.00",
    productName: "La Fée Parisienne Absinthe",
    source: "retailer_listing",
    sourceRef:
      "https://www.cambridgewine.com/shop/products/spirits/other-spirits/la-fee-parisienne-absinthe-68-70cl.html",
    notes:
      "Parisienne is La Fée's flagship and its only 68% expression; the other La Fée " +
      "absinthes run 38-70%. Check the bottle if a different expression is in use.",
  },
  {
    name: "Rye",
    abv: "45.00",
    productName: "Bulleit Rye",
    source: "retailer_listing",
    sourceRef: "https://thelittlewhiskyshop.co.uk/products/bulleit-rye-70cl-45",
  },
  {
    name: "Punt e Mes",
    abv: "16.00",
    productName: "Punt e Mes",
    source: "retailer_listing",
    sourceRef: "https://milroysofsoho.com/products/punt-e-mes-16-75cl",
  },
  {
    name: "Luxardo Maraschino",
    abv: "32.00",
    productName: "Luxardo Maraschino Originale",
    source: "manufacturer",
    sourceRef: "https://www.luxardo.it/liqueurs-and-distillates/maraschino-originale/",
    notes: "The UK 70cl listing at Cambridge Wine Merchants agrees at 32%.",
  },
  // Base spirits, 25% or more of one recipe.
  {
    name: "Cotswold Whisky",
    abv: "46.00",
    productName: "Fortnum's English Single Malt Whisky (Cotswolds Distillery)",
    source: "retailer_listing",
    sourceRef: "https://www.fortnumandmason.com/fortnum-s-english-single-malt-whisky-70cl",
    notes:
      "Fortnum's own-label single malt, distilled by Cotswolds Distillery — identified by " +
      "Cyrus, 19 Sept 2026. Fortnum's product page: \"46% ABV\".",
  },
  {
    name: "Epsolon Blanco Tequila",
    abv: "40.00",
    productName: "Espolòn Blanco Tequila",
    source: "retailer_listing",
    sourceRef: "https://www.distillersdirect.com/products/espolon-blanco-tequila-70cl",
    notes: "The component name misspells Espolòn; the product name is correct.",
  },
  {
    name: "Havana Club 7",
    abv: "40.00",
    productName: "Havana Club 7 Años",
    source: "retailer_listing",
    sourceRef: "https://latitudewine.co.uk/products/havana-club-7",
  },
  {
    name: "Calvados",
    abv: "40.00",
    productName: "Avallen Calvados",
    source: "retailer_listing",
    sourceRef: "https://www.inn-express.com/product-ranges/spirits-liqueurs/avallen-calvados",
  },
  {
    name: "Cynar",
    abv: "16.50",
    productName: "Cynar",
    source: "retailer_listing",
    sourceRef: "https://alcopone.co.uk/products/cynar-liqueur-70cl-16-5",
  },
  {
    name: "Akvavit",
    abv: "45.00",
    productName: "Aalborg Taffel Akvavit",
    source: "retailer_listing",
    sourceRef: "https://alcopone.co.uk/products/aalborg-taffel-akvavit-aquavit-70cl-45",
    notes: "The Danish home-market bottling is 41%; UK listings are 45%.",
  },
  {
    name: "Manzanilla",
    abv: "15.00",
    productName: "La Guita Manzanilla",
    source: "retailer_listing",
    sourceRef: "https://www.diffordsguide.com/beer-wine-spirits/7221/la-guita-manzanilla",
    notes:
      "Difford's Guide is a drinks reference rather than a shop, so this is the weaker end " +
      "of retailer_listing. Matthew Clark's page (now mcbdrinks.co.uk) shows no ABV.",
  },
  {
    name: "Tequila Reposado",
    abv: "40.00",
    productName: "Espolòn Reposado Tequila",
    source: "retailer_listing",
    sourceRef:
      "https://www.distillersdirect.com/collections/reposado-tequila/products/espolon-reposado-tequila-70cl",
  },
  {
    name: "Scratch (white rum)",
    abv: "40.00",
    productName: "Fortnum's Hertfordshire White Rum (Scratch British Rum, bulk)",
    source: "manufacturer",
    sourceRef:
      "Doug Miller, Scratch British Rum (Canebrake Ltd) — email 17 Jan 2025, thread \"F&M\": " +
      "\"we are looking at around £23.67 per litre at 40% ex VAT\"",
    notes:
      "A custom Fortnum's product, sold by them as Hertfordshire White Rum — not Scratch's " +
      "own Faithful British Rum, which is 42%. The Canebrake invoice (MF0012026, 16 Jun 2026) " +
      "and the Fortnum's product page do not state an ABV.",
  },
  {
    name: "Lychee Liqueur",
    abv: "20.00",
    productName: "Kwai Feh Lychee Liqueur",
    source: "retailer_listing",
    sourceRef: "https://www.drinksupermarket.com/kwai-feh-lychee-liqueur-70cl",
  },
  // The rest.
  {
    name: "Aperol",
    abv: "11.00",
    productName: "Aperol",
    source: "retailer_listing",
    sourceRef: "https://www.cambridgewine.com/shop/products/spirits/liqueurs-and-aperitifs/aperol-11-70cl.html",
  },
  {
    name: "Yellow Chartreuse",
    abv: "43.00",
    productName: "Yellow Chartreuse",
    source: "manufacturer",
    sourceRef: "https://www.chartreuse.fr/en/produit/yellow-chartreuse/",
  },
  {
    name: "Mezcal",
    abv: "42.00",
    productName: "Del Maguey Vida Mezcal",
    source: "retailer_listing",
    sourceRef: "https://secretbottleshop.co.uk/products/del-maguey-mezcal-vida-70cl-42-abv",
    notes: "Was recorded at 40%. Every UK listing read on 19 Sept 2026 gives 42%.",
  },
  {
    name: "Blue Curaçao",
    abv: "21.00",
    productName: "Bols Blue Curaçao",
    source: "manufacturer",
    sourceRef: "https://bols.com/products/bols-blue-curacao-liqueur",
    notes:
      "Standard Bols Blue, not \"Bols Blue Curaçao 1575\" at 29.5%. The UK 70cl listing at " +
      "Grapevine UK also gives 21%.",
  },
  {
    name: "Pisco Aba",
    abv: "40.00",
    productName: "Pisco Aba",
    source: "retailer_listing",
    sourceRef: "https://www.i-d-s.com/london/pisco-aba-lq1085.html",
  },
  {
    name: "Triple Sec",
    abv: "40.00",
    productName: "Cointreau",
    source: "retailer_listing",
    sourceRef:
      "https://www.cambridgewine.com/shop/products/spirits/liqueurs-and-aperitifs/cointreau-liqueur-40-70cl.html",
  },
  {
    name: "Somerset Cider Brandy",
    abv: "42.00",
    productName: "Somerset Cider Brandy 3 Year Old",
    source: "manufacturer",
    sourceRef: "https://somersetciderbrandy.com/all-products/p/somerset-cider-brandy-3-year-old",
  },
  {
    name: "Heering Cherry",
    abv: "24.00",
    productName: "Cherry Heering",
    source: "retailer_listing",
    sourceRef: "https://www.vineyardbelfast.co.uk/products/21005039",
  },
  {
    name: "Passoã",
    abv: "17.00",
    productName: "Passoã",
    source: "retailer_listing",
    sourceRef: "https://kaygees.co.uk/products/passoa-passion-fruit-liqueur-70cl",
    notes: "Launched at 20% in 1986; 17% outside the US since 2005.",
  },
  {
    name: "Fino Sherry",
    abv: "15.00",
    productName: "Tio Pepe Fino",
    source: "retailer_listing",
    sourceRef:
      "https://www.drinksupermarket.com/tio-pepe-palomino-dry-fino-spanish-sherry-75cl-15-abv",
  },
  {
    name: "Fernet Branca",
    abv: "39.00",
    productName: "Fernet-Branca",
    source: "retailer_listing",
    sourceRef: "https://www.vineyardbelfast.co.uk/products/8004400013099",
  },
  {
    name: "Kaveri Ginger Liqueur",
    abv: "20.30",
    productName: "Kaveri Spicy Ginger Liqueur",
    source: "retailer_listing",
    sourceRef: "https://threshers.co.uk/products/kaveri-spicy-ginger-liqueur-50cl",
    notes: "Kaveri Drinks' own site gives no ABV.",
  },
  {
    name: "Angostura Orange Bitters",
    abv: "28.00",
    productName: "Angostura Orange Bitters",
    source: "retailer_listing",
    sourceRef: "https://thechampagnecompany.com/angostura-orange-bitters-10cl",
  },
  {
    name: "Bob's Grapefruit Bitters",
    abv: "30.00",
    productName: "Bob's Grapefruit Bitters",
    source: "retailer_listing",
    sourceRef: "https://thechampagnecompany.com/bob-s-grapefruit-bitters-10cl",
    notes:
      "Was recorded at 35%. Difford's Guide also gives 30%; Bob's own site gives no ABV. " +
      "A five-point change, so worth a look at the bottle.",
  },
  {
    name: "Fee Brothers Peach Bitters",
    abv: "1.70",
    productName: "Fee Brothers Peach Bitters",
    source: "retailer_listing",
    sourceRef: "https://www.amathusdrinks.com/fee-brothers-peach-bitters",
    notes: "Glycerine-based, hence the low figure. Vineyard Belfast also lists 1.7%.",
  },
  // Custom and bulk spirits, from our own documents.
  {
    name: "Vodka (Thames NGS)",
    abv: "40.10",
    productName: "Thames Distillers NGS",
    source: "supplier_invoice",
    sourceRef: "Thames Distillers invoice 26/AG19, 25 Aug 2026 (line: 4 25 Ltrs Tubs NGS 40.1%)",
    notes: "40.1% on every Thames invoice from 26/MY15 (19 May 2026) to 26/AG19.",
    effectiveDate: "2026-08-25",
  },
  {
    name: "Vodka (Thames NGS)",
    abv: "40.20",
    productName: "Thames Distillers NGS",
    source: "supplier_invoice",
    sourceRef: "Thames Distillers invoice 26/SP16, 9 Sep 2026 (line: 4 25 Ltrs Tubs NGS 40.2%)",
    notes:
      "The strength varies by batch: 40.1% on earlier invoices, 40.2% on this one. Duty on " +
      "the same invoice is charged on 40.20 litres of alcohol, which corroborates it.",
    effectiveDate: "2026-09-09",
  },
  {
    name: "Gin (Amalthea)",
    abv: "46.00",
    productName: "Fortnum's Vesper Amalthea (custom)",
    source: "manufacturer",
    sourceRef:
      "Cyrus, 19 Sept 2026: \"Vesper Amalthea definitively 46% - we redesigned this with the " +
      "team\"; Adam Lock, Fortnum's distillery, email 7 Sep 2026: \"The figure of 46% has also " +
      "been mentioned but we think this may be the Vesper Gin.\"",
    notes:
      "The custom Amalthea made for the Fortnum's Vesper, specified jointly with the distillery. " +
      "Not the Ginger Amalthea (50%, component \"Ginger Amalthea Gin\") and not the Clementini " +
      "Amalthea (43%, component \"Gin (Clementini Amalthea)\").",
  },
];

// ---- 2. New components ---------------------------------------------------------

type NewComponent = {
  name: string;
  abv: string;
  productName: string;
  source: AbvSource;
  sourceRef: string;
  abvNotes: string;
  componentNotes: string;
  /** Per litre. Null means no price is known and a placeholder row says so. */
  pricePerLitre: string | null;
  priceSource: "manual" | "placeholder";
  priceNotes: string;
};

const NEW_COMPONENTS: NewComponent[] = [
  {
    name: "Vodka (58 & Co Triple Distilled)",
    abv: "40.00",
    productName: "58 and Co. Triple Distilled Vodka",
    source: "supplier_invoice",
    sourceRef: "58 & Co invoice SI-00003881, 19 Mar 2026 (product TDV/40/1L/CORE/DP)",
    abvNotes:
      "The ABV is in the product code, as with the 58 & Co gin. Also on SI-00003367, " +
      "31 Jan 2025, and in 58 & Co's pricing email of 12 Feb 2025: \"Triple Distilled 40% - £20 p/L\".",
    componentNotes:
      "The MFC Vesper's vodka, replacing Bimber, which no longer makes vodka (Cyrus, 19 Sept " +
      "2026). Not the custom 58 & Co x Myatt's Fields vodka at 37.5%, which was the Espresso " +
      "Martini's vodka before Thames NGS.",
    pricePerLitre: "20.00",
    priceSource: "manual",
    priceNotes:
      "58 & Co invoice SI-00003881, 19 Mar 2026: TDV/40/1L/CORE/DP £200.00; pricing email " +
      "12 Feb 2025: \"Triple Distilled 40% - £20 p/L\".",
  },
  {
    name: "Vodka (Fortnum's NGS)",
    abv: "40.00",
    productName: "Fortnum's neutral spirit, diluted to 40%",
    source: "manufacturer",
    sourceRef:
      "Adam Lock, Fortnum's distillery, email 3 Jul 2026, thread \"Amalthea shipment\": \"We have " +
      "Neutral Apple Spirit here in the distillery now @48% so we will dilute this down to 40%\"; " +
      "confirmed 40% by Cyrus, 19 Sept 2026.",
    abvNotes:
      "Supplied by Fortnum's from the source of all their NGS (Cyrus, 19 Sept 2026). Replaced " +
      "Fortnum's Barley Vodka, which ran out in June 2026.",
    componentNotes:
      "The F&M Vesper's vodka. Fortnum's product; we get it FROM Fortnum's, charged on the " +
      "RTV. Replaced the Barley Vodka (recorded as Bimber) from July 2026.",
    pricePerLitre: null,
    priceSource: "placeholder",
    priceNotes:
      "No price known: Fortnum's charge by RTV. Recorded at zero so the F&M Vesper's COGS is " +
      "visibly incomplete rather than silently wrong.",
  },
  {
    name: "Gin (Clementini Amalthea)",
    abv: "43.00",
    productName: "Fortnum's Clementini Amalthea (custom)",
    source: "manufacturer",
    sourceRef: "Cyrus, 19 Sept 2026: \"Clementini Amalthea 43%\"",
    abvNotes: "A different custom Amalthea from the Vesper's (46%) and the Gingertini's (50%).",
    componentNotes:
      "The gin in the Fortnum's Clementini, last year's seasonal. A future version may be " +
      "released under a different name (Cyrus, 19 Sept 2026). Fortnum's product; charged by RTV.",
    pricePerLitre: "16.92",
    priceSource: "manual",
    priceNotes:
      "Oscar Dodd, Fortnum's, email 18 Aug 2025, thread \"Apples?\": \"We will honour the bulk " +
      "Amalthea cost of £16.92/litre\" — agreed for the Clementini.",
  },
];

// ---- 3. Recipe versions ------------------------------------------------------

type Swap = {
  label: string;
  drinkSlug: string;
  clientId: number;
  from: string;
  to: string;
  why: string;
  /**
   * A ruling to write this version even though Gate 1 fails. Recorded in the
   * version's created_by so the override is visible wherever the recipe is.
   * The declared ABV is NOT changed: it records what the printed label says,
   * and the label is the thing that is wrong.
   */
  gateOverride?: string;
};

const SWAPS: Swap[] = [
  {
    label: "MFC Vesper",
    drinkSlug: "vesper",
    clientId: 1,
    from: "Vodka (Bimber - stock only, no reorder)",
    to: "Vodka (58 & Co Triple Distilled)",
    why: "Bimber no longer make vodka; the MFC Vesper moved to 58 & Co Triple Distilled.",
    gateOverride:
      "Gate 1 overridden by Cyrus, 19 Sept 2026: the recipe is right and the 38.2% label is " +
      "wrong. Recipes are set by flavour, never adjusted to match a label; the label is being " +
      "dealt with separately.",
  },
  {
    label: "F&M Vesper",
    drinkSlug: "vesper",
    clientId: 2,
    from: "Vodka (Bimber - stock only, no reorder)",
    to: "Vodka (Fortnum's NGS)",
    why: "The F&M Vesper uses Fortnum's own NGS at 40%.",
  },
  {
    label: "F&M Clementini",
    drinkSlug: "clementini",
    clientId: 2,
    from: "Gin (Amalthea)",
    to: "Gin (Clementini Amalthea)",
    why: "The Clementini's gin is its own 43% Amalthea, not the 46% Vesper Amalthea.",
  },
];

// ---- 5. Note corrections (exact match only) ----------------------------------

const NOTE_CORRECTIONS: { name: string; from: string; to: string }[] = [
  {
    name: "Vodka (Bimber - stock only, no reorder)",
    from:
      "Bimber relationship ended (Cyrus, 20 Jul 2026); substantial bottle stock remains and the Vespers continue on it until a replacement is chosen. Do not reorder. £27.80 is the as-paid price.",
    to:
      "Discontinued: Bimber no longer make vodka (Cyrus, 19 Sept 2026). The MFC Vesper moved to " +
      "58 & Co Triple Distilled and the F&M Vesper to Fortnum's NGS. ABV stays assumed: no " +
      "document states it. Do not reorder. £27.80 is the as-paid price.",
  },
  {
    name: "Shipwreck Rum",
    from: "Fortnum's product; we buy it FROM Fortnum's; price from next purchase invoice (Cyrus, 22 Jul 2026)",
    to:
      "Discontinued. Fortnum's product, used only in the Autumn Nectar, a Fortnum's seasonal from " +
      "a few years ago; there is no equivalent in the current range (Cyrus, 19 Sept 2026). ABV " +
      "stays assumed: no document states it.",
  },
  {
    name: "Jerez (Pedro Ximénez)",
    from: "Fortnum's product; we buy it FROM Fortnum's; price from next purchase invoice (Cyrus, 22 Jul 2026)",
    to:
      "Discontinued. Pedro Ximénez, used only in the Griotte — a chocolate cherry cocktail that " +
      "worked but did not sell, and was abandoned (Cyrus, 19 Sept 2026). Brand not recorded, so " +
      "the ABV stays assumed.",
  },
  {
    name: "Gin (Amalthea)",
    from: "One Amalthea price for all variants: £16.67/L (Cyrus, 20 Jul 2026). Primary use: F&M Vesper Martini.",
    to:
      "The custom Vesper Amalthea, 46% (Cyrus, 19 Sept 2026). F&M Vesper only: the Clementini's " +
      "gin is \"Gin (Clementini Amalthea)\" and the Gingertini's is \"Ginger Amalthea Gin\". " +
      "Price £16.67/L (Cyrus, 20 Jul 2026).",
  },
];

// ------------------------------------------------------------------------------

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ABV sources, ${TODAY}\n`);

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));
  const missing = [
    ...SOURCED.map((s) => s.name),
    ...SWAPS.map((s) => s.from),
    ...NOTE_CORRECTIONS.map((n) => n.name),
  ].filter((n) => !byName.has(n));
  if (missing.length) throw new Error(`Components not found: ${[...new Set(missing)].join(", ")}`);

  // What every component's ABV will be once this runs, for the before/after.
  const abvAfter = new Map(all.map((c) => [c.id, { name: c.name, abv: c.abv }]));
  const before = new Map(all.map((c) => [c.id, { name: c.name, abv: c.abv }]));

  // ---- 1. Sourced figures ----------------------------------------------------
  console.log("SOURCED FIGURES\n");
  let recorded = 0;
  for (const s of SOURCED) {
    const c = byName.get(s.name)!;
    const [latest] = await db
      .select()
      .from(componentAbvHistory)
      .where(eq(componentAbvHistory.componentId, c.id))
      .orderBy(desc(componentAbvHistory.effectiveDate), desc(componentAbvHistory.id))
      .limit(1);
    const already = await db
      .select({ id: componentAbvHistory.id })
      .from(componentAbvHistory)
      .where(
        and(
          eq(componentAbvHistory.componentId, c.id),
          eq(componentAbvHistory.source, s.source),
          eq(componentAbvHistory.sourceRef, s.sourceRef),
        ),
      )
      .limit(1);
    abvAfter.set(c.id, { name: c.name, abv: s.abv });
    if (already.length) {
      console.log(`  = ${s.name}: already recorded from this source`);
      continue;
    }
    const current = latest ? Number(latest.abv) : Number(c.abv);
    const changed = current !== Number(s.abv);
    console.log(
      `  ${changed ? "~" : "="} ${s.name}: ${current.toFixed(2)}% ${changed ? "-> " + s.abv + "%" : "(unchanged)"}` +
        `  [${s.source}]  ${s.productName}`,
    );
    recorded++;
    if (!WRITE) continue;
    await db.insert(componentAbvHistory).values({
      componentId: c.id,
      abv: s.abv,
      productName: s.productName,
      effectiveDate: s.effectiveDate ?? TODAY,
      source: s.source,
      sourceRef: s.sourceRef,
      notes: s.notes ?? null,
    });
    await db
      .update(components)
      .set({
        abv: s.abv,
        productName: s.productName,
        abvSource: s.source,
        abvSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(components.id, c.id));
  }
  console.log(`\n  ${recorded} readings to record.`);

  // ---- 2 and 4. New components and their prices ------------------------------
  console.log("\nNEW COMPONENTS\n");
  const template = byName.get("Gin (Amalthea)")!;
  const newIds = new Map<string, number>();
  let placeholderId = -1;
  for (const n of NEW_COMPONENTS) {
    const existing = byName.get(n.name);
    if (existing) {
      console.log(`  = ${n.name}: already exists (id ${existing.id})`);
      newIds.set(n.name, existing.id);
      abvAfter.set(existing.id, { name: n.name, abv: existing.abv });
      continue;
    }
    const unitCost = n.pricePerLitre ? (Number(n.pricePerLitre) / 1000).toFixed(4) : "0";
    console.log(
      `  + ${n.name}: ${n.abv}% [${n.source}]  ${n.productName}  — ` +
        (n.pricePerLitre ? `£${n.pricePerLitre}/L [${n.priceSource}]` : "no price [placeholder]"),
    );
    if (!WRITE) {
      newIds.set(n.name, placeholderId);
      abvAfter.set(placeholderId, { name: n.name, abv: n.abv });
      placeholderId--;
      continue;
    }
    const [row] = await db
      .insert(components)
      .values({
        name: n.name,
        type: template.type,
        uom: template.uom,
        packSize: "1000.000",
        packCost: n.pricePerLitre ?? "0.00",
        unitCost,
        unitCostSetAt: new Date(),
        notes: n.componentNotes,
        abv: n.abv,
        abvSource: n.source,
        abvSetAt: new Date(),
        productName: n.productName,
      })
      .returning({ id: components.id });
    await db.insert(componentAbvHistory).values({
      componentId: row.id,
      abv: n.abv,
      productName: n.productName,
      effectiveDate: TODAY,
      source: n.source,
      sourceRef: n.sourceRef,
      notes: n.abvNotes,
    });
    await db.insert(componentPriceHistory).values({
      componentId: row.id,
      supplierId: null,
      unitCost,
      currency: "GBP",
      uom: template.uom,
      effectiveDate: TODAY,
      source: n.priceSource,
      sourceId: null,
      notes: n.priceNotes,
    });
    newIds.set(n.name, row.id);
    abvAfter.set(row.id, { name: n.name, abv: n.abv });
  }

  // ---- 3. Recipe versions, each through Gate 1 -------------------------------
  console.log("\nRECIPE VERSIONS — each put through Gate 1 exactly as the editor would\n");
  const refused: string[] = [];
  for (const s of SWAPS) {
    const [drink] = await db.select().from(drinks).where(eq(drinks.slug, s.drinkSlug)).limit(1);
    if (!drink) throw new Error(`Unknown drink: ${s.drinkSlug}`);
    const [current] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.drinkId, drink.id), eq(recipes.clientId, s.clientId), eq(recipes.isCurrent, true)))
      .limit(1);
    if (!current) throw new Error(`${s.label}: no current recipe`);
    const lines = await db
      .select()
      .from(recipeLines)
      .where(eq(recipeLines.recipeId, current.id))
      .orderBy(recipeLines.displayOrder);
    const fromId = byName.get(s.from)!.id;
    const toId = newIds.get(s.to) ?? byName.get(s.to)?.id;
    if (toId === undefined) throw new Error(`${s.label}: target component ${s.to} not found`);
    if (!lines.some((l) => l.componentId === fromId)) {
      console.log(`  = ${s.label}: v${current.version} no longer uses ${s.from} — left alone`);
      continue;
    }
    const newLines = lines.map((l) => ({
      componentId: l.componentId === fromId ? toId : l.componentId,
      percentage: l.percentage,
    }));
    const oldAbv = abvFromLines(lines, before).abv;
    const newAbv = abvFromLines(newLines, abvAfter).abv;
    const { value: declared, conflicts } = await declaredAbvFor(drink.id, s.clientId);
    const verdict =
      conflicts.length > 1 ? null : gateOne(newAbv, declared?.declared ?? null);
    const verdictText =
      verdict === null
        ? `REFUSED — the SKUs disagree on the label (${conflicts.join("%, ")}%)`
        : verdict.status === "fail"
          ? `REFUSED by Gate 1 — computes ${verdict.computed.toFixed(1)}% against a ` +
            `${verdict.declared.toFixed(1)}% label, a ${verdict.gap.toFixed(1)}-point gap`
          : verdict.status === "pass"
            ? `Gate 1 pass (label ${verdict.declared.toFixed(1)}%)`
            : "Gate 1 cannot run — no label figure recorded (unverified)";
    console.log(
      `  ${s.label} v${current.version} -> v${current.version + 1}: ${s.from} -> ${s.to}\n` +
        `      computed ${oldAbv.toFixed(2)}% -> ${newAbv.toFixed(2)}%.  ${verdictText}`,
    );
    if (verdict === null || verdict.status === "fail") {
      if (!s.gateOverride) {
        refused.push(s.label);
        continue;
      }
      console.log(`      OVERRIDDEN — ${s.gateOverride}`);
    }
    if (!WRITE) continue;
    const [next] = await db
      .insert(recipes)
      .values({
        drinkId: drink.id,
        clientId: s.clientId,
        version: current.version + 1,
        isCurrent: false,
        method: current.method,
        createdBy: s.gateOverride ? `${CREATED_BY}. ${s.gateOverride}` : CREATED_BY,
      })
      .returning({ id: recipes.id });
    await db.insert(recipeLines).values(
      newLines.map((l, i) => ({
        recipeId: next.id,
        componentId: l.componentId,
        percentage: l.percentage,
        displayOrder: i,
      })),
    );
    await db.batch([
      db.update(recipes).set({ isCurrent: false, updatedAt: new Date() }).where(eq(recipes.id, current.id)),
      db.update(recipes).set({ isCurrent: true, updatedAt: new Date() }).where(eq(recipes.id, next.id)),
    ]);
  }

  // ---- Every current recipe whose computed ABV moves --------------------------
  console.log("\nCOMPUTED ABV — current recipes that move because a component ABV changed\n");
  const current = await db
    .select({ id: recipes.id, drinkId: recipes.drinkId, clientId: recipes.clientId, drink: drinks.name })
    .from(recipes)
    .innerJoin(drinks, eq(drinks.id, recipes.drinkId))
    .where(eq(recipes.isCurrent, true));
  const allLines = await db.select().from(recipeLines);
  for (const r of current) {
    const lines = allLines.filter((l) => l.recipeId === r.id);
    // A version written above uses components that did not exist before this
    // run; it has no "before" to compare, and is reported under RECIPE VERSIONS.
    if (lines.some((l) => !before.has(l.componentId))) continue;
    const a = abvFromLines(lines, before).abv;
    const b = abvFromLines(lines, abvAfter).abv;
    if (Math.abs(a - b) >= 0.005) {
      console.log(`  ${r.drink} (client ${r.clientId}): ${a.toFixed(2)}% -> ${b.toFixed(2)}%`);
    }
  }

  // ---- 5. Note corrections -----------------------------------------------------
  console.log("\nNOTES — replaced only where they still read exactly as found\n");
  for (const fix of NOTE_CORRECTIONS) {
    const c = byName.get(fix.name)!;
    if (c.notes !== fix.from) {
      console.log(`  = ${fix.name}: note no longer matches the original — left alone`);
      continue;
    }
    console.log(`  ~ ${fix.name}: note corrected`);
    if (WRITE) {
      await db.update(components).set({ notes: fix.to, updatedAt: new Date() }).where(eq(components.id, c.id));
    }
  }

  if (refused.length) {
    console.log(
      `\nREFUSED: ${refused.join(", ")}. Not written. The recipe and the label disagree by more ` +
        `than Gate 1 allows; establish which is right before changing either.`,
    );
  }
  console.log(`\n${WRITE ? "Done." : "Dry run only — nothing written. Re-run with --write."}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
