"use server";

/**
 * Server Action for persisting RRP overrides via GitHub API.
 * Same pattern as ingredient price persistence — every save is a git commit.
 */

import { revalidatePath } from "next/cache";

const OWNER = "cyrusgilbertrolfe";
const REPO = "back-bar";
const BRANCH = "main";
const RRP_PATH = "src/data/rrp-overrides.json";
const WHOLESALE_PATH = "src/data/wholesale-overrides.json";

export type UpdateRrpResult =
  | { ok: true }
  | { ok: false; error: string };

async function ghHeaders(): Promise<Record<string, string>> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) throw new Error("GITHUB_PAT is not set.");
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghGet(filePath: string) {
  const headers = await ghHeaders();
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers, cache: "no-store" },
  );
  if (!res.ok) throw new Error(`GitHub GET ${filePath} failed (${res.status})`);
  const data = await res.json();
  return { content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

async function ghPut(filePath: string, content: string, sha: string, message: string) {
  const headers = await ghHeaders();
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha,
        branch: BRANCH,
      }),
    },
  );
  if (!res.ok) throw new Error(`GitHub PUT ${filePath} failed (${res.status})`);
}

/**
 * Save an RRP override for a product. Commits to git so all devices see it.
 */
export async function updateRrpOverride(
  productId: string,
  productName: string,
  size: string,
  newRrp: number,
): Promise<UpdateRrpResult> {
  if (!Number.isFinite(newRrp) || newRrp <= 0) {
    return { ok: false, error: "RRP must be a positive number." };
  }

  try {
    const file = await ghGet(RRP_PATH);
    const overrides: Record<string, number> = JSON.parse(file.content);

    overrides[productId] = Math.round(newRrp * 100) / 100;

    const commitMsg = `Update ${productName} ${size} RRP to £${overrides[productId].toFixed(2)}\n\nSource: Back Bar pricing editor`;

    await ghPut(
      RRP_PATH,
      JSON.stringify(overrides, null, 2) + "\n",
      file.sha,
      commitMsg,
    );

    revalidatePath("/finances/pricing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reset all RRP overrides (revert to defaults from pricing-data.ts).
 */
export async function resetRrpOverrides(): Promise<UpdateRrpResult> {
  try {
    const file = await ghGet(RRP_PATH);
    await ghPut(RRP_PATH, "{}\n", file.sha, "Reset all RRP overrides to defaults\n\nSource: Back Bar pricing editor");
    revalidatePath("/finances/pricing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Save a wholesale price override for a product. Commits to git so all devices see it.
 * When set, this value replaces the formula-derived wholesale; the retailer test still runs against it.
 */
export async function updateWholesaleOverride(
  productId: string,
  productName: string,
  size: string,
  newWholesale: number,
): Promise<UpdateRrpResult> {
  if (!Number.isFinite(newWholesale) || newWholesale <= 0) {
    return { ok: false, error: "Wholesale must be a positive number." };
  }

  try {
    const file = await ghGet(WHOLESALE_PATH);
    const overrides: Record<string, number> = JSON.parse(file.content);

    overrides[productId] = Math.round(newWholesale * 100) / 100;

    const commitMsg = `Update ${productName} ${size} wholesale to £${overrides[productId].toFixed(2)}\n\nSource: Back Bar pricing editor`;

    await ghPut(
      WHOLESALE_PATH,
      JSON.stringify(overrides, null, 2) + "\n",
      file.sha,
      commitMsg,
    );

    revalidatePath("/finances/pricing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reset all wholesale overrides (revert to formula-derived values).
 */
export async function resetWholesaleOverrides(): Promise<UpdateRrpResult> {
  try {
    const file = await ghGet(WHOLESALE_PATH);
    await ghPut(
      WHOLESALE_PATH,
      "{}\n",
      file.sha,
      "Reset all wholesale overrides to defaults\n\nSource: Back Bar pricing editor",
    );
    revalidatePath("/finances/pricing");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
