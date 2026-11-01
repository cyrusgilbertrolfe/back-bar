/**
 * Tidies stock count 1 (as at 31 March 2026) on Cyrus's rulings of 1 November
 * 2026:
 * - Formats never held as bottles come off the count: every 5L, the
 *   own-brand 700ml, and the Tuxedo 500ml. All were counted at zero. New counts
 *   leave them out through heldAsBottles().
 * - This year's count is best efforts. Labels and some ingredients on hand were
 *   not counted, and a year end cannot be counted after the fact, so they are
 *   waived rather than estimated. The basis says so.
 *
 *   npx tsx --env-file=.env.local scripts/erp/tidy-stock-count-1-20261101.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/tidy-stock-count-1-20261101.ts --write  # apply
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, skus, stockCountLines, stockCounts } from "../../src/db/schema";
import { heldAsBottles } from "../../src/lib/erp/stock-count";

const WRITE = process.argv.includes("--write");
const COUNT_ID = 1;

const BASIS =
  "Counted at the year end, 31 March 2026. Bottled drinks are not held in stock (the stock is held as liquid), " +
  "so every finished-goods line is zero (Cyrus, 1 Nov 2026). Best efforts: labels and some ingredients on hand were " +
  "not counted and are waived for this year, since a year end cannot be counted after the fact. The next year end " +
  "is counted in full.";

async function main() {
  const [count] = await db.select().from(stockCounts).where(eq(stockCounts.id, COUNT_ID));
  if (!count || count.status !== "draft") throw new Error(`Count ${COUNT_ID} is not a draft`);
  const [own] = await db.select().from(clients).where(eq(clients.name, "Myatt's Fields"));
  const skuById = new Map((await db.select().from(skus)).map((s) => [s.id, s]));
  const lines = await db.select().from(stockCountLines).where(eq(stockCountLines.countId, COUNT_ID));

  const drop = lines.filter((l) => {
    const s = l.kind === "finished" && l.skuId ? skuById.get(l.skuId) : undefined;
    return s && !heldAsBottles(s, own?.id ?? null);
  });
  const counted = drop.filter((l) => l.quantity != null && Number(l.quantity) !== 0);
  if (counted.length) throw new Error(`Not dropping lines with stock: ${counted.map((l) => l.id).join(", ")}`);

  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: drop ${drop.length} finished lines, all at zero`);
  console.log(`  ${drop.map((l) => skuById.get(l.skuId!)!.code).join(" ")}`);
  console.log(`  basis → ${BASIS}`);
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");

  await db.delete(stockCountLines).where(inArray(stockCountLines.id, drop.map((l) => l.id)));
  await db.update(stockCounts).set({ basis: BASIS, updatedAt: new Date() }).where(eq(stockCounts.id, COUNT_ID));
  console.log("Done.");
}

main();
