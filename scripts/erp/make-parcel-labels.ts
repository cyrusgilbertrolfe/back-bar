/**
 * Box labels for a parcel order, without running the app: the same code as the
 * order page's buttons. First DUGD-DN00004 to DuGARD by Royal Mail (15 Nov 2026).
 *
 * Writes two Zebra 4 × 6 PDFs, one label per box each: the covert label for
 * the outside, and the contents label for inside, on top of the bottles. The
 * boxes come from the lines (src/lib/erp/order-parcels.ts). Read-only.
 *
 *   npx tsx --env-file=.env.local scripts/erp/make-parcel-labels.ts <orderNumber> [--out-dir=outputs]
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { boxBottles, boxContentsFacts, boxProduct, loadParcelOrder } from "../../src/lib/erp/order-parcels";
import { buildCovertBoxLabelsPdf, buildShipmentCaseLabelsPdf } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const orderNumber = process.argv[2];
  if (!orderNumber || orderNumber.startsWith("--")) throw new Error("Pass the order number, e.g. DUGD-DN00004.");
  const outDir = arg("out-dir") ?? "outputs";

  const order = await loadParcelOrder({ orderNumber });
  if (!order) throw new Error(`No order ${orderNumber}.`);
  const { plan } = order;
  if (plan.problems.length || !plan.boxes.length)
    throw new Error(`Cannot label ${orderNumber}:\n- ${(plan.problems.length ? plan.problems : ["It has no lines."]).join("\n- ")}`);
  if (order.shippingMethod !== "parcel") console.warn(`Note: ${orderNumber} goes on a pallet, by choice or because it is more than ten boxes.`);

  const fonts = await loadBrandFonts();
  const outside = path.join(outDir, `Box labels ${orderNumber} - outside.pdf`);
  const inside = path.join(outDir, `Box labels ${orderNumber} - inside.pdf`);
  await writeFile(outside, await buildCovertBoxLabelsPdf({ orderNumber, recipient: order.customerName, boxes: plan.boxes.length }, {}, fonts));
  await writeFile(inside, await buildShipmentCaseLabelsPdf(boxContentsFacts(plan, order), {}, fonts));

  console.log(`${orderNumber}, ${order.customerName}: ${plan.boxes.length} boxes`);
  plan.boxes.forEach((b, i) => console.log(`  Box ${i + 1}: ${boxBottles(b)} of ${b.capacity}, ${boxProduct(b)}`));
  plan.notes.forEach((n) => console.log(`  Note: ${n}`));
  console.log(`Wrote ${outside}\nWrote ${inside}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
