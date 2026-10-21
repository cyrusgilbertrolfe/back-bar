"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  priceProposals,
  supplierInvoiceLines,
  supplierInvoices,
  supplierItemMap,
} from "@/db/schema";
import { newerPriceThan, writeComponentPrice } from "@/lib/erp/price-writer";

const PATH = "/finances/invoice-check";
const OPEN = ["pending", "queried"] as const;

/** Close an invoice once nothing on it is waiting. */
async function closeIfDecided(invoiceId: number) {
  const lines = await db
    .select({ id: supplierInvoiceLines.id })
    .from(supplierInvoiceLines)
    .where(eq(supplierInvoiceLines.invoiceId, invoiceId));
  const waiting = lines.length
    ? await db
        .select({ id: priceProposals.id })
        .from(priceProposals)
        .where(and(inArray(priceProposals.invoiceLineId, lines.map((l) => l.id)), inArray(priceProposals.status, [...OPEN])))
    : [];
  if (waiting.length === 0) {
    await db
      .update(supplierInvoices)
      .set({ status: "closed" })
      .where(and(eq(supplierInvoices.id, invoiceId), eq(supplierInvoices.status, "open")));
  }
}

/**
 * Approve one proposal: write it through the component form's own price
 * writer, dated the invoice date, and remember the supplier's code for next
 * time. Refused if a newer price is already in use, since an older invoice
 * must not overwrite it.
 */
async function approve(id: number): Promise<number> {
  const [row] = await db
    .select({ p: priceProposals, line: supplierInvoiceLines, inv: supplierInvoices, c: components })
    .from(priceProposals)
    .innerJoin(supplierInvoiceLines, eq(priceProposals.invoiceLineId, supplierInvoiceLines.id))
    .innerJoin(supplierInvoices, eq(supplierInvoiceLines.invoiceId, supplierInvoices.id))
    .innerJoin(components, eq(priceProposals.componentId, components.id))
    .where(eq(priceProposals.id, id))
    .limit(1);
  if (!row) throw new Error(`Proposal ${id} not found`);
  const { p, line, inv, c } = row;
  if (!(OPEN as readonly string[]).includes(p.status)) throw new Error(`Proposal ${id} is already ${p.status}`);
  if (p.flag === "older_than_current") throw new Error("A newer price is already in use; this invoice can't replace it.");
  const newer = await newerPriceThan(c.id, p.effectiveDate);
  if (newer) {
    throw new Error(`${c.name} has a newer price, dated ${newer.effectiveDate}; this invoice can't replace it.`);
  }

  const historyId = await writeComponentPrice({
    componentId: c.id,
    componentName: c.name,
    supplierId: c.defaultSupplierId,
    uom: c.uom,
    packSize: p.packSize,
    goodsCost: p.goodsCost,
    feesCost: p.feesCost,
    feesNote: p.feesNote,
    invoice: { invoiceSupplier: inv.supplierName, invoiceRef: inv.invoiceRef },
    effectiveDate: p.effectiveDate,
    notes:
      p.flag === "confirmed"
        ? `Price confirmed by invoice, approved from the invoice check: line ${line.lineNo}, "${line.description}"`
        : `Invoice check, approved: line ${line.lineNo}, "${line.description}"; ${p.packSize}${c.uom} @ £${(Number(p.goodsCost) + Number(p.feesCost)).toFixed(4)}`,
    updateComponent: true,
  });

  if (line.supplierCode && line.packsPerUnit && line.packSize) {
    await db
      .insert(supplierItemMap)
      .values({
        supplierName: inv.supplierName,
        supplierCode: line.supplierCode,
        description: line.description,
        componentId: c.id,
        packsPerUnit: line.packsPerUnit,
        packSize: line.packSize,
      })
      .onConflictDoUpdate({
        target: [supplierItemMap.supplierName, supplierItemMap.supplierCode],
        set: { componentId: c.id, packsPerUnit: line.packsPerUnit, packSize: line.packSize, confirmedAt: new Date() },
      });
  }

  await db
    .update(priceProposals)
    .set({ status: "approved", decidedAt: new Date(), priceHistoryId: historyId })
    .where(eq(priceProposals.id, id));
  return inv.id;
}

export async function approveProposal(id: number) {
  const invoiceId = await approve(id);
  await closeIfDecided(invoiceId);
  revalidatePath(PATH);
}

/** Every pending "confirmed by invoice" row on one invoice: the routine ones. */
export async function approveConfirmed(invoiceId: number) {
  const rows = await db
    .select({ id: priceProposals.id })
    .from(priceProposals)
    .innerJoin(supplierInvoiceLines, eq(priceProposals.invoiceLineId, supplierInvoiceLines.id))
    .where(
      and(
        eq(supplierInvoiceLines.invoiceId, invoiceId),
        eq(priceProposals.status, "pending"),
        eq(priceProposals.flag, "confirmed"),
      ),
    );
  for (const r of rows) await approve(r.id);
  await closeIfDecided(invoiceId);
  revalidatePath(PATH);
}

async function decide(id: number, status: "rejected" | "queried", form: FormData) {
  const note = String(form.get("note") ?? "").trim() || null;
  const [p] = await db
    .update(priceProposals)
    .set({ status, decidedAt: status === "rejected" ? new Date() : null, decisionNote: note })
    .where(and(eq(priceProposals.id, id), inArray(priceProposals.status, [...OPEN])))
    .returning({ lineId: priceProposals.invoiceLineId });
  if (!p) throw new Error(`Proposal ${id} is not waiting for a decision`);
  const [line] = await db
    .select({ invoiceId: supplierInvoiceLines.invoiceId })
    .from(supplierInvoiceLines)
    .where(eq(supplierInvoiceLines.id, p.lineId));
  await closeIfDecided(line.invoiceId);
  revalidatePath(PATH);
}

export async function rejectProposal(id: number, form: FormData) {
  await decide(id, "rejected", form);
}

/** Taken up with the supplier before paying. Still undecided; stays on the list. */
export async function queryProposal(id: number, form: FormData) {
  await decide(id, "queried", form);
}
