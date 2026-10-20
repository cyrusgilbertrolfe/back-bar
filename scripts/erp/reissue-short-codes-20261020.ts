/**
 * Reissue the short codes under the 20 Oct 2026 standard, OWNER-DRINK-SIZE
 * (Cyrus): four letters, four letters, four digits of ml as sold. MYFL for
 * our own brand, CRPS for Cripps, FTNM for Fortnum's.
 *
 *   npx tsx --env-file=.env.local scripts/erp/reissue-short-codes-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/reissue-short-codes-20261020.ts --write  # apply
 *
 * Codes are assigned once and never changed; this is the one exception,
 * made while only two of the old codes had left the building. This file is
 * the record of what each SKU was formerly, so a box carrying an old label
 * can be traced: CRPS-EM is on the Cripps Espresso Martini cases of
 * CRPS-DN00001 and 097648, FM-EDAQ on the old Fortnum's Word labels.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

const CODES: { sku: string; formerly: string | null; code: string }[] = [
  { sku: "apples-and-pears-500-fm", formerly: "FM-APPR", code: "FTNM-APPR-0500" },
  { sku: "christmas-gingertini-500-fm", formerly: "FM-XGIN", code: "FTNM-XGIN-0500" },
  { sku: "espresso-daiquiri-350-fm", formerly: "FM-EDAQ", code: "FTNM-EDAQ-0350" },
  { sku: "robin-roy-350-fm", formerly: "FM-RROY", code: "FTNM-RROY-0350" },
  { sku: "vesper-martini-350-fm", formerly: "FM-VESP", code: "FTNM-VESP-0350" },
  { sku: "espresso-martini-700-cripps", formerly: "CRPS-EM", code: "CRPS-EMAR-0700" },
  // New, on the standard from the start.
  { sku: "negroni-3000-cripps", formerly: null, code: "CRPS-NEGR-3000" },
  { sku: "negroni-700-cripps", formerly: null, code: "CRPS-NEGR-0700" },
];

async function main() {
  console.log(WRITE ? "APPLYING" : "DRY RUN");
  for (const c of CODES) {
    const [sku] = await db.select().from(skus).where(eq(skus.code, c.sku));
    if (!sku) throw new Error(`SKU ${c.sku} not found`);
    if (sku.shortCode === c.code) {
      console.log(`  ${c.sku}: already ${c.code}`);
      continue;
    }
    if (sku.shortCode !== c.formerly) {
      throw new Error(`${c.sku} is ${sku.shortCode ?? "uncoded"}, expected ${c.formerly ?? "uncoded"}`);
    }
    console.log(`  ${c.sku}: ${c.formerly ?? "(none)"} → ${c.code}`);
    if (WRITE) await db.update(skus).set({ shortCode: c.code, updatedAt: new Date() }).where(eq(skus.id, sku.id));
  }
  if (!WRITE) console.log("Dry run only. Re-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
