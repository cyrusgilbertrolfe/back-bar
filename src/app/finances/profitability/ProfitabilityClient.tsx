"use client";

import { useState } from "react";
import type { SkuCostBreakdown, CogsSummary } from "@/lib/cogs";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

const STATUS_META: Record<SkuCostBreakdown["status"], { label: string; color: string }> = {
  match: { label: "Match", color: COLOR.positive },
  close: { label: "Close", color: COLOR.accent },
  gap: { label: "Gap", color: COLOR.flag },
  "no-recipe": { label: "No recipe", color: COLOR.mutedLight },
};

type Props = {
  breakdowns: SkuCostBreakdown[];
  summary: CogsSummary;
};

export default function ProfitabilityClient({ breakdowns, summary }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered =
    filterStatus === "all" ? breakdowns : breakdowns.filter((b) => b.status === filterStatus);

  const selected = breakdowns.find((b) => b.productId === selectedId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* Summary — inline headline statistics, no box */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 32,
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "24px 0",
        }}
      >
        <SummaryStat label="SKUs" value={String(summary.totalSkus)} />
        <SummaryStat
          label="Matched"
          value={String(summary.matched)}
          sub="< 3% delta"
          color={COLOR.positive}
        />
        <SummaryStat
          label="Close"
          value={String(summary.close)}
          sub="3–10% delta"
          color={COLOR.accent}
        />
        <SummaryStat
          label="Gaps"
          value={String(summary.gap + summary.noRecipe)}
          sub="> 10% or unmapped"
          color={COLOR.flag}
        />
        <SummaryStat
          label="Derived total"
          value={fmt(summary.totalDerivedCogs)}
          sub={`Liquid ${fmt(summary.totalDerivedLiquidCogs)} + labour ${fmt(summary.totalLabour)}`}
        />
        <SummaryStat
          label="Hardcoded total"
          value={fmt(summary.totalHardcodedCogs)}
        />
        <SummaryStat
          label="Aggregate delta"
          value={fmt(summary.totalDelta)}
          sub="derived − hardcoded"
          color={Math.abs(summary.totalDelta) < 10 ? COLOR.positive : COLOR.flag}
        />
      </section>

      {/* Unmapped ingredients notice */}
      {summary.unmappedIngredients.length > 0 && (
        <section
          style={{
            borderTop: `1px solid ${COLOR.flag}`,
            borderBottom: `1px solid ${COLOR.flag}`,
            padding: "20px 0",
          }}
        >
          <p style={{ fontSize: 11, color: COLOR.flag, marginBottom: 8, ...smallCaps }}>
            Unmapped ingredients — no cost assigned
          </p>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 15,
              color: COLOR.inkSoft,
              lineHeight: 1.55,
              marginBottom: 12,
              maxWidth: 720,
            }}
          >
            These recipe ingredients have no entry in the ingredient master, so their cost is
            treated as £0 in the derived COGS. The delta between derived and hardcoded COGS
            partly reflects this.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {summary.unmappedIngredients.map((name) => (
              <span
                key={name}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  fontFamily: FONT.mono,
                  color: COLOR.flag,
                  border: `1px solid ${COLOR.flagSoft}`,
                  background: "rgba(142,58,44,0.04)",
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Filter tabs + table + detail grid */}
      <section>
        <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
          {(["all", "match", "close", "gap", "no-recipe"] as const).map((f) => {
            const active = filterStatus === f;
            const count =
              f === "all" ? breakdowns.length : breakdowns.filter((b) => b.status === f).length;
            const label = f === "all" ? `All (${count})` : f === "no-recipe" ? `No recipe (${count})` : `${f.charAt(0).toUpperCase()}${f.slice(1)} (${count})`;
            return (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 0",
                  fontSize: 11,
                  cursor: "pointer",
                  color: active ? COLOR.accent : COLOR.muted,
                  borderBottom: active
                    ? `1px solid ${COLOR.accent}`
                    : "1px solid transparent",
                  ...smallCaps,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="profit-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 40 }}>
          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
                  <th style={thStyle("left")}>SKU</th>
                  <th style={thStyle("right")}>Size</th>
                  <th style={thStyle("right")}>Hardcoded</th>
                  <th style={thStyle("right")}>Derived</th>
                  <th style={thStyle("right")}>Δ</th>
                  <th style={thStyle("center")}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const meta = STATUS_META[b.status];
                  const active = b.productId === selectedId;
                  return (
                    <tr
                      key={b.productId}
                      className="profit-row"
                      style={{
                        borderBottom: `1px solid ${COLOR.rule}`,
                        background: active ? COLOR.paperDeep : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedId(b.productId)}
                    >
                      <td
                        style={{
                          padding: "14px 12px",
                          fontFamily: FONT.serif,
                          fontSize: 16,
                          color: COLOR.ink,
                        }}
                      >
                        {b.productName}
                        {b.productId === "martini-flight" && (
                          <div
                            style={{
                              fontSize: 11,
                              fontStyle: "italic",
                              color: COLOR.muted,
                              marginTop: 2,
                              fontFamily: FONT.serif,
                            }}
                          >
                            Derived recipe pending — aggregated from component SKU costs
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "14px 12px",
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          fontSize: 12,
                          color: COLOR.muted,
                          ...smallCaps,
                          ...tabularNums,
                        }}
                      >
                        {b.size}
                      </td>
                      <td
                        style={{
                          padding: "14px 12px",
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          color: COLOR.inkSoft,
                          ...tabularNums,
                        }}
                      >
                        {fmt(b.hardcodedCogs)}
                      </td>
                      <td
                        style={{
                          padding: "14px 12px",
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          color: b.status === "no-recipe" ? COLOR.mutedLight : COLOR.ink,
                          fontWeight: 500,
                          ...tabularNums,
                        }}
                      >
                        {b.status === "no-recipe" ? "—" : fmt(b.derivedCogs)}
                      </td>
                      <td
                        style={{
                          padding: "14px 12px",
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          fontWeight: 600,
                          color:
                            b.status === "no-recipe"
                              ? COLOR.mutedLight
                              : Math.abs(b.deltaPct) < 3
                              ? COLOR.positive
                              : Math.abs(b.deltaPct) < 10
                              ? COLOR.accent
                              : COLOR.flag,
                          ...tabularNums,
                        }}
                      >
                        {b.status === "no-recipe" ? "—" : fmtPct(b.deltaPct)}
                      </td>
                      <td style={{ padding: "14px 12px", textAlign: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            color: meta.color,
                            ...smallCaps,
                          }}
                        >
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <SkuDetail breakdown={selected} />
            ) : (
              <div
                style={{
                  borderTop: `1px solid ${COLOR.rule}`,
                  borderBottom: `1px solid ${COLOR.rule}`,
                  padding: "80px 24px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: FONT.serif,
                    fontStyle: "italic",
                    fontSize: 16,
                    color: COLOR.muted,
                    maxWidth: 400,
                    margin: "0 auto",
                  }}
                >
                  Select a SKU to see the full ingredient-level cost breakdown.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <style>{`
        .profit-row:hover { background: ${COLOR.paperDeep}; }
        @media (max-width: 960px) {
          .profit-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </div>
  );
}

function thStyle(align: "left" | "right" | "center") {
  return {
    padding: "12px 12px",
    textAlign: align,
    fontSize: 10,
    color: COLOR.muted,
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
    ...smallCaps,
  };
}

function SkuDetail({ breakdown: b }: { breakdown: SkuCostBreakdown }) {
  const meta = STATUS_META[b.status];
  const mappedLines = b.lines.filter((l) => l.mapped);
  const unmappedLines = b.lines.filter((l) => !l.mapped);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ borderTop: `2px solid ${COLOR.ink}`, paddingTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
          <div>
            <h2
              style={{
                fontFamily: FONT.serif,
                fontSize: 30,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: COLOR.ink,
                marginBottom: 6,
              }}
            >
              {b.productName}
            </h2>
            <p style={{ fontSize: 11, color: COLOR.accent, ...smallCaps }}>
              {b.size} · {b.recipeName ?? "No recipe linked"}
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              color: meta.color,
              paddingTop: 6,
              ...smallCaps,
            }}
          >
            {meta.label}
          </span>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 24,
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "16px 0",
        }}
      >
        <SummaryStat label="Hardcoded" value={fmt(b.hardcodedCogs)} />
        <SummaryStat
          label="Liquid"
          value={b.status === "no-recipe" ? "—" : fmt(b.derivedLiquidCogs)}
        />
        <SummaryStat label="Labour" value={fmt(b.labour)} />
        <SummaryStat
          label="Derived"
          value={b.status === "no-recipe" ? "—" : fmt(b.derivedCogs)}
          sub="liquid + labour"
          color={
            b.status === "match"
              ? COLOR.positive
              : b.status === "close"
              ? COLOR.accent
              : b.status === "gap"
              ? COLOR.flag
              : undefined
          }
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 24,
        }}
      >
        <SummaryStat
          label="Delta"
          value={b.status === "no-recipe" ? "—" : `${fmt(b.delta)} (${fmtPct(b.deltaPct)})`}
          sub="derived − hardcoded"
          color={
            b.status === "no-recipe"
              ? undefined
              : Math.abs(b.deltaPct) < 3
              ? COLOR.positive
              : Math.abs(b.deltaPct) < 10
              ? COLOR.accent
              : COLOR.flag
          }
        />
        <SummaryStat
          label="Packaging (not in COGS)"
          value={fmt(b.packaging.packagingTotal)}
          sub={`Bottle ${fmt(b.packaging.bottle)} · Label ${fmt(b.packaging.label)} · Hygiene ${fmt(b.packaging.hygieneLabel)}`}
        />
      </section>

      {b.unmappedPct > 0 && (
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 13,
            color: COLOR.flag,
            lineHeight: 1.55,
          }}
        >
          {b.unmappedPct.toFixed(1)}% of the recipe has no cost assigned
          ({b.unmappedIngredients.join(", ")}). The derived COGS understates the real
          cost by this share.
        </p>
      )}

      {/* Ingredient breakdown */}
      {b.lines.length > 0 && (
        <section>
          <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 12, ...smallCaps }}>
            Ingredient cost breakdown — {b.bottleSizeMl} ml bottle
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
                <th style={thStyle("left")}>Ingredient</th>
                <th style={thStyle("right")}>Share</th>
                <th style={thStyle("right")}>ml</th>
                <th style={thStyle("right")}>£/ml</th>
                <th style={thStyle("right")}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {mappedLines.map((line) => (
                <tr
                  key={line.recipeIngredientName}
                  style={{ borderBottom: `1px solid ${COLOR.rule}` }}
                >
                  <td
                    style={{
                      padding: "12px 12px",
                      fontFamily: FONT.serif,
                      fontSize: 15,
                      color: COLOR.ink,
                    }}
                  >
                    {line.recipeIngredientName}
                  </td>
                  <td style={numCellStyle(COLOR.muted)}>{line.sharePct.toFixed(1)}%</td>
                  <td style={numCellStyle(COLOR.muted)}>{line.mlInBottle.toFixed(1)}</td>
                  <td style={numCellStyle(COLOR.muted)}>
                    {line.ingredient ? `£${pricePerMlFmt(line.ingredient)}` : "—"}
                  </td>
                  <td style={numCellStyle(COLOR.ink)}>{fmt(line.cost)}</td>
                </tr>
              ))}

              {unmappedLines.map((line) => (
                <tr
                  key={line.recipeIngredientName}
                  style={{ borderBottom: `1px solid ${COLOR.rule}` }}
                >
                  <td
                    style={{
                      padding: "12px 12px",
                      fontFamily: FONT.serif,
                      fontSize: 15,
                      color: COLOR.mutedLight,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {line.recipeIngredientName}
                    <span style={{ fontSize: 9, color: COLOR.flag, ...smallCaps }}>unmapped</span>
                  </td>
                  <td style={numCellStyle(COLOR.mutedLight)}>{line.sharePct.toFixed(1)}%</td>
                  <td style={numCellStyle(COLOR.mutedLight)}>{line.mlInBottle.toFixed(1)}</td>
                  <td style={numCellStyle(COLOR.mutedLight)}>—</td>
                  <td style={numCellStyle(COLOR.flag)}>£0.00</td>
                </tr>
              ))}

              {/* Subtotals */}
              <tr style={{ borderTop: `1px solid ${COLOR.ruleBold}` }}>
                <td style={{ padding: "12px 12px", fontSize: 13, color: COLOR.muted, ...smallCaps }}>
                  Liquid subtotal
                </td>
                <td style={numCellStyle(COLOR.muted)}>100%</td>
                <td style={numCellStyle(COLOR.muted)}>{b.bottleSizeMl}</td>
                <td />
                <td style={numCellStyle(COLOR.ink)}>{fmt(b.derivedLiquidCogs)}</td>
              </tr>
              <tr>
                <td style={{ padding: "10px 12px", fontSize: 12, color: COLOR.muted, fontFamily: FONT.serif, fontStyle: "italic" }}>
                  + Labour (per bottle)
                </td>
                <td /><td /><td />
                <td style={numCellStyle(COLOR.inkSoft)}>{fmt(b.labour)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${COLOR.ink}` }}>
                <td
                  style={{
                    padding: "16px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 17,
                    fontWeight: 500,
                    color: COLOR.ink,
                  }}
                >
                  Derived COGS
                </td>
                <td /><td /><td />
                <td
                  style={{
                    padding: "16px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontWeight: 600,
                    fontSize: 16,
                    color: COLOR.ink,
                    ...tabularNums,
                  }}
                >
                  {fmt(b.derivedCogs)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
}

function pricePerMlFmt(ing: { currentPrice: number; bottleSizeMl: number }): string {
  return (ing.currentPrice / ing.bottleSizeMl).toFixed(4);
}

function numCellStyle(color: string): React.CSSProperties {
  return {
    padding: "12px 12px",
    textAlign: "right",
    fontFamily: FONT.mono,
    color,
    ...tabularNums,
  };
}

function SummaryStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>
        {label}
      </p>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 22,
          fontWeight: 400,
          color: color ?? COLOR.ink,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          ...tabularNums,
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: 11,
            color: COLOR.muted,
            marginTop: 4,
            lineHeight: 1.4,
            fontFamily: FONT.sans,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
