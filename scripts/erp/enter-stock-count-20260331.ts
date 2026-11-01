/**
 * Enters the 31 March 2026 year-end count into stock count 1, from the count
 * sheet Cyrus pasted on 1 November 2026 (counted by Clemency on 31 March).
 *
 * Cyrus's rulings, 1 November 2026:
 * - Bottled drinks are not held in stock; the stock is held as liquid. The
 *   sheet's 10s and 1s on the bottle lines are placeholders, so every
 *   finished-goods line is counted as zero.
 * - Kecello and Limoncello are kept, for a short-run new cocktail, and the
 *   Honey Gin for a Bee's Knees; none is written off. Yuzu Negroni is delisted,
 *   but none was on hand. None is in the register, so they go in as
 *   unregistered lines. Limoncello was counted at nil.
 * - The figure is valued at Back Bar's costs, not the spreadsheet's.
 *
 * The sheet's 58 Gin is the in-house gin, 58 & Co's London Dry (Cyrus, 1 Nov 2026).
 *
 * Liquid ingredients on the sheet are taken as litres, the unit the old AUDIT
 * tab priced them in. Components the sheet does not mention stay uncounted.
 *
 *   npx tsx --env-file=.env.local scripts/erp/enter-stock-count-20260331.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/erp/enter-stock-count-20260331.ts --write  # apply
 */

import { and, eq } from "drizzle-orm";

import { db } from "../../src/db";
import {
  components,
  skus,
  stockCountLines,
  stockCounts,
} from "../../src/db/schema";
import { computeSkuCost, unitCostResolver } from "../../src/lib/erp/cogs";
import {
  valueCount,
  KIND_ORDER,
  KIND_LABEL,
} from "../../src/lib/erp/stock-count";

const WRITE = process.argv.includes("--write");
const COUNT_ID = 1;

const DETAILS = {
  countedOn: "2026-03-31",
  countedBy: "Clemency",
  basis:
    "Counted at the year end, 31 March 2026. Bottled drinks are not held in stock (the stock is held as liquid), " +
    "so every finished-goods line is zero (Cyrus, 1 Nov 2026).",
};

/** Component id → quantity and unit, from the sheet. */
const COMPONENTS: {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
}[] = [
  {
    id: 1,
    name: "Gin (in-house), the sheet's 58 Gin",
    quantity: 50,
    unit: "litre",
  },
  { id: 7, name: "Kahlua", quantity: 6, unit: "litre" },
  { id: 50, name: "Scratch (white rum)", quantity: 80, unit: "litre" },
  {
    id: 112,
    name: "Vodka (58 & Co Triple Distilled)",
    quantity: 10,
    unit: "litre",
  },
  {
    id: 2,
    name: "Vodka (Bimber - stock only, no reorder)",
    quantity: 25,
    unit: "litre",
  },
  { id: 12, name: "500ml bottle", quantity: 72, unit: "each" },
  { id: 11, name: "250ml bottle", quantity: 2688, unit: "each" },
  { id: 13, name: "50ml miniature bottle", quantity: 4800, unit: "each" },
  {
    id: 15,
    name: "F&M 350ml bottle (Apollo VB003)",
    quantity: 0,
    unit: "each",
  },
  {
    id: 20,
    name: "50ml mini outer box (Vive mailer and insert)",
    quantity: 480,
    unit: "each",
    note:
      "Not on the count sheet; 480 sets on hand (Cyrus, 1 Nov 2026). Vive Printing quote 15487, 14 Jan 2026: box £2.72 + insert " +
      "£0.78, delivered. Usable: the insert is fixed with double-sided tape. Held for the Martini Flight and a Negroni flight",
  },
];

/** Aged and batched liquid, by drink and client. */
const BULK: {
  drinkId: number;
  clientId: number;
  name: string;
  litres: number;
}[] = [
  { drinkId: 9, clientId: 1, name: "Manhattan", litres: 9 },
  { drinkId: 5, clientId: 1, name: "Desert Negroni", litres: 9 },
  { drinkId: 12, clientId: 1, name: "Negroni", litres: 81 },
  { drinkId: 12, clientId: 3, name: "Negroni (Cripps)", litres: 5 },
];

/** Not in the register: valued only once a unit cost is typed on the line. */
const OTHER: {
  description: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  obsolete?: boolean;
  note?: string;
}[] = [
  {
    description: "Kecello 500ml",
    quantity: 6,
    unit: "bottle",
    unitCost: 7.73,
    note:
      "Kept for a short-run new cocktail (Cyrus, 1 Nov 2026). ESTIMATE: 0.5 L liquid at £12.33/L, plus 500ml bottle £1.06, " +
      "cork £0.21, EPR £0.15 and labels £0.15 at Back Bar's costs",
  },
  {
    description: "Kecello, aged liquid",
    quantity: 11,
    unit: "litre",
    unitCost: 12.33,
    note:
      "Kept for a short-run new cocktail (Cyrus, 1 Nov 2026). ESTIMATE from the spirit alone: 32% ABV from 40% NGS is 0.8 L NGS " +
      "per litre, at Thames NGS £15.41/L duty paid. Grapefruit zest and sugar left out",
  },
  {
    description: "Honey Gin",
    quantity: 5,
    unit: "litre",
    unitCost: 19.5,
    note: "Kept for a Bee's Knees (Cyrus, 1 Nov 2026). £97.50 per 5L, ex VAT, delivered: Union Distillers order 31115, 12 Sep 2022, the last bought",
  },
  {
    description: "58 Custom Vodka",
    quantity: 50,
    unit: "litre",
    unitCost: 18.5,
    note: "58 & Co x Myatt's Fields vodka 37.5%, £18.50/L duty paid, ex VAT: 58 & Co SI-00003881, 19 Mar 2026",
  },
  {
    description: "12 box",
    quantity: 190,
    unit: "each",
    unitCost: 1.06,
    note: "0201 glued case 350x270x215, £1,060 per 1,000: ASC Cartons invoice 133382, 30 Jan 2025, by courier, no carriage charged",
  },
  {
    description: "12 box dividers",
    quantity: 190,
    unit: "each",
    unitCost: 0.9,
    note: "12-cell divider, spec 137336, £900 per 1,000: ASC Cartons invoice 133382, 30 Jan 2025",
  },
  {
    description: "Double box",
    quantity: 150,
    unit: "each",
    unitCost: 0.55,
    note: "2-bottle 0201, 245x120x260, 620 at £0.55: ASC Cartons quote of 2 Feb 2021, the bulk order taken; carriage nil",
  },
  {
    description: "Single box",
    quantity: 200,
    unit: "each",
    unitCost: 0.35,
    note: "1-bottle outer, 1,000 at £0.35: ASC Cartons quote of 8 Dec 2020 (pro forma MYATTSPF111220 is £0.59 with the fitment)",
  },
  {
    description: "Single inserts",
    quantity: 200,
    unit: "each",
    unitCost: 0.3,
    note: "Single bottle insert, 1,200 at £0.30: ASC Cartons pro forma MYATTSPF191021, 19 Oct 2021, shipping nil",
  },
  {
    description: "Boxset outer",
    quantity: 200,
    unit: "each",
    unitCost: 1.09,
    note: "Printed mailer MYATTSBOX1 272x90x48: £0.49 box + £0.60 one-colour print, Postpack invoice 605630, 9 Nov 2021, carriage nil",
  },
  {
    description: "Cripps box",
    quantity: 100,
    unit: "each",
    unitCost: 0.83,
    note: "6x700ml outer at £0.83, the price Clemency was paying on 26 Mar 2026 (Boxes Etc thread); no invoice found",
  },
];

async function main() {
  const [count] = await db
    .select()
    .from(stockCounts)
    .where(eq(stockCounts.id, COUNT_ID));
  if (!count) throw new Error(`No stock count ${COUNT_ID}`);
  if (count.status !== "draft")
    throw new Error(`Count ${COUNT_ID} is ${count.status}; reopen it first`);
  const lines = await db
    .select()
    .from(stockCountLines)
    .where(eq(stockCountLines.countId, COUNT_ID));
  if (lines.some((l) => l.quantity != null))
    throw new Error(
      `Count ${COUNT_ID} already has counted lines; not overwriting`,
    );
  if (lines.some((l) => l.kind === "bulk" || l.kind === "other"))
    throw new Error(`Count ${COUNT_ID} already has added lines`);

  const finished = lines.filter((l) => l.kind === "finished");
  const missing = COMPONENTS.filter(
    (c) => !lines.some((l) => l.kind === "component" && l.componentId === c.id),
  );
  if (missing.length)
    throw new Error(
      `No line for component ${missing.map((m) => m.name).join(", ")}`,
    );

  console.log(
    `${WRITE ? "APPLYING" : "DRY RUN"} to count ${COUNT_ID}, as at ${count.asAt}`,
  );
  console.log(
    `  details: counted ${DETAILS.countedOn} by ${DETAILS.countedBy}`,
  );
  console.log(`  ${finished.length} finished-goods lines → 0`);
  console.log(
    `  ${COMPONENTS.length} component lines, ${BULK.length} bulk lines, ${OTHER.length} unregistered lines`,
  );
  if (!WRITE) return report(false);

  await db
    .update(stockCounts)
    .set({ ...DETAILS, updatedAt: new Date() })
    .where(eq(stockCounts.id, COUNT_ID));
  for (const l of finished) {
    await db
      .update(stockCountLines)
      .set({ quantity: "0", updatedAt: new Date() })
      .where(eq(stockCountLines.id, l.id));
  }
  for (const c of COMPONENTS) {
    await db
      .update(stockCountLines)
      .set({
        quantity: String(c.quantity),
        unit: c.unit,
        ...(c.note ? { note: c.note } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(stockCountLines.countId, COUNT_ID),
          eq(stockCountLines.componentId, c.id),
        ),
      );
  }
  await db.insert(stockCountLines).values([
    ...BULK.map((b) => ({
      countId: COUNT_ID,
      kind: "bulk" as const,
      drinkId: b.drinkId,
      clientId: b.clientId,
      quantity: String(b.litres),
      unit: "litre",
    })),
    ...OTHER.map((o) => ({
      countId: COUNT_ID,
      kind: "other" as const,
      description: o.description,
      quantity: String(o.quantity),
      unit: o.unit,
      unitCost: o.unitCost == null ? null : String(o.unitCost),
      obsolete: o.obsolete ?? false,
      note: o.note ?? null,
    })),
  ]);
  await report(true);
}

/**
 * Values what is entered. After a write the count values itself; a dry run
 * values the same lines the same way valueCount does (COGS as at the year end,
 * component prices recorded by then), without writing them.
 */
async function report(written: boolean) {
  if (written) {
    const v = await valueCount(COUNT_ID);
    if (!v) return;
    for (const k of KIND_ORDER)
      console.log(
        `  ${KIND_LABEL[k]}: £${v.byKind[k].value.toFixed(2)} (${v.byKind[k].counted} of ${v.byKind[k].lines} counted)`,
      );
    console.log(
      `  TOTAL £${v.total.toFixed(2)}, ${v.invoiceBackedPct.toFixed(0)}% invoice-backed, ${v.unvalued} counted lines unvalued, ${v.writtenDown} written down`,
    );
    return;
  }
  const asOf = "2026-03-31";
  const problems: string[] = [];
  const unitCostOf = await unitCostResolver(asOf, problems);
  const comps = await db.select().from(components);
  let compTotal = 0;
  console.log("\n  Components:");
  for (const c of COMPONENTS) {
    const comp = comps.find((x) => x.id === c.id)!;
    const per = c.unit === "litre" ? 1000 : 1;
    const unitCost = unitCostOf(comp) * per;
    compTotal += unitCost * c.quantity;
    console.log(
      `    ${c.name}: ${c.quantity} ${c.unit} × £${unitCost.toFixed(4)} = £${(unitCost * c.quantity).toFixed(2)}`,
    );
  }
  const skuRows = await db.select().from(skus);
  let bulkTotal = 0;
  console.log(
    "\n  Bulk liquid, at the recipe's liquid cost per litre plus wastage:",
  );
  for (const b of BULK) {
    const s = skuRows
      .filter((s) => s.drinkId === b.drinkId && s.clientId === b.clientId)
      .sort(
        (a, z) => Number(z.active) - Number(a.active) || z.sizeMl - a.sizeMl,
      )[0];
    const c = await computeSkuCost(s.id, {
      asOf,
      currentRecipeBeforeRecords: true,
    });
    const perLitre = (c.liquidTotal / c.sizeMl) * 1000 * (1 + c.wastagePct);
    bulkTotal += perLitre * b.litres;
    console.log(
      `    ${b.name}: ${b.litres} L × £${perLitre.toFixed(2)}/L = £${(perLitre * b.litres).toFixed(2)} (from ${c.skuCode})`,
    );
  }
  console.log(
    "\n  Not in the register (no cost until one is typed on the line):",
  );
  let otherTotal = 0;
  for (const o of OTHER) {
    const value =
      o.obsolete || o.unitCost == null ? null : o.unitCost * o.quantity;
    otherTotal += value ?? 0;
    const how = o.obsolete
      ? "written off to nil"
      : value == null
        ? "unvalued"
        : `× £${o.unitCost!.toFixed(2)} = £${value.toFixed(2)}`;
    console.log(`    ${o.description}: ${o.quantity} ${o.unit}, ${how}`);
  }
  console.log(
    `\n  Finished goods £0.00 · bulk £${bulkTotal.toFixed(2)} · components £${compTotal.toFixed(2)} · unregistered £${otherTotal.toFixed(2)}`,
  );
  console.log(`  TOTAL £${(bulkTotal + compTotal + otherTotal).toFixed(2)}`);
  console.log("Dry run only. Re-run with --write to apply.");
}

main();
