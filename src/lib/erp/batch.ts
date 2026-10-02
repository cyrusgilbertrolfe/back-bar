/**
 * Anchored batching: size a batch around one bottle of one ingredient.
 *
 * The batch calculator asks "how many litres?", which is the wrong question for
 * a short run. The real constraint is often a single bottle of something
 * awkward: you have one 300ml bottle of ginjo sake, the Sakura Martini is the
 * only drink that uses it, and the batch should be whatever that bottle makes.
 * Asking for litres means doing that arithmetic in your head at the bench, in
 * reverse, and getting it wrong.
 *
 * So: pick the anchor ingredient, say how many bottles of it you are committing,
 * and everything else falls out. Cyrus, 31 Jul 2026.
 *
 * It also answers the two questions that follow immediately: how many bottles of
 * each other ingredient do I need to open, and how many finished bottles does
 * this yield in each format.
 */

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { clients, components, drinks, recipeLines, recipes, skus } from "@/db/schema";
import { perUomCost, priceProvenanceFor } from "@/lib/erp/ingredients";
import { summariseProvenance, type CostSource } from "@/lib/erp/provenance";

export interface AnchorOption {
  componentId: number;
  name: string;
  uom: string;
  percentage: number;
  /** How the supplier sells it, e.g. 300 for a 300ml bottle. Null if unknown. */
  packSize: number | null;
}

export interface AnchorLine {
  componentId: number;
  name: string;
  uom: string;
  percentage: number;
  /** How much of this the batch needs. */
  quantity: number;
  packSize: number | null;
  /** Whole containers to open. Null when the pack size is unknown. */
  bottlesToOpen: number | null;
  /** What is left in the last one, in the component's UOM. */
  leftover: number | null;
  unitCost: number;
  cost: number;
  /** Where unitCost came from, and the date it applies from. */
  source: CostSource;
  setAt: string | null;
  isAnchor: boolean;
}

export interface BatchYield {
  code: string;
  sizeMl: number;
  wholeBottles: number;
  remainderMl: number;
}

export interface AnchorPlan {
  drinkName: string;
  clientName: string;
  method: string | null;

  anchorName: string;
  anchorBottles: number;
  anchorQuantity: number;

  batchMl: number;
  batchLitres: number;

  lines: AnchorLine[];
  totalCost: number;
  costPerLitre: number;
  /** Worst source across the lines, and the oldest input date. See provenance.ts. */
  costSource: CostSource | null;
  costAsOf: string | null;
  /** Lines standing on a placeholder or with no sourced price. */
  placeholderLines: number;
  unsourcedLines: number;

  yields: BatchYield[];
  warnings: string[];
}

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function round(x: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

async function loadRecipe(clientSlug: string, drinkSlug: string) {
  const [row] = await db
    .select({
      recipeId: recipes.id,
      drinkId: drinks.id,
      drinkName: drinks.name,
      clientName: clients.name,
      method: recipes.method,
    })
    .from(recipes)
    .innerJoin(drinks, eq(drinks.id, recipes.drinkId))
    .innerJoin(clients, eq(clients.id, recipes.clientId))
    .where(
      and(eq(clients.slug, clientSlug), eq(drinks.slug, drinkSlug), eq(recipes.isCurrent, true)),
    )
    .limit(1);
  if (!row) return null;

  const lines = await db
    .select({
      componentId: components.id,
      name: components.name,
      uom: components.uom,
      percentage: recipeLines.percentage,
      packSize: components.packSize,
      packCost: components.packCost,
      unitCost: components.unitCost,
    })
    .from(recipeLines)
    .innerJoin(components, eq(components.id, recipeLines.componentId))
    .where(eq(recipeLines.recipeId, row.recipeId))
    .orderBy(asc(recipeLines.displayOrder));

  return { ...row, lines };
}

/** The ingredients you could anchor on, biggest share first. */
export async function listAnchorOptions(
  clientSlug: string,
  drinkSlug: string,
): Promise<AnchorOption[]> {
  const r = await loadRecipe(clientSlug, drinkSlug);
  if (!r) return [];
  return r.lines
    .filter((l) => n(l.percentage) > 0)
    .map((l) => ({
      componentId: l.componentId,
      name: l.name,
      uom: l.uom,
      percentage: n(l.percentage),
      packSize: l.packSize === null ? null : n(l.packSize),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * @param anchorComponentId the ingredient you are sizing around
 * @param bottles           how many containers of it you are committing
 * @param anchorQuantityOverride use instead of bottles when you have a part bottle
 */
export async function planBatchFromAnchor(
  clientSlug: string,
  drinkSlug: string,
  anchorComponentId: number,
  bottles = 1,
  anchorQuantityOverride?: number,
): Promise<AnchorPlan | null> {
  const r = await loadRecipe(clientSlug, drinkSlug);
  if (!r) return null;

  const anchor = r.lines.find((l) => l.componentId === anchorComponentId);
  if (!anchor) return null;

  const warnings: string[] = [];

  const anchorPct = n(anchor.percentage);
  if (anchorPct <= 0) {
    warnings.push(`${anchor.name} is 0% of this recipe, so it cannot anchor a batch.`);
    return null;
  }

  const anchorPack = anchor.packSize === null ? null : n(anchor.packSize);
  let anchorQuantity: number;
  if (anchorQuantityOverride !== undefined && anchorQuantityOverride > 0) {
    anchorQuantity = anchorQuantityOverride;
  } else if (anchorPack && anchorPack > 0) {
    anchorQuantity = anchorPack * bottles;
  } else {
    warnings.push(
      `${anchor.name} has no pack size recorded, so "one bottle" is unknown. Enter a quantity instead.`,
    );
    return null;
  }

  const batchMl = anchorQuantity / (anchorPct / 100);

  const pctTotal = r.lines.reduce((s, l) => s + n(l.percentage), 0);
  if (Math.abs(pctTotal - 100) > 0.01) {
    warnings.push(
      `Recipe lines sum to ${round(pctTotal, 3)}%, not 100%, so the batch size is approximate.`,
    );
  }

  const provenance = await priceProvenanceFor(r.lines.map((l) => l.componentId));

  const lines: AnchorLine[] = r.lines.map((l) => {
    const pct = n(l.percentage);
    const quantity = (pct / 100) * batchMl;
    const pack = l.packSize === null ? null : n(l.packSize);
    const unitCost = perUomCost({
      packSize: l.packSize,
      packCost: l.packCost,
      unitCost: l.unitCost,
    });
    const bottlesToOpen = pack && pack > 0 ? Math.ceil(quantity / pack) : null;
    return {
      componentId: l.componentId,
      name: l.name,
      uom: l.uom,
      percentage: pct,
      quantity: round(quantity, 1),
      packSize: pack,
      bottlesToOpen,
      leftover: bottlesToOpen === null || pack === null ? null : round(bottlesToOpen * pack - quantity, 1),
      unitCost,
      cost: round(unitCost * quantity, 4),
      source: provenance.get(l.componentId)?.source ?? "unsourced",
      setAt: provenance.get(l.componentId)?.setAt ?? null,
      isAnchor: l.componentId === anchorComponentId,
    };
  });

  const heavy = lines.filter((l) => !l.isAnchor && (l.bottlesToOpen ?? 0) > 6);
  for (const h of heavy) {
    warnings.push(`${h.name} needs ${h.bottlesToOpen} containers opened. Check that is intended.`);
  }

  const unpriced = lines.filter((l) => l.unitCost === 0 && !/^water$/i.test(l.name));
  for (const u of unpriced) {
    warnings.push(`${u.name} has no price, so the batch cost is understated.`);
  }

  const skuRows = await db
    .select({ sizeMl: skus.sizeMl, code: skus.code })
    .from(skus)
    .where(and(eq(skus.drinkId, r.drinkId), eq(skus.active, true)))
    .orderBy(asc(skus.sizeMl));

  const totalCost = round(lines.reduce((s, l) => s + l.cost, 0));

  return {
    drinkName: r.drinkName,
    clientName: r.clientName,
    method: r.method,
    anchorName: anchor.name,
    anchorBottles: bottles,
    anchorQuantity: round(anchorQuantity, 1),
    batchMl: round(batchMl, 1),
    batchLitres: round(batchMl / 1000, 3),
    lines,
    totalCost,
    costPerLitre: batchMl > 0 ? round((totalCost / batchMl) * 1000) : 0,
    ...summariseProvenance(lines),
    placeholderLines: lines.filter((l) => l.source === "placeholder").length,
    unsourcedLines: lines.filter((l) => l.source === "unsourced").length,
    yields: skuRows.map((s) => ({
      code: s.code,
      sizeMl: s.sizeMl,
      wholeBottles: Math.floor(batchMl / s.sizeMl),
      remainderMl: round(batchMl % s.sizeMl, 1),
    })),
    warnings,
  };
}
