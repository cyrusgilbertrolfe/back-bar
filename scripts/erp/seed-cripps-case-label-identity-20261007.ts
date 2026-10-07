/**
 * Cripps as a customer who issues no purchase order, and their identity on
 * the 700ml Espresso Martini, so its case labels can be printed.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-cripps-case-label-identity-20261007.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-cripps-case-label-identity-20261007.ts --write  # apply
 *
 * Source: Cyrus, 7 Oct 2026. Cases of 6; short code CRPS-EM; Cripps give us
 * no product code and no supplier code; no ABV on the case label (the bottle
 * says 20%, the recipe 18.5%). The customer name is the one QuickBooks
 * invoices, Cripps Barn Group Ltd.
 *
 * Only ever fills an empty field, like the Fortnum's seed.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { customers, skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const CUSTOMER = "Cripps Barn Group Ltd.";
const SKU = {
  code: "espresso-martini-700-cripps",
  shortCode: "CRPS-EM",
  customerDescription: "Espresso Martini 70cl",
  unitsPerCase: 6,
} as const;

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: Cripps case label identity\n`);

  const [row] = await db.select().from(skus).where(eq(skus.code, SKU.code));
  if (!row) throw new Error(`SKU ${SKU.code} not found`);
  const patch: Partial<typeof skus.$inferInsert> = {};
  for (const f of ["shortCode", "customerDescription", "unitsPerCase"] as const) {
    if (row[f] === null) {
      (patch as Record<string, unknown>)[f] = SKU[f];
      console.log(`  ${SKU.code}  ${f} := ${SKU[f]}`);
    } else if (row[f] !== SKU[f]) {
      console.log(`  ${SKU.code}  ${f} holds ${row[f]}, would be ${SKU[f]}: LEFT ALONE`);
    }
  }
  if (WRITE && Object.keys(patch).length) {
    await db.update(skus).set({ ...patch, updatedAt: new Date() }).where(eq(skus.id, row.id));
  }

  const [existing] = await db.select().from(customers).where(eq(customers.name, CUSTOMER));
  if (existing) {
    console.log(`\n  customer ${CUSTOMER} exists [${existing.id}], issues POs: ${existing.issuesPurchaseOrders}`);
    if (existing.issuesPurchaseOrders) {
      console.log("  issues_purchase_orders := false");
      if (WRITE) await db.update(customers).set({ issuesPurchaseOrders: false }).where(eq(customers.id, existing.id));
    }
  } else {
    console.log(`\n  customer ${CUSTOMER}: CREATE, issues no POs`);
    if (WRITE) {
      await db.insert(customers).values({
        name: CUSTOMER,
        issuesPurchaseOrders: false,
        notes: "Orders on demand with no PO. Shipments carry our dispatch number, CRPS-DN#####.",
      });
    }
  }

  console.log(WRITE ? "\nDONE." : "\nDry run only. Re-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
