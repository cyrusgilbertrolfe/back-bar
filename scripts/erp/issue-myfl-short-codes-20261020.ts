/**
 * Short codes for the own-brand range, MYFL-<drink>-<size>, on the standard
 * of 20 Oct 2026 (Cyrus): see reissue-short-codes-20261020.ts. Also moves
 * the Christmas Gingertini from XGIN, which read as "gin", to GING; it held
 * FTNM-XGIN-0500 for a few hours on 20 Oct and was never sent or printed.
 *
 *   npx tsx --env-file=.env.local scripts/erp/issue-myfl-short-codes-20261020.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/issue-myfl-short-codes-20261020.ts --write  # apply
 *
 * The drink's four letters belong to the drink and are the same under every
 * owner. Sets (Martini Flight MFLT, Choose Six CSIX, Sours Taster SOUR) have
 * no SKU rows yet and take their codes when they do.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, drinks, skus } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");

/** By drink name as Back Bar has it. Baby Otis is now Cuban Rum Manhattan. */
const DRINK_CODES: Record<string, string> = {
  "Apples & Pears": "APPR",
  "Baby Otis": "CMAN",
  "Christmas Gingertini": "GING",
  Clementini: "CLEM",
  "Cold Brew Negroni": "CNEG",
  "Corpse Reviver": "CREV",
  Dempsey: "DEMP",
  "Desert Negroni": "DNEG",
  "Espresso Daiquiri": "EDAQ",
  "Espresso Martini": "EMAR",
  "Gibson Martini": "GIBS",
  "Lychee Martini": "LYCH",
  Manhattan: "MANH",
  Margarita: "MARG",
  "Naked & Famous": "NAKD",
  Negroni: "NEGR",
  "Pisco Martini": "PISC",
  "Red Hook": "HOOK",
  "Robin Roy": "RROY",
  "Rum Old Fashioned": "RMOF",
  "Sakura Martini": "SAKU",
  Trident: "TRID",
  Tuxedo: "TUXD",
  "Vesper Martini": "VESP",
};

const RENAMED: Record<string, string> = { "FTNM-XGIN-0500": "FTNM-GING-0500" };

async function main() {
  console.log(WRITE ? "APPLYING" : "DRY RUN");
  const rows = await db
    .select({ id: skus.id, code: skus.code, shortCode: skus.shortCode, sizeMl: skus.sizeMl, drink: drinks.name, client: clients.name })
    .from(skus)
    .innerJoin(drinks, eq(drinks.id, skus.drinkId))
    .innerJoin(clients, eq(clients.id, skus.clientId));

  const planned = new Map<number, string>();
  for (const r of rows) {
    if (r.shortCode && RENAMED[r.shortCode]) planned.set(r.id, RENAMED[r.shortCode]);
    if (r.client !== "Myatt's Fields") continue;
    const drink = DRINK_CODES[r.drink];
    if (!drink) throw new Error(`No drink code for ${r.drink}`);
    const code = `MYFL-${drink}-${String(r.sizeMl).padStart(4, "0")}`;
    if (r.shortCode && r.shortCode !== code) throw new Error(`${r.code} already has ${r.shortCode}`);
    if (!r.shortCode) planned.set(r.id, code);
  }
  const codes = [...planned.values()];
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dup) throw new Error(`Two SKUs would share ${dup}`);

  for (const r of rows.filter((r) => planned.has(r.id)).sort((a, b) => a.code.localeCompare(b.code))) {
    console.log(`  ${r.code}: ${r.shortCode ?? "(none)"} → ${planned.get(r.id)}`);
  }
  console.log(`${planned.size} codes.`);
  if (!WRITE) return console.log("Dry run only. Re-run with --write to apply.");
  for (const [id, shortCode] of planned) {
    await db.update(skus).set({ shortCode, updatedAt: new Date() }).where(eq(skus.id, id));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
