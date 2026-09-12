/**
 * Backfill ABV provenance, and record the first two verified figures.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-provenance.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-provenance.ts --write  # apply
 *
 * Written 12 Sept 2026, opening week 2 of docs/roadmap.md.
 *
 * Two jobs, in this order:
 *
 * 1. BACKFILL. Every component that already carries an ABV gets a history row
 *    marked `assumed`, because that is the honest label: on 12 Sept 2026, 46 of
 *    52 alcoholic components held a round number, ten of them at exactly
 *    40.00%, and none had a source. Six values looked precise enough to have
 *    been read off a bottle (41.2, 41.4, 40.1, 44.7, 20.3, 1.7) and they are
 *    STILL marked `assumed`, because "looks read" is not evidence and one of
 *    those six — the in-house gin at 41.2% — turned out to be wrong.
 *
 *    The backfill deliberately does not guess. It records that we do not know.
 *
 * 2. VERIFIED FIGURES. Two components now have real provenance:
 *
 *    - Gin (in-house): 41.2% -> 43.0%. Every 58 & Co invoice since November
 *      2025 states "58 and Co London Dry Gin 43% 1L", product code
 *      LDG/43/1L/CORE/DP — the ABV is in the product code. Cyrus confirmed
 *      from an invoice independently before this was looked up. This component
 *      is in ELEVEN current recipes, so it is the largest single correction in
 *      the range.
 *
 *    - Old Tom Gin: 41.4% confirmed unchanged, per Hayman's own product page.
 *      The figure was already right; what it lacked was a source. Recording it
 *      is the point — an unsourced correct number is one overwrite away from
 *      being an unsourced wrong one.
 *
 * Idempotent: a component already carrying the target (abv, source, sourceRef)
 * is left alone, so re-running adds no duplicate history rows.
 */

import { eq, and, desc } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentAbvHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = "2026-09-12";

type Verified = {
  name: string;
  abv: string;
  source: "bottle" | "manufacturer" | "supplier_invoice";
  sourceRef: string;
  notes: string;
};

const VERIFIED: Verified[] = [
  {
    name: "Gin (in-house)",
    abv: "43.00",
    source: "supplier_invoice",
    sourceRef: "58 & Co invoice SI-00003971, 15 Jun 2026 (product LDG/43/1L/CORE/DP)",
    notes:
      "58 and Co London Dry Gin 43% 1L. The ABV is stated in the product code itself " +
      "and is consistent across invoices SI-00003726 (4 Nov 2025), SI-00003787 " +
      "(15 Dec 2025), SI-00003881 (19 Mar 2026) and SI-00003971 (15 Jun 2026). " +
      "Previously recorded as 41.2% with no source — that figure appears to have been " +
      "Hayman's London Dry, a different gin. Corrects 11 current recipes.",
  },
  {
    name: "Old Tom Gin",
    abv: "41.40",
    source: "manufacturer",
    sourceRef: "https://www.haymansgin.com/product/old-tom-gin/",
    notes:
      "Hayman's Old Tom Gin, 41.4% ABV per the producer's product page, read " +
      "12 Sept 2026. Value unchanged — this records the source it never had. " +
      "Confirmed by Cyrus as the product actually used.",
  },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ABV provenance, ${TODAY}\n`);

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));

  // ---- 1. Backfill everything that has an ABV but no source -------------
  const needBackfill = all.filter((c) => c.abv !== null && c.abvSource === null);
  console.log(`BACKFILL — ${needBackfill.length} components carry an ABV with no source.`);
  console.log("  Marking them `assumed`: the figure predates provenance and its origin");
  console.log("  is unknown. This is a record of ignorance, not a reading.\n");

  let backfilled = 0;
  for (const c of needBackfill) {
    // The two verified ones are handled below; don't stamp them `assumed` first.
    if (VERIFIED.some((v) => v.name === c.name)) continue;
    if (WRITE) {
      await db.insert(componentAbvHistory).values({
        componentId: c.id,
        abv: c.abv!,
        effectiveDate: TODAY,
        source: "assumed",
        sourceRef: null,
        notes:
          "Backfilled 12 Sept 2026. Value predates the abv_source column; nobody " +
          "recorded where it came from. Needs verification against a bottle.",
      });
      await db
        .update(components)
        .set({ abvSource: "assumed", abvSetAt: new Date(), updatedAt: new Date() })
        .where(eq(components.id, c.id));
    }
    backfilled++;
  }
  console.log(`  ${WRITE ? "wrote" : "would write"} ${backfilled} \`assumed\` history rows\n`);

  // ---- 2. The verified figures ------------------------------------------
  console.log("VERIFIED — figures with a real source:\n");
  for (const v of VERIFIED) {
    const c = byName.get(v.name);
    if (!c) {
      console.log(`  !! "${v.name}" not found in components — skipped`);
      continue;
    }
    const before = c.abv;
    const changed = before !== v.abv;

    // Idempotence: already carrying this exact figure from this exact source?
    const [latest] = await db
      .select()
      .from(componentAbvHistory)
      .where(
        and(
          eq(componentAbvHistory.componentId, c.id),
          eq(componentAbvHistory.source, v.source),
        ),
      )
      .orderBy(desc(componentAbvHistory.id))
      .limit(1);
    if (latest && latest.abv === v.abv && latest.sourceRef === v.sourceRef) {
      console.log(`  = ${v.name}: already recorded at ${v.abv}% from this source — skipped`);
      continue;
    }

    console.log(
      `  ${changed ? "~" : "="} ${v.name}: ${before}% ${changed ? "->" : "(unchanged)"} ` +
        `${changed ? v.abv + "%" : ""}  [${v.source}]`,
    );
    console.log(`      ref: ${v.sourceRef}`);

    if (WRITE) {
      await db.insert(componentAbvHistory).values({
        componentId: c.id,
        abv: v.abv,
        effectiveDate: TODAY,
        source: v.source,
        sourceRef: v.sourceRef,
        notes: v.notes,
      });
      await db
        .update(components)
        .set({
          abv: v.abv,
          abvSource: v.source,
          abvSetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(components.id, c.id));
    }
  }

  console.log(
    `\n${WRITE ? "Done." : "Dry run only — nothing written. Re-run with --write."}`,
  );
  console.log("Next: npm run audit, and expect Gate 1 results to move on 11 recipes.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
