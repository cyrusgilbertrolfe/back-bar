"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Client, Recipe, BatchCalculation } from "@/types";
import { RECIPES } from "@/data/recipes";
import { calculateBatch } from "@/lib/calculator";
import { useSettings } from "@/hooks/useSettings";
import BatchOutput from "./BatchOutput";
import PrintView from "./PrintView";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

const CLIENTS: Client[] = [
  "Myatt's Fields",
  "Fortnum & Mason",
  "Cripps",
  "Bayley & Sage",
  "Macknade",
  "Liberty",
];

const DEFAULT_LITRES = 9;

export default function Calculator() {
  const { settings } = useSettings();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [activeLitres, setActiveLitres] = useState<number>(DEFAULT_LITRES);
  const [customInput, setCustomInput] = useState<string>("");
  const [customError, setCustomError] = useState<string>("");
  const [result, setResult] = useState<BatchCalculation | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const filteredRecipes = useMemo(() => {
    if (!selectedClient) return [];
    return RECIPES.filter((r) => r.clients.includes(selectedClient));
  }, [selectedClient]);

  useEffect(() => {
    if (selectedRecipe) {
      setResult(calculateBatch(selectedRecipe, activeLitres, settings));
    }
  }, [selectedRecipe, activeLitres, settings]);

  function handleClientSelect(client: Client) {
    setSelectedClient(client);
    setSelectedRecipe(null);
    setResult(null);
    setCustomInput("");
    setCustomError("");
    setActiveLitres(DEFAULT_LITRES);
  }

  function handleRecipeSelect(recipe: Recipe) {
    setSelectedRecipe(recipe);
    setCustomInput("");
    setCustomError("");
    setActiveLitres(DEFAULT_LITRES);
  }

  function handleUseStandard() {
    setCustomInput("");
    setCustomError("");
    setActiveLitres(DEFAULT_LITRES);
  }

  function handleCustomCalculate() {
    setCustomError("");
    const litres = parseFloat(customInput);
    if (!customInput || isNaN(litres) || litres <= 0) {
      setCustomError("Enter a valid volume.");
      return;
    }
    if (litres > 500) {
      setCustomError("Max 500L.");
      return;
    }
    setActiveLitres(litres);
  }

  const isCustomActive = activeLitres !== DEFAULT_LITRES;

  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="print-only" aria-hidden="true">
        {result && <PrintView result={result} date={today} />}
      </div>

      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {/* Step 1: Client */}
        <section>
          <StepHeader step={1} label="Client" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 8,
              marginTop: 16,
            }}
          >
            {CLIENTS.map((client) => {
              const active = selectedClient === client;
              return (
                <button
                  key={client}
                  onClick={() => handleClientSelect(client)}
                  style={{
                    padding: "14px 16px",
                    fontSize: 15,
                    fontFamily: FONT.serif,
                    textAlign: "left",
                    background: active ? COLOR.ink : "transparent",
                    color: active ? COLOR.paper : COLOR.ink,
                    border: `1px solid ${active ? COLOR.ink : COLOR.rule}`,
                    cursor: "pointer",
                    minHeight: 52,
                  }}
                >
                  {client}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Recipe */}
        {selectedClient && (
          <section>
            <StepHeader step={2} label={`Recipe — ${selectedClient}`} />
            {filteredRecipes.length === 0 ? (
              <p
                style={{
                  marginTop: 16,
                  fontFamily: FONT.serif,
                  fontStyle: "italic",
                  color: COLOR.muted,
                }}
              >
                No recipes available for {selectedClient} yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 8,
                  marginTop: 16,
                }}
              >
                {filteredRecipes.map((recipe) => {
                  const active = selectedRecipe?.name === recipe.name;
                  return (
                    <button
                      key={recipe.name}
                      onClick={() => handleRecipeSelect(recipe)}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        background: active ? COLOR.paperDeep : "transparent",
                        color: COLOR.ink,
                        border: `1px solid ${active ? COLOR.accent : COLOR.rule}`,
                        cursor: "pointer",
                        minHeight: 64,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT.serif,
                          fontSize: 17,
                          fontWeight: 500,
                          color: active ? COLOR.accent : COLOR.ink,
                        }}
                      >
                        {recipe.name}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: COLOR.muted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {recipe.ingredients
                          .filter((i) => i.parts !== undefined)
                          .map((i) => i.ingredientName)
                          .join(", ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Volume */}
        {selectedRecipe && (
          <section>
            <StepHeader step={3} label="Volume" />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 16,
                marginTop: 16,
              }}
            >
              <button
                onClick={handleUseStandard}
                style={{
                  padding: "12px 22px",
                  fontSize: 15,
                  fontFamily: FONT.serif,
                  background: !isCustomActive ? COLOR.ink : "transparent",
                  color: !isCustomActive ? COLOR.paper : COLOR.inkSoft,
                  border: `1px solid ${!isCustomActive ? COLOR.ink : COLOR.rule}`,
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                9 L — standard
              </button>

              <span style={{ color: COLOR.muted }}>or</span>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.1"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomCalculate()}
                    placeholder="Custom"
                    style={{
                      width: 120,
                      padding: "12px 30px 12px 14px",
                      fontSize: 15,
                      fontFamily: FONT.mono,
                      background: "transparent",
                      color: COLOR.ink,
                      border: `1px solid ${isCustomActive ? COLOR.accent : COLOR.rule}`,
                      outline: "none",
                      minHeight: 48,
                      ...tabularNums,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      right: 12,
                      fontSize: 13,
                      color: COLOR.muted,
                      pointerEvents: "none",
                    }}
                  >
                    L
                  </span>
                </div>
                <button
                  onClick={handleCustomCalculate}
                  style={{
                    padding: "12px 22px",
                    fontSize: 11,
                    background: COLOR.accent,
                    color: COLOR.paper,
                    border: "none",
                    cursor: "pointer",
                    minHeight: 48,
                    ...smallCaps,
                  }}
                >
                  Calculate
                </button>
              </div>
            </div>
            {customError && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: COLOR.flag,
                  fontFamily: FONT.serif,
                  fontStyle: "italic",
                }}
              >
                {customError}
              </p>
            )}
          </section>
        )}

        {/* Results */}
        {result && (
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 20,
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <StepHeader step={4} label="Batch sheet" />
              <button
                onClick={() => window.print()}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 11,
                  color: COLOR.accent,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  textDecorationThickness: 1,
                  ...smallCaps,
                }}
              >
                Print / save as PDF
              </button>
            </div>
            <div ref={printRef}>
              <BatchOutput result={result} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          color: COLOR.muted,
          letterSpacing: "0.08em",
        }}
      >
        {String(step).padStart(2, "0")}
      </span>
      <h2
        style={{
          fontFamily: FONT.serif,
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: COLOR.ink,
        }}
      >
        {label}
      </h2>
    </div>
  );
}
