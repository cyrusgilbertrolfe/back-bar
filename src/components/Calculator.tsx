"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Client, Recipe, BatchCalculation } from "@/types";
import { RECIPES } from "@/data/recipes";
import { calculateBatch } from "@/lib/calculator";
import { useSettings } from "@/hooks/useSettings";
import BatchOutput from "./BatchOutput";
import PrintView from "./PrintView";

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

  // Auto-calculate whenever recipe or active volume changes
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
      {/* Print-only view */}
      <div className="print-only" aria-hidden="true">
        {result && <PrintView result={result} date={today} />}
      </div>

      {/* Screen view */}
      <div className="no-print space-y-8">
        {/* Step 1: Client */}
        <section>
          <StepLabel step={1} label="Select client" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {CLIENTS.map((client) => (
              <button
                key={client}
                onClick={() => handleClientSelect(client)}
                className="rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 text-left border"
                style={{
                  background: selectedClient === client ? "#2d6a4f" : "#141414",
                  borderColor: selectedClient === client ? "#52b788" : "#2d2d2d",
                  color: selectedClient === client ? "#fff" : "#d1d5db",
                }}
              >
                {client}
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Recipe */}
        {selectedClient && (
          <section>
            <StepLabel step={2} label={`Select recipe — ${selectedClient}`} />
            {filteredRecipes.length === 0 ? (
              <p className="mt-4 text-sm italic" style={{ color: "#6b7280" }}>
                No recipes available for {selectedClient} yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.name}
                    onClick={() => handleRecipeSelect(recipe)}
                    className="rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 text-left border"
                    style={{
                      background: selectedRecipe?.name === recipe.name ? "#1a3d29" : "#141414",
                      borderColor:
                        selectedRecipe?.name === recipe.name ? "#2d6a4f" : "#2d2d2d",
                      color: selectedRecipe?.name === recipe.name ? "#52b788" : "#d1d5db",
                    }}
                  >
                    <span className="block font-semibold">{recipe.name}</span>
                    <span className="block text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>
                      {recipe.ingredients
                        .filter((i) => i.parts !== undefined)
                        .map((i) => i.ingredientName)
                        .join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Volume */}
        {selectedRecipe && (
          <section>
            <StepLabel step={3} label="Volume" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {/* Standard 9L pill */}
              <button
                onClick={handleUseStandard}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold border transition-all duration-150"
                style={{
                  background: !isCustomActive ? "#1a1a1a" : "#141414",
                  borderColor: !isCustomActive ? "#c9a227" : "#2d2d2d",
                  color: !isCustomActive ? "#c9a227" : "#6b7280",
                }}
              >
                9L — Standard
              </button>

              <span style={{ color: "#2d2d2d" }}>|</span>

              {/* Custom input */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    max="500"
                    step="0.1"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomCalculate()}
                    placeholder="Custom"
                    className="rounded-xl px-4 py-2.5 pr-8 text-sm font-medium border outline-none transition-all w-28"
                    style={{
                      background: "#141414",
                      borderColor: isCustomActive ? "#c9a227" : "#2d2d2d",
                      color: "#fff",
                    }}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: "#6b7280" }}
                  >
                    L
                  </span>
                </div>
                <button
                  onClick={handleCustomCalculate}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold border transition-all duration-150"
                  style={{
                    background: "#c9a227",
                    borderColor: "#e0b840",
                    color: "#0a0a0a",
                  }}
                >
                  Calculate
                </button>
              </div>
            </div>
            {customError && (
              <p className="mt-2 text-sm" style={{ color: "#f87171" }}>
                {customError}
              </p>
            )}
          </section>
        )}

        {/* Results */}
        {result && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <StepLabel step={4} label="Batch sheet" />
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border transition-all duration-150"
                style={{
                  background: "#141414",
                  borderColor: "#2d6a4f",
                  color: "#52b788",
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print / Save as PDF
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

function StepLabel({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: "#c9a227", color: "#0a0a0a" }}
      >
        {step}
      </span>
      <h2 className="text-base font-semibold" style={{ color: "#f0f0f0" }}>
        {label}
      </h2>
    </div>
  );
}
