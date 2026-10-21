/**
 * Checks for the invoice price check's fee rules and flags, against real
 * invoices. No database. `npm run check:invoice-rules`; silent on success
 * apart from the last line.
 */

import assert from "node:assert/strict";

import { apportionFees, flagProposal, reconciles, type RuleLine } from "@/lib/erp/invoice-check/rules";

const near = (a: number, b: number, what: string) => assert.ok(Math.abs(a - b) < 0.005, `${what}: ${a} ≠ ${b}`);

// Pattesons 248118, 20 Oct 2026: freight printed against the glass and the
// corks, a £0 pallet, and EPR, which is never a fee.
const pattesons: RuleLine[] = [
  { lineNo: 1, description: "700ml Blackwell Bottle", kind: "goods", lineTotal: 728.4 },
  { lineNo: 2, description: "Wooden Pallet (UK)", kind: "pallet", lineTotal: 0, feeAppliesTo: null },
  { lineNo: 3, description: "EPR", kind: "epr", lineTotal: 103.86 },
  { lineNo: 4, description: "30x12 Natural Wood cork", kind: "goods", lineTotal: 185 },
  { lineNo: 5, description: "Freight Costs - Glass and corks", kind: "fee", lineTotal: 66.85, feeAppliesTo: [1, 4] },
];
{
  const { shares, issues } = apportionFees(pattesons);
  assert.equal(issues.size, 0);
  near(shares.get(1)!.amount, (66.85 * 728.4) / 913.4, "bottles' freight");
  near(shares.get(4)!.amount, (66.85 * 185) / 913.4, "corks' freight");
  near(shares.get(1)!.amount + shares.get(4)!.amount, 66.85, "freight fully landed");
  assert.ok(reconciles(pattesons, 1084.11).ok, "Pattesons reconciles to its Goods Net");
  assert.ok(!reconciles(pattesons, 1184.11).ok, "a misread net is caught");
}

// A fee printed against nothing in particular is split by goods value; a
// pallet charge is landed the same way.
{
  const { shares } = apportionFees([
    { lineNo: 1, description: "A", kind: "goods", lineTotal: 300 },
    { lineNo: 2, description: "B", kind: "goods", lineTotal: 100 },
    { lineNo: 3, description: "Pallets", kind: "pallet", lineTotal: 48, feeAppliesTo: null },
  ]);
  near(shares.get(1)!.amount, 36, "by value, A");
  near(shares.get(2)!.amount, 12, "by value, B");
}

// Thames Distillers 26/OC14, 12 Oct 2026: excise printed apart is part of the
// spirit's goods cost, not a fee (Cyrus, 21 Oct 2026).
{
  const { shares, duty, issues } = apportionFees([
    { lineNo: 1, description: "25L tubs NGS 40%", kind: "goods", lineTotal: 178 },
    { lineNo: 2, description: "Excise on 40.00 litres of alcohol", kind: "duty", lineTotal: 1359.6, feeAppliesTo: null },
  ]);
  assert.equal(issues.size, 0);
  near(duty.get(1)!.amount, 1359.6, "duty lands on the spirit");
  near(shares.get(1)!.amount, 0, "and not as a fee");
}

// Not guessed: a discount, a credit, an unreadable target, a target that is not goods.
{
  const { issues } = apportionFees([
    { lineNo: 1, description: "A", kind: "goods", lineTotal: 100 },
    { lineNo: 2, description: "Trade discount", kind: "other", lineTotal: -10 },
    { lineNo: 3, description: "Carriage refund", kind: "fee", lineTotal: -5, feeAppliesTo: null },
    { lineNo: 4, description: "Surcharge", kind: "fee", lineTotal: 5, feeAppliesTo: "unclear" },
    { lineNo: 5, description: "Delivery for EPR", kind: "fee", lineTotal: 5, feeAppliesTo: [9] },
  ]);
  assert.deepEqual([...issues.keys()].sort(), [2, 3, 4, 5]);
}

// Flags, on landed £ per unit.
const inUse = { packSize: 1, unitCost: 0.8437, goodsCost: 0.7815, effectiveDate: "2026-10-09", invoiceBacked: true };
const at = (unitCost: number, over: Partial<typeof inUse> = {}, goodsCost = 0.7815, packSize = 1, effectiveDate = "2026-10-20") =>
  flagProposal({ ...inUse, ...over }, { packSize, goodsCost, unitCost, effectiveDate });

assert.equal(at(0.8387).flag, "confirmed", "same goods, landed −0.6%");
assert.equal(at(0.8387, {}, 0.79).flag, "changed", "goods price differs");
assert.equal(at(0.9, {}, 0.84).flag, "changed", "+6.7%");
assert.deepEqual([at(0.93, {}, 0.87).flag, at(0.93, {}, 0.87).urgent], ["moved", true], "+10.2% is moved and urgent");
assert.deepEqual([at(0.75, {}, 0.69).flag, at(0.75, {}, 0.69).urgent], ["moved", false], "−11% is moved, not urgent: only rises are");
assert.deepEqual([at(0.8437, {}, 0.7815, 700).flag, at(0.8437, {}, 0.7815, 700).urgent], ["pack_size_changed", true]);
assert.equal(at(0.8437, { invoiceBacked: false }).flag, "new");
assert.equal(at(0.8437, {}, 0.7815, 1, "2026-10-01").flag, "older_than_current");

console.log("invoice rules: all checks pass");
