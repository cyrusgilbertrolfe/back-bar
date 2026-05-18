"use server";

/**
 * Server Actions for the Sales Tracker.
 *
 * Persistence: every write commits the updated JSON to GitHub via the
 * Contents API — same pattern as the ingredient/pricing editors. Reads in
 * src/lib/sales-data.ts go live to GitHub, so a write is visible immediately
 * (and a redeploy follows for the bundled fallback). Requires GITHUB_PAT.
 */

import { revalidatePath } from "next/cache";
import {
  ACCOUNTS_PATH,
  TOUCHPOINTS_PATH,
  ghGet,
  ghPut,
  isValidEmail,
  type Account,
  type Category,
  type Status,
  type Tier,
  type Touchpoint,
  type TouchpointType,
  CATEGORIES,
  STATUSES,
  TIERS,
  TOUCHPOINT_TYPES,
} from "@/lib/sales-data";

export type SalesResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function requirePat(): string {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    throw new Error(
      "GITHUB_PAT is not set — add it to the environment to save changes.",
    );
  }
  return pat;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Create account ──────────────────────────────────────────────────────────

export interface NewAccountInput {
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
}

export async function createAccount(
  input: NewAccountInput,
): Promise<SalesResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Company name is required." };
  if (!CATEGORIES.includes(input.category))
    return { ok: false, error: "Invalid category." };
  if (!TIERS.includes(input.tier))
    return { ok: false, error: "Invalid tier." };
  if (!STATUSES.includes(input.status))
    return { ok: false, error: "Invalid status." };
  if (input.buyer_email.trim() && !isValidEmail(input.buyer_email.trim()))
    return { ok: false, error: "Buyer email is not a valid email address." };

  try {
    const pat = requirePat();
    const file = await ghGet(ACCOUNTS_PATH, pat);
    const accounts: Account[] = JSON.parse(file.content);

    const ts = nowIso();
    const account: Account = {
      id: crypto.randomUUID(),
      name,
      category: input.category,
      tier: input.tier,
      city: input.city.trim(),
      buyer_name: input.buyer_name.trim(),
      buyer_title: input.buyer_title.trim(),
      buyer_email: input.buyer_email.trim(),
      buyer_phone: input.buyer_phone.trim(),
      status: input.status,
      notes: input.notes.trim(),
      created_at: ts,
      updated_at: ts,
    };
    accounts.push(account);

    await ghPut(
      ACCOUNTS_PATH,
      JSON.stringify(accounts, null, 2) + "\n",
      file.sha,
      `Add account: ${name} (${input.category}, Tier ${input.tier})\n\nSource: Back Bar sales tracker`,
      pat,
    );

    revalidatePath("/sales/accounts");
    return { ok: true, id: account.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Update account (editable fields on the detail page) ─────────────────────

export interface UpdateAccountInput {
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
}

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<SalesResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Company name is required." };
  if (!CATEGORIES.includes(input.category))
    return { ok: false, error: "Invalid category." };
  if (!TIERS.includes(input.tier))
    return { ok: false, error: "Invalid tier." };
  if (!STATUSES.includes(input.status))
    return { ok: false, error: "Invalid status." };
  if (input.buyer_email.trim() && !isValidEmail(input.buyer_email.trim()))
    return { ok: false, error: "Buyer email is not a valid email address." };

  try {
    const pat = requirePat();
    const file = await ghGet(ACCOUNTS_PATH, pat);
    const accounts: Account[] = JSON.parse(file.content);

    const idx = accounts.findIndex((a) => a.id === input.id);
    if (idx < 0) return { ok: false, error: "Account not found." };

    const prev = accounts[idx];
    accounts[idx] = {
      ...prev,
      name,
      category: input.category,
      tier: input.tier,
      city: input.city.trim(),
      buyer_name: input.buyer_name.trim(),
      buyer_title: input.buyer_title.trim(),
      buyer_email: input.buyer_email.trim(),
      buyer_phone: input.buyer_phone.trim(),
      status: input.status,
      notes: input.notes.trim(),
      updated_at: nowIso(),
    };

    const statusNote =
      prev.status !== input.status
        ? ` — status ${prev.status} → ${input.status}`
        : "";

    await ghPut(
      ACCOUNTS_PATH,
      JSON.stringify(accounts, null, 2) + "\n",
      file.sha,
      `Update account: ${name}${statusNote}\n\nSource: Back Bar sales tracker`,
      pat,
    );

    revalidatePath("/sales/accounts");
    revalidatePath(`/sales/accounts/${input.id}`);
    return { ok: true, id: input.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Add touchpoint ──────────────────────────────────────────────────────────

export interface NewTouchpointInput {
  account_id: string;
  date: string; // YYYY-MM-DD
  type: TouchpointType;
  summary: string;
}

export async function addTouchpoint(
  input: NewTouchpointInput,
): Promise<SalesResult> {
  const summary = input.summary.trim();
  if (!summary) return { ok: false, error: "Summary is required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date))
    return { ok: false, error: "Date must be a valid date." };
  if (!TOUCHPOINT_TYPES.includes(input.type))
    return { ok: false, error: "Invalid touchpoint type." };

  try {
    const pat = requirePat();

    // Confirm the account exists before logging against it.
    const acctFile = await ghGet(ACCOUNTS_PATH, pat);
    const accounts: Account[] = JSON.parse(acctFile.content);
    const account = accounts.find((a) => a.id === input.account_id);
    if (!account) return { ok: false, error: "Account not found." };

    const file = await ghGet(TOUCHPOINTS_PATH, pat);
    const touchpoints: Touchpoint[] = JSON.parse(file.content);

    const touchpoint: Touchpoint = {
      id: crypto.randomUUID(),
      account_id: input.account_id,
      date: input.date,
      type: input.type,
      summary,
      created_at: nowIso(),
    };
    touchpoints.push(touchpoint);

    await ghPut(
      TOUCHPOINTS_PATH,
      JSON.stringify(touchpoints, null, 2) + "\n",
      file.sha,
      `Touchpoint: ${account.name} — ${input.type} (${input.date})\n\nSource: Back Bar sales tracker`,
      pat,
    );

    revalidatePath(`/sales/accounts/${input.account_id}`);
    revalidatePath("/sales/accounts");
    return { ok: true, id: touchpoint.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
