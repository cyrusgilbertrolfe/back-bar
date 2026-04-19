"use client";

import { useState } from "react";
import { MASTER_INGREDIENTS } from "@/data/ingredients";
import { RECIPES } from "@/data/recipes";
import { useSettings } from "@/hooks/useSettings";
import { IngredientType, Client, RecipeIngredient } from "@/types";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

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
  const { settings, updateBottleSize, updateIngredientType } = useSettings();
  const [activeTab, setActiveTab] = useState<"ingredients" | "recipes">("ingredients");
  const [recipeFilter, setRecipeFilter] = useState<Client | "all">("all");
  const [editingRecipeIdx, setEditingRecipeIdx] = useState<number | null>(null);
  const [localRecipes, setLocalRecipes] = useState(RECIPES);
  const [search, setSearch] = useState("");

  const filtered = MASTER_INGREDIENTS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  function resolvedType(name: string): IngredientType {
    return (
      settings.ingredientOverrides[name]?.type ??
      MASTER_INGREDIENTS.find((i) => i.name === name)?.type ??
      "bottle"
    );
  }

  function resolvedBottleSize(name: string): number {
    return (
      settings.ingredientOverrides[name]?.bottleSize ??
      MASTER_INGREDIENTS.find((i) => i.name === name)?.bottleSize ??
      700
    );
  }

  const displayedRecipes =
    recipeFilter === "all"
      ? localRecipes
      : localRecipes.filter((r) => r.clients.includes(recipeFilter));

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 24,
          borderBottom: `1px solid ${COLOR.rule}`,
          marginBottom: 32,
        }}
      >
        {(["ingredients", "recipes"] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 0",
                fontSize: 13,
                background: "none",
                border: "none",
                borderBottom: active ? `2px solid ${COLOR.accent}` : "2px solid transparent",
                marginBottom: -1,
                color: active ? COLOR.accent : COLOR.muted,
                cursor: "pointer",
                fontFamily: FONT.sans,
                ...smallCaps,
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === "ingredients" && (
        <div>
          <input
            type="text"
            placeholder="Search ingredients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {filtered.map((ingredient) => {
              const type = resolvedType(ingredient.name);
              const size = resolvedBottleSize(ingredient.name);
              const edited =
                settings.ingredientOverrides[ingredient.name]?.type !== undefined ||
                settings.ingredientOverrides[ingredient.name]?.bottleSize !== undefined;
              return (
                <div
                  key={ingredient.name}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 0",
                    borderBottom: `1px solid ${COLOR.rule}`,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontFamily: FONT.serif,
                      fontSize: 16,
                      color: COLOR.ink,
                      minWidth: 180,
                    }}
                  >
                    {ingredient.name}
                    {edited && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 10,
                          color: COLOR.accent,
                          ...smallCaps,
                        }}
                      >
                        edited
                      </span>
                    )}
                  </span>

                  <select
                    value={type}
                    onChange={(e) =>
                      updateIngredientType(ingredient.name, e.target.value as IngredientType)
                    }
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      outline: "none",
                      background: "transparent",
                      border: `1px solid ${COLOR.rule}`,
                      color: COLOR.inkSoft,
                      fontFamily: FONT.sans,
                    }}
                  >
                    {(["jerry-can", "bottle", "house-made", "dashes"] as IngredientType[]).map(
                      (t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ),
                    )}
                  </select>

                  {type === "bottle" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        value={size}
                        min={50}
                        max={3000}
                        step={50}
                        onChange={(e) =>
                          updateBottleSize(ingredient.name, parseInt(e.target.value) || 700)
                        }
                        style={{
                          width: 72,
                          padding: "6px 8px",
                          fontSize: 12,
                          textAlign: "right",
                          outline: "none",
                          background: "transparent",
                          border: `1px solid ${COLOR.rule}`,
                          color: COLOR.inkSoft,
                          fontFamily: FONT.mono,
                          ...tabularNums,
                        }}
                      />
                      <span style={{ fontSize: 11, color: COLOR.muted }}>ml</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "recipes" && (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
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

          <div>
            {displayedRecipes.map((recipe) => {
              const globalIdx = localRecipes.indexOf(recipe);
              const isEditing = editingRecipeIdx === globalIdx;
              return (
                <div
                  key={recipe.name}
                  style={{
                    borderBottom: `1px solid ${COLOR.rule}`,
                  }}
                >
                  <button
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "16px 0",
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 16,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onClick={() => setEditingRecipeIdx(isEditing ? null : globalIdx)}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: FONT.serif,
                          fontSize: 18,
                          fontWeight: 500,
                          color: COLOR.ink,
                          marginBottom: 4,
                        }}
                      >
                        {recipe.name}
                      </p>
                      <p style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>
                        {recipe.clients.join(", ")}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: COLOR.muted,
                        transform: isEditing ? "rotate(180deg)" : "none",
                        transition: "transform 120ms",
                      }}
                    >
                      ▾
                    </span>
                  </button>

                  {isEditing && (
                    <div style={{ paddingBottom: 20 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                                (_, i) => i !== iIdx,
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
                          style={{
                            marginTop: 8,
                            background: "none",
                            border: "none",
                            padding: 0,
                            fontSize: 11,
                            color: COLOR.accent,
                            cursor: "pointer",
                            textDecoration: "underline",
                            textUnderlineOffset: 3,
                            alignSelf: "flex-start",
                            ...smallCaps,
                          }}
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

          <p
            style={{
              marginTop: 32,
              fontSize: 13,
              fontFamily: FONT.serif,
              fontStyle: "italic",
              color: COLOR.muted,
              lineHeight: 1.55,
            }}
          >
            Note — recipe edits here are display-only in this session. To persist,
            update <code style={{ fontFamily: FONT.mono, fontSize: 12, color: COLOR.accent }}>src/data/recipes.ts</code>.
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
      style={{
        padding: "5px 12px",
        fontSize: 11,
        background: active ? COLOR.ink : "transparent",
        border: `1px solid ${active ? COLOR.ink : COLOR.rule}`,
        color: active ? COLOR.paper : COLOR.inkSoft,
        cursor: "pointer",
        fontFamily: FONT.sans,
        ...smallCaps,
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
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="text"
        value={ingredient.ingredientName}
        onChange={(e) => onUpdate({ ...ingredient, ingredientName: e.target.value })}
        style={{
          flex: 1,
          padding: "6px 10px",
          fontSize: 13,
          outline: "none",
          background: "transparent",
          border: `1px solid ${COLOR.rule}`,
          color: COLOR.ink,
          fontFamily: FONT.serif,
        }}
        placeholder="Ingredient name"
      />
      <input
        type="number"
        value={ingredient.parts ?? ""}
        onChange={(e) => onUpdate({ ...ingredient, parts: parseFloat(e.target.value) || 0 })}
        style={{
          width: 80,
          padding: "6px 10px",
          fontSize: 13,
          textAlign: "right",
          outline: "none",
          background: "transparent",
          border: `1px solid ${COLOR.rule}`,
          color: COLOR.ink,
          fontFamily: FONT.mono,
          ...tabularNums,
        }}
        placeholder="parts"
      />
      <button
        onClick={onRemove}
        style={{
          width: 28,
          height: 28,
          border: `1px solid ${COLOR.flagSoft}`,
          background: "transparent",
          color: COLOR.flag,
          cursor: "pointer",
          fontSize: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>
    </div>
  );
}
