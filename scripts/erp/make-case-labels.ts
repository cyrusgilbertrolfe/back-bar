/**
 * Write case labels for one order line to a PDF, without running the app.
 * The same code as the drink page's download button.
 *
 *   npx tsx --env-file=.env.local scripts/erp/make-case-labels.ts <lineId> [--cases=N] [--start=N] [--out=path.pdf]
 *   npx tsx --env-file=.env.local scripts/erp/make-case-labels.ts calibration [--out=path.pdf]
 */

import { writeFile } from "node:fs/promises";

import { getCaseLabelLine } from "../../src/lib/labels/case-label-data";
import { buildCalibrationPdf, buildCaseLabelsPdf } from "../../src/lib/labels/case-labels";
import { loadBrandFonts } from "../../src/lib/labels/fonts";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

async function main() {
  const target = process.argv[2];
  if (!target) throw new Error("Pass an order line id, or 'calibration'.");
  const fonts = await loadBrandFonts();

  if (target === "calibration") {
    const out = arg("out") ?? "Case label calibration.pdf";
    await writeFile(out, await buildCalibrationPdf(fonts));
    console.log(`Wrote ${out}`);
    return;
  }

  const line = await getCaseLabelLine(Number(target));
  if (!line) throw new Error(`No order line ${target}.`);
  if (line.problems.length || !line.facts) {
    throw new Error(`Cannot print ${line.orderNumber}:\n- ${line.problems.join("\n- ")}`);
  }
  // A PO delivered in more than one shipment labels each shipment on its own,
  // CASE n OF this shipment, so Goods In can count each one complete.
  const cases = Number(arg("cases") ?? line.cases);
  if (!Number.isInteger(cases) || cases < 1 || cases > line.cases)
    throw new Error(`--cases must be a whole number from 1 to ${line.cases}, the cases on the line.`);
  const out = arg("out") ?? `Case labels ${line.orderNumber} ${line.facts.supplierSku}.pdf`;
  await writeFile(
    out,
    await buildCaseLabelsPdf(line.facts, { count: cases, startAt: Number(arg("start") ?? 1) }, fonts),
  );
  console.log(`Wrote ${out}: ${cases} labels, ${line.facts.orderNumber} ${line.facts.supplierSku}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
