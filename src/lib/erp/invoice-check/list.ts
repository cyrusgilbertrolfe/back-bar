/**
 * The approval list as the page reads it: invoices with their lines and
 * proposals, urgent first, then oldest first, so Thursday's Weekly works down a
 * week of mail in the order it arrived.
 */

import { asc, desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  components,
  inboundMessages,
  priceProposals,
  supplierInvoiceLines,
  supplierInvoices,
  type PriceProposal,
  type SupplierInvoice,
  type SupplierInvoiceLine,
} from "@/db/schema";

export interface ListedLine extends SupplierInvoiceLine {
  componentName: string | null;
  proposal: PriceProposal | null;
}

export interface ListedInvoice extends SupplierInvoice {
  threadId: string | null;
  mailbox: string | null;
  lines: ListedLine[];
  urgent: boolean;
  pending: number;
}

export async function listInvoices(opts: { includeClosed: boolean }): Promise<ListedInvoice[]> {
  const invoices = await db
    .select()
    .from(supplierInvoices)
    .where(inArray(supplierInvoices.status, opts.includeClosed ? ["open", "unreadable", "closed"] : ["open", "unreadable"]))
    .orderBy(asc(supplierInvoices.invoiceDate), asc(supplierInvoices.id));
  if (invoices.length === 0) return [];

  const ids = invoices.map((i) => i.id);
  const lines = await db
    .select()
    .from(supplierInvoiceLines)
    .where(inArray(supplierInvoiceLines.invoiceId, ids))
    .orderBy(asc(supplierInvoiceLines.lineNo));
  const lineIds = lines.map((l) => l.id);
  const proposals = lineIds.length
    ? await db.select().from(priceProposals).where(inArray(priceProposals.invoiceLineId, lineIds)).orderBy(desc(priceProposals.id))
    : [];
  const compIds = [...new Set(lines.map((l) => l.componentId).filter((x): x is number => x !== null))];
  const comps = compIds.length
    ? await db.select({ id: components.id, name: components.name }).from(components).where(inArray(components.id, compIds))
    : [];
  const msgIds = invoices.map((i) => i.inboundMessageId).filter((x): x is number => x !== null);
  const msgs = msgIds.length
    ? await db
        .select({ id: inboundMessages.id, threadId: inboundMessages.threadId, mailbox: inboundMessages.mailbox })
        .from(inboundMessages)
        .where(inArray(inboundMessages.id, msgIds))
    : [];

  const nameById = new Map(comps.map((c) => [c.id, c.name]));
  const proposalByLine = new Map(proposals.map((p) => [p.invoiceLineId, p]));
  const msgById = new Map(msgs.map((m) => [m.id, m]));

  const listed = invoices.map((inv) => {
    const own = lines
      .filter((l) => l.invoiceId === inv.id)
      .map((l) => ({
        ...l,
        componentName: l.componentId === null ? null : (nameById.get(l.componentId) ?? null),
        proposal: proposalByLine.get(l.id) ?? null,
      }));
    const open = own.filter((l) => l.proposal && (l.proposal.status === "pending" || l.proposal.status === "queried"));
    const msg = inv.inboundMessageId === null ? undefined : msgById.get(inv.inboundMessageId);
    return {
      ...inv,
      threadId: msg?.threadId ?? null,
      mailbox: msg?.mailbox ?? null,
      lines: own,
      pending: open.length,
      urgent: inv.urgentReason !== null || open.some((l) => l.proposal!.urgent),
    };
  });
  return listed.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
