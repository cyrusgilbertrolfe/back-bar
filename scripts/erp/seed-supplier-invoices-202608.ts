/**
 * Record prices actually paid, from supplier invoices.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-supplier-invoices-202608.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-supplier-invoices-202608.ts --write  # apply
 *
 * Written 13 Sept 2026, from documents Cyrus supplied after a supplier's price
 * list was wrongly used as a cost source (see fix-mc-letter-misuse-20260913.ts).
 * These are the opposite kind of evidence: what Myatt's Fields was actually
 * charged.
 *
 *   Master of Malt trade invoices 7971568 (27 Aug 2026), 7982704 (1 Sep 2026)
 *   and 7988955 (6 Sep 2026), and Speciality Brands proforma 113450 (4 Aug
 *   2026, duty paid). All prices are ex VAT. The business is VAT-registered,
 *   so ex-VAT is the cost. Master of Malt's order-confirmation emails show
 *   VAT-inclusive figures (£15.36 for Kahlúa, against £12.80 on the invoice),
 *   which is how an earlier comparison overstated its price by 20%.
 *
 * Plus Calvados: Cyrus confirmed on 13 Sept 2026 that Avallen is bought as a
 * 4.5 L at £152.38, not the 700 ml at £18.95 Back Bar held.
 *
 * Every change is guarded on the component's CURRENT pack and cost matching the
 * figures this was written against, so a cost someone has changed since is never
 * overwritten. A row whose price already matches gets a sourced history entry
 * only if it has none. Price history uses `manual` — "entered by a person,
 * usually from a supplier invoice in hand" — with the invoice in the note.
 */

import { desc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components, componentPriceHistory } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

type Line = {
  name: string;
  before: { packSize: string | null; packCost: string | null };
  after: { packSize: string; packCost: string };
  effectiveDate: string;
  evidence: string;
};

const MOM = "Master of Malt trade invoice";
const LINES: Line[] = [
  {
    name: "Kahlua",
    before: { packSize: "700", packCost: "13.43" },
    after: { packSize: "700", packCost: "12.80" },
    effectiveDate: "2026-09-06",
    evidence: `${MOM} 7988955, 6 Sep 2026: 90 x Kahlúa Coffee Liqueur 16.0% 70cl at £12.80 ex VAT; same price on 7971568, 27 Aug 2026 (60). Replaces £13.43, a Matthew Clark list price. The £15.36 on the order confirmation is VAT-inclusive.`,
  },
  {
    name: "Suze",
    before: { packSize: "700", packCost: "22.00" },
    after: { packSize: "700", packCost: "12.30" },
    effectiveDate: "2026-09-01",
    evidence: `${MOM} 7982704, 1 Sep 2026: 49 x Suze 20.0% 70cl at £12.30 ex VAT; same price on 7971568, 27 Aug 2026 (30).`,
  },
  {
    name: "Belle de Brillet (pear liqueur)",
    before: { packSize: "700", packCost: "21.67" },
    after: { packSize: "700", packCost: "24.90" },
    effectiveDate: "2026-09-01",
    evidence: `${MOM} 7982704, 1 Sep 2026: Belle de Brillet 30.0% 70cl at £24.90 ex VAT; same price on 7971568, 27 Aug 2026 (21).`,
  },
  {
    name: "Akashi Tai Daiginjo Genshu Sake",
    before: { packSize: "720", packCost: "34.50" },
    after: { packSize: "720", packCost: "33.20" },
    effectiveDate: "2026-08-27",
    evidence: `${MOM} 7971568, 27 Aug 2026: Akashi-Tai Daiginjo Genshu 17.0% 72cl at £33.20 ex VAT.`,
  },
  {
    name: "Angostura Bitters",
    before: { packSize: "148", packCost: "12.00" },
    after: { packSize: "200", packCost: "10.13" },
    effectiveDate: "2026-09-01",
    evidence: `${MOM} 7982704, 1 Sep 2026: 27 x Angostura Bitters 44.7% 20cl at £10.13 ex VAT (zero-rated). Pack corrected 148ml -> 200ml.`,
  },
  {
    name: "Bob's Vanilla Bitters",
    before: { packSize: null, packCost: null },
    after: { packSize: "100", packCost: "12.54" },
    effectiveDate: "2026-08-27",
    evidence: `${MOM} 7971568, 27 Aug 2026: Bob's Vanilla Bitters 35.0% 10cl at £12.54 ex VAT (zero-rated). Previously no pack or price.`,
  },
  {
    name: "Cocchi Americano",
    before: { packSize: "750", packCost: "18.42" },
    after: { packSize: "750", packCost: "15.66" },
    effectiveDate: "2026-08-04",
    evidence: "Speciality Brands proforma 113450, 4 Aug 2026, duty paid: 60 x Cocchi Americano 16.5% 75cl (VERMO/COC1) at £15.66 net. A proforma, not a tax invoice.",
  },
  {
    name: "Cocchi Torino",
    before: { packSize: "750", packCost: "18.05" },
    after: { packSize: "750", packCost: "18.05" },
    effectiveDate: "2026-08-04",
    evidence: "Speciality Brands proforma 113450, 4 Aug 2026, duty paid: 12 x Cocchi Vermouth di Torino 16% 75cl (VERMO/COC2) at £18.05 net. Price already matched; this records its source. A proforma, not a tax invoice.",
  },
  {
    name: "Calvados",
    before: { packSize: "700", packCost: "18.95" },
    after: { packSize: "4500", packCost: "152.38" },
    effectiveDate: TODAY,
    evidence: "Avallen Calvados 4.5L at £152.38, confirmed by Cyrus on 13 Sept 2026 as the correct pack and price. A matching Matthew Clark order (10794740) was reported by an inbox search summary, not read directly. Replaces 700ml at £18.95: cost per ml rises about 25%.",
  },
];

const eqNum = (a: string | null, b: string | null) =>
  a == null || b == null ? a == null && b == null : Number(a) === Number(b);

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"} — prices actually paid, from supplier invoices\n`);
  const byName = new Map((await db.select().from(components)).map((c) => [c.name, c]));
  let changed = 0, sourced = 0, skipped = 0, refused = 0;

  for (const l of LINES) {
    const c = byName.get(l.name);
    if (!c) { console.log(`  !! ${l.name}: not found — refused`); refused++; continue; }
    const label = l.name.padEnd(32);
    const [newest] = await db.select().from(componentPriceHistory)
      .where(eq(componentPriceHistory.componentId, c.id))
      .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id)).limit(1);

    const atAfter = eqNum(c.packSize, l.after.packSize) && eqNum(c.packCost, l.after.packCost);
    const atBefore = eqNum(c.packSize, l.before.packSize) && eqNum(c.packCost, l.before.packCost);
    const noChange = eqNum(l.before.packSize, l.after.packSize) && eqNum(l.before.packCost, l.after.packCost);

    if (atAfter && (!noChange || newest)) {
      if (newest?.notes === l.evidence || !noChange) {
        console.log(`  =  ${label} already ${c.packSize}${c.uom} @ £${c.packCost}`);
        skipped++; continue;
      }
    }
    if (!atBefore) {
      console.log(`  !! ${label} is ${c.packSize}${c.uom} @ £${c.packCost}, expected ${l.before.packSize}ml @ £${l.before.packCost} — refused`);
      refused++; continue;
    }

    let effective = l.effectiveDate;
    if (newest && String(newest.effectiveDate) > effective) {
      console.log(`     (${l.name}: an existing row is dated ${newest.effectiveDate}, later than ${effective}; dating this ${TODAY} so it sorts newest)`);
      effective = TODAY;
    }
    const unitCost = (Number(l.after.packCost) / Number(l.after.packSize)).toFixed(4);

    if (noChange) {
      console.log(`  +  ${label} £${c.packCost} unchanged — adding its source (no history yet)`);
      sourced++;
    } else {
      console.log(`  ~  ${label} ${l.before.packSize ?? "?"}ml @ £${l.before.packCost ?? "?"} -> ${l.after.packSize}ml @ £${l.after.packCost}  (unit £${unitCost}/ml)`);
      changed++;
    }
    if (!WRITE) continue;
    await db.insert(componentPriceHistory).values({
      componentId: c.id, supplierId: c.defaultSupplierId, unitCost, currency: "GBP", uom: c.uom,
      effectiveDate: effective, source: "manual", sourceId: null, notes: l.evidence,
    });
    if (!noChange) {
      await db.update(components)
        .set({ packSize: l.after.packSize, packCost: l.after.packCost, unitCost, unitCostSetAt: new Date(), updatedAt: new Date() })
        .where(eq(components.id, c.id));
    }
  }
  console.log(`\n${changed} changed · ${sourced} sourced · ${skipped} already done · ${refused} refused`);
  console.log(WRITE ? "Done." : "Dry run only — nothing written. Re-run with --write.");
  if (refused) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
