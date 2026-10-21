/**
 * The invoice price check's arithmetic: fees apportioned under Cyrus's rules,
 * and each proposed price flagged against the price in use. Pure functions, no
 * database and no model, so the same invoice always lands the same way.
 *
 * The rules (Cyrus, 2 and 9 Oct 2026; thresholds 21 Oct 2026):
 * - A component's cost is landed: goods plus every fee on the invoice, ex VAT.
 * - A fee printed against particular items goes to those items, split between
 *   them by goods value; any other fee is split across all goods lines by value.
 * - Pallet charges are landed cost, under the same two rules.
 * - EPR is never a fee. £0 and FOC lines are never prices.
 * - Duty printed as its own line is part of the goods cost, not a fee: the
 *   supplier has paid it and it is simply what the spirit costs (Cyrus, 21 Oct
 *   2026, on Thames Distillers). It is targeted the same way a fee is.
 * - Anything else (discounts, credits, deposits) is not guessed: it goes to
 *   Cyrus to rule, and the invoice's prices wait with it.
 */

export type LineKind = "goods" | "fee" | "pallet" | "duty" | "epr" | "zero" | "other";

export interface RuleLine {
  lineNo: number;
  description: string;
  kind: LineKind;
  /** Ex VAT, as printed. */
  lineTotal: number;
  /** Fee, pallet or duty: the lines it is printed against; null for none in particular; "unclear" if unreadable. */
  feeAppliesTo?: number[] | null | "unclear";
}

export interface FeeShare {
  /** £ of fees this goods line carries, unrounded. */
  amount: number;
  /** How it was arrived at, for the fees note. */
  parts: string[];
}

export interface Apportioned {
  shares: Map<number, FeeShare>;
  /** Duty each goods line carries, which lands in its goods cost, not its fees. */
  duty: Map<number, FeeShare>;
  /** Lines the rules do not cover, keyed by line number, with why. */
  issues: Map<number, string>;
}

const gbp = (x: number) => `£${x.toFixed(2)}`;

export function apportionFees(lines: RuleLine[]): Apportioned {
  const goods = lines.filter((l) => l.kind === "goods");
  const shares = new Map<number, FeeShare>(goods.map((g) => [g.lineNo, { amount: 0, parts: [] }]));
  const duty = new Map<number, FeeShare>(goods.map((g) => [g.lineNo, { amount: 0, parts: [] }]));
  const issues = new Map<number, string>();

  for (const l of lines) {
    if (l.kind === "other") {
      issues.set(l.lineNo, "Not goods, a fee, a pallet, duty or EPR: the fee rules don't say how this lands.");
      continue;
    }
    if (l.kind !== "fee" && l.kind !== "pallet" && l.kind !== "duty") continue;
    if (l.lineTotal === 0) continue;
    if (l.lineTotal < 0) {
      issues.set(l.lineNo, `A negative ${l.kind === "duty" ? "duty line" : "fee"} (a credit or refund): the rules don't cover it.`);
      continue;
    }
    if (l.feeAppliesTo === "unclear") {
      issues.set(l.lineNo, "Can't tell which items this fee is printed against.");
      continue;
    }

    const against = Array.isArray(l.feeAppliesTo) && l.feeAppliesTo.length > 0 ? l.feeAppliesTo : null;
    const printedAgainst = against !== null;
    const targets = against ? goods.filter((g) => against.includes(g.lineNo)) : goods;
    if (targets.length === 0) {
      issues.set(
        l.lineNo,
        printedAgainst
          ? `Printed against line${against.length === 1 ? "" : "s"} ${against.join(", ")}, which ${against.length === 1 ? "is" : "are"} not goods on this invoice.`
          : "A fee on an invoice with no goods lines.",
      );
      continue;
    }
    const base = targets.reduce((s, g) => s + g.lineTotal, 0);
    if (base <= 0) {
      issues.set(l.lineNo, "The goods it applies to total £0, so it can't be split by value.");
      continue;
    }
    const basis = printedAgainst
      ? targets.length === 1
        ? "printed against this line"
        : `printed against lines ${targets.map((t) => t.lineNo).join(", ")}, by value`
      : `over ${gbp(base)} goods, by value`;
    for (const g of targets) {
      const amount = (l.lineTotal * g.lineTotal) / base;
      const share = (l.kind === "duty" ? duty : shares).get(g.lineNo)!;
      share.amount += amount;
      share.parts.push(`${l.description} ${gbp(l.lineTotal)}, ${basis}: ${gbp(amount)}`);
    }
  }
  return { shares, duty, issues };
}

// ─── Flags ──────────────────────────────────────────────────────────────────

/** Within this, with the goods price unchanged, a price is confirmed by invoice. */
export const CONFIRMED_WITHIN = 0.01;
/** At or above this, either way, a move is flagged "moved"; a rise this big is urgent. */
export const MOVED_AT = 0.1;

export type ProposalFlag =
  | "new"
  | "confirmed"
  | "changed"
  | "moved"
  | "pack_size_changed"
  | "older_than_current";

export interface InUse {
  packSize: number | null;
  unitCost: number | null;
  /** Goods per pack on the newest price row, when it was entered split. */
  goodsCost: number | null;
  /** Newest price row's effective date, YYYY-MM-DD. */
  effectiveDate: string | null;
  /** Any price row for this component names an invoice. */
  invoiceBacked: boolean;
}

export interface Proposed {
  packSize: number;
  goodsCost: number;
  unitCost: number;
  effectiveDate: string;
}

export function flagProposal(inUse: InUse, p: Proposed): { flag: ProposalFlag; changePct: number | null; urgent: boolean } {
  const changePct =
    inUse.unitCost && inUse.unitCost > 0 ? ((p.unitCost - inUse.unitCost) / inUse.unitCost) * 100 : null;
  const bigMove = changePct !== null && Math.abs(changePct) >= MOVED_AT * 100;
  const packChanged = inUse.packSize !== null && Math.abs(inUse.packSize - p.packSize) > 1e-9;
  // Urgent means query it before paying, so only a rise is (Cyrus, 21 Oct
  // 2026: "we don't really care about falls"). A big fall is still "moved".
  const bigRise = bigMove && changePct! > 0;
  const urgent = bigRise || packChanged;

  if (inUse.effectiveDate && inUse.effectiveDate > p.effectiveDate) {
    return { flag: "older_than_current", changePct, urgent: false };
  }
  if (packChanged) return { flag: "pack_size_changed", changePct, urgent };
  if (!inUse.invoiceBacked || changePct === null) return { flag: "new", changePct, urgent };
  if (bigMove) return { flag: "moved", changePct, urgent };
  const goodsSame = inUse.goodsCost === null || Math.abs(inUse.goodsCost - p.goodsCost) < 0.00005;
  if (goodsSame && Math.abs(changePct) <= CONFIRMED_WITHIN * 100) return { flag: "confirmed", changePct, urgent };
  return { flag: "changed", changePct, urgent };
}

/** Lines must add to the printed net within a penny a line for rounding, or nothing is proposed. */
export function reconciles(lines: { lineTotal: number }[], netTotal: number): { ok: boolean; sum: number } {
  const sum = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { ok: Math.abs(sum - netTotal) <= Math.max(0.01, 0.005 * lines.length), sum };
}
