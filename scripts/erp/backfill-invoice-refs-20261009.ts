/**
 * Record the invoice behind every price in use whose note already names one.
 *
 *   npx tsx --env-file=.env.local scripts/erp/backfill-invoice-refs-20261009.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/backfill-invoice-refs-20261009.ts --write  # apply
 *
 * Written 9 Oct 2026, roadmap week 4. Migration 0018 gave component_price_history
 * an invoice supplier and number, and a row carrying both now reads as
 * invoice-backed. Before it, 0% of COGS read that way, although most prices in
 * use were copied from an invoice and say so in their note.
 *
 * This fills the two columns on the price-history row already in use. It adds
 * no row and moves no price, so no COGS changes; only how its source reads.
 * Each entry below was read from that row's note by hand.
 *
 * Deliberately left out, for Cyrus to rule (not invoices, or not one invoice):
 *   - Cocchi Americano and Cocchi Torino: Speciality Brands proforma 113450,
 *     which their notes call "a proforma, not a tax invoice".
 *   - Passoã: Matthew Clark ORDER 23900027, not an invoice number.
 *   - Vodka (Thames NGS): "Thames invoice 22 Jun 2026", no number.
 *   - Espresso (house-brewed): a fully loaded figure built from several
 *     invoices and estimates, not read from one.
 *
 * Refuses rather than guesses: an entry is written only if the newest history
 * row still describes the price in use, its note contains the invoice number,
 * and it carries no invoice yet.
 */

import { db } from "@/db";
import { components, componentPriceHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newestByComponent, operativeProvenance } from "@/lib/erp/ingredients";

const WRITE = process.argv.includes("--write");

/** componentId → the invoice its in-use price was read from, as its note names it. */
const ENTRIES: { componentId: number; supplier: string; ref: string }[] = [
  { componentId: 4, supplier: "Matthew Clark", ref: "4417302" }, // Campari
  { componentId: 6, supplier: "Matthew Clark", ref: "4417302" }, // Lillet Blanc
  { componentId: 39, supplier: "Matthew Clark", ref: "4417302" }, // Punt e Mes
  { componentId: 31, supplier: "Matthew Clark", ref: "4417302" }, // Carpano Antica
  { componentId: 7, supplier: "Master of Malt", ref: "7988955" }, // Kahlúa
  { componentId: 64, supplier: "Master of Malt", ref: "7982704" }, // Belle de Brillet
  { componentId: 65, supplier: "Master of Malt", ref: "7982704" }, // Suze
  { componentId: 67, supplier: "Master of Malt", ref: "7982704" }, // Angostura
  { componentId: 102, supplier: "Master of Malt", ref: "7971568" }, // Bob's Vanilla Bitters
  { componentId: 41, supplier: "Master of Malt", ref: "7971568" }, // Akashi-Tai sake
  { componentId: 87, supplier: "APC Pure", ref: "187817" }, // Citric acid
  { componentId: 89, supplier: "APC Pure", ref: "187817" }, // Tartaric acid
  { componentId: 93, supplier: "APC Pure", ref: "187817" }, // Phosphoric acid 45%
  { componentId: 50, supplier: "Canebrake", ref: "MF0012026" }, // Scratch white rum
  { componentId: 112, supplier: "58 & Co", ref: "SI-00003881" }, // Vodka (58 & Co)
  { componentId: 78, supplier: "G&C Packaging", ref: "26GC/A-0350" }, // 700ml Blackwell bottle
  { componentId: 75, supplier: "G&C Packaging", ref: "26GC/A-0350" }, // Cork 30x12
  { componentId: 79, supplier: "G&C Packaging", ref: "26GC/A-0350" }, // EPR 700ml Blackwell
  { componentId: 76, supplier: "G&C Packaging", ref: "26GC/A-0280" }, // Cork 19mm
  { componentId: 15, supplier: "Pattesons", ref: "226031" }, // F&M 350ml bottle
  { componentId: 80, supplier: "Pattesons", ref: "226031" }, // EPR F&M 350ml
  { componentId: 77, supplier: "Acorn Print", ref: "INV-11992" }, // 50ml watchstrap label
  { componentId: 82, supplier: "Daymark", ref: "368141" }, // Front label F&M
  { componentId: 12, supplier: "Croxsons", ref: "110408" }, // 500ml bottle
  { componentId: 105, supplier: "Croxsons", ref: "110408" }, // Cork 34x12
  { componentId: 98, supplier: "Flaschenland (World of Bottles)", ref: "RE2026-127110" }, // 3L Big Joe
];

async function main() {
  const [comps, history] = await Promise.all([
    db.select().from(components),
    db.select().from(componentPriceHistory),
  ]);
  const byId = new Map(comps.map((c) => [c.id, c]));
  const newest = newestByComponent(history);

  let ok = 0;
  const refused: string[] = [];
  for (const e of ENTRIES) {
    const c = byId.get(e.componentId);
    const h = newest.get(e.componentId);
    const name = c?.name ?? `component ${e.componentId}`;
    if (!c || !h) {
      refused.push(`${name}: no component or no price history`);
      continue;
    }
    if (operativeProvenance(c, h).source === "unsourced") {
      refused.push(`${name}: the newest history row no longer describes the price in use`);
      continue;
    }
    if (!(h.notes ?? "").includes(e.ref)) {
      refused.push(`${name}: row ${h.id}'s note does not mention ${e.ref}`);
      continue;
    }
    if (h.invoiceSupplier || h.invoiceRef) {
      refused.push(`${name}: row ${h.id} already names ${h.invoiceSupplier} ${h.invoiceRef}`);
      continue;
    }
    console.log(`${WRITE ? "WRITE" : "would write"}  row ${h.id}  ${name.padEnd(44)}  ${e.supplier} ${e.ref}`);
    if (WRITE) {
      await db
        .update(componentPriceHistory)
        .set({ invoiceSupplier: e.supplier, invoiceRef: e.ref })
        .where(eq(componentPriceHistory.id, h.id));
    }
    ok++;
  }

  for (const r of refused) console.log(`REFUSED  ${r}`);
  console.log(`\n${ok} ${WRITE ? "written" : "to write"}, ${refused.length} refused${WRITE ? "" : ". Dry run: pass --write to apply."}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
