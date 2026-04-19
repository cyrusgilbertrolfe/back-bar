"use client";

import { useState } from "react";
import type { SkuCostBreakdown, CogsSummary } from "@/lib/cogs";

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

const STATUS_BADGE: Record<SkuCostBreakdown["status"], { label: string; color: string; bg: string }> = {
  match: { label: "Match", color: "#4fae8f", bg: "rgba(79,174,143,0.1)" },
  close: { label: "Close", color: "#c9a227", bg: "rgba(201,162,39,0.1)" },
  gap: { label: "Gap", color: "#e07a5f", bg: "rgba(224,122,95,0.1)" },
  "no-recipe": { label: "No recipe", color: "#555", bg: "rgba(85,85,85,0.1)" },
};

type Props = {
  breakdowns: SkuCostBreakdown[];
  summary: CogsSummary;
};

export default function ProfitabilityClient({ breakdowns, summary }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered =
    filterStatus === "all"
      ? breakdowns
      : breakdowns.filter((b) => b.status === filterStatus);

  const selected = breakdowns.find((b) => b.productId === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-8">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="SKUs" value={String(summary.totalSkus)} />
        <SummaryCard
          label="Matched"
          value={String(summary.matched)}
          sub="< 3% delta"
          color="#4fae8f"
        />
        <SummaryCard
          label="Close"
          value={String(summary.close)}
          sub="3-10% delta"
          color="#c9a227"
        />
        <SummaryCard
          label="Gaps"
          value={String(summary.gap + summary.noRecipe)}
          sub="> 10% or unmapped"
          color="#e07a5f"
        />
        <SummaryCard
          label="Total hardcoded"
          value={fmt(summary.totalHardcodedCogs)}
          sub="sum of all SKU COGS"
        />
        <SummaryCard
          label="Derived COGS"
          value={fmt(summary.totalDerivedCogs)}
          sub={`Liquid ${fmt(summary.totalDerivedLiquidCogs)} + Labour ${fmt(summary.totalLabour)}`}
          color="#c9a227"
        />
        <SummaryCard
          label="Aggregate delta"
          value={fmt(summary.totalDelta)}
          sub="derived − hardcoded"
          color={Math.abs(summary.totalDelta) < 10 ? "#4fae8f" : "#e07a5f"}
        />
      </div>

      {/* Unmapped ingredients notice */}
      {summary.unmappedIngredients.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: "rgba(224,122,95,0.06)", border: "1px solid rgba(224,122,95,0.15)" }}
        >
          <p className="text-xs uppercase tracking-[0.12em] font-semibold mb-2" style={{ color: "#e07a5f" }}>
            Unmapped ingredients — no cost assigned
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#999" }}>
            These recipe ingredients have no entry in the ingredient master, so their cost is treated as
            £0 in the derived COGS. The delta between derived and hardcoded COGS partly reflects this.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {summary.unmappedIngredients.map((name) => (
              <span
                key={name}
                className="px-2.5 py-1 rounded text-xs"
                style={{ background: "rgba(224,122,95,0.1)", color: "#e07a5f" }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs + table */}
      <div>
        <div className="flex gap-2 mb-4">
          {["all", "match", "close", "gap", "no-recipe"].map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className="px-3 py-1.5 rounded text-xs font-medium uppercase transition-all"
              style={{
                background: filterStatus === f ? "#1a1a1a" : "transparent",
                color: filterStatus === f ? "#c9a227" : "#555",
                letterSpacing: "0.1em",
              }}
            >
              {f === "all" ? `All (${breakdowns.length})` : f === "no-recipe" ? "No recipe" : `${f} (${breakdowns.filter((b) => b.status === f).length})`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6">
          {/* SKU table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
          >
            <div
              className="grid grid-cols-[1.6fr_0.5fr_0.6fr_0.6fr_0.5fr_0.4fr] gap-1 px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold"
              style={{ color: "#555", borderBottom: "1px solid #1c1c1c" }}
            >
              <span>SKU</span>
              <span className="text-right">Size</span>
              <span className="text-right">Hardcoded</span>
              <span className="text-right">Derived</span>
              <span className="text-right">Delta</span>
              <span className="text-center">Status</span>
            </div>
            <ul>
              {filtered.map((b) => {
                const badge = STATUS_BADGE[b.status];
                const active = b.productId === selectedId;
                return (
                  <li key={b.productId}>
                    <button
                      onClick={() => setSelectedId(b.productId)}
                      className="w-full grid grid-cols-[1.6fr_0.5fr_0.6fr_0.6fr_0.5fr_0.4fr] gap-1 px-4 py-3 text-sm text-left transition-colors"
                      style={{
                        background: active ? "#121212" : "transparent",
                        borderBottom: "1px solid #141414",
                        color: active ? "#f0f0f0" : "#cfcfcf",
                      }}
                    >
                      <span className="truncate flex flex-col">
                        <span className="truncate">{b.productName}</span>
                        {b.productId === "martini-flight" && (
                          <span className="text-[10px] italic" style={{ color: "#666" }}>
                            Derived recipe pending — aggregated from component SKU costs
                          </span>
                        )}
                      </span>
                      <span className="text-right tabular-nums" style={{ color: "#777" }}>
                        {b.size}
                      </span>
                      <span className="text-right tabular-nums">{fmt(b.hardcodedCogs)}</span>
                      <span
                        className="text-right tabular-nums"
                        style={{ color: b.status === "no-recipe" ? "#555" : "#cfcfcf" }}
                      >
                        {b.status === "no-recipe" ? "—" : fmt(b.derivedCogs)}
                      </span>
                      <span
                        className="text-right tabular-nums font-semibold"
                        style={{
                          color:
                            b.status === "no-recipe"
                              ? "#555"
                              : Math.abs(b.deltaPct) < 3
                              ? "#4fae8f"
                              : Math.abs(b.deltaPct) < 10
                              ? "#c9a227"
                              : "#e07a5f",
                        }}
                      >
                        {b.status === "no-recipe" ? "—" : fmtPct(b.deltaPct)}
                      </span>
                      <span className="flex justify-center">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em]"
                          style={{ color: badge.color, background: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail panel */}
          <div>
            {selected ? (
              <SkuDetail breakdown={selected} />
            ) : (
              <div
                className="rounded-xl p-10 text-center"
                style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
              >
                <div className="w-8 h-px mx-auto mb-6" style={{ background: "#c9a227" }} />
                <p className="text-sm" style={{ color: "#555" }}>
                  Select a SKU to see the full ingredient-level cost breakdown.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkuDetail({ breakdown: b }: { breakdown: SkuCostBreakdown }) {
  const badge = STATUS_BADGE[b.status];
  const mappedLines = b.lines.filter((l) => l.mapped);
  const unmappedLines = b.lines.filter((l) => !l.mapped);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-xl p-6" style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="w-8 h-px mb-5" style={{ background: "#c9a227" }} />
            <h2 className="text-2xl font-bold" style={{ color: "#f0f0f0", letterSpacing: "-0.01em" }}>
              {b.productName}
            </h2>
            <p className="text-xs uppercase tracking-[0.15em] mt-1" style={{ color: "#c9a227" }}>
              {b.size} · {b.recipeName ?? "No recipe linked"}
            </p>
          </div>
          <span
            className="px-3 py-1 rounded text-xs font-semibold uppercase tracking-[0.08em]"
            style={{ color: badge.color, background: badge.bg }}
          >
            {badge.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Hardcoded COGS" value={fmt(b.hardcodedCogs)} />
          <StatCard
            label="Liquid"
            value={b.status === "no-recipe" ? "—" : fmt(b.derivedLiquidCogs)}
          />
          <StatCard
            label="Labour"
            value={fmt(b.labour)}
          />
          <StatCard
            label="Derived COGS"
            value={b.status === "no-recipe" ? "—" : fmt(b.derivedCogs)}
            sub="Liquid + labour"
            color={b.status === "match" ? "#4fae8f" : b.status === "close" ? "#c9a227" : "#e07a5f"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <StatCard
            label="Delta (derived − hardcoded)"
            value={b.status === "no-recipe" ? "—" : `${fmt(b.delta)} (${fmtPct(b.deltaPct)})`}
            color={
              b.status === "no-recipe"
                ? "#555"
                : Math.abs(b.deltaPct) < 3
                ? "#4fae8f"
                : Math.abs(b.deltaPct) < 10
                ? "#c9a227"
                : "#e07a5f"
            }
          />
          <StatCard
            label="Packaging (not in COGS)"
            value={fmt(b.packaging.packagingTotal)}
            sub={`Bottle ${fmt(b.packaging.bottle)} · Label ${fmt(b.packaging.label)} · Hygiene ${fmt(b.packaging.hygieneLabel)}`}
          />
        </div>

        {b.unmappedPct > 0 && (
          <p className="text-xs mt-4" style={{ color: "#e07a5f" }}>
            {b.unmappedPct.toFixed(1)}% of the recipe has no cost assigned (
            {b.unmappedIngredients.join(", ")}). The derived COGS understates the real cost by this share.
          </p>
        )}
      </div>

      {/* Ingredient breakdown */}
      {b.lines.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}
        >
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #1c1c1c" }}>
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: "#555" }}>
              Ingredient cost breakdown — {b.bottleSizeMl} ml bottle
            </p>
          </div>

          <div
            className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold"
            style={{ color: "#555", borderBottom: "1px solid #141414" }}
          >
            <span>Ingredient</span>
            <span className="text-right">Share</span>
            <span className="text-right">ml</span>
            <span className="text-right">£/ml</span>
            <span className="text-right">Cost</span>
          </div>

          <ul>
            {/* Mapped lines first */}
            {mappedLines.map((line) => (
              <li
                key={line.recipeIngredientName}
                className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-3 text-sm tabular-nums"
                style={{ borderBottom: "1px solid #141414", color: "#cfcfcf" }}
              >
                <span className="truncate">{line.recipeIngredientName}</span>
                <span className="text-right" style={{ color: "#777" }}>
                  {line.sharePct.toFixed(1)}%
                </span>
                <span className="text-right" style={{ color: "#777" }}>
                  {line.mlInBottle.toFixed(1)}
                </span>
                <span className="text-right" style={{ color: "#777" }}>
                  {line.ingredient ? `£${pricePerMlFmt(line.ingredient)}` : "—"}
                </span>
                <span className="text-right">{fmt(line.cost)}</span>
              </li>
            ))}

            {/* Unmapped lines */}
            {unmappedLines.map((line) => (
              <li
                key={line.recipeIngredientName}
                className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-3 text-sm tabular-nums"
                style={{ borderBottom: "1px solid #141414", color: "#777" }}
              >
                <span className="truncate flex items-center gap-2">
                  {line.recipeIngredientName}
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                    style={{ color: "#e07a5f", background: "rgba(224,122,95,0.1)" }}
                  >
                    unmapped
                  </span>
                </span>
                <span className="text-right">{line.sharePct.toFixed(1)}%</span>
                <span className="text-right">{line.mlInBottle.toFixed(1)}</span>
                <span className="text-right">—</span>
                <span className="text-right" style={{ color: "#e07a5f" }}>
                  £0.00
                </span>
              </li>
            ))}
          </ul>

          {/* Subtotal + labour → COGS total */}
          <div
            className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-3 text-sm"
            style={{ borderTop: "1px solid #1c1c1c", color: "#999" }}
          >
            <span>Liquid subtotal</span>
            <span className="text-right">100%</span>
            <span className="text-right">{b.bottleSizeMl}</span>
            <span />
            <span className="text-right">{fmt(b.derivedLiquidCogs)}</span>
          </div>
          <div
            className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-2 text-xs"
            style={{ color: "#666" }}
          >
            <span className="pl-4">+ Labour (per bottle)</span>
            <span /><span /><span />
            <span className="text-right">{fmt(b.labour)}</span>
          </div>
          <div
            className="grid grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr_0.5fr] gap-2 px-6 py-4 text-sm font-semibold"
            style={{ borderTop: "1px solid #1c1c1c", color: "#f0f0f0" }}
          >
            <span>Derived COGS</span>
            <span /><span /><span />
            <span className="text-right">{fmt(b.derivedCogs)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function pricePerMlFmt(ing: { currentPrice: number; bottleSizeMl: number }): string {
  return (ing.currentPrice / ing.bottleSizeMl).toFixed(4);
}

function SummaryCard({
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
    <div className="rounded-xl p-4" style={{ background: "#0a0a0a", border: "1px solid #1c1c1c" }}>
      <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: "#555" }}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: color ?? "#f0f0f0" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] mt-1" style={{ color: "#444" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
      <p className="text-[9px] uppercase tracking-[0.12em]" style={{ color: "#555" }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: color ?? "#f0f0f0" }}>
        {value}
      </p>
      {sub && (
        <p className="text-[9px] mt-1 leading-tight" style={{ color: "#444" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
