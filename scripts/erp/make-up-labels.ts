/**
 * UP handling labels for a shipment that must travel upright: an arrow, UP,
 * FRAGILE GLASS, and the shipment's number and case. Same 4-up stock as the
 * case labels. The cases come off the order's lines.
 *
 *   npx tsx --env-file=.env.local scripts/erp/make-up-labels.ts <order-number> [--per-case=4] [--start=N] [--out=path.pdf]
 */

import { writeFile } from "node:fs/promises";

import { asc, eq } from "drizzle-orm";

import { db } from "../../src/db";
import { drinks, skus, wholesaleOrderLines, wholesaleOrders } from "../../src/db/schema";
import { buildUpLabelsPdf } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

function size(ml: number) {
  return ml >= 1000 ? `${ml / 1000}L` : `${ml / 10}cl`;
}

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber || orderNumber.startsWith("--")) throw new Error("Pass the order number, e.g. CRPS-DN00002.");
  const [order] = await db.select().from(wholesaleOrders).where(eq(wholesaleOrders.orderNumber, orderNumber));
  if (!order) throw new Error(`No order ${orderNumber}.`);

  const lines = await db
    .select({ qty: wholesaleOrderLines.qty, unitsPerCase: wholesaleOrderLines.unitsPerCase, sizeMl: skus.sizeMl, drink: drinks.name })
    .from(wholesaleOrderLines)
    .innerJoin(skus, eq(skus.id, wholesaleOrderLines.skuId))
    .innerJoin(drinks, eq(drinks.id, skus.drinkId))
    .where(eq(wholesaleOrderLines.orderId, order.id))
    .orderBy(asc(wholesaleOrderLines.lineNo));
  if (!lines.length) throw new Error(`${orderNumber} has no lines.`);
  const products = new Set(lines.map((l) => `${l.drink} ${size(l.sizeMl)}`));
  if (products.size > 1) throw new Error(`${orderNumber} carries more than one product: ${[...products].join(", ")}`);
  if (lines.some((l) => !l.unitsPerCase)) throw new Error(`A line of ${orderNumber} has no case quantity.`);

  const cases = lines.flatMap((l) => Array<number>(Number(l.qty)).fill(l.unitsPerCase!));
  const perCase = Number(arg("per-case") ?? 4);
  const out = arg("out") ?? `UP labels ${orderNumber}.pdf`;
  const facts = { orderNumber, orderNumberIsOurs: order.orderNumberIsOurs, product: [...products][0], cases };
  await writeFile(out, await buildUpLabelsPdf(facts, { perCase, startAt: Number(arg("start") ?? 1) }, await loadBrandFonts()));
  console.log(`Wrote ${out}: ${cases.length * perCase} labels, ${perCase} per case, cases of ${cases.join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
