"use client";

import { useState } from "react";
import { MASTER_INGREDIENTS } from "@/data/ingredients";
import { RECIPES } from "@/data/recipes";
import { useSettings } from "@/hooks/useSettings";
import { IngredientType, Client, RecipeIngredient } from "@/types";

const CLIENTS: Client[] = [
  "Myatt's Fields",
  "Fortnum & Mason",
  "Cripps",
  "Bayley & Sage",
  "Macknade",
  "Liberty",
];

const TYPE_LABELS: Record<IngredientType, string> = {
  "jerry-can": "Jerry can",
  bottle: "Bottle",
  "house-made": "House-made",
  dashes: "Dashes",
};

export default function SettingsPanel() {
  const { settings, updateBottleSize, updateIngredientType, saveSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<"ingredients" | "recipes">("ingredients");
  const [recipeFilter, setRecipeFilter] = useState<Client | "all">("all");
  const [editingRecipeIdx, setEditingRecipeIdx] = useState<number | null>(null);

  // Local copy of recipes for editing
  const [localRecipes, setLocalRecipes] = useState(RECIPES);

  // Ingredient search
  const [search, setSearch] = useState("");
  const filtered = MASTER_INGREDIENTS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  function resolvedType(name: string): IngredientType {
    return settings.ingredientOverrides[name]?.type ??
      MASTER_INGREDIENTS.find((i) => i.name === name)?.type ??
      "bottle";
  }

  function resolvedBottleSize(name: string): number {
    return settings.ingredientOverrides[name]?.bottleSize ??
      MASTER_INGREDIENTS.find((i) => i.name === name)?.bottleSize ??
      700;
  }

  const displayedRecipes =
    recipeFilter === "all"
      ? localRecipes
      : localRecipes.filter((r) => r.clients.includes(recipeFilter));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f0f0f0" }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#6b7280" }}>
          Manage ingredient types, bottle sizes, and view recipes.
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-8"
        style={{ background: "#141414" }}
      >
        {(["ingredients", "recipes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{
              background: activeTab === tab ? "#2d6a4f" : "transparent",
              color: activeTab === tab ? "#fff" : "#6b7280",
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Ingredients tab */}
      {activeTab === "ingredients" && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search ingredients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm border outline-none"
              style={{
                background: "#141414",
                borderColor: "#2d2d2d",
                color: "#f0f0f0",
              }}
            />
          </div>

          <div className="space-y-2">
            {filtered.map((ingredient) => {
              const type = resolvedType(ingredient.name);
              const size = resolvedBottleSize(ingredient.name);
              return (
                <div
                  key={ingredient.name}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 border"
                  style={{ background: "#141414", borderColor: "#2d2d2d" }}
                >
                  <span className="flex-1 text-sm font-medium text-white min-w-0">
                    {ingredient.name}
                  </span>

                  {/* Type selector */}
                  <select
                    value={type}
                    onChange={(e) =>
                      updateIngredientType(
                        ingredient.name,
                        e.target.value as IngredientType
                      )
                    }
                    className="rounded-lg px-2 py-1.5 text-xs border outline-none"
                    style={{
                      background: "#1e1e1e",
                      borderColor: "#2d2d2d",
                      color: "#d1d5db",
                    }}
                  >
                    {(["jerry-can", "bottle", "house-made", "dashes"] as IngredientType[]).map(
                      (t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      )
                    )}
                  </select>

                  {/* Bottle size (only if type = bottle) */}
                  {type === "bottle" && (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={size}
                        min={50}
                        max={3000}
                        step={50}
                        onChange={(e) =>
                          updateBottleSize(ingredient.name, parseInt(e.target.value) || 700)
                        }
                        className="w-20 rounded-lg px-2 py-1.5 text-xs border outline-none text-right"
                        style={{
                          background: "#1e1e1e",
                          borderColor: "#2d2d2d",
                          color: "#d1d5db",
                        }}
                      />
                      <span className="text-xs" style={{ color: "#6b7280" }}>ml</span>
                    </div>
                  )}

                  {/* Badge for default overridden */}
                  {(settings.ingredientOverrides[ingredient.name]?.type ||
                    settings.ingredientOverrides[ingredient.name]?.bottleSize) && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#1a3d29", color: "#52b788" }}
                    >
                      edited
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recipes tab */}
      {activeTab === "recipes" && (
        <div>
          {/* Client filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            <FilterChip
              label="All"
              active={recipeFilter === "all"}
              onClick={() => setRecipeFilter("all")}
            />
            {CLIENTS.map((c) => (
              <FilterChip
                key={c}
                label={c}
                active={recipeFilter === c}
                onClick={() => setRecipeFilter(c)}
              />
            ))}
          </div>

          <div className="space-y-3">
            {displayedRecipes.map((recipe, idx) => {
              const globalIdx = localRecipes.indexOf(recipe);
              const isEditing = editingRecipeIdx === globalIdx;
              return (
                <div
                  key={recipe.name}
                  className="rounded-xl border overflow-hidden"
                  style={{ background: "#141414", borderColor: "#2d2d2d" }}
                >
                  {/* Recipe header */}
                  <button
                    className="w-full flex items-start justify-between gap-4 px-5 py-4"
                    onClick={() =>
                      setEditingRecipeIdx(isEditing ? null : globalIdx)
                    }
                  >
                    <div className="text-left">
                      <p className="font-semibold text-sm text-white">{recipe.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                        {recipe.clients.join(", ")}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${isEditing ? "rotate-180" : ""}`}
                      style={{ color: "#6b7280" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded view */}
                  {isEditing && (
                    <div
                      className="px-5 pb-5 border-t"
                      style={{ borderColor: "#2d2d2d" }}
                    >
                      <div className="pt-4 space-y-2">
                        {recipe.ingredients.map((ing, iIdx) => (
                          <RecipeIngredientRow
                            key={ing.ingredientName}
                            ingredient={ing}
                            onUpdate={(updated) => {
                              const newRecipes = [...localRecipes];
                              const newIngredients = [...newRecipes[globalIdx].ingredients];
                              newIngredients[iIdx] = updated;
                              newRecipes[globalIdx] = {
                                ...newRecipes[globalIdx],
                                ingredients: newIngredients,
                              };
                              setLocalRecipes(newRecipes);
                            }}
                            onRemove={() => {
                              const newRecipes = [...localRecipes];
                              const newIngredients = newRecipes[globalIdx].ingredients.filter(
                                (_, i) => i !== iIdx
                              );
                              newRecipes[globalIdx] = {
                                ...newRecipes[globalIdx],
                                ingredients: newIngredients,
                              };
                              setLocalRecipes(newRecipes);
                            }}
                          />
                        ))}
                        <button
                          className="mt-2 text-xs px-3 py-1.5 rounded-lg border transition-all"
                          style={{ borderColor: "#2d6a4f", color: "#52b788", background: "transparent" }}
                          onClick={() => {
                            const newRecipes = [...localRecipes];
                            newRecipes[globalIdx] = {
                              ...newRecipes[globalIdx],
                              ingredients: [
                                ...newRecipes[globalIdx].ingredients,
                                { ingredientName: "New ingredient", parts: 0 },
                              ],
                            };
                            setLocalRecipes(newRecipes);
                          }}
                        >
                          + Add ingredient
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs" style={{ color: "#6b7280" }}>
            Note: Recipe edits here are display-only in this session. To permanently save
            changes, update <code className="text-xs" style={{ color: "#52b788" }}>src/data/recipes.ts</code>.
          </p>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
      style={{
        background: active ? "#2d6a4f" : "#141414",
        borderColor: active ? "#52b788" : "#2d2d2d",
        color: active ? "#fff" : "#9ca3af",
      }}
    >
      {label}
    </button>
  );
}

function RecipeIngredientRow({
  ingredient,
  onUpdate,
  onRemove,
}: {
  ingredient: RecipeIngredient;
  onUpdate: (updated: RecipeIngredient) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={ingredient.ingredientName}
        onChange={(e) => onUpdate({ ...ingredient, ingredientName: e.target.value })}
        className="flex-1 rounded-lg px-3 py-1.5 text-sm border outline-none"
        style={{ background: "#1e1e1e", borderColor: "#2d2d2d", color: "#f0f0f0" }}
        placeholder="Ingredient name"
      />
      <input
        type="number"
        value={ingredient.parts ?? ""}
        onChange={(e) => onUpdate({ ...ingredient, parts: parseFloat(e.target.value) || 0 })}
        className="w-20 rounded-lg px-3 py-1.5 text-sm border outline-none text-right"
        style={{ background: "#1e1e1e", borderColor: "#2d2d2d", color: "#f0f0f0" }}
        placeholder="parts"
      />
      <button
        onClick={onRemove}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
        style={{ background: "#2d1515", color: "#f87171" }}
      >
        ×
      </button>
    </div>
  );
}
