/**
 * Correct existing prices to landed cost.
 *
 *   npx tsx --env-file=.env.local scripts/erp/landed-cost-corrections-20261009.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/landed-cost-corrections-20261009.ts --write  # apply
 *
 * Cyrus, 2 Oct 2026: a component's cost is its landed cost, goods plus inbound
 * delivery, carriage, surcharges and every other fee on the invoice, apportioned
 * across the pack, ex VAT; EPR stays its own bill-of-materials line. Until now
 * the data mixed two conventions: freight folded into the 3L Big Joe and the
 * Croxsons 500ml bottle, left out of everything below.
 *
 * Rulings applied (Cyrus, 9 Oct 2026): a fee printed against particular items
 * goes to those items; any other fee is split by goods value. Pallet charges
 * are landed cost.
 *
 * Every other invoice behind a price in use was read on 9 Oct 2026 and charges
 * nothing beyond the goods (Matthew Clark 4417302 and 4469554, Master of Malt
 * 7988955, 7982704 and 7971568, 58 & Co SI-00003881, Daymark 368141,
 * Speciality Brands 4031364, Thames 26/SP16), so those prices are already
 * landed. The Croxsons 500ml bottle and the 3L Big Joe already fold freight in.
 *
 * Each correction writes the landed price to the component and a manual
 * price-history row dated today, carrying the invoice and the goods and fees
 * split, so the COGS movement report shows it as a landed-cost change. Refuses
 * a component whose price in use is no longer the goods figure below.
 */

import { db } from "@/db";
import { components, componentPriceHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeAllSkuCosts } from "@/lib/erp/cogs";
import { perUomCost } from "@/lib/erp/ingredients";
import { recordCogsSnapshots } from "@/lib/erp/cogs-movement";

const WRITE = process.argv.includes("--write");

interface Correction {
  componentId: number;
  /** Goods per pack, ex VAT, as invoiced. Must equal the pack price in use. */
  goods: number;
  /** This pack's share of the fees, ex VAT, excluding EPR. */
  fees: number;
  feesNote: string;
  supplier: string;
  ref: string;
}

const CORRECTIONS: Correction[] = [
  {
    componentId: 78, // 700ml bottle (Blackwell)
    goods: 728.4 / 932,
    fees: 57.95 / 932,
    feesNote: "Viamaster next-day transport £57.95, printed against the bottles, over 932 bottles",
    supplier: "G&C Packaging",
    ref: "26GC/A-0350",
  },
  {
    componentId: 75, // Cork 30x12mm
    goods: 0.185,
    fees: 12 / 1000,
    feesNote: "FedEx £12.00, printed against the corks, over 1,000 corks",
    supplier: "G&C Packaging",
    ref: "26GC/A-0350",
  },
  {
    componentId: 15, // F&M 350ml bottle (Apollo VB003)
    goods: 0.887,
    fees: 0.887 * (48 / 3925.47),
    feesNote: "Pallets £48.00 (3 × £16.00), delivery £0.00, over £3,925.47 goods, by value",
    supplier: "Pattesons",
    ref: "226031",
  },
  {
    componentId: 76, // Cork 19mm wood-top
    goods: 0.16508,
    fees: 0.16508 * (48 / 3925.47),
    feesNote: "Pallets £48.00 (3 × £16.00), delivery £0.00, over £3,925.47 goods, by value",
    supplier: "Pattesons",
    ref: "226031",
  },
  {
    componentId: 77, // 50ml watchstrap label
    goods: 128.32 / 3000,
    fees: 10.95 / 3000,
    feesNote: "Postage £10.95 over 3,000 labels",
    supplier: "Acorn Print",
    ref: "INV-11992",
  },
  {
    componentId: 50, // Scratch (white rum), priced per 1000ml pack
    goods: 23.67,
    fees: 111.6 / 125,
    feesNote: "Courier £111.60 (no mark-up, no VAT charged) over 125 L",
    supplier: "Canebrake",
    ref: "MF0012026",
  },
  // APC Pure 187817: carriage £18.98 for the whole invoice, VAT charged on it,
  // so £18.98 is ex VAT. Split by goods value over £88.83.
  {
    componentId: 87, // Citric acid powder, 2.5 kg
    goods: 35.83,
    fees: 35.83 * (18.98 / 88.83),
    feesNote: "Carriage £18.98 for the whole invoice over £88.83 goods, by value",
    supplier: "APC Pure",
    ref: "187817",
  },
  {
    componentId: 89, // Tartaric acid powder, 1 kg
    goods: 21.26,
    fees: 21.26 * (18.98 / 88.83),
    feesNote: "Carriage £18.98 for the whole invoice over £88.83 goods, by value",
    supplier: "APC Pure",
    ref: "187817",
  },
  {
    componentId: 93, // Phosphoric acid 45%, 2.5 L priced as 3,225 g
    goods: 31.74,
    fees: 31.74 * (18.98 / 88.83),
    feesNote: "Carriage £18.98 for the whole invoice over £88.83 goods, by value",
    supplier: "APC Pure",
    ref: "187817",
  },
];

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const before = await computeAllSkuCosts();
  const deltaUnit = new Map<number, number>();
  const refused: string[] = [];

  for (const k of CORRECTIONS) {
    const [c] = await db.select().from(components).where(eq(components.id, k.componentId));
    if (!c) {
      refused.push(`component ${k.componentId}: not found`);
      continue;
    }
    const size = Number(c.packSize ?? 1) > 0 ? Number(c.packSize ?? 1) : 1;
    const inUsePack = perUomCost(c) * size;
    // The price in use must still be the goods figure, to the 4dp a price keeps.
    if (Math.abs(inUsePack - k.goods) > Math.max(0.0001 * size, k.goods * 0.001)) {
      refused.push(`${c.name}: price in use £${inUsePack.toFixed(4)} per pack is not the invoiced goods £${k.goods.toFixed(4)}`);
      continue;
    }
    const landed = k.goods + k.fees;
    const unit = landed / size;
    deltaUnit.set(c.id, unit - perUomCost(c));
    console.log(
      `${WRITE ? "WRITE" : "would write"}  ${c.name.padEnd(36)} £${k.goods.toFixed(4)} + £${k.fees.toFixed(4)} = £${landed.toFixed(4)} per ${size === 1 ? "each" : `${size}${c.uom}`}  (+${((k.fees / k.goods) * 100).toFixed(2)}%)`,
    );
    if (!WRITE) continue;

    await db
      .update(components)
      .set({ packCost: landed.toFixed(2), unitCost: unit.toFixed(4), unitCostSetAt: new Date(), updatedAt: new Date() })
      .where(eq(components.id, c.id));
    await db.insert(componentPriceHistory).values({
      componentId: c.id,
      supplierId: c.defaultSupplierId ?? null,
      unitCost: unit.toFixed(4),
      currency: "GBP",
      uom: c.uom,
      effectiveDate: today,
      source: "manual",
      invoiceSupplier: k.supplier,
      invoiceRef: k.ref,
      goodsCost: k.goods.toFixed(4),
      feesCost: k.fees.toFixed(4),
      feesNote: k.feesNote,
      notes: `Landed cost correction, 9 Oct 2026 (Cyrus's 2 Oct ruling): goods £${k.goods.toFixed(4)} + fees £${k.fees.toFixed(4)} per pack, ${k.feesNote}. ${k.supplier} ${k.ref}.`,
    });
  }

  // What it does to COGS: each line's quantity times the change in its unit cost, plus wastage.
  let total = 0;
  const bySku: [string, number][] = [];
  for (const b of before) {
    const d = [...b.liquid, ...b.packaging].reduce((s, l) => s + l.quantity * (deltaUnit.get(l.componentId) ?? 0), 0) * (1 + b.wastagePct);
    if (Math.abs(d) > 0.00005) {
      total += d;
      bySku.push([b.skuCode, d]);
    }
  }
  bySku.sort((a, b) => b[1] - a[1]);
  console.log(`\nCOGS moves on ${bySku.length} SKUs, £${total.toFixed(2)} summed per bottle. Largest:`);
  for (const [code, d] of bySku.slice(0, 8)) console.log(`  ${code.padEnd(32)} +£${d.toFixed(4)}`);
  for (const r of refused) console.log(`REFUSED  ${r}`);
  if (WRITE) {
    const snap = await recordCogsSnapshots("landed cost corrections");
    console.log(`\nWritten. COGS snapshot recorded for ${snap.written} SKUs that moved.`);
  } else {
    console.log("\nDry run: pass --write to apply.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
