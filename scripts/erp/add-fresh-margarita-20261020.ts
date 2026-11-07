/**
 * Add Fresh Margarita to Back Bar, with its 5L SKU (Cyrus, 20 Oct 2026).
 *
 *   npx tsx --env-file=.env.local scripts/erp/add-fresh-margarita-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/add-fresh-margarita-20261020.ts --write  # apply
 *
 * Two drinks, two names. Margarita is our recipe with Myatt's Lime Sours,
 * which QuickBooks used to call "Invisible Margarita", a name and branding
 * no longer used. Fresh Margarita is the version caterers buy for events,
 * QuickBooks item 216 ("Margarita for Caterers", to be "Fresh Margarita 5L").
 * No recipe yet: this gives the drink a name and its SKU a short code.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, drinks, skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

async function main() {
  console.log(WRITE ? "APPLYING" : "DRY RUN");
  // Own brand, as on the Margarita 5L.
  const [marg] = await db.select().from(skus).where(eq(skus.code, "margarita-5000"));
  const [own] = marg?.clientId ? await db.select().from(clients).where(eq(clients.id, marg.clientId)) : [];
  if (!own) throw new Error("Own-brand client not found via margarita-5000");
  console.log(`  owner: ${own.name}`);

  const [taken] = await db.select().from(skus).where(eq(skus.shortCode, "MYFL-FMRG-5000"));
  if (taken) throw new Error(`MYFL-FMRG-5000 already belongs to ${taken.code}`);

  let [drink] = await db.select().from(drinks).where(eq(drinks.slug, "fresh-margarita"));
  if (drink) console.log(`  drink fresh-margarita exists (${drink.id})`);
  else {
    console.log("  + drink Fresh Margarita (fresh-margarita)");
    if (WRITE)
      [drink] = await db
        .insert(drinks)
        .values({
          slug: "fresh-margarita",
          name: "Fresh Margarita",
          notes:
            "The Margarita caterers buy for events. Not the Margarita, which is our recipe with Myatt's Lime Sours. Added 20 Oct 2026 (Cyrus) for QuickBooks item 216.",
        })
        .returning();
  }

  console.log("  + SKU fresh-margarita-5000, 5000ml, Myatt's Fields, MYFL-FMRG-5000");
  if (WRITE)
    await db.insert(skus).values({
      code: "fresh-margarita-5000",
      drinkId: drink.id,
      clientId: own.id,
      sizeMl: 5000,
      shortCode: "MYFL-FMRG-5000",
    });
  if (!WRITE) console.log("Dry run only. Re-run with --write to apply.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
