/**
 * Start COGS movement tracking: reconstruct the history, then take today's
 * baseline.
 *
 *   npx tsx --env-file=.env.local scripts/erp/reconstruct-cogs-history-20261009.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/reconstruct-cogs-history-20261009.ts --write  # apply
 *
 * Written 9 Oct 2026 (Cyrus: "we definitely want to track COGS movement").
 * sku_cogs_snapshots starts empty, so without this the report would begin
 * today. For every day from 2 Jun 2026 (when the recipes were seeded into the
 * database) on which a price-history row or a recipe version is dated, each
 * active SKU is costed as at the end of that day, and a snapshot
 * is written where its COGS moved, marked `reconstructed`. Those use today's
 * bill of materials and wastage rate, which are not dated, so they are close
 * rather than exact. Then one live snapshot of every SKU is taken as the
 * baseline that real tracking compares against.
 *
 * Only inserts into sku_cogs_snapshots; nothing else is touched. Refuses to
 * run against a table that already holds snapshots, so it cannot be run twice.
 */

import { db } from "@/db";
import { componentPriceHistory, recipes, skuCogsSnapshots, components, type SkuCogsSnapshot } from "@/db/schema";
import { recordCogsSnapshots } from "@/lib/erp/cogs-movement";

const WRITE = process.argv.includes("--write");
const HISTORY_STARTS = "2026-06-02";

async function main() {
  // A dry run may come before migration 0019, when the table does not exist yet.
  const existing = await db
    .select({ id: skuCogsSnapshots.id })
    .from(skuCogsSnapshots)
    .limit(1)
    .catch((err) => {
      if (WRITE) throw err;
      return [];
    });
  if (existing.length > 0) {
    console.log("sku_cogs_snapshots already holds snapshots; refusing to reconstruct over them.");
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [history, recipeRows, comps] = await Promise.all([
    db.select().from(componentPriceHistory),
    db.select().from(recipes),
    db.select({ id: components.id, name: components.name }).from(components),
  ]);
  const name = new Map(comps.map((c) => [c.id, c.name]));

  // What happened on each day, for the trigger text.
  const events = new Map<string, Set<string>>();
  const note = (d: string, what: string) => {
    if (d >= today) return;
    const set = events.get(d) ?? new Set<string>();
    set.add(what);
    events.set(d, set);
  };
  for (const h of history) note(h.effectiveDate, `price: ${name.get(h.componentId) ?? h.componentId}`);
  for (const r of recipeRows) note(r.createdAt.toISOString().slice(0, 10), `recipe v${r.version}: drink ${r.drinkId}`);

  // Recipes were seeded into the database on 2 Jun 2026; before that every
  // drink would cost as packaging alone, so history starts there.
  const dates = [...events.keys()].filter((d) => d >= HISTORY_STARTS).sort();
  const dry = WRITE ? undefined : new Map<number, SkuCogsSnapshot>();
  let total = 0;
  for (const d of dates) {
    const what = [...events.get(d)!];
    const trigger = `reconstructed: ${what.slice(0, 4).join("; ")}${what.length > 4 ? `; +${what.length - 4} more` : ""}`;
    const { written } = await recordCogsSnapshots(trigger, { asOf: d, dryRun: dry });
    total += written;
    console.log(`${d}  ${String(written).padStart(3)} SKUs moved  ${trigger.slice(15, 120)}`);
  }

  // Today's live figures for every SKU, exact, so tracking starts from them.
  const base = await recordCogsSnapshots("baseline", { dryRun: dry, all: true });
  console.log(`${today}  ${String(base.written).padStart(3)} SKUs, live baseline`);
  console.log(
    `\n${dates.length} days reconstructed, ${total} reconstructed snapshots, ${base.written} baseline snapshots ${WRITE ? "written" : "would be written. Dry run: pass --write to apply"}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
