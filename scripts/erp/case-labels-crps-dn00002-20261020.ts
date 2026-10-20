/**
 * Case labels for CRPS-DN00002, the Cripps Jeroboam Negroni, packed in mixed
 * cases of 12, 12 and 6: the standard Cripps case label, numbered CASE 1–3
 * OF 3 across both order lines. The UP handling labels go on as well
 * (make-up-labels.ts), not instead (Cyrus, 20 Oct 2026).
 *
 *   npx tsx --env-file=.env.local scripts/erp/case-labels-crps-dn00002-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/case-labels-crps-dn00002-20261020.ts --write  # set the SKU, write the PDF
 *
 * The drink page prints one order line at a time with the SKU's case
 * quantity, which a mixed shipment does not fit; a one-off at this volume.
 */

import { writeFile } from "node:fs/promises";

import { asc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";
import { getCaseLabelLine } from "../../src/lib/labels/case-label-data";
import { buildCaseLabelsPdf } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const WRITE = process.argv.includes("--write");
const ORDER = "CRPS-DN00002";
/** Ours, as Cripps give none: matches "Espresso Martini 70cl" on their other SKU. */
const DESCRIPTION = "Negroni 3L";
/** The full case; the third case of this shipment is a part case of 6. */
const UNITS_PER_CASE = 12;

async function main() {
  const [sku] = await db.select().from(skus).where(eq(skus.code, "negroni-3000-cripps"));
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: ${sku.code} ${sku.shortCode}, description "${DESCRIPTION}", case of ${UNITS_PER_CASE}`);
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");
  await db
    .update(skus)
    .set({ customerDescription: DESCRIPTION, unitsPerCase: UNITS_PER_CASE, updatedAt: new Date() })
    .where(eq(skus.id, sku.id));

  const [order] = await db.select().from(wholesaleOrders).where(eq(wholesaleOrders.orderNumber, ORDER));
  const lines = await db
    .select()
    .from(wholesaleOrderLines)
    .where(eq(wholesaleOrderLines.orderId, order.id))
    .orderBy(asc(wholesaleOrderLines.lineNo));
  const mixedCases = lines.flatMap((l) => Array<number>(Number(l.qty)).fill(l.unitsPerCase!));

  // The full-case line passes every check the drink page applies.
  const full = await getCaseLabelLine(lines.find((l) => l.unitsPerCase === UNITS_PER_CASE)!.id);
  if (!full?.facts || full.problems.length) throw new Error(`Cannot print:\n- ${full?.problems.join("\n- ")}`);

  const out = `outputs/Case labels ${ORDER} ${full.facts.supplierSku}.pdf`;
  await writeFile(out, await buildCaseLabelsPdf(full.facts, { count: mixedCases.length, mixedCases }, await loadBrandFonts()));
  console.log(`Wrote ${out}: cases of ${mixedCases.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
