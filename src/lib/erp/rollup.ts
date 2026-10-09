/**
 * The COGS rollup tree: "where did this £14.83 come from?" answered step by
 * step (spec §12, roadmap week 4).
 *
 * It does no costing of its own. Every figure on a SKU's branches is the one
 * computeSkuCost already produced, so the tree can never disagree with the
 * number on the pricing, P&L or COGS pages. What it adds is the working: the
 * recipe percentage that became the millilitres, the pack price that became
 * the unit cost, the wastage applied to the subtotal, and, for anything we
 * make ourselves, what its constituents add up to.
 *
 * A sub-recipe line is costed at the price in use on the component, as COGS
 * does. Its constituents are shown beneath it at their own prices in use; when
 * they add up to something else, the gap is named rather than quietly picked
 * between, because COGS does not use the derived figure.
 */

import { db } from "@/db";
import { components, componentRecipes } from "@/db/schema";
import { computeSkuCost, type CostLine, type SkuCost } from "@/lib/erp/cogs";
import { perUomCost, priceProvenanceFor } from "@/lib/erp/ingredients";
import type { CostSource } from "@/lib/erp/provenance";

export interface RollupNode {
  key: string;
  label: string;
  /** £. Null for a heading that carries no figure of its own. */
  amount: number | null;
  /** The arithmetic that produced `amount`, in words a person can check. */
  working: string | null;
  /** Where the price came from and when, on leaves that carry one. */
  source?: CostSource;
  setAt?: string | null;
  /** The invoice behind the price, e.g. "Matthew Clark 4417302". */
  invoice?: string | null;
  /** The component behind the line, for a link to its price and history. */
  componentId?: number;
  /** Shown but not summed: excluded from COGS, or a constituent of a sub-recipe. */
  outside?: boolean;
  /** A caveat about this branch, e.g. constituents that disagree with the price in use. */
  note?: string;
  /** True when the note names something wrong, not merely explains. */
  noteFlagged?: boolean;
  children: RollupNode[];
}

export interface CostRollup {
  cost: SkuCost;
  root: RollupNode;
}

/** Discrepancy, as a share of the price in use, past which a derived cost is named. */
const DERIVED_TOLERANCE = 0.005;

const UOM_UNIT: Record<string, string> = { ml: "ml", g: "g", each: "each", m: "m" };

/** £ to 2dp for amounts. */
export function gbp(x: number): string {
  return x.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });
}

/** A unit cost legibly: £0.0220 per ml, £0.000620 per ml, £0.62 each. */
export function unitPrice(x: number, uom: string): string {
  const dp = x === 0 ? 2 : x >= 0.1 ? 2 : x >= 0.001 ? 4 : 6;
  const amt = `£${x.toFixed(dp)}`;
  return uom === "each" ? `${amt} each` : `${amt} per ${UOM_UNIT[uom] ?? uom}`;
}

/** A quantity in its unit: 175.0 ml, 2.04 g, 1 each. */
export function qty(x: number, uom: string): string {
  if (uom === "each") return `${x.toLocaleString("en-GB", { maximumFractionDigits: 3 })} each`;
  const dp = x >= 100 ? 1 : x >= 1 ? 2 : 3;
  return `${x.toFixed(dp)} ${UOM_UNIT[uom] ?? uom}`;
}

function packPhrase(l: { packSize: number | null; packCost: number | null; uom: string; isSubRecipe: boolean }): string | null {
  if (l.isSubRecipe) return "made in-house";
  if (l.packSize && l.packSize > 1 && l.packCost) {
    return `bought at ${gbp(l.packCost)} per ${qty(l.packSize, l.uom)}`;
  }
  return null;
}

function lineWorking(l: CostLine, sizeMl: number): string {
  const parts: string[] = [];
  if (l.percentage !== undefined) {
    parts.push(`${l.percentage.toFixed(3).replace(/\.?0+$/, "")}% of ${sizeMl} ml = ${qty(l.quantity, l.uom)}`);
  } else {
    parts.push(qty(l.quantity, l.uom));
  }
  parts.push(`× ${unitPrice(l.unitCost, l.uom)}`);
  const pack = packPhrase(l);
  return pack ? `${parts.join(" ")} (${pack})` : parts.join(" ");
}

type ComponentRow = typeof components.$inferSelect;
type RecipeRow = typeof componentRecipes.$inferSelect;

interface Ctx {
  comps: Map<number, ComponentRow>;
  recipesByParent: Map<number, RecipeRow[]>;
  prov: Map<number, { source: CostSource; setAt: string | null; invoice: string | null }>;
}

/**
 * The constituents of `quantity` of a sub-recipe, each scaled from the base
 * batch, recursing through nested sub-recipes. Returns the nodes and what they
 * add up to. A nested sub-recipe counts at what ITS constituents add up to, so
 * the derivation goes all the way down, as the batch calculator's does; where
 * its own price in use says otherwise, that is named on its node.
 */
function constituents(
  parent: ComponentRow,
  quantity: number,
  ctx: Ctx,
  keyPrefix: string,
  seen: Set<number>,
): { nodes: RollupNode[]; total: number | null; note?: string } {
  const yieldQty = Number(parent.batchYield);
  const rows = ctx.recipesByParent.get(parent.id) ?? [];
  if (seen.has(parent.id)) return { nodes: [], total: null, note: "Circular sub-recipe reference" };
  if (!(yieldQty > 0)) return { nodes: [], total: null, note: "No batch yield recorded, so its constituents cannot be scaled" };
  if (rows.length === 0) return { nodes: [], total: null, note: "No constituents recorded" };
  const nextSeen = new Set(seen).add(parent.id);

  const nodes: RollupNode[] = [];
  let total = 0;
  for (const r of [...rows].sort((a, b) => a.displayOrder - b.displayOrder)) {
    const child = ctx.comps.get(r.childComponentId);
    if (!child) continue;
    const perBatch = Number(r.quantity);
    const q = (perBatch / yieldQty) * quantity;
    const unit = perUomCost(child);
    const p = ctx.prov.get(child.id);
    const isSub = child.type === "sub_recipe";
    const pack = packPhrase({
      packSize: child.packSize === null ? null : Number(child.packSize),
      packCost: child.packCost === null ? null : Number(child.packCost),
      uom: child.uom,
      isSubRecipe: isSub,
    });
    const scaled = `${qty(perBatch, child.uom)} per ${qty(yieldQty, parent.uom)} batch → ${qty(q, child.uom)}`;
    const node: RollupNode = {
      key: `${keyPrefix}.${child.id}`,
      label: child.name,
      amount: unit * q,
      working: `${scaled} × ${unitPrice(unit, child.uom)}` + (pack ? ` (${pack})` : ""),
      source: p?.source,
      setAt: p?.setAt ?? null,
      invoice: p?.invoice ?? null,
      componentId: child.id,
      outside: true,
      children: [],
    };
    if (isSub) {
      const sub = constituents(child, q, ctx, node.key, nextSeen);
      node.children = sub.nodes;
      if (sub.total !== null) {
        // Inside a derivation, a made component counts at what it is made of.
        node.amount = sub.total;
        node.working = `${scaled}, made in-house from the constituents below`;
      }
      Object.assign(node, derivedNote(unit, sub, q, child.uom));
    }
    total += node.amount ?? 0;
    nodes.push(node);
  }
  return { nodes, total };
}

/**
 * Compares a made component's price in use with what its constituents add up
 * to, per unit, so a gap is named instead of quietly picked between.
 */
function derivedNote(
  inUse: number,
  sub: { total: number | null; note?: string },
  quantity: number,
  uom: string,
): Pick<RollupNode, "note" | "noteFlagged"> {
  if (sub.note) return { note: sub.note, noteFlagged: true };
  if (sub.total === null || !(quantity > 0)) return {};
  const derived = sub.total / quantity;
  const gap = Math.abs(inUse - derived);
  if (gap <= Math.max(1e-7, inUse * DERIVED_TOLERANCE)) {
    return { note: `Its constituents add up to ${unitPrice(derived, uom)}, which agrees with the price in use` };
  }
  return {
    note: `Its constituents add up to ${unitPrice(derived, uom)}, but its price in use is ${unitPrice(inUse, uom)}. Its price needs updating to match its recipe`,
    noteFlagged: true,
  };
}

function lineNode(l: CostLine, b: SkuCost, ctx: Ctx, keyPrefix: string, outside: boolean): RollupNode {
  const node: RollupNode = {
    key: `${keyPrefix}.${l.kind}.${l.componentId}`,
    label: l.name,
    amount: l.cost,
    working: lineWorking(l, b.sizeMl),
    source: l.source,
    setAt: l.setAt,
    invoice: l.invoice,
    componentId: l.componentId,
    outside,
    children: [],
  };
  if (l.suppliedByCustomer) node.note = "Supplied by the customer, so never in COGS";
  if (l.isSubRecipe) {
    const comp = ctx.comps.get(l.componentId);
    if (comp) {
      const sub = constituents(comp, l.quantity, ctx, node.key, new Set());
      node.children = sub.nodes;
      Object.assign(node, derivedNote(l.unitCost, sub, l.quantity, l.uom));
    }
  }
  return node;
}

/** Every component id reachable from the lines, through sub-recipes. */
function reachable(ids: number[], recipesByParent: Map<number, RecipeRow[]>): number[] {
  const out = new Set<number>();
  const stack = [...ids];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const r of recipesByParent.get(id) ?? []) stack.push(r.childComponentId);
  }
  return [...out];
}

export async function buildCostRollup(skuId: number): Promise<CostRollup> {
  const b = await computeSkuCost(skuId);

  const [allComponents, allRecipes] = await Promise.all([
    db.select().from(components),
    db.select().from(componentRecipes),
  ]);
  const recipesByParent = new Map<number, RecipeRow[]>();
  for (const r of allRecipes) {
    const list = recipesByParent.get(r.parentComponentId) ?? [];
    list.push(r);
    recipesByParent.set(r.parentComponentId, list);
  }
  const lineIds = [...b.liquid, ...b.packaging, ...b.excluded].map((l) => l.componentId);
  const prov = await priceProvenanceFor(reachable(lineIds, recipesByParent));
  const ctx: Ctx = { comps: new Map(allComponents.map((c) => [c.id, c])), recipesByParent, prov };

  const liquid: RollupNode = {
    key: "liquid",
    label: `Liquid, ${b.sizeMl} ml from the current recipe`,
    amount: b.liquidTotal,
    working: b.liquid.length > 0 ? `${b.liquid.length} recipe ${b.liquid.length === 1 ? "line" : "lines"}, summed` : null,
    children: b.liquid.map((l) => lineNode(l, b, ctx, "liquid", false)),
  };
  const packaging: RollupNode = {
    key: "packaging",
    label: "Packaging, from the bill of materials",
    amount: b.packagingTotal,
    working: b.packaging.length > 0 ? `${b.packaging.length} bill of materials ${b.packaging.length === 1 ? "line" : "lines"}, summed` : null,
    children: b.packaging.map((l) => lineNode(l, b, ctx, "packaging", false)),
  };
  const subtotal: RollupNode = {
    key: "subtotal",
    label: "Subtotal",
    amount: b.subtotal,
    working: `${gbp(b.liquidTotal)} liquid + ${gbp(b.packagingTotal)} packaging`,
    children: [liquid, packaging],
  };
  const wastage: RollupNode = {
    key: "wastage",
    label: "Wastage",
    amount: b.wastage,
    working: `${(b.wastagePct * 100).toFixed(1)}% of the ${gbp(b.subtotal)} subtotal (Settings)`,
    children: [],
  };

  const children = [subtotal, wastage];
  if (b.excluded.length > 0) {
    children.push({
      key: "excluded",
      label: "Not in COGS",
      amount: b.excluded.reduce((s, l) => s + l.cost, 0),
      working: "On the bill of materials but excluded, e.g. carriage, which flexes by channel",
      outside: true,
      children: b.excluded.map((l) => lineNode(l, b, ctx, "excluded", true)),
    });
  }

  const root: RollupNode = {
    key: "cogs",
    label: "COGS",
    amount: b.total,
    working: `${gbp(b.subtotal)} subtotal + ${gbp(b.wastage)} wastage`,
    source: b.costSource ?? undefined,
    setAt: b.costAsOf,
    children,
  };

  return { cost: b, root };
}
