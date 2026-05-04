"use server";

/**
 * Server Action for updating ingredient prices.
 *
 * Persistence strategy: commits the updated JSON files to GitHub via the
 * Contents API. Vercel picks up the commit and redeploys within ~30-60s,
 * so every computer sees the new prices.
 *
 * Requires GITHUB_PAT in environment (a fine-grained PAT with Contents
 * read+write scoped to cyrusgilbertrolfe/back-bar).
 */

import { revalidatePath } from "next/cache";
import type { IngredientMaster, IngredientPriceHistoryEntry } from "@/lib/ingredients";

const OWNER = "cyrusgilbertrolfe";
const REPO = "back-bar";
const BRANCH = "main";
const INGREDIENTS_PATH = "src/data/ingredients.json";
const HISTORY_PATH = "src/data/ingredient-price-history.json";

export type UpdatePriceResult =
  | { ok: true; ingredient: IngredientMaster }
  | { ok: false; error: string };

// ─── GitHub Contents API helpers ────────────────────────────────────────────

async function ghHeaders(): Promise<Record<string, string>> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) throw new Error("GITHUB_PAT is not set — add it to Vercel environment variables.");
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

interface GhFile {
  content: string; // JSON string (decoded from base64)
  sha: string;     // needed for the PUT to update
}

async function ghGet(filePath: string): Promise<GhFile> {
  const headers = await ghHeaders();
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${filePath} failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf8");
  return { content: decoded, sha: data.sha };
}

async function ghPut(filePath: string, content: string, sha: string, message: string) {
  const headers = await ghHeaders();
  const encoded = Buffer.from(content, "utf8").toString("base64");
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ message, content: encoded, sha, branch: BRANCH }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub PUT ${filePath} failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ─── Public action ──────────────────────────────────────────────────────────

export async function updateIngredientPrice(
  ingredientId: string,
  newPrice: number,
  note?: string,
): Promise<UpdatePriceResult> {
  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return { ok: false, error: "Price must be a non-negative number." };
  }

  try {
    // 1. Read both files from GitHub (latest committed versions)
    const [ingFile, histFile] = await Promise.all([ghGet(INGREDIENTS_PATH), ghGet(HISTORY_PATH)]);

    const ingredients: IngredientMaster[] = JSON.parse(ingFile.content);
    const history: IngredientPriceHistoryEntry[] = JSON.parse(histFile.content);

    // 2. Apply the change
    const idx = ingredients.findIndex((i) => i.id === ingredientId);
    if (idx < 0) return { ok: false, error: `Ingredient "${ingredientId}" not found.` };

    const oldPrice = ingredients[idx].currentPrice;
    const today = new Date().toISOString().slice(0, 10);

    const updated: IngredientMaster = {
      ...ingredients[idx],
      currentPrice: Math.round(newPrice * 10000) / 10000,
      currentPriceSetAt: today,
    };
    ingredients[idx] = updated;

    const historyEntry: IngredientPriceHistoryEntry = {
      ingredientId,
      date: today,
      price: updated.currentPrice,
      ...(note && note.trim() ? { note: note.trim() } : {}),
    };
    history.push(historyEntry);

    // 3. Format commit message
    const arrow = newPrice > oldPrice ? "↑" : newPrice < oldPrice ? "↓" : "→";
    const trimmedNote = note?.trim();
    const commitMsg = [
      `Update ${updated.name} price: £${oldPrice.toFixed(2)} ${arrow} £${updated.currentPrice.toFixed(2)}`,
      "",
      trimmedNote ? trimmedNote : undefined,
      `Ingredient: ${updated.name} (${updated.bottleSizeMl}ml)`,
      `Source: Back Bar ingredient editor`,
    ]
      .filter(Boolean)
      .join("\n");

    // 4. Commit ingredients.json first, then history (needs the new SHA)
    await ghPut(
      INGREDIENTS_PATH,
      JSON.stringify(ingredients, null, 2) + "\n",
      ingFile.sha,
      commitMsg,
    );

    await ghPut(
      HISTORY_PATH,
      JSON.stringify(history, null, 2) + "\n",
      histFile.sha,
      commitMsg,
    );

    revalidatePath("/finances/ingredients");
    return { ok: true, ingredient: updated };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
