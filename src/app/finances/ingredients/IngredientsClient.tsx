"use client";

import { useMemo, useState, useTransition } from "react";
import {
  IngredientMaster,
  IngredientPriceHistoryEntry,
  computeImpact,
  pricePerMl,
} from "@/lib/ingredients";
import { updateIngredientPrice } from "@/app/actions/ingredients";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

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
  ingredients: IngredientMaster[];
  priceHistory: IngredientPriceHistoryEntry[];
  usageCounts: Record<string, number>;
};

export default function IngredientsClient({ ingredients, priceHistory, usageCounts }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.spreadsheetName?.toLowerCase().includes(q) ?? false),
    );
  }, [ingredients, query]);

  const selected = ingredients.find((i) => i.id === selectedId) ?? null;
  const selectedHistory = useMemo(
    () =>
      selected
        ? priceHistory
            .filter((h) => h.ingredientId === selected.id)
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
    [priceHistory, selected],
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
      {/* LEFT — ingredient table */}
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
            <col style={{ width: 78 }} />
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
              <th style={thStyle("right")}>Bottle</th>
              <th style={thStyle("right")}>Price</th>
              <th style={thStyle("right")}>Used in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ing) => {
              const active = ing.id === selectedId;
              const count = usageCounts[ing.id] ?? 0;
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
                    }}
                  >
                    {ing.name}
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
                    {ing.bottleSizeMl}&nbsp;ml
                  </td>
                  <td
                    style={{
                      padding: "14px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.ink,
                      ...tabularNums,
                    }}
                  >
                    {fmt(ing.currentPrice)}
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

      {/* RIGHT — detail + impact preview */}
      <section>
        {selected ? (
          <IngredientDetail ingredient={selected} history={selectedHistory} />
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
}: {
  ingredient: IngredientMaster;
  history: IngredientPriceHistoryEntry[];
}) {
  const [newPriceStr, setNewPriceStr] = useState(ingredient.currentPrice.toString());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const newPrice = Number(newPriceStr);
  const newPriceValid = Number.isFinite(newPrice) && newPrice >= 0;
  const changed = newPriceValid && Math.abs(newPrice - ingredient.currentPrice) > 0.0005;

  const impact = useMemo(
    () => (newPriceValid ? computeImpact(ingredient, newPrice) : []),
    [ingredient, newPrice, newPriceValid],
  );

  const ppmCurrent = pricePerMl(ingredient);
  const ppmNew = newPriceValid ? newPrice / ingredient.bottleSizeMl : ppmCurrent;
  const deltaPct =
    ingredient.currentPrice > 0
      ? ((newPrice - ingredient.currentPrice) / ingredient.currentPrice) * 100
      : 0;

  function handleSave() {
    if (!changed || !newPriceValid) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateIngredientPrice(ingredient.id, newPrice, note);
      if (res.ok) {
        setFeedback({
          kind: "ok",
          msg: "Saved to git. The site will redeploy in ~30s with the new price.",
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
          {ingredient.bottleSizeMl} ml · {fmt(ingredient.currentPrice)} · set{" "}
          {fmtDate(ingredient.currentPriceSetAt)}
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
              New price (per {ingredient.bottleSizeMl} ml bottle)
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
              Note (optional — shows up in history)
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
          <Stat label="Current £/ml" value={`£${ppmCurrent.toFixed(5)}`} />
          <Stat
            label="New £/ml"
            value={`£${ppmNew.toFixed(5)}`}
            color={changed ? COLOR.accent : undefined}
          />
          <Stat
            label="Change"
            value={changed ? `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "—"}
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
          Impact on MFC drinks
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
          {impact.length === 0
            ? "No MFC recipes use this ingredient yet."
            : `${impact.length} recipe${impact.length === 1 ? "" : "s"} — sorted by biggest 500 ml impact`}
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
                <tr
                  key={row.recipeName}
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
                    {row.recipeName}
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
                    {fmtMl(row.mlPerBottle500)}
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
                    {changed ? fmtDelta(row.deltaPer500) : "—"}
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
          Price history
        </p>
        {history.length === 0 ? (
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 14,
              color: COLOR.muted,
            }}
          >
            No history recorded.
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
                <th style={thStyle("right")}>Date</th>
                <th style={thStyle("right")}>Price</th>
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
                    {h.note ?? "—"}
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
                    {fmt(h.price)}
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
