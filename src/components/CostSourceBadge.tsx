import { COLOR, smallCaps, tabularNums } from "@/lib/design";
import {
  COST_SOURCE_LABEL,
  costCaveat,
  fmtCostDate,
  isFlaggedSource,
  toCostSource,
  type CostSource,
} from "@/lib/erp/provenance";

const SOURCE_COLOR: Record<CostSource, string> = {
  inbound: COLOR.positive,
  manual: COLOR.accent,
  placeholder: COLOR.flag,
  unsourced: COLOR.flag,
};

/**
 * The shared cost provenance badge: the source AND its date, on the page and
 * not only in a hover title ("Invoice · 12 Sep 2026"). Placeholder and
 * unsourced badges carry a flag outline so they cannot be read past.
 *
 * `source` accepts any string so raw price-history values can be passed
 * straight in; anything outside the vocabulary reads as unsourced.
 */
export default function CostSourceBadge({
  source,
  date,
  fontSize = 10,
  block = false,
}: {
  source: CostSource | string | null | undefined;
  /** ISO date (YYYY-MM-DD) the figure applies from, or null when undated. */
  date: string | null | undefined;
  fontSize?: number;
  /** Stack the date under the label instead of running it inline. */
  block?: boolean;
}) {
  const s = toCostSource(source);
  const flagged = isFlaggedSource(s);
  const when = date ? fmtCostDate(date) : "no date";
  return (
    <span
      title={`${COST_SOURCE_LABEL[s]}, ${date ? `as of ${when}` : "never dated"}`}
      style={{
        display: block ? "inline-flex" : "inline-block",
        flexDirection: block ? "column" : undefined,
        alignItems: block ? "flex-end" : undefined,
        fontSize,
        color: SOURCE_COLOR[s],
        whiteSpace: "nowrap",
        padding: flagged ? "1px 6px" : undefined,
        border: flagged ? `1px solid ${COLOR.flagSoft}` : undefined,
        background: flagged ? "rgba(142,58,44,0.05)" : undefined,
        ...smallCaps,
        ...tabularNums,
      }}
    >
      <span>{COST_SOURCE_LABEL[s]}</span>
      {block ? <span style={{ color: COLOR.muted }}>{when}</span> : <span> · {when}</span>}
    </span>
  );
}

/**
 * Provenance for a COGS total: the badge (worst source, oldest input date) and,
 * when placeholder or unsourced lines are inside the figure, a distinct flag
 * naming how many. Deliberately separate from the generic problems flag.
 */
export function CostTotalProvenance({
  source,
  asOf,
  placeholders,
  unsourced,
  align = "right",
  fontSize = 9,
}: {
  source: CostSource | null;
  asOf: string | null;
  placeholders: number;
  unsourced: number;
  align?: "left" | "right";
  fontSize?: number;
}) {
  const caveat = costCaveat({ placeholders, unsourced });
  return (
    <div style={{ marginTop: 4, textAlign: align }}>
      <CostSourceBadge source={source} date={asOf} fontSize={fontSize} />
      {caveat && (
        <div style={{ marginTop: 3, fontSize, color: COLOR.flag, ...smallCaps }}>{caveat}</div>
      )}
    </div>
  );
}
