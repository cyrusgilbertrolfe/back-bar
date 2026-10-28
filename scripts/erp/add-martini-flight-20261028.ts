/**
 * The Martini Flight as a real SKU, 28 October 2026: six 50ml Martinis in a
 * gift box, EAN 5060665000451 (GS1 UK, 26 October). Priced the same day,
 * £35 RRP and £20 wholesale (Cyrus).
 *
 * Its COGS is built, not typed. The six 50ml SKUs go in as set lines, each at
 * its own COGS, and the box, brochure, gift card and box label go on its bill
 * of materials. When any of those prices moves, so does the Flight.
 *
 * There is no earlier row to reuse. The "phantom martini-flight SKU" of 14 July
 * was an entry in src/lib/pricing-data.ts (RRP £198, COGS £79.15, no SKU
 * behind it), deleted with the file layer on 31 July.
 *
 * Code and size follow the short code record of 20 October 2026: a set's size
 * is the bottles inside, so this is martini-flight-50 at 50ml, MYFL-MFLT-0050,
 * leaving room for a six-250ml Flight as MYFL-MFLT-0250.
 *
 * Components created here:
 * - The Martini Flight brochure, £1.11 each, a manual price with no invoice.
 * - Gift card and the 76x51mm box label, £0.15 each, with NO price history, so
 *   they read Unsourced wherever the Flight's COGS appears: gaps, not hidden.
 *
 * Prices are not written here. Set them through the Back Bar connector
 * (set_rrp, set_wholesale_price, set_ingredient_price for the brochure) so
 * they land through the same audited path as every other price.
 *
 * Needs migration 0026 (sku_set_lines and the 'insert' role).
 *
 *   npx tsx --env-file=.env.local scripts/erp/add-martini-flight-20261028.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/add-martini-flight-20261028.ts --write  # apply
 */

import { eq, ilike, inArray, or } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, components, skuComponents, skuSetLines, skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

const SKU = {
  code: "martini-flight-50",
  sizeMl: 50,
  gtin: "5060665000451",
  shortCode: "MYFL-MFLT-0050",
  customerDescription: "The Martini Flight",
};

const CHILDREN = [
  "tuxedo-50",
  "gibson-martini-50",
  "vesper-50",
  "lychee-martini-50",
  "pisco-martini-50",
  "sakura-martini-50",
];

/** The 50ml mini outer box: Vive Printing mailer box and insert, £3.50 from 28 Oct 2026. */
const BOX_COMPONENT_ID = 20;

const NEW_COMPONENTS = [
  {
    name: "Martini Flight brochure",
    role: "insert" as const,
    cost: "1.11",
    notes: "50 unit print run, figure from Aug 2026 proposal, no invoice yet",
  },
  {
    name: "Gift card, handwritten",
    role: "insert" as const,
    cost: "0.15",
    notes: "Placeholder, unsourced: no supplier or price yet. Gift card written by hand for each box.",
  },
  {
    name: "Box label 76x51mm",
    role: "front_label" as const,
    cost: "0.15",
    notes: "Placeholder, unsourced: no supplier or price yet. The new label on the Martini Flight box.",
  },
];

async function main() {
  const phantom = await db
    .select({ id: skus.id, code: skus.code })
    .from(skus)
    .where(or(ilike(skus.code, "%flight%"), eq(skus.gtin, SKU.gtin), eq(skus.shortCode, SKU.shortCode)));
  if (phantom.length > 0) {
    throw new Error(`A Flight row already exists: ${phantom.map((p) => `[${p.id}] ${p.code}`).join(", ")}`);
  }

  const [mfc] = await db.select().from(clients).where(eq(clients.slug, "mfc"));
  const children = await db.select().from(skus).where(inArray(skus.code, CHILDREN));
  const missing = CHILDREN.filter((c) => !children.some((s) => s.code === c));
  if (missing.length > 0) throw new Error(`Missing child SKUs: ${missing.join(", ")}`);

  const [box] = await db.select().from(components).where(eq(components.id, BOX_COMPONENT_ID));
  if (box?.name !== "50ml mini outer box") throw new Error(`Component ${BOX_COMPONENT_ID} is not the 50ml mini outer box`);

  const existing = await db
    .select({ name: components.name })
    .from(components)
    .where(inArray(components.name, NEW_COMPONENTS.map((c) => c.name)));
  if (existing.length > 0) throw new Error(`Components already exist: ${existing.map((e) => e.name).join(", ")}`);

  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: ${SKU.code} (${SKU.shortCode}, EAN ${SKU.gtin}) under ${mfc.name}`);
  for (const c of children) console.log(`  set line: 1 × ${c.code}`);
  console.log(`  bill of materials: 1 × ${box.name} (outer_carton, £${Number(box.unitCost).toFixed(2)})`);
  for (const c of NEW_COMPONENTS) console.log(`  bill of materials: 1 × ${c.name} (${c.role}, new, £${c.cost})`);
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");

  const [sku] = await db
    .insert(skus)
    .values({ ...SKU, clientId: mfc.id, drinkId: null, active: true })
    .returning();

  await db.insert(skuSetLines).values(
    children.map((c) => ({ setSkuId: sku.id, childSkuId: c.id, quantity: "1" })),
  );

  const created = await db
    .insert(components)
    .values(
      NEW_COMPONENTS.map((c) => ({
        name: c.name,
        type: "packaging" as const,
        uom: "each" as const,
        packSize: "1",
        // Unsourced by construction: a cached price with no history row behind it.
        // The brochure's history row is written through set_ingredient_price.
        packCost: c.cost,
        unitCost: c.cost,
        notes: c.notes,
      })),
    )
    .returning();

  await db.insert(skuComponents).values([
    { skuId: sku.id, componentId: box.id, quantity: "1", role: "outer_carton" as const, includeInCogs: true },
    ...NEW_COMPONENTS.map((c, i) => ({
      skuId: sku.id,
      componentId: created[i].id,
      quantity: "1",
      role: c.role,
      includeInCogs: true,
    })),
  ]);

  console.log(`Created SKU [${sku.id}] ${sku.code}; components ${created.map((c) => `[${c.id}] ${c.name}`).join(", ")}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
