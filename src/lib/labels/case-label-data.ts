/**
 * The facts a case label prints, resolved from an order line.
 *
 * Object model (Cyrus, 19 Sep 2026): the drink is ours; the SKU is that drink
 * for one client in one format, and carries the client's name for it; the
 * order line says how many cases of that SKU on which PO. The label comes
 * from the order line and inherits the product's identity from the SKU.
 *
 * The order line keeps its own verbatim copy of what the PO says. When the two
 * disagree the label is refused, not printed with one of them picked: that
 * disagreement is exactly how the Case 6 / Case 12 error of 2 Sep 2026 would
 * have been caught before 84 wrong labels went on 42 boxes.
 */

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { clients, customers, skus, wholesaleOrderLines, wholesaleOrders } from "@/db/schema";

import type { CaseLabelFacts } from "./case-labels";

export type CaseLabelLine = {
  lineId: number;
  orderNumber: string;
  customerName: string;
  raisedOn: string | null;
  status: string;
  cases: number;
  skuCode: string;
  facts: CaseLabelFacts | null;
  /** Why this line cannot be labelled. Empty means it can. */
  problems: string[];
};

/** The short caption prefix, "F&M" for Fortnum's. */
function clientShortName(customerName: string): string {
  return /fortnum/i.test(customerName) ? "F&M" : customerName;
}

/** Quote marks differ between a PO PDF and a keyboard; nothing else may. */
function sameText(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

const lineQuery = () =>
  db
    .select({
      lineId: wholesaleOrderLines.id,
      qty: wholesaleOrderLines.qty,
      lineItemCode: wholesaleOrderLines.customerItemCode,
      lineDescription: wholesaleOrderLines.customerDescription,
      lineUnitsPerCase: wholesaleOrderLines.unitsPerCase,
      orderNumber: wholesaleOrders.orderNumber,
      raisedOn: wholesaleOrders.raisedOn,
      status: wholesaleOrders.status,
      customerName: customers.name,
      accountCode: customers.accountCode,
      skuCode: skus.code,
      shortCode: skus.shortCode,
      skuItemCode: skus.customerItemCode,
      skuDescription: skus.customerDescription,
      skuUnitsPerCase: skus.unitsPerCase,
    })
    .from(wholesaleOrderLines)
    .innerJoin(wholesaleOrders, eq(wholesaleOrders.id, wholesaleOrderLines.orderId))
    .innerJoin(customers, eq(customers.id, wholesaleOrders.customerId))
    .innerJoin(skus, eq(skus.id, wholesaleOrderLines.skuId));

type Row = Awaited<ReturnType<ReturnType<typeof lineQuery>["execute"]>>[number];

function resolve(r: Row): CaseLabelLine {
  const problems: string[] = [];
  const cases = Number(r.qty);
  if (!Number.isInteger(cases)) problems.push(`The order line is for ${r.qty} cases, which is not a whole number.`);

  if (!r.shortCode) problems.push("The SKU has no short code (supplier SKU).");
  if (!r.skuItemCode) problems.push("The SKU has no customer product reference.");
  if (!r.skuDescription) problems.push("The SKU has no customer product description.");
  if (!r.skuUnitsPerCase) problems.push("The SKU has no case quantity.");

  if (r.skuItemCode && r.lineItemCode && r.skuItemCode !== r.lineItemCode)
    problems.push(`The PO says product ${r.lineItemCode}; the SKU says ${r.skuItemCode}.`);
  if (r.skuDescription && r.lineDescription && !sameText(r.skuDescription, r.lineDescription))
    problems.push(`The PO describes it as "${r.lineDescription}"; the SKU says "${r.skuDescription}".`);
  if (r.skuUnitsPerCase && r.lineUnitsPerCase && r.skuUnitsPerCase !== r.lineUnitsPerCase)
    problems.push(`The PO is for cases of ${r.lineUnitsPerCase}; the SKU says cases of ${r.skuUnitsPerCase}.`);

  const facts: CaseLabelFacts | null =
    r.shortCode && r.skuItemCode && r.skuDescription && r.skuUnitsPerCase
      ? {
          purchaseOrder: r.orderNumber,
          customerItemCode: r.skuItemCode,
          customerDescription: r.skuDescription,
          supplierSku: r.shortCode,
          unitsPerCase: r.skuUnitsPerCase,
          supplierAccountCode: r.accountCode,
          clientShortName: clientShortName(r.customerName),
        }
      : null;

  return {
    lineId: r.lineId,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    raisedOn: r.raisedOn,
    status: r.status,
    cases,
    skuCode: r.skuCode,
    facts,
    problems,
  };
}

export async function getCaseLabelLine(lineId: number): Promise<CaseLabelLine | null> {
  const [row] = await lineQuery().where(eq(wholesaleOrderLines.id, lineId));
  return row ? resolve(row) : null;
}

export type ClientSkuIdentity = {
  skuId: number;
  code: string;
  clientName: string;
  shortCode: string | null;
  customerItemCode: string | null;
  customerDescription: string | null;
  unitsPerCase: number | null;
};

/** This drink's SKUs sold under a partner's name, i.e. everything but own-brand. */
export async function listClientSkus(drinkId: number): Promise<ClientSkuIdentity[]> {
  return db
    .select({
      skuId: skus.id,
      code: skus.code,
      clientName: clients.name,
      shortCode: skus.shortCode,
      customerItemCode: skus.customerItemCode,
      customerDescription: skus.customerDescription,
      unitsPerCase: skus.unitsPerCase,
    })
    .from(skus)
    .innerJoin(clients, eq(clients.id, skus.clientId))
    .where(and(eq(skus.drinkId, drinkId), eq(clients.isDefault, false), eq(skus.active, true)))
    .orderBy(skus.code);
}

/** Every order line with cases on it, for any SKU of this drink. */
export async function listCaseLabelLines(drinkId: number): Promise<CaseLabelLine[]> {
  const rows = await lineQuery()
    .where(and(eq(skus.drinkId, drinkId), gt(wholesaleOrderLines.qty, "0")))
    .orderBy(wholesaleOrders.raisedOn);
  return rows.map(resolve).reverse();
}
