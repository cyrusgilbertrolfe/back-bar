/**
 * The one provenance vocabulary for costs.
 *
 * Extends the revenue rule (docs/revenue-provenance.md) to costing: a cost
 * that cannot be traced does not pass as one, every cost carries a source and
 * an as-of date, and a placeholder is flagged wherever it appears, in the UI
 * and in the MCP responses alike.
 *
 * No server imports: this module is shared by server code, client components
 * and the MCP tools, so it must stay safe on both sides of the boundary.
 */

export type CostSource = "inbound" | "manual" | "placeholder" | "unsourced";

export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  inbound: "Invoice",
  manual: "Manual",
  placeholder: "Placeholder",
  unsourced: "Unsourced",
};

/**
 * Worst first. A total is only as trustworthy as its weakest line, and a
 * placeholder is worse than a gap because it is a figure known to be wrong.
 */
const WORST_FIRST: CostSource[] = ["placeholder", "unsourced", "manual", "inbound"];

/** Coerce a stored or legacy value ("none" included) into the vocabulary. */
export function toCostSource(s: string | null | undefined): CostSource {
  return s === "inbound" || s === "manual" || s === "placeholder" ? s : "unsourced";
}

/** True for the two sources that must be flagged wherever they appear. */
export function isFlaggedSource(s: CostSource): boolean {
  return s === "placeholder" || s === "unsourced";
}

/** The worst source in the set, or null for an empty set. */
export function worstSource(sources: CostSource[]): CostSource | null {
  for (const s of WORST_FIRST) if (sources.includes(s)) return s;
  return null;
}

/**
 * Summarise a set of cost lines: the worst source, and the OLDEST date, because
 * a total is only as current as its stalest input. The date is null when any
 * line has none, since an undated input makes the whole total undatable.
 */
export function summariseProvenance(
  lines: { source: CostSource; setAt: string | null }[],
): { costSource: CostSource | null; costAsOf: string | null } {
  const costSource = worstSource(lines.map((l) => l.source));
  const dates = lines.map((l) => l.setAt);
  if (dates.length === 0 || dates.some((d) => !d)) return { costSource, costAsOf: null };
  const costAsOf = (dates as string[]).reduce((min, d) => (d < min ? d : min));
  return { costSource, costAsOf };
}

/** "12 Sep 2026" from an ISO date (YYYY-MM-DD). Never shifted by timezone. */
export function fmtCostDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Plain-English caveat for a total that stands on weak lines, or null when it
 * does not. Used on totals in the UI and echoed in MCP responses.
 */
export function costCaveat(counts: { placeholders: number; unsourced: number }): string | null {
  const parts: string[] = [];
  if (counts.placeholders > 0) {
    parts.push(`${counts.placeholders} placeholder ${counts.placeholders === 1 ? "line" : "lines"}`);
  }
  if (counts.unsourced > 0) {
    parts.push(`${counts.unsourced} unsourced ${counts.unsourced === 1 ? "line" : "lines"}`);
  }
  if (parts.length === 0) return null;
  return `Includes ${parts.join(" and ")}`;
}
