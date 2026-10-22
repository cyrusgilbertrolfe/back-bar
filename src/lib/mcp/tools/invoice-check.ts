/**
 * MCP tools: the invoice price check (roadmap week 6), run natively in Back Bar.
 *
 * The daily capture task reads cocktails@ through the Superhuman connector and
 * hands each supplier message to Back Bar here, so it needs no code checkout,
 * git or npm on the Mini (Cyrus, 22 Oct 2026: "the closer it is to a native
 * Back Bar process, the better"). The same planCapture/recordCapture as
 * `npm run invoice-check` do the work, so the fee rules are applied in one
 * place. The run's instructions: Lifemaxxing, Domains/Cocktails/Back Bar,
 * "Invoice check capture - the standing instruction [Living reference]".
 *
 * Submitting a message writes only to the invoice check's own tables. No tool
 * here writes a component price: that happens when Cyrus approves a row on
 * /finances/invoice-check.
 */

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { inboundMessages } from "@/db/schema";
import { INVOICE_CHECK_JOB, lastCronRuns, recordCronRun } from "@/lib/erp/cron-runs";
import { parseCapture } from "@/lib/erp/invoice-check/extraction";
import { listInvoices } from "@/lib/erp/invoice-check/list";
import { planCapture, recordCapture, type Plan } from "@/lib/erp/invoice-check/propose";
import type { ToolDefinition } from "../types";

const pct = (x: number | null) => (x === null ? null : `${x > 0 ? "+" : ""}${x.toFixed(1)}%`);

/** What a plan means, in the terms the run reports: proposals, urgent items, things to rule. */
function summarise(plan: Plan) {
  const inv = plan.capture.invoice;
  if (!inv) return { kind: plan.capture.message.kind, invoice: null };
  const urgent: string[] = [];
  if (plan.urgentReason) urgent.push(plan.urgentReason);
  for (const p of plan.lines) {
    if (p.proposal?.urgent) {
      urgent.push(
        p.proposal.flag === "pack_size_changed"
          ? `${p.componentName}: pack size changed`
          : `${p.componentName}: ${pct(p.proposal.changePct)}`,
      );
    }
  }
  return {
    kind: plan.capture.message.kind,
    invoice: `${inv.supplierName} ${inv.invoiceRef}`,
    skipped: plan.skip,
    reconciles: plan.reconciles,
    lineSum: Number(plan.lineSum.toFixed(2)),
    proposals: plan.lines
      .filter((p) => p.proposal)
      .map((p) => ({
        line: p.line.lineNo,
        component: p.componentName,
        match: p.matchNote,
        goodsPerPack: p.proposal!.goodsCost,
        feesPerPack: p.proposal!.feesCost,
        packSize: p.proposal!.packSize,
        unitCostNow: p.proposal!.currentUnitCost,
        unitCostProposed: p.proposal!.proposedUnitCost,
        change: pct(p.proposal!.changePct),
        flag: p.proposal!.flag,
        urgent: p.proposal!.urgent,
      })),
    urgent,
    forCyrus: plan.lines.filter((p) => p.issue).map((p) => ({ line: p.line.lineNo, description: p.line.description, issue: p.issue })),
  };
}

export const invoiceCheckTools: ToolDefinition[] = [
  {
    name: "get_invoice_check_status",
    title: "Invoice check: status",
    description:
      "Where the invoice price check stands: the newest supplier message already captured (start the next " +
      "mailbox read from there), the last capture run, how many proposed prices are waiting for Cyrus, and " +
      "every urgent item (a rise of 10% or more, a changed pack size, an invoice that does not reconcile, a " +
      "dispute) and every line he must rule on. Read only.",
    access: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => {
      const [[newest], runs, invoices] = await Promise.all([
        db
          .select({ receivedAt: inboundMessages.receivedAt, messageId: inboundMessages.messageId })
          .from(inboundMessages)
          .orderBy(desc(inboundMessages.receivedAt))
          .limit(1),
        lastCronRuns(INVOICE_CHECK_JOB),
        listInvoices({ includeClosed: false }),
      ]);
      return {
        newestCapturedMessage: newest ? { receivedAt: newest.receivedAt.toISOString(), messageId: newest.messageId } : null,
        lastRun: runs.last
          ? { at: runs.last.ranAt.toISOString(), ok: runs.last.ok, messages: runs.last.checked, proposals: runs.last.written, error: runs.last.error }
          : null,
        pricesWaiting: invoices.reduce((n, i) => n + i.pending, 0),
        urgent: invoices
          .filter((i) => i.urgent && (i.pending > 0 || i.status === "unreadable"))
          .map((i) => ({
            invoice: `${i.supplierName} ${i.invoiceRef}`,
            date: i.invoiceDate,
            reason: i.urgentReason,
            lines: i.lines
              .filter((l) => l.proposal?.urgent && (l.proposal.status === "pending" || l.proposal.status === "queried"))
              .map((l) =>
                l.proposal!.flag === "pack_size_changed"
                  ? `${l.componentName}: pack size changed`
                  : `${l.componentName}: ${pct(l.proposal!.changePct === null ? null : Number(l.proposal!.changePct))}`,
              ),
          })),
        forCyrus: invoices.flatMap((i) =>
          i.lines.filter((l) => l.issue).map((l) => ({ invoice: `${i.supplierName} ${i.invoiceRef}`, line: l.lineNo, issue: l.issue })),
        ),
        page: "https://admin.myattsfields.com/finances/invoice-check",
      };
    },
  },
  {
    name: "submit_supplier_message",
    title: "Invoice check: submit a supplier message",
    description:
      "Hand Back Bar one supplier message read from cocktails@, and, if it carries an invoice, that invoice " +
      "read into its printed lines. Back Bar records the message once (purchase tracking reads quotes, " +
      "confirmations and delivery notes from the same record), checks the lines add up to the printed net, " +
      "applies the fee rules (fees printed against items go to them, other fees and pallets by goods value, " +
      "duty into the goods cost, EPR never a fee) and puts a proposed price for each matched goods line on " +
      "Cyrus's approval list. It never writes a component price. An invoice already on the list is skipped. " +
      "Use dry_run first to see what would be proposed. The `capture` shape: { message: { messageId, " +
      "threadId, mailbox, from, subject, receivedAt (ISO), kind: invoice|credit_note|quote|" +
      "order_confirmation|delivery_note|statement|other, supplierName, bodyText, attachmentNames[] }, " +
      "invoice: null | { supplierName, invoiceRef, invoiceDate (YYYY-MM-DD), orderRef, attachmentName, " +
      "netTotal, vat, total, disputeNote, lines: [ { lineNo, code, description, qty, packUnit, lineTotal " +
      "(ex VAT, always the line total), kind: goods|fee|pallet|duty|epr|zero|other, feeAppliesTo (fee, " +
      "pallet or duty only: line numbers it is printed against, null for none in particular, or " +
      "\"unclear\"), match (goods only, or null when unsure): { componentId, packsPerUnit, packSize, " +
      "reason } } ] } }.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        capture: { type: "object", description: "The message and its invoice, in the shape described above." },
        dry_run: { type: "boolean", description: "Plan and report without writing anything." },
      },
      required: ["capture"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const capture = parseCapture(args.capture);
      const plan = await planCapture(capture);
      const summary = summarise(plan);
      if (args.dry_run === true || args.dry_run === "true") return { dryRun: true, ...summary };
      const written = await recordCapture(plan);
      return { dryRun: false, messageCaptured: written.messageCaptured, proposalsWritten: written.proposals, ...summary };
    },
  },
  {
    name: "record_invoice_check_run",
    title: "Invoice check: record the run",
    description:
      "Close a capture run: record whether it succeeded, how many supplier messages it submitted and how " +
      "many prices it proposed, or the error that stopped it. Call it once at the end of every run, quiet " +
      "days and failures included, so a run that did not happen can be told from a quiet one.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        messages: { type: "number", description: "Supplier messages submitted this run." },
        proposals: { type: "number", description: "Prices proposed this run." },
        error: { type: "string", description: "What stopped or troubled the run, if anything." },
      },
      required: ["ok"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const n = (k: string) => (typeof args[k] === "number" ? (args[k] as number) : undefined);
      await recordCronRun({
        job: INVOICE_CHECK_JOB,
        ok: args.ok === true,
        checked: n("messages"),
        written: n("proposals"),
        error: typeof args.error === "string" && args.error.trim() ? args.error.trim() : undefined,
      });
      return { recorded: true };
    },
  },
];
