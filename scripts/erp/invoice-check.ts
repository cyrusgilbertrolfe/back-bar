/**
 * The invoice price check's propose step (roadmap week 6, 21 Oct 2026).
 *
 * The daily capture on the Mini reads cocktails@ through the Superhuman
 * connector and writes one JSON capture per supplier message (the shape in
 * src/lib/erp/invoice-check/extraction.ts). Its instructions live in
 * Lifemaxxing, not here: Domains/Cocktails/Back Bar, "Invoice check capture -
 * the standing instruction [Living reference]". This reads the captures, records each
 * message once, and for an invoice writes its lines and a price proposal per
 * matched goods line to the approval list at /finances/invoice-check.
 *
 * Nothing is written to component_price_history: that happens only when Cyrus
 * approves a row. Every run, quiet or not, leaves a cron_runs row.
 *
 *   npm run invoice-check -- <capture.json | dir> ... [--dry-run]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { recordCronRun } from "@/lib/erp/cron-runs";
import { parseCapture } from "@/lib/erp/invoice-check/extraction";
import { planCapture, recordCapture, type Plan } from "@/lib/erp/invoice-check/propose";

export const INVOICE_CHECK_JOB = "invoice-check";

function files(args: string[]): string[] {
  return args.flatMap((a) =>
    statSync(a).isDirectory()
      ? readdirSync(a)
          .filter((f) => f.endsWith(".json"))
          .sort()
          .map((f) => join(a, f))
      : [a],
  );
}

const pct = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(1)}%`);

function report(plan: Plan): string[] {
  const inv = plan.capture.invoice;
  const m = plan.capture.message;
  if (!inv) return [`  message only (${m.kind}): ${m.subject ?? "(no subject)"}`];
  const out = [`  ${inv.supplierName} ${inv.invoiceRef}, ${inv.invoiceDate}, net £${inv.netTotal.toFixed(2)}`];
  if (plan.skip) return [...out, `    skipped: ${plan.skip}`];
  out.push(`    lines add to £${plan.lineSum.toFixed(2)}: ${plan.reconciles ? "reconciles" : "DOES NOT RECONCILE"}`);
  if (plan.urgentReason) out.push(`    URGENT: ${plan.urgentReason}`);
  for (const p of plan.lines) {
    const head = `    ${String(p.line.lineNo).padStart(2)} ${p.line.kind.padEnd(6)} £${p.line.lineTotal.toFixed(2).padStart(9)}  ${p.line.description}`;
    out.push(head);
    if (p.componentName) out.push(`         → ${p.componentName} [${p.matchNote}]`);
    if (p.proposal) {
      const q = p.proposal;
      out.push(
        `         goods £${q.goodsCost.toFixed(4)} + fees £${q.feesCost.toFixed(4)} per ${q.packSize}-pack;` +
          ` £/unit ${q.currentUnitCost?.toFixed(4) ?? "—"} → ${q.proposedUnitCost.toFixed(4)} (${pct(q.changePct)})` +
          ` ${q.flag.toUpperCase()}${q.urgent ? " URGENT" : ""}`,
      );
      if (q.feesNote) out.push(`         fees: ${q.feesNote}`);
    }
    if (p.issue) out.push(`         FOR CYRUS: ${p.issue}`);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const paths = files(args.filter((a) => a !== "--dry-run"));
  if (paths.length === 0) {
    console.error("Give one or more capture files or directories.");
    process.exit(1);
  }

  let captured = 0;
  let proposed = 0;
  try {
    for (const path of paths) {
      const capture = parseCapture(JSON.parse(readFileSync(path, "utf8")));
      const plan = await planCapture(capture);
      console.log(`${path}\n${report(plan).join("\n")}`);
      if (dryRun) continue;
      const r = await recordCapture(plan);
      if (r.messageCaptured) captured++;
      proposed += r.proposals;
    }
  } catch (err) {
    if (!dryRun) await recordCronRun({ job: INVOICE_CHECK_JOB, ok: false, checked: captured, written: proposed, error: String(err) });
    throw err;
  }

  if (dryRun) {
    console.log("\nDry run: nothing written.");
    return;
  }
  await recordCronRun({ job: INVOICE_CHECK_JOB, ok: true, checked: captured, written: proposed });
  console.log(`\n${captured} message${captured === 1 ? "" : "s"} captured, ${proposed} price${proposed === 1 ? "" : "s"} proposed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
