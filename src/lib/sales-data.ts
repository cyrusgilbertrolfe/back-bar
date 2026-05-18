/**
 * Sales Tracker v1.0 — data model + reads.
 *
 * Persistence mirrors the pricing/ingredients pattern: the source of truth is
 * two JSON files committed to git via the GitHub Contents API (see
 * src/app/actions/sales.ts for writes). Reads go live to GitHub when a
 * GITHUB_PAT is present so a freshly-added account or touchpoint shows up
 * immediately — no waiting for a redeploy. Without a PAT (local dev) we fall
 * back to the bundled JSON so the pages still render.
 *
 * Deliberately small. Two tables, no extra dependency. See the v1.0 spec.
 */

import accountsSeed from "@/data/sales-accounts.json";
import touchpointsSeed from "@/data/sales-touchpoints.json";

// ─── Enums (kept as const arrays so the UI can map over them) ────────────────

export const CATEGORIES = [
  "Department Store",
  "Food Hall",
  "Florist",
  "Chocolatier",
  "Local",
  "Wine Merchant",
  "Lifestyle",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const TIERS = [1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export const STATUSES = [
  "Researching",
  "Box Sent",
  "Followed Up",
  "Replied",
  "Live",
  "Declined",
  "No Response",
] as const;
export type Status = (typeof STATUSES)[number];

export const TOUCHPOINT_TYPES = [
  "Box Sent",
  "Email",
  "Call",
  "Letter",
  "Reply Received",
  "Meeting",
  "Other",
] as const;
export type TouchpointType = (typeof TOUCHPOINT_TYPES)[number];

export interface Account {
  id: string;
  name: string;
  category: Category;
  tier: Tier;
  city: string;
  buyer_name: string;
  buyer_title: string;
  buyer_email: string;
  buyer_phone: string;
  status: Status;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Touchpoint {
  id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  type: TouchpointType;
  summary: string;
  created_at: string;
}

// ─── GitHub Contents API (same approach as actions/pricing.ts) ────────────────

export const OWNER = "cyrusgilbertrolfe";
export const REPO = "back-bar";
export const BRANCH = "main";
export const ACCOUNTS_PATH = "src/data/sales-accounts.json";
export const TOUCHPOINTS_PATH = "src/data/sales-touchpoints.json";

function ghHeaders(pat: string): Record<string, string> {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export interface GhFile {
  content: string;
  sha: string;
}

/** Read a JSON file live from GitHub. Caller handles the no-PAT case. */
export async function ghGet(filePath: string, pat: string): Promise<GhFile> {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`,
    { headers: ghHeaders(pat), cache: "no-store" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub GET ${filePath} failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return {
    content: Buffer.from(data.content, "base64").toString("utf8"),
    sha: data.sha,
  };
}

export async function ghPut(
  filePath: string,
  content: string,
  sha: string,
  message: string,
  pat: string,
) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: ghHeaders(pat),
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        sha,
        branch: BRANCH,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub PUT ${filePath} failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ─── Reads used by the pages ─────────────────────────────────────────────────

async function readJson<T>(
  filePath: string,
  fallback: T[],
): Promise<T[]> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) return fallback; // local dev without a PAT — use bundled seed
  try {
    const file = await ghGet(filePath, pat);
    return JSON.parse(file.content) as T[];
  } catch {
    // Network/permissions hiccup — degrade to the bundled copy rather than 500.
    return fallback;
  }
}

export async function getAccounts(): Promise<Account[]> {
  return readJson<Account>(ACCOUNTS_PATH, accountsSeed as Account[]);
}

export async function getTouchpoints(): Promise<Touchpoint[]> {
  return readJson<Touchpoint>(TOUCHPOINTS_PATH, touchpointsSeed as Touchpoint[]);
}

export async function getAccount(id: string): Promise<Account | null> {
  const accounts = await getAccounts();
  return accounts.find((a) => a.id === id) ?? null;
}

export async function getTouchpointsForAccount(
  accountId: string,
): Promise<Touchpoint[]> {
  const all = await getTouchpoints();
  return all
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first
}

// ─── Sort + display helpers ──────────────────────────────────────────────────

/**
 * Default list ordering within a tier. Spec: Box Sent and Followed Up to the
 * top, Researching below, No Response and Declined to the bottom. Replied and
 * Live (a live conversation / a win) sit above everything — they need action.
 */
const STATUS_ORDER: Record<Status, number> = {
  Replied: 0,
  Live: 1,
  "Box Sent": 2,
  "Followed Up": 3,
  Researching: 4,
  "No Response": 5,
  Declined: 6,
};

export function statusRank(s: Status): number {
  return STATUS_ORDER[s];
}

export function lastTouchpointDate(
  accountId: string,
  touchpoints: Touchpoint[],
): string | null {
  let latest: string | null = null;
  for (const t of touchpoints) {
    if (t.account_id !== accountId) continue;
    if (latest === null || t.date > latest) latest = t.date;
  }
  return latest;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
