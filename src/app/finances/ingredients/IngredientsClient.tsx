"use client";

import { useMemo, useState, useTransition } from "react";
import { updateIngredientPrice } from "@/app/actions/ingredients";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import CostSourceBadge from "@/components/CostSourceBadge";
import type { CostSource } from "@/lib/erp/provenance";

// Plain serialisable shapes passed down from the server page. These mirror
// @/lib/erp/ingredients but carry no server-only imports.
export type ClientIngredient = {
  id: number;
  name: string;
  type: string;
  uom: string;
  packSize: number | null;
  packCost: number | null;
  /** £ per UOM, the operative costing figure. */
  unitCost: number;
  unitCostSetAt: string | null;
  provenance: CostSource;
  isSubRecipe: boolean;
  notes: string | null;
};

export type ClientPriceHistoryRow = {
  componentId: number;
  date: string;
  unitCost: number;
  source: string;
  note: string | null;
};

export type RecipeUsageRow = {
  componentId: number;
  drinkName: string;
  clientName: string;
  percentage: number;
};

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 });

const fmtDelta = (n: number) => {
  const abs = Math.abs(n).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  });
  if (n > 0.005) return `+${abs}`;
  if (n < -0.005) return `−${abs}`;
  return abs;
};

const fmtMl = (n: number) =>
  n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " ml";

const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

type Props = {
  ingredients: ClientIngredient[];
  priceHistory: ClientPriceHistoryRow[];
  recipeUsage: RecipeUsageRow[];
  usageCounts: Record<number, number>;
};

export default function IngredientsClient({
  ingredients,
  priceHistory,
  recipeUsage,
  usageCounts,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  const selected = ingredients.find((i) => i.id === selectedId) ?? null;
  const selectedHistory = useMemo(
    () => (selected ? priceHistory.filter((h) => h.componentId === selected.id) : []),
    [priceHistory, selected],
  );
  const selectedUsage = useMemo(
    () => (selected ? recipeUsage.filter((u) => u.componentId === selected.id) : []),
    [recipeUsage, selected],
  );

  return (
    <div
      className="ingredients-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.2fr",
        gap: 48,
      }}
    >
      {/* LEFT: ingredient table */}
      <section>
        <input
          type="text"
          placeholder="Search ingredients…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            outline: "none",
            background: "transparent",
            border: `1px solid ${COLOR.rule}`,
            color: COLOR.ink,
            fontFamily: FONT.sans,
            marginBottom: 20,
          }}
        />

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, tableLayout: "fixed" }}>
          <colgroup>
            <col />
            <col style={{ width: 76 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr
              style={{
                borderTop: `2px solid ${COLOR.ink}`,
                borderBottom: `1px solid ${COLOR.ruleBold}`,
              }}
            >
              <th style={thStyle("left")}>Ingredient</th>
              <th style={thStyle("right")}>Pack</th>
              <th style={thStyle("right")}>Price</th>
              <th style={thStyle("right")}>Used in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ing) => {
              const active = ing.id === selectedId;
              const count = usageCounts[ing.id] ?? 0;
              const displayPrice =
                ing.packSize && ing.packSize > 1 && ing.packCost !== null
                  ? ing.packCost
                  : ing.unitCost;
              const priced = ing.provenance !== "unsourced" || displayPrice > 0;
              return (
                <tr
                  key={ing.id}
                  className="ing-row"
                  style={{
                    borderBottom: `1px solid ${COLOR.rule}`,
                    background: active ? COLOR.paperDeep : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedId(ing.id)}
                >
                  <td
                    style={{
                      padding: "14px 12px",
                      color: active ? COLOR.ink : COLOR.inkSoft,
                      fontFamily: FONT.serif,
                      fontSize: 16,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ing.name}
                    {ing.isSubRecipe && (
                      <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.accent, ...smallCaps }}>
                        made
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      ...tabularNums,
                    }}
                  >
                    {ing.packSize && ing.packSize > 1
                      ? `${ing.packSize} ${ing.uom}`
                      : `per ${ing.uom}`}
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: priced ? COLOR.ink : COLOR.flag,
                      ...tabularNums,
                    }}
                  >
                    {priced ? fmt(displayPrice) : "none"}
                    <div>
                      <CostSourceBadge source={ing.provenance} date={ing.unitCostSetAt} fontSize={9} block />
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: count > 0 ? COLOR.accent : COLOR.mutedLight,
                      ...tabularNums,
                    }}
                  >
                    {count}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* RIGHT: detail + impact preview */}
      <section>
        {selected ? (
          <IngredientDetail
            key={selected.id}
            ingredient={selected}
            history={selectedHistory}
            usage={selectedUsage}
          />
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
              Select an ingredient to see its history, the drinks that use it, and to model a
              price change.
            </p>
          </div>
        )}
      </section>

      <style>{`
        .ing-row:hover { background: ${COLOR.paperDeep}; }
        @media (max-width: 900px) {
          .ingredients-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
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

function IngredientDetail({
  ingredient,
  history,
  usage,
}: {
  ingredient: ClientIngredient;
  history: ClientPriceHistoryRow[];
  usage: RecipeUsageRow[];
}) {
  const pricedByPack = !!ingredient.packSize && ingredient.packSize > 1;
  const currentEditPrice = pricedByPack
    ? (ingredient.packCost ?? 0)
    : ingredient.unitCost;

  const [newPriceStr, setNewPriceStr] = useState(currentEditPrice.toString());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const newPrice = Number(newPriceStr);
  const newPriceValid = Number.isFinite(newPrice) && newPrice >= 0;
  const changed = newPriceValid && Math.abs(newPrice - currentEditPrice) > 0.0005;

  const currentUnit = ingredient.unitCost;
  const newUnit = newPriceValid
    ? pricedByPack
      ? newPrice / (ingredient.packSize ?? 1)
      : newPrice
    : currentUnit;

  const deltaPct =
    currentEditPrice > 0 ? ((newPrice - currentEditPrice) / currentEditPrice) * 100 : 0;

  // Price-change impact per drink at 500ml, from the live recipe shares.
  // Only meaningful for liquid (ml) components.
  const impact = useMemo(() => {
    if (ingredient.uom !== "ml") return [];
    return usage
      .map((u) => {
        const mlPer500 = (u.percentage / 100) * 500;
        return {
          key: `${u.drinkName} (${u.clientName})`,
          mlPer500,
          currentCostPer500: mlPer500 * currentUnit,
          newCostPer500: mlPer500 * newUnit,
          deltaPer500: mlPer500 * (newUnit - currentUnit),
        };
      })
      .sort((a, b) => Math.abs(b.deltaPer500) - Math.abs(a.deltaPer500));
  }, [usage, ingredient.uom, currentUnit, newUnit]);

  function handleSave() {
    if (!changed || !newPriceValid) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateIngredientPrice(ingredient.id, newPrice, note);
      if (res.ok) {
        setFeedback({
          kind: "ok",
          msg: "Saved to the database and stamped in the price history.",
        });
        setNote("");
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <header style={{ borderTop: `2px solid ${COLOR.ink}`, paddingTop: 20 }}>
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: COLOR.ink,
            marginBottom: 8,
          }}
        >
          {ingredient.name}
        </h2>
        <p style={{ fontSize: 11, color: COLOR.accent, ...smallCaps }}>
          {pricedByPack
            ? `${ingredient.packSize} ${ingredient.uom} · ${fmt(ingredient.packCost ?? 0)}`
            : `£${ingredient.unitCost.toFixed(4)} / ${ingredient.uom}`}
        </p>
        <p style={{ marginTop: 6 }}>
          <CostSourceBadge source={ingredient.provenance} date={ingredient.unitCostSetAt} fontSize={11} />
          <span style={{ fontSize: 10, color: COLOR.flag, ...smallCaps }}>
            {ingredient.provenance === "unsourced" &&
              " · this figure has no invoice or manual entry behind it"}
            {ingredient.provenance === "placeholder" &&
              " · a stand-in price, known to be wrong"}
          </span>
        </p>
        {ingredient.notes && (
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 14,
              color: COLOR.muted,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {ingredient.notes}
          </p>
        )}
      </header>

      {/* Scenario editor */}
      <section>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Model a price change
        </p>

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <label style={{ flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>
              {pricedByPack
                ? `New price (per ${ingredient.packSize} ${ingredient.uom} pack)`
                : `New price (per ${ingredient.uom})`}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newPriceStr}
              onChange={(e) => setNewPriceStr(e.target.value)}
              style={inputStyle()}
            />
          </label>
          <label style={{ flex: 1.4, minWidth: 240 }}>
            <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>
              Note (optional, shows up in history)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Supplier price increase Q2"
              style={inputStyle()}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            borderTop: `1px solid ${COLOR.rule}`,
            borderBottom: `1px solid ${COLOR.rule}`,
            padding: "16px 0",
            marginBottom: 20,
          }}
        >
          <Stat label={`Current £/${ingredient.uom}`} value={`£${currentUnit.toFixed(5)}`} />
          <Stat
            label={`New £/${ingredient.uom}`}
            value={`£${newUnit.toFixed(5)}`}
            color={changed ? COLOR.accent : undefined}
          />
          <Stat
            label="Change"
            value={changed ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "·"}
            color={changed ? (deltaPct >= 0 ? COLOR.flag : COLOR.positive) : undefined}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button
            disabled={!changed || isPending}
            onClick={handleSave}
            style={{
              background: changed && !isPending ? COLOR.ink : COLOR.rule,
              color: COLOR.paper,
              border: "none",
              padding: "10px 20px",
              fontSize: 11,
              cursor: changed && !isPending ? "pointer" : "default",
              opacity: !changed ? 0.5 : 1,
              ...smallCaps,
            }}
          >
            {isPending ? "Saving…" : "Save price change"}
          </button>
          {feedback && (
            <span
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 14,
                color: feedback.kind === "ok" ? COLOR.accent : COLOR.flag,
              }}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </section>

      {/* Impact preview */}
      <section>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 4, ...smallCaps }}>
          Impact on drinks
        </p>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 14,
            color: COLOR.muted,
            marginBottom: 16,
          }}
        >
          {ingredient.uom !== "ml"
            ? "Impact modelling applies to liquid ingredients; this component is costed per " +
              ingredient.uom +
              "."
            : impact.length === 0
            ? "No current recipes use this ingredient."
            : `${impact.length} recipe${impact.length === 1 ? "" : "s"}, sorted by biggest 500 ml impact`}
        </p>

        {impact.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr
                style={{
                  borderTop: `2px solid ${COLOR.ink}`,
                  borderBottom: `1px solid ${COLOR.ruleBold}`,
                }}
              >
                <th style={thStyle("left")}>Drink</th>
                <th style={thStyle("right")}>ml / 500</th>
                <th style={thStyle("right")}>Current</th>
                <th style={thStyle("right")}>New</th>
                <th style={thStyle("right")}>Δ / 500</th>
              </tr>
            </thead>
            <tbody>
              {impact.map((row) => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontFamily: FONT.serif,
                      fontSize: 15,
                      color: COLOR.ink,
                    }}
                  >
                    {row.key}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                      ...tabularNums,
                    }}
                  >
                    {fmtMl(row.mlPer500)}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.inkSoft,
                      ...tabularNums,
                    }}
                  >
                    {fmt(row.currentCostPer500)}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: changed ? COLOR.accent : COLOR.inkSoft,
                      fontWeight: changed ? 600 : 400,
                      ...tabularNums,
                    }}
                  >
                    {fmt(row.newCostPer500)}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      fontWeight: 600,
                      color: !changed
                        ? COLOR.mutedLight
                        : row.deltaPer500 > 0.005
                        ? COLOR.flag
                        : row.deltaPer500 < -0.005
                        ? COLOR.positive
                        : COLOR.mutedLight,
                      ...tabularNums,
                    }}
                  >
                    {changed ? fmtDelta(row.deltaPer500) : "·"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      {/* Price history */}
      <section>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Price history (per {ingredient.uom})
        </p>
        {history.length === 0 ? (
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 14,
              color: COLOR.flag,
            }}
          >
            No history recorded. This price has never been sourced or entered.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr
                style={{
                  borderTop: `2px solid ${COLOR.ink}`,
                  borderBottom: `1px solid ${COLOR.ruleBold}`,
                }}
              >
                <th style={thStyle("left")}>Note</th>
                <th style={thStyle("left")}>Source</th>
                <th style={thStyle("right")}>Date</th>
                <th style={thStyle("right")}>£ / {ingredient.uom}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, idx) => (
                <tr key={`${h.date}-${idx}`} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontFamily: FONT.serif,
                      fontStyle: h.note ? "normal" : "italic",
                      color: h.note ? COLOR.inkSoft : COLOR.mutedLight,
                    }}
                  >
                    {h.note ?? "·"}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      fontSize: 10,
                      textAlign: "left",
                    }}
                  >
                    <CostSourceBadge source={h.source} date={h.date} fontSize={10} />
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      color: COLOR.muted,
                      ...tabularNums,
                    }}
                  >
                    {fmtDate(h.date)}
                  </td>
                  <td
                    style={{
                      padding: "12px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.ink,
                      ...tabularNums,
                    }}
                  >
                    £{h.unitCost.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 6,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    background: "transparent",
    border: `1px solid ${COLOR.rule}`,
    color: COLOR.ink,
    fontFamily: FONT.sans,
    ...tabularNums,
  };
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>{label}</p>
      <p
        style={{
          fontFamily: FONT.mono,
          fontSize: 18,
          fontWeight: 500,
          color: color ?? COLOR.ink,
          ...tabularNums,
        }}
      >
        {value}
      </p>
    </div>
  );
}
