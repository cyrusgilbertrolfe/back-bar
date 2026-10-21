/**
 * Rename component 75 to what its suppliers call it (Cyrus, 21 Oct 2026: "let's
 * use what the suppliers say"). Back Bar had "Cork 30x12mm micro-agglomerated";
 * G&C invoices it as "30x12 NATURAL WOOD TOP SHANK 19" (code 00873) and
 * Pattesons as "30x12 Natural Wood with 27x19.5 Shank (BTOP59)" (GC01264), at
 * the same £185 a thousand. The invoice price check found it on 21 Oct.
 *
 *   npx tsx --env-file=.env.local scripts/erp/rename-cork-30x12-20261021.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/rename-cork-30x12-20261021.ts --write  # apply
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { components } from "../../src/db/schema";

const WRITE = process.argv.includes("--write");
const ID = 75;
const FROM = "Cork 30x12mm micro-agglomerated";
const TO = "Cork 30x12mm natural wood top shank";

async function main() {
  const [c] = await db.select().from(components).where(eq(components.id, ID));
  if (!c) throw new Error(`Component ${ID} not found`);
  if (c.name === TO) {
    console.log(`Already "${TO}"`);
    return;
  }
  if (c.name !== FROM) throw new Error(`Component ${ID} is "${c.name}", not "${FROM}"; not touching it`);
  const note = `Renamed 21 Oct 2026 from "${FROM}" to the suppliers' description (G&C 00873, Pattesons GC01264).`;
  console.log(`${WRITE ? "APPLYING" : "DRY RUN"}: ${ID} "${FROM}" → "${TO}"`);
  if (!WRITE) return;
  await db
    .update(components)
    .set({ name: TO, notes: c.notes ? `${c.notes}\n${note}` : note, updatedAt: new Date() })
    .where(eq(components.id, ID));
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
