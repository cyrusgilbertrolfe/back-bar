/**
 * Backfill ABV provenance, and record verified figures.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-provenance.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-abv-provenance.ts --write  # apply
 *
 * Written 12 Sept 2026, opening week 2 of docs/roadmap.md. Extended 13 Sept
 * 2026 when `product_name` was added.
 *
 * Three jobs, in this order:
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
 * 2. VERIFIED FIGURES, each with the product it describes:
 *
 *    - Gin (in-house): 41.2% -> 43.0%, 58 and Co London Dry Gin. Every 58 & Co
 *      invoice since November 2025 states "58 and Co London Dry Gin 43% 1L",
 *      product code LDG/43/1L/CORE/DP — the ABV is in the product code. Cyrus
 *      confirmed from an invoice independently, and on 13 Sept confirmed it is
 *      their standard London Dry, not a bespoke blend. In eleven current recipes.
 *
 *    - Old Tom Gin: 41.4% confirmed unchanged, Hayman's Old Tom Gin, per the
 *      producer's own product page. The figure was already right; what it
 *      lacked was a source.
 *
 * 3. NOTE CORRECTIONS. The gin's component note read "Base spirit; in-house
 *    Fusion blend". Cyrus had never heard the phrase. It was unsourced prose
 *    wearing the costume of a fact, and it is replaced by exact-match only, so a
 *    note someone has since edited is never overwritten.
 *
 * Idempotent: a figure already recorded from the same source is not written
 * twice. If that earlier row predates `product_name`, the product is filled in
 * on it — metadata the column did not exist to hold, not a change of fact.
 */

import { eq, and, desc } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentAbvHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

type Verified = {
  name: string;
  abv: string;
  productName: string;
  source: "bottle" | "manufacturer" | "supplier_invoice";
  sourceRef: string;
  notes: string;
};

const VERIFIED: Verified[] = [
  {
    name: "Gin (in-house)",
    abv: "43.00",
    productName: "58 and Co London Dry Gin",
    source: "supplier_invoice",
    sourceRef: "58 & Co invoice SI-00003971, 15 Jun 2026 (product LDG/43/1L/CORE/DP)",
    notes:
      "58 and Co London Dry Gin 43% 1L — their standard London Dry (Cyrus, 13 Sept 2026). " +
      "The ABV is stated in the product code itself and is consistent across invoices " +
      "SI-00003726 (4 Nov 2025), SI-00003787 (15 Dec 2025), SI-00003881 (19 Mar 2026) and " +
      "SI-00003971 (15 Jun 2026). Previously recorded as 41.2% with no source. Corrects 11 " +
      "current recipes.",
  },
  {
    name: "Old Tom Gin",
    abv: "41.40",
    productName: "Hayman's Old Tom Gin",
    source: "manufacturer",
    sourceRef: "https://www.haymansgin.com/product/old-tom-gin/",
    notes:
      "Hayman's Old Tom Gin, 41.4% ABV per the producer's product page, read 12 Sept 2026. " +
      "Value unchanged — this records the source it never had. Confirmed by Cyrus as the " +
      "product actually used.",
  },
  {
    name: "Mount Gay Rum",
    abv: "37.50",
    productName: "Mount Gay Eclipse Rum",
    source: "supplier_invoice",
    sourceRef: "Matthew Clark invoice 4103269, 25 Mar 2026 (line: MOUNTGAY ECLIPSE RUM 37.5%70X6)",
    notes:
      "The strength is printed in Matthew Clark's own product description on the invoice PDF. " +
      "The line's unit price, £17.46, is exactly this component's recorded pack cost, which is " +
      "how the product is identified. Previously recorded as 40% with no source. The largest " +
      "single-component impact in the range: 86% of the Rum Old Fashioned.",
  },
];

const NOTE_CORRECTIONS: { name: string; from: string; to: string }[] = [
  {
    name: "Gin (in-house)",
    from: "Base spirit; in-house Fusion blend",
    to:
      "Base spirit. 58 and Co London Dry Gin, 43% — their standard London Dry, not a bespoke " +
      "blend (Cyrus, 13 Sept 2026). An earlier note describing an \"in-house Fusion blend\" " +
      "was unsourced and wrong.",
  },
];

/**
 * Products identified from supplier documents where the ABV itself is not yet
 * evidenced (13 Sept 2026). Each gets a history row that names the bottle but
 * keeps the ABV `assumed`: the component becomes checkable without the figure
 * being promoted to something it is not. `abv_set_at` is deliberately left
 * alone, because the ABV was not set.
 *
 * Several of these identifications come from Matthew Clark order emails read
 * through an inbox search assistant rather than from the documents directly.
 * They are recorded because each line's unit price matches this component's
 * recorded pack cost to the penny, and that assistant never saw Back Bar's
 * prices — the match is independent corroboration. The same assistant also
 * claimed ABVs "from attached invoice PDFs" on emails that turned out to have
 * no attachments, which is why none of its ABV figures are recorded here.
 */
const PRODUCT_IDENTITIES: { name: string; productName: string; evidence: string }[] = [
  {
    name: "Akvavit",
    productName: "Aalborg Taffel Akvavit",
    evidence:
      "Matthew Clark invoice 4103269 (PDF), 25 Mar 2026: AALBORG TAFFEL AKVAVIT 70x6 at £27.93, " +
      "exactly this component's pack cost.",
  },
  {
    name: "Manzanilla",
    productName: "La Guita Manzanilla",
    evidence:
      "Matthew Clark invoice 4103269 (PDF), 25 Mar 2026: LA GUITA MANZANILLA 75X6 at £11.25, " +
      "exactly this component's pack cost.",
  },
  {
    name: "Rye",
    productName: "Bulleit Rye",
    evidence:
      "Matthew Clark order 23339746: Bulleit Rye Whiskey 70cl at £28.02, exactly this " +
      "component's pack cost. Read from order emails via inbox search, 13 Sept 2026.",
  },
  {
    name: "Tequila Reposado",
    productName: "Espolòn Reposado Tequila",
    evidence:
      "Matthew Clark order 23339746: Espolon Reposado Tequila 70cl at £26.88, exactly this " +
      "component's pack cost. Read from order emails via inbox search, 13 Sept 2026.",
  },
  {
    name: "Lychee Liqueur",
    productName: "Kwai Feh Lychee Liqueur",
    evidence:
      "Matthew Clark orders 21566854 and 22286623: Kwai Feh Lychee 70cl at £17.85, exactly this " +
      "component's pack cost. Read from order emails via inbox search, 13 Sept 2026.",
  },
  {
    name: "Fino Sherry",
    productName: "Tio Pepe Fino",
    evidence: "Component note: \"Tio Pepe. Used in the Tuxedo. (Cyrus, 20 Jul 2026)\".",
  },
];

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — ABV provenance, ${TODAY}\n`);

  const all = await db.select().from(components);
  const byName = new Map(all.map((c) => [c.name, c]));

  // ---- 1. Backfill everything that has an ABV but no source -------------
  const needBackfill = all.filter(
    (c) => c.abv !== null && c.abvSource === null && !VERIFIED.some((v) => v.name === c.name),
  );
  console.log(`BACKFILL — ${needBackfill.length} components carry an ABV with no source.`);
  if (needBackfill.length) {
    console.log("  Marking them `assumed`: the figure predates provenance and its origin");
    console.log("  is unknown. This is a record of ignorance, not a reading.");
  }
  for (const c of needBackfill) {
    if (!WRITE) continue;
    await db.insert(componentAbvHistory).values({
      componentId: c.id,
      abv: c.abv!,
      productName: c.productName,
      effectiveDate: TODAY,
      source: "assumed",
      sourceRef: null,
      notes:
        "Backfilled. Value predates the abv_source column; nobody recorded where it " +
        "came from. Needs verification against a bottle.",
    });
    await db
      .update(components)
      .set({ abvSource: "assumed", abvSetAt: new Date(), updatedAt: new Date() })
      .where(eq(components.id, c.id));
  }
  console.log(`  ${WRITE ? "wrote" : "would write"} ${needBackfill.length} \`assumed\` rows\n`);

  // ---- 2. Verified figures ----------------------------------------------
  console.log("VERIFIED — figures with a real source:\n");
  for (const v of VERIFIED) {
    const c = byName.get(v.name);
    if (!c) {
      console.log(`  !! "${v.name}" not found in components — skipped`);
      continue;
    }

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

    const alreadyRecorded =
      latest && Number(latest.abv) === Number(v.abv) && latest.sourceRef === v.sourceRef;

    if (alreadyRecorded) {
      const needsProduct = latest.productName === null || c.productName === null;
      console.log(
        `  = ${v.name}: already recorded at ${v.abv}% from this source` +
          (needsProduct ? ` — filling in product "${v.productName}"` : " — nothing to do"),
      );
      if (WRITE && needsProduct) {
        if (latest.productName === null) {
          await db
            .update(componentAbvHistory)
            .set({ productName: v.productName })
            .where(eq(componentAbvHistory.id, latest.id));
        }
        if (c.productName === null) {
          await db
            .update(components)
            .set({ productName: v.productName, updatedAt: new Date() })
            .where(eq(components.id, c.id));
        }
      }
      continue;
    }

    const changed = Number(c.abv) !== Number(v.abv);
    console.log(
      `  ${changed ? "~" : "="} ${v.name}: ${c.abv}% ${changed ? "-> " + v.abv + "%" : "(unchanged)"}` +
        `  [${v.source}]  ${v.productName}`,
    );
    console.log(`      ref: ${v.sourceRef}`);
    if (!WRITE) continue;
    await db.insert(componentAbvHistory).values({
      componentId: c.id,
      abv: v.abv,
      productName: v.productName,
      effectiveDate: TODAY,
      source: v.source,
      sourceRef: v.sourceRef,
      notes: v.notes,
    });
    await db
      .update(components)
      .set({
        abv: v.abv,
        productName: v.productName,
        abvSource: v.source,
        abvSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(components.id, c.id));
  }

  // ---- 2b. Products named, ABV still assumed -----------------------------
  console.log("\nPRODUCTS — named from supplier documents; ABV stays `assumed` until evidenced:\n");
  for (const p of PRODUCT_IDENTITIES) {
    const c = byName.get(p.name);
    if (!c) {
      console.log(`  !! "${p.name}" not found — skipped`);
      continue;
    }
    if (c.productName === p.productName) {
      console.log(`  = ${p.name}: already "${p.productName}"`);
      continue;
    }
    if (c.productName !== null) {
      console.log(`  !! ${p.name}: already names "${c.productName}" — left alone for a human`);
      continue;
    }
    if (c.abv === null) {
      console.log(`  !! ${p.name}: no ABV to carry into the history row — skipped`);
      continue;
    }
    console.log(`  ~ ${p.name} -> "${p.productName}"  (ABV ${c.abv}% still assumed)`);
    console.log(`      evidence: ${p.evidence}`);
    if (!WRITE) continue;
    await db.insert(componentAbvHistory).values({
      componentId: c.id,
      abv: c.abv,
      productName: p.productName,
      effectiveDate: TODAY,
      source: "assumed",
      sourceRef: null,
      notes: `Product identified; ABV not yet evidenced. ${p.evidence}`,
    });
    await db
      .update(components)
      .set({ productName: p.productName, updatedAt: new Date() })
      .where(eq(components.id, c.id));
  }

  // ---- 3. Note corrections (exact match only) ---------------------------
  console.log("\nNOTES — unsourced prose replaced only where it still reads exactly as found:\n");
  for (const fix of NOTE_CORRECTIONS) {
    const c = byName.get(fix.name);
    if (!c) {
      console.log(`  !! "${fix.name}" not found — skipped`);
    } else if (c.notes === fix.from) {
      console.log(`  ~ ${fix.name}: "${fix.from}" -> corrected`);
      if (WRITE) {
        await db
          .update(components)
          .set({ notes: fix.to, updatedAt: new Date() })
          .where(eq(components.id, c.id));
      }
    } else {
      console.log(`  = ${fix.name}: note no longer matches the original — left alone`);
    }
  }

  console.log(`\n${WRITE ? "Done." : "Dry run only — nothing written. Re-run with --write."}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
