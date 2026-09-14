/**
 * Undo the misuse of Matthew Clark's price-change letter as a cost source.
 *
 *   npx tsx --env-file=.env.local scripts/erp/fix-mc-letter-misuse-20260913.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/fix-mc-letter-misuse-20260913.ts --write  # apply
 *
 * Written 13 Sept 2026. Earlier the same evening, seed-mc-price-letter-20260302.ts
 * treated Matthew Clark's list prices as evidence of what Myatt's Fields pays.
 * Cyrus: "Just because we have a price from Matthew Clark doesn't mean we buy
 * from them" — and there are better prices elsewhere. That script wrote four
 * price-history rows that claim a source they do not have:
 *
 *   #119 Rye, #121 Lillet Blanc, #122 Campari — `manual` rows citing the letter,
 *        which turned costs that had no recorded source into costs that appear
 *        sourced. Deleted, restoring the honest state: unsourced.
 *   #120 Chinotto Nero — moved the cost from £22.57 to the letter's £23.67.
 *        Deleted and the cost restored. £22.57 is itself only Matthew Clark's
 *        pre-March list price, so it is then marked `placeholder`.
 *
 * Deleting rather than stacking corrections: these rows record nothing that
 * happened in the world, only a mistaken inference made an hour earlier. Their
 * full content is kept in the Gate 1 rulings record in Lifemaxxing (Domains/Cocktails/Back Bar) and in the commit history.
 *
 * Every delete is guarded: the row must still exist, still cite the letter, and
 * have been created on 13 Sept 2026. Anything else is refused and reported.
 */

import { desc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);
const LETTER = "Matthew Clark price-change letter";
const WRITTEN_FROM = new Date("2026-09-13T00:00:00Z");

const WRONG_ROWS: { id: number; component: string }[] = [
  { id: 119, component: "Rye" },
  { id: 120, component: "Chinotto Nero" },
  { id: 121, component: "Lillet Blanc" },
  { id: 122, component: "Campari" },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — undo the price-letter misuse\n`);
  const byName = new Map((await db.select().from(components)).map((c) => [c.name, c]));
  let refused = 0;

  for (const w of WRONG_ROWS) {
    const c = byName.get(w.component);
    const [row] = await db.select().from(componentPriceHistory).where(eq(componentPriceHistory.id, w.id));
    const ok =
      c && row && row.componentId === c.id &&
      (row.notes ?? "").includes(LETTER) &&
      row.createdAt >= WRITTEN_FROM;
    if (!ok) {
      console.log(`  !! #${w.id} ${w.component}: guard failed (missing, moved, or no longer the letter row) — refused`);
      refused++;
      continue;
    }
    console.log(`  -  delete #${w.id} ${w.component} [${row.source}] £${row.unitCost}/${row.uom} — "${(row.notes ?? "").slice(0, 70)}…"`);
    if (WRITE) await db.delete(componentPriceHistory).where(eq(componentPriceHistory.id, w.id));
  }

  // Chinotto Nero: restore the pre-error cost, then mark it a placeholder.
  const chin = byName.get("Chinotto Nero")!;
  const restorePack = "22.57";
  const restoreUnit = (Number(restorePack) / Number(chin.packSize)).toFixed(4);
  if (Number(chin.packCost) !== 23.67) {
    console.log(`\n  !! Chinotto Nero pack cost is £${chin.packCost}, not the £23.67 this undoes — refused`);
    refused++;
  } else {
    console.log(`\n  ~  Chinotto Nero cost £${chin.packCost} -> £${restorePack} (unit £${restoreUnit}/${chin.uom})`);
    console.log(`  +  Chinotto Nero: append \`placeholder\` row at £${restoreUnit}/${chin.uom}`);
    if (WRITE && refused === 0) {
      await db
        .update(components)
        .set({ packCost: restorePack, unitCost: restoreUnit, updatedAt: new Date() })
        .where(eq(components.id, chin.id));
      await db.insert(componentPriceHistory).values({
        componentId: chin.id,
        supplierId: chin.defaultSupplierId,
        unitCost: restoreUnit,
        currency: "GBP",
        uom: chin.uom,
        effectiveDate: TODAY,
        source: "placeholder",
        sourceId: null,
        notes:
          "Cost not evidenced. £22.57 per 500ml is Matthew Clark's pre-March 2026 list price, entered " +
          "2 Jun 2026. Cyrus, 13 Sept 2026: \"There are better prices than this\" and \"Just because we " +
          "have a price from Matthew Clark doesn't mean we buy from them.\" Replace with the price " +
          "actually paid, from a purchase invoice.",
      });
    }
  }

  if (WRITE) {
    const [newest] = await db.select().from(componentPriceHistory)
      .where(eq(componentPriceHistory.componentId, chin.id))
      .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id)).limit(1);
    console.log(`\n  check: Chinotto newest price row is [${newest?.source}] £${newest?.unitCost}`);
  }
  console.log(`\n${refused ? `${refused} refused. ` : ""}${WRITE ? "Done." : "Dry run only — nothing written."}`);
  if (refused) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
