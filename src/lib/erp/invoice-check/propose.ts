/**
 * The propose step: one captured message in, and if it carries an invoice, its
 * lines and a price proposal for each matched goods line out. Writes only to
 * the invoice check's own tables; a price reaches component_price_history only
 * when Cyrus approves it (actions.ts on /finances/invoice-check).
 *
 * `planCapture` reads and computes; `recordCapture` writes what it planned.
 * The split is what makes a dry run honest: it prints exactly what would be
 * written.
 */

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  componentPriceHistory,
  inboundMessages,
  priceProposals,
  supplierInvoiceLines,
  supplierInvoices,
  supplierItemMap,
} from "@/db/schema";

import type { Capture, ExtractedLine } from "./extraction";
import { apportionFees, flagProposal, reconciles, type ProposalFlag } from "./rules";

export interface PlannedLine {
  line: ExtractedLine;
  componentId: number | null;
  componentName: string | null;
  packsPerUnit: number | null;
  packSize: number | null;
  matchNote: string | null;
  issue: string | null;
  proposal: PlannedProposal | null;
}

export interface PlannedProposal {
  componentId: number;
  packSize: number;
  goodsCost: number;
  feesCost: number;
  feesNote: string | null;
  currentUnitCost: number | null;
  proposedUnitCost: number;
  changePct: number | null;
  flag: ProposalFlag;
  urgent: boolean;
}

export interface Plan {
  capture: Capture;
  /** Set when there is nothing to write for the invoice: already captured. */
  skip: string | null;
  reconciles: boolean;
  lineSum: number;
  urgentReason: string | null;
  lines: PlannedLine[];
}

const round4 = (x: number) => Math.round(x * 10000) / 10000;

export async function planCapture(capture: Capture): Promise<Plan> {
  const inv = capture.invoice;
  const empty: Plan = { capture, skip: null, reconciles: true, lineSum: 0, urgentReason: null, lines: [] };
  if (!inv) return empty;

  const [existing] = await db
    .select({ id: supplierInvoices.id })
    .from(supplierInvoices)
    .where(and(eq(supplierInvoices.supplierName, inv.supplierName), eq(supplierInvoices.invoiceRef, inv.invoiceRef)))
    .limit(1);
  if (existing) return { ...empty, skip: `${inv.supplierName} ${inv.invoiceRef} is already on the list` };

  const rec = reconciles(inv.lines, inv.netTotal);

  // Known supplier codes first; Claude's reading only where the code is new.
  const codes = inv.lines.map((l) => l.code).filter((c): c is string => !!c);
  const known = codes.length
    ? await db
        .select()
        .from(supplierItemMap)
        .where(and(eq(supplierItemMap.supplierName, inv.supplierName), inArray(supplierItemMap.supplierCode, codes)))
    : [];
  const knownByCode = new Map(known.map((k) => [k.supplierCode, k]));

  const planned: PlannedLine[] = inv.lines.map((line) => {
    const p: PlannedLine = {
      line,
      componentId: null,
      componentName: null,
      packsPerUnit: null,
      packSize: null,
      matchNote: null,
      issue: null,
      proposal: null,
    };
    if (line.kind !== "goods") return p;
    const k = line.code ? knownByCode.get(line.code) : undefined;
    if (k) {
      p.componentId = k.componentId;
      p.packsPerUnit = Number(k.packsPerUnit);
      p.packSize = Number(k.packSize);
      p.matchNote = `Supplier code ${line.code}, confirmed ${k.confirmedAt.toISOString().slice(0, 10)}`;
    } else if (line.match) {
      p.componentId = line.match.componentId;
      p.packsPerUnit = line.match.packsPerUnit;
      p.packSize = line.match.packSize;
      p.matchNote = `Claude's reading, unconfirmed: ${line.match.reason}`;
    } else {
      p.issue = "No component in Back Bar matched this line.";
    }
    if (line.lineTotal <= 0) p.issue = "A goods line at £0 or less is never a price.";
    else if (p.componentId !== null && !(line.qty && line.qty > 0)) p.issue = "No quantity, so no price per pack.";
    return p;
  });

  const { shares, duty, issues } = apportionFees(inv.lines);
  for (const p of planned) {
    const why = issues.get(p.line.lineNo);
    if (why) p.issue = why;
  }
  const ruleIssues = issues.size > 0;

  const ids = [...new Set(planned.map((p) => p.componentId).filter((x): x is number => x !== null))];
  const comps = ids.length ? await db.select().from(components).where(inArray(components.id, ids)) : [];
  const compById = new Map(comps.map((c) => [c.id, c]));
  const history = ids.length
    ? await db
        .select()
        .from(componentPriceHistory)
        .where(inArray(componentPriceHistory.componentId, ids))
        .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id))
    : [];
  const invoiceBacked = new Set(
    (ids.length
      ? await db
          .select({ componentId: componentPriceHistory.componentId })
          .from(componentPriceHistory)
          .where(and(inArray(componentPriceHistory.componentId, ids), isNotNull(componentPriceHistory.invoiceRef)))
      : []
    ).map((r) => r.componentId),
  );

  for (const p of planned) {
    if (p.componentId === null) continue;
    const c = compById.get(p.componentId);
    if (!c) {
      p.issue = `Component ${p.componentId} does not exist.`;
      p.componentId = null;
      continue;
    }
    p.componentName = c.name;
    if (p.issue) continue;
    // The invoice's prices wait while any line on it is outside the rules or
    // its lines don't add up: a guessed fee is a wrong price.
    if (!rec.ok) {
      p.issue = "Waits: the invoice's lines don't add up to its printed net.";
      continue;
    }
    if (ruleIssues) {
      p.issue = `Waits for your ruling on line ${[...issues.keys()].join(", ")}, since it may change this price.`;
      continue;
    }

    const packs = p.line.qty! * p.packsPerUnit!;
    const share = shares.get(p.line.lineNo)!;
    const dutyShare = duty.get(p.line.lineNo)!;
    // Duty printed apart is part of what the goods cost, not a fee.
    const goodsCost = round4((p.line.lineTotal + dutyShare.amount) / packs);
    const feesCost = round4(share.amount / packs);
    const proposedUnitCost = round4((goodsCost + feesCost) / p.packSize!);
    const newest = history.find((h) => h.componentId === c.id);
    const { flag, changePct, urgent } = flagProposal(
      {
        packSize: c.packSize === null ? null : Number(c.packSize),
        unitCost: Number(c.unitCost),
        goodsCost: newest?.goodsCost == null ? null : Number(newest.goodsCost),
        effectiveDate: newest?.effectiveDate ?? null,
        invoiceBacked: invoiceBacked.has(c.id),
      },
      { packSize: p.packSize!, goodsCost, unitCost: proposedUnitCost, effectiveDate: inv.invoiceDate },
    );
    p.proposal = {
      componentId: c.id,
      packSize: p.packSize!,
      goodsCost,
      feesCost,
      feesNote:
        [
          dutyShare.parts.length ? `Goods include duty: ${dutyShare.parts.join("; ")}` : null,
          share.parts.length ? `${share.parts.join("; ")}` : null,
        ]
          .filter(Boolean)
          .join("; ") + (dutyShare.parts.length || share.parts.length ? `; over ${packs} packs` : "") || null,
      currentUnitCost: Number(c.unitCost),
      proposedUnitCost,
      changePct: changePct === null ? null : Math.round(changePct * 100) / 100,
      flag,
      urgent,
    };
  }

  const reasons: string[] = [];
  if (!rec.ok) {
    reasons.push(`Lines add to £${rec.sum.toFixed(2)}, not the printed net £${inv.netTotal.toFixed(2)}: not read reliably.`);
  }
  if (inv.disputeNote) reasons.push(inv.disputeNote);

  return {
    capture,
    skip: null,
    reconciles: rec.ok,
    lineSum: rec.sum,
    urgentReason: reasons.length ? reasons.join(" ") : null,
    lines: planned,
  };
}

export interface Recorded {
  messageCaptured: boolean;
  invoiceId: number | null;
  proposals: number;
}

/** Write a plan. The message is captured even when its invoice is skipped. */
export async function recordCapture(plan: Plan): Promise<Recorded> {
  const m = plan.capture.message;
  const inserted = await db
    .insert(inboundMessages)
    .values({
      messageId: m.messageId,
      threadId: m.threadId,
      mailbox: m.mailbox,
      fromAddress: m.from,
      subject: m.subject,
      receivedAt: new Date(m.receivedAt),
      kind: m.kind,
      supplierName: m.supplierName,
      bodyText: m.bodyText,
      attachmentNames: m.attachmentNames,
    })
    .onConflictDoNothing({ target: inboundMessages.messageId })
    .returning({ id: inboundMessages.id });
  const [msg] = inserted.length
    ? inserted
    : await db.select({ id: inboundMessages.id }).from(inboundMessages).where(eq(inboundMessages.messageId, m.messageId));

  const inv = plan.capture.invoice;
  if (!inv || plan.skip) return { messageCaptured: inserted.length > 0, invoiceId: null, proposals: 0 };

  const [invoice] = await db
    .insert(supplierInvoices)
    .values({
      inboundMessageId: msg.id,
      supplierName: inv.supplierName,
      invoiceRef: inv.invoiceRef,
      invoiceDate: inv.invoiceDate,
      orderRef: inv.orderRef,
      attachmentName: inv.attachmentName,
      netTotal: inv.netTotal.toFixed(2),
      vat: inv.vat?.toFixed(2) ?? null,
      total: inv.total?.toFixed(2) ?? null,
      reconciles: plan.reconciles,
      status: plan.reconciles ? "open" : "unreadable",
      urgentReason: plan.urgentReason,
    })
    .returning({ id: supplierInvoices.id });

  let proposals = 0;
  try {
    for (const p of plan.lines) {
      const [line] = await db
        .insert(supplierInvoiceLines)
        .values({
          invoiceId: invoice.id,
          lineNo: p.line.lineNo,
          supplierCode: p.line.code,
          description: p.line.description,
          qty: p.line.qty?.toString() ?? null,
          packUnit: p.line.packUnit,
          lineTotal: p.line.lineTotal.toFixed(2),
          kind: p.line.kind,
          feeAppliesTo: Array.isArray(p.line.feeAppliesTo) ? p.line.feeAppliesTo : null,
          componentId: p.componentId,
          packsPerUnit: p.packsPerUnit?.toString() ?? null,
          packSize: p.packSize?.toString() ?? null,
          matchNote: p.matchNote,
          issue: p.issue,
        })
        .returning({ id: supplierInvoiceLines.id });
      if (!p.proposal) continue;
      const q = p.proposal;
      await db.insert(priceProposals).values({
        invoiceLineId: line.id,
        componentId: q.componentId,
        effectiveDate: inv.invoiceDate,
        packSize: q.packSize.toString(),
        goodsCost: q.goodsCost.toFixed(4),
        feesCost: q.feesCost.toFixed(4),
        feesNote: q.feesNote,
        currentUnitCost: q.currentUnitCost?.toFixed(4) ?? null,
        proposedUnitCost: q.proposedUnitCost.toFixed(4),
        changePct: q.changePct?.toFixed(2) ?? null,
        flag: q.flag,
        urgent: q.urgent,
      });
      proposals++;
    }
  } catch (err) {
    // No transactions on the HTTP driver: take the half-written invoice out
    // again (its lines and proposals cascade) so the next run starts clean.
    await db.delete(supplierInvoices).where(eq(supplierInvoices.id, invoice.id));
    throw err;
  }
  return { messageCaptured: inserted.length > 0, invoiceId: invoice.id, proposals };
}
