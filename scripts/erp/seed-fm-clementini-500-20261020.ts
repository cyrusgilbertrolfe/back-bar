/**
 * The Fortnum's Clementini 500ml: last Christmas's seasonal, entered as
 * history so the Fortnum's Clementini recipe has a bottle of its own.
 *
 *   npx tsx --env-file=.env.local scripts/erp/seed-fm-clementini-500-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/seed-fm-clementini-500-20261020.ts --write  # apply
 *
 * Source: Cyrus, 20 Oct 2026. The Clementini was Fortnum's Christmas 2025
 * seasonal, in a 500ml bottle they supplied, filled at 510ml like this
 * year's Apples & Pears and Gingertini. Inactive: it is a record, not a live
 * product, so the calculator and pricing pages do not offer it until it is
 * reactivated. The batch calculator stopped borrowing our 700ml for it on the
 * same day (d438944), which is what showed it had no SKU.
 *
 * The liquid is the Clementini's own Fortnum's recipe (version 3), the one
 * bottled last Christmas. Only the packaging is copied, from
 * apples-and-pears-500-fm, which is packed the same way: Fortnum's bottle,
 * cork, EPR and labels, and our 6-bottle carton (Cyrus confirmed both,
 * 20 Oct 2026). Refuses to run if the SKU already exists.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, drinks, skuComponents, skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const TEMPLATE = "apples-and-pears-500-fm";
const SKU = { code: "clementini-500-fm", shortCode: "FTNM-CLEM-0500", sizeMl: 510 } as const;

async function main() {
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: Fortnum's Clementini 500ml\n`);

  const [exists] = await db.select({ id: skus.id }).from(skus).where(eq(skus.code, SKU.code));
  if (exists) throw new Error(`${SKU.code} already exists [${exists.id}]`);
  const [taken] = await db.select({ code: skus.code }).from(skus).where(eq(skus.shortCode, SKU.shortCode));
  if (taken) throw new Error(`short code ${SKU.shortCode} is already ${taken.code}'s`);

  const [drink] = await db.select({ id: drinks.id }).from(drinks).where(eq(drinks.slug, "clementini"));
  const [fm] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, "fm"));
  const [template] = await db.select().from(skus).where(eq(skus.code, TEMPLATE));
  if (!drink || !fm || !template) throw new Error("clementini, fm or the template SKU is missing");

  const bom = await db.select().from(skuComponents).where(eq(skuComponents.skuId, template.id));
  console.log(`  ${SKU.code}  ${SKU.shortCode}  ${SKU.sizeMl}ml fill  inactive  drink ${drink.id}  client fm`);
  for (const l of bom) {
    console.log(
      `    ${l.role.padEnd(14)} component ${l.componentId}  × ${l.quantity}` +
        `${l.suppliedByCustomer ? "  supplied by Fortnum's" : ""}`,
    );
  }

  if (!WRITE) return;
  // neon-http has no transactions: if the BoM fails, take the SKU back out.
  const [row] = await db
    .insert(skus)
    .values({
      code: SKU.code,
      drinkId: drink.id,
      clientId: fm.id,
      sizeMl: SKU.sizeMl,
      active: false,
      shortCode: SKU.shortCode,
    })
    .returning({ id: skus.id });
  try {
    await db.insert(skuComponents).values(
      bom.map((l) => ({
        skuId: row.id,
        componentId: l.componentId,
        role: l.role,
        quantity: l.quantity,
        includeInCogs: l.includeInCogs,
        suppliedByCustomer: l.suppliedByCustomer,
        notes: `Copied from ${TEMPLATE}, 20 Oct 2026.`,
      })),
    );
  } catch (e) {
    await db.delete(skus).where(eq(skus.id, row.id));
    throw e;
  }
  const lines = await db.select().from(skuComponents).where(eq(skuComponents.skuId, row.id));
  console.log(`\n  written [${row.id}] with ${lines.length} BoM lines`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
