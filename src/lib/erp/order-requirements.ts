/**
 * What an order needs, worked out rather than asked: the ingredients, glass,
 * closures and labels for its lines, from the same recipes and bills of
 * materials that COGS reads (Cyrus, 8 Nov 2026). So the requirement and the
 * cost cannot disagree.
 *
 * Liquid carries the wastage rate, because a batch really is made a little
 * over. Glass and labels are the plain count: nobody buys 30.6 bottles.
 * EPR is a cost, not something you can run out of, so it is in the cost and
 * not in the list. A sub-recipe stays on the list, as something we make, and
 * what goes into it is added.
 *
 * Stock on hand is not recorded yet, so every item answers "don't know" until
 * its category goes live. A blank is never a zero.
 */

import { computeSkuCost, type CostLine, type SkuCost } from "@/lib/erp/cogs";
import { planBatch, type BatchPlan } from "@/lib/erp/sub-recipes";
import { lineBottles, liveLines, lineValue, type OrderRow } from "@/lib/erp/orders";

export type RequirementItem = {
  componentId: number;
  name: string;
  kind: "liquid" | "packaging";
  uom: string;
  need: number;
  packSize: number | null;
  /** £, before wastage. Null when it is outside COGS or sits inside a sub-recipe. */
  cost: number | null;
  madeHere: boolean;
  suppliedByCustomer: boolean;
  /** The sub-recipes it goes into, when it is not only a direct ingredient. */
  usedIn: string[];
};

export type Requirements = {
  items: RequirementItem[];
  /** £ of EPR: in the cost, not on the list. */
  eprCost: number;
  wastage: number;
  wastagePct: number;
  /** Cost of goods for the order: the items, EPR and wastage. */
  total: number;
  /** Lines' value ex delivery, or null if any line has no price yet. */
  goodsValue: number | null;
  /** Order lines with no SKU, so nothing can be worked out for them. */
  unmatched: string[];
  problems: string[];
};

const WATER = /^(filtered )?water$/i;

/** "3L Big Joe bottle", without the supplier's code in brackets. */
export function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\d[^)]*\)\s*$/, "");
}

/** A quantity as you would buy it: litres, kilos, or a whole count. */
export function buyingQty(need: number, uom: string): { qty: number; uom: string | null } {
  if (uom === "ml") return { qty: Math.ceil(need / 100) / 10, uom: "L" };
  if (uom === "g") return { qty: Math.ceil(need / 100) / 10, uom: "kg" };
  if (uom === "m") return { qty: Math.ceil(need * 10) / 10, uom: "m" };
  // A carton per six bottles is held as 0.1667 each, so trim that before rounding up.
  return { qty: Math.ceil(Math.round(need * 10) / 10), uom: null };
}

export function needText(item: Pick<RequirementItem, "need" | "uom">): string {
  const { qty, uom } = buyingQty(item.need, item.uom);
  const shown = qty.toLocaleString("en-GB", { maximumFractionDigits: 1 });
  return uom ? `${shown} ${uom}` : shown;
}

/** "45 × 700 ml", or null when it is bought singly or we make it. */
export function packText(item: Pick<RequirementItem, "need" | "uom" | "packSize" | "madeHere">): string | null {
  if (item.madeHere || item.packSize === null || item.packSize <= 1) return null;
  return `${Math.ceil(item.need / item.packSize)} × ${item.packSize.toLocaleString("en-GB")} ${item.uom}`;
}

export async function orderRequirements(order: OrderRow): Promise<Requirements> {
  const items = new Map<number, RequirementItem>();
  const problems = new Set<string>();
  const unmatched: string[] = [];
  const costs = new Map<number, SkuCost>();
  let eprCost = 0;
  let wastage = 0;
  let wastagePct = 0;

  const costOf = async (skuId: number) => {
    const known = costs.get(skuId);
    if (known) return known;
    const cost = await computeSkuCost(skuId);
    costs.set(skuId, cost);
    return cost;
  };

  const add = (line: CostLine, kind: RequirementItem["kind"], need: number, cost: number | null) => {
    const item = items.get(line.componentId);
    if (item) {
      item.need += need;
      if (cost !== null) item.cost = (item.cost ?? 0) + cost;
      return;
    }
    items.set(line.componentId, {
      componentId: line.componentId,
      name: line.name,
      kind,
      uom: line.uom,
      need,
      packSize: line.packSize,
      cost,
      madeHere: line.isSubRecipe,
      suppliedByCustomer: line.suppliedByCustomer ?? false,
      usedIn: [],
    });
  };

  const walk = async (skuId: number, bottles: number) => {
    const cost = await costOf(skuId);
    for (const p of cost.problems) problems.add(`${cost.skuCode}: ${p}`);
    wastage += cost.wastage * bottles;
    wastagePct = cost.wastagePct;
    for (const l of cost.liquid) add(l, "liquid", l.quantity * bottles * (1 + cost.wastagePct), l.cost * bottles);
    for (const l of cost.packaging) {
      if (l.kind === "epr") eprCost += l.cost * bottles;
      else add(l, "packaging", l.quantity * bottles, l.cost * bottles);
    }
    for (const l of cost.excluded) {
      if (l.kind !== "shipping" && l.kind !== "epr") add(l, "packaging", l.quantity * bottles, null);
    }
    for (const child of cost.items) await walk(child.skuId, child.quantity * bottles);
  };

  const lines = liveLines(order);
  for (const line of lines) {
    if (line.skuId === null) unmatched.push(line.customerDescription ?? line.unitDescription ?? "A line with no product");
    else await walk(line.skuId, lineBottles(line));
  }

  const addPlan = (plan: BatchPlan) => {
    for (const l of plan.lines) {
      if (l.isSubRecipe) continue;
      const known = items.get(l.componentId);
      if (known) {
        known.need += l.quantity;
        known.usedIn.push(plan.name);
      } else {
        items.set(l.componentId, {
          componentId: l.componentId,
          name: l.name,
          kind: "liquid",
          uom: l.uom,
          need: l.quantity,
          packSize: null,
          cost: null,
          madeHere: false,
          suppliedByCustomer: false,
          usedIn: [plan.name],
        });
      }
    }
    plan.steps.forEach(addPlan);
  };
  for (const item of [...items.values()].filter((i) => i.madeHere)) {
    try {
      addPlan(await planBatch(item.componentId, item.need));
    } catch (e) {
      problems.add(`${item.name}: ${e instanceof Error ? e.message : "its recipe could not be read"}`);
    }
  }

  let total = 0;
  for (const line of lines) {
    if (line.skuId !== null) total += (await costOf(line.skuId)).total * lineBottles(line);
  }
  const values = lines.map(lineValue);

  return {
    items: [...items.values()]
      .filter((i) => !WATER.test(i.name))
      .sort((a, b) => Number(a.kind !== "liquid") - Number(b.kind !== "liquid") || (b.cost ?? 0) - (a.cost ?? 0)),
    eprCost,
    wastage,
    wastagePct,
    total,
    goodsValue: values.some((v) => v === null) ? null : values.reduce<number>((s, v) => s + (v ?? 0), 0),
    unmatched,
    problems: [...problems],
  };
}
