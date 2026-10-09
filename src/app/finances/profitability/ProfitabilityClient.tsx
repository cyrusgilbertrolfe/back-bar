"use client";

import { useState } from "react";
import Link from "next/link";
import type { SkuCost, CostLine } from "@/lib/erp/cogs";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import CostSourceBadge from "@/components/CostSourceBadge";
import { costCaveat } from "@/lib/erp/provenance";

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

export type CogsPageSummary = {
  totalSkus: number;
  clean: number;
  withUnsourced: number;
  withPlaceholders: number;
  withProblems: number;
  totalCogs: number;
  totalLiquid: number;
  totalPackaging: number;
  totalWastage: number;
  /** Share of total COGS that traces to a supplier invoice, 0 to 100. */
  invoiceBackedPct: number;
  wastagePct: number;
  unsourcedNames: string[];
  placeholderNames: string[];
};

type Filter = "all" | "clean" | "unsourced" | "placeholders" | "problems";

type Props = {
  breakdowns: SkuCost[];
  summary: CogsPageSummary;
};

function skuStatus(b: SkuCost): { label: string; color: string } {
  if (b.problems.length > 0) return { label: "Problem", color: COLOR.flag };
  if (b.unsourced.length > 0) return { label: "Unsourced lines", color: COLOR.flag };
  if (b.placeholders.length > 0) return { label: "Placeholder", color: COLOR.accentSoft };
  return { label: "Clean", color: COLOR.positive };
}

export default function ProfitabilityClient({ breakdowns, summary }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const matches = (b: SkuCost, f: Filter) => {
    switch (f) {
      case "all":
        return true;
      case "clean":
        return b.unsourced.length === 0 && b.placeholders.length === 0 && b.problems.length === 0;
      case "unsourced":
        return b.unsourced.length > 0;
      case "placeholders":
        return b.placeholders.length > 0;
      case "problems":
        return b.problems.length > 0;
    }
  };

  const filtered = breakdowns.filter((b) => matches(b, filter));
  const selected = breakdowns.find((b) => b.skuId === selectedId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* Summary */}
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
          label="Clean"
          value={String(summary.clean)}
          sub="every line sourced"
          color={COLOR.positive}
        />
        <SummaryStat
          label="With unsourced lines"
          value={String(summary.withUnsourced)}
          color={summary.withUnsourced > 0 ? COLOR.flag : COLOR.positive}
        />
        <SummaryStat
          label="On placeholders"
          value={String(summary.withPlaceholders)}
          sub="declared stand-ins"
          color={summary.withPlaceholders > 0 ? COLOR.accentSoft : COLOR.positive}
        />
        <SummaryStat
          label="Invoice-backed"
          value={`${summary.invoiceBackedPct.toFixed(1)}%`}
          sub="of total COGS"
          color={summary.invoiceBackedPct >= 90 ? COLOR.positive : COLOR.accent}
        />
        <SummaryStat
          label="Total COGS"
          value={fmt(summary.totalCogs)}
          sub={`Liquid ${fmt(summary.totalLiquid)} + packaging ${fmt(summary.totalPackaging)} + wastage ${fmt(summary.totalWastage)}`}
        />
        <SummaryStat
          label="Wastage"
          value={`${(summary.wastagePct * 100).toFixed(1)}%`}
          sub="applied to every SKU"
        />
      </section>

      {/* Unsourced + placeholder notice */}
      {(summary.unsourcedNames.length > 0 || summary.placeholderNames.length > 0) && (
        <section
          style={{
            borderTop: `1px solid ${COLOR.flag}`,
            borderBottom: `1px solid ${COLOR.flag}`,
            padding: "20px 0",
          }}
        >
          <p style={{ fontSize: 11, color: COLOR.flag, marginBottom: 8, ...smallCaps }}>
            Cost lines with no record behind them
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
            These lines are in the COGS at their current figure, but nothing records where
            the figure came from, or it is a declared placeholder. They are named here so
            nobody mistakes the totals for traced ones. Prices entered by hand from the best
            information we have are the standard way of working and are not listed.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {summary.unsourcedNames.map((name) => (
              <span
                key={`u-${name}`}
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
            {summary.placeholderNames.map((name) => (
              <span
                key={`p-${name}`}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  fontFamily: FONT.mono,
                  color: COLOR.accentSoft,
                  border: `1px solid ${COLOR.rule}`,
                }}
                title="Declared placeholder: a stand-in with someone working on the real figure"
              >
                {name} (placeholder)
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Filter tabs + table + detail grid */}
      <section>
        <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
          {(
            [
              ["all", "All"],
              ["clean", "Clean"],
              ["unsourced", "Unsourced"],
              ["placeholders", "Placeholders"],
              ["problems", "Problems"],
            ] as [Filter, string][]
          ).map(([f, label]) => {
            const active = filter === f;
            const count = breakdowns.filter((b) => matches(b, f)).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 0",
                  fontSize: 11,
                  cursor: "pointer",
                  color: active ? COLOR.accent : COLOR.muted,
                  borderBottom: active ? `1px solid ${COLOR.accent}` : "1px solid transparent",
                  ...smallCaps,
                }}
              >
                {label} ({count})
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
                  <th style={thStyle("right")}>Liquid</th>
                  <th style={thStyle("right")}>Packaging</th>
                  <th style={thStyle("right")}>COGS</th>
                  <th style={thStyle("center")}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const meta = skuStatus(b);
                  const active = b.skuId === selectedId;
                  return (
                    <tr
                      key={b.skuId}
                      className="profit-row"
                      style={{
                        borderBottom: `1px solid ${COLOR.rule}`,
                        background: active ? COLOR.paperDeep : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedId(b.skuId)}
                    >
                      <td
                        style={{
                          padding: "14px 12px",
                          fontFamily: FONT.serif,
                          fontSize: 16,
                          color: COLOR.ink,
                        }}
                      >
                        {b.drinkName ?? b.skuCode}
                        <div
                          style={{
                            fontFamily: FONT.mono,
                            fontSize: 10,
                            color: COLOR.mutedLight,
                            marginTop: 2,
                          }}
                        >
                          {[b.clientName, b.skuCode].filter(Boolean).join(" · ")}
                        </div>
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
                        {b.sizeMl}ml
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
                        {fmt(b.liquidTotal)}
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
                        {fmt(b.packagingTotal)}
                      </td>
                      <td
                        style={{
                          padding: "14px 12px",
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          color: COLOR.ink,
                          fontWeight: 500,
                          ...tabularNums,
                        }}
                      >
                        {fmt(b.total)}
                      </td>
                      <td style={{ padding: "14px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: 10, color: meta.color, ...smallCaps }}>
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
                  Select a SKU to see the full line-level cost build.
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

function SkuDetail({ breakdown: b }: { breakdown: SkuCost }) {
  const meta = skuStatus(b);
  const caveat = costCaveat({ placeholders: b.placeholders.length, unsourced: b.unsourcedLines });

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
              {b.drinkName ?? b.skuCode}
            </h2>
            <p style={{ fontSize: 11, color: COLOR.accent, ...smallCaps }}>
              {b.sizeMl}ml · {b.clientName ?? "no client"} · {b.skuCode}
            </p>
            <Link
              href={`/finances/cogs/${b.skuId}`}
              style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: COLOR.ink, ...smallCaps }}
            >
              Open the rollup, every step →
            </Link>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 10, color: COLOR.muted, marginRight: 8, ...smallCaps }}>
                Weakest source, oldest input
              </span>
              <CostSourceBadge source={b.costSource} date={b.costAsOf} />
            </div>
            {caveat && (
              <p style={{ fontSize: 11, color: COLOR.flag, marginTop: 6, ...smallCaps }}>
                {caveat}
              </p>
            )}
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
        <SummaryStat label="Liquid" value={fmt(b.liquidTotal)} />
        <SummaryStat label="Packaging" value={fmt(b.packagingTotal)} />
        <SummaryStat
          label={`Wastage (${(b.wastagePct * 100).toFixed(1)}%)`}
          value={fmt(b.wastage)}
        />
        <SummaryStat label="COGS" value={fmt(b.total)} color={meta.color} />
        <SummaryStat
          label="Invoice-backed"
          value={`${b.invoiceBackedPct.toFixed(1)}%`}
          color={b.invoiceBackedPct >= 90 ? COLOR.positive : COLOR.accent}
        />
      </section>

      {b.problems.length > 0 && (
        <div>
          {b.problems.map((p) => (
            <p
              key={p}
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 13,
                color: COLOR.flag,
                lineHeight: 1.55,
              }}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {b.liquid.length > 0 && (
        <LineTable title={`Liquid, ${b.sizeMl} ml bottle`} lines={b.liquid} total={b.liquidTotal} totalLabel="Liquid subtotal" />
      )}

      {b.packaging.length > 0 && (
        <LineTable title="Primary packaging (in COGS)" lines={b.packaging} total={b.packagingTotal} totalLabel="Packaging subtotal" />
      )}

      {b.excluded.length > 0 && (
        <LineTable
          title="Excluded from COGS (channel costs)"
          lines={b.excluded}
          total={b.excluded.reduce((s, l) => s + l.cost, 0)}
          totalLabel="Excluded subtotal"
          mutedTitle
        />
      )}

      {/* Rollup */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <tr>
            <td style={{ padding: "8px 12px", fontSize: 12, color: COLOR.muted, fontFamily: FONT.serif, fontStyle: "italic" }}>
              Subtotal (liquid + packaging)
            </td>
            <td style={numCellStyle(COLOR.inkSoft)}>{fmt(b.subtotal)}</td>
          </tr>
          <tr>
            <td style={{ padding: "8px 12px", fontSize: 12, color: COLOR.muted, fontFamily: FONT.serif, fontStyle: "italic" }}>
              + Wastage ({(b.wastagePct * 100).toFixed(1)}%)
            </td>
            <td style={numCellStyle(COLOR.inkSoft)}>{fmt(b.wastage)}</td>
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
              COGS
            </td>
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
              {fmt(b.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LineTable({
  title,
  lines,
  total,
  totalLabel,
  mutedTitle,
}: {
  title: string;
  lines: CostLine[];
  total: number;
  totalLabel: string;
  mutedTitle?: boolean;
}) {
  return (
    <section>
      <p style={{ fontSize: 10, color: mutedTitle ? COLOR.mutedLight : COLOR.muted, marginBottom: 12, ...smallCaps }}>
        {title}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            <th style={thStyle("left")}>Line</th>
            <th style={thStyle("right")}>Qty</th>
            <th style={thStyle("right")}>Unit cost</th>
            <th style={thStyle("right")}>Cost</th>
            <th style={thStyle("right")}>Source · as of</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            return (
              <tr key={`${line.kind}-${line.componentId}`} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td
                  style={{
                    padding: "12px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 15,
                    color: COLOR.ink,
                  }}
                >
                  {line.name}
                  {line.kind !== "liquid" && (
                    <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.mutedLight, ...smallCaps }}>
                      {line.kind.replace(/_/g, " ")}
                    </span>
                  )}
                </td>
                <td style={numCellStyle(COLOR.muted)}>
                  {line.kind === "liquid"
                    ? `${line.quantity.toFixed(1)} ml`
                    : `× ${line.quantity.toLocaleString("en-GB")}`}
                </td>
                <td style={numCellStyle(COLOR.muted)}>£{line.unitCost.toFixed(4)}</td>
                <td style={numCellStyle(COLOR.ink)}>{fmt(line.cost)}</td>
                <td style={{ padding: "12px 12px", textAlign: "right" }}>
                  <CostSourceBadge source={line.source} date={line.setAt} fontSize={10} block />
                </td>
              </tr>
            );
          })}
          <tr style={{ borderTop: `1px solid ${COLOR.ruleBold}` }}>
            <td style={{ padding: "12px 12px", fontSize: 13, color: COLOR.muted, ...smallCaps }}>
              {totalLabel}
            </td>
            <td />
            <td />
            <td style={numCellStyle(COLOR.ink)}>{fmt(total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  );
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
