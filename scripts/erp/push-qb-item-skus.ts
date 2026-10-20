/**
 * Push the 20 Oct 2026 short codes (OWNER-DRINK-SIZE) into QuickBooks Online
 * as each product's SKU, through Back Bar's own Intuit app. The claude.ai
 * QuickBooks connector can only create products, not edit them.
 *
 *   npx tsx --env-file=.env.local --env-file=.env.production.local scripts/erp/push-qb-item-skus.ts          # dry run
 *   npx tsx --env-file=.env.local --env-file=.env.production.local scripts/erp/push-qb-item-skus.ts --write  # apply
 *
 * Both env files: DATABASE_URL is in .env.local, the Intuit client ID and
 * secret only in .env.production.local. The refresh token comes from the
 * database, and a run rotates it there like any other refresh.
 *
 * Needs a live QuickBooks link: if the token has died, sign in to Back Bar
 * and visit /api/qb-auth first.
 *
 * QuickBooks items are matched to Back Bar SKUs by name, which is guesswork,
 * so the dry run prints every proposed pairing and everything left unmatched
 * on both sides. Nothing is written until Cyrus has read that list and said
 * yes. Where the guess is wrong, pin it in OVERRIDES (by QuickBooks item Id)
 * and run the dry run again.
 *
 * The write is a sparse update of Item.Sku alone; name, price, accounts and
 * stock are left as they are.
 */

import { eq } from "drizzle-orm";

import { db } from "../../src/db";
import { clients, drinks, skus } from "../../src/db/schema";
import { getAccessToken, qbRequest } from "../../src/lib/quickbooks";

const WRITE = process.argv.includes("--write");

/**
 * QuickBooks item Id → Back Bar short code, or null for "takes no SKU".
 * These win over the name match. Fill in from the dry run.
 */
const OVERRIDES: Record<string, string | null> = {};

/** Items that take no SKU whatever their name: gift cards. */
const NO_SKU = [/cocktail card/i, /gift ?card/i, /gift ?voucher/i];

/** Owner words in a QuickBooks item name, mapped to the short code prefix. */
const OWNER_WORDS: [RegExp, string][] = [
  [/\bcripps\b/i, "CRPS"],
  [/\bfortnum|\bf ?& ?m\b|\bfm\b/i, "FTNM"],
];

type QBItem = {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
  Sku?: string;
  SyncToken: string;
  Type: string;
  Active: boolean;
};

type BBSku = {
  code: string;
  shortCode: string;
  sizeMl: number;
  drink: string | null;
  client: string | null;
  customerDescription: string | null;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Size in ml written in an item name: 700ml, 70cl, 0.7L, 3L, 3 litre. */
function sizeInName(name: string): number | null {
  const m = name.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(ml|cl|l|ltr|litre|liter)s?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === "ml") return Math.round(n);
  if (m[2] === "cl") return Math.round(n * 10);
  return Math.round(n * 1000);
}

function ownerOf(name: string): string {
  for (const [re, prefix] of OWNER_WORDS) if (re.test(name)) return prefix;
  return "MYFL";
}

/** Candidate SKUs for one item: same owner, drink name in the item name, same size if the item gives one. */
function candidates(item: QBItem, all: BBSku[]): BBSku[] {
  const name = norm(item.Name);
  const owner = ownerOf(item.Name);
  const size = sizeInName(item.Name);
  const hits = all.filter((s) => {
    if (!s.shortCode.startsWith(owner + "-")) return false;
    if (size !== null && s.sizeMl !== size) return false;
    const names = [s.drink, s.customerDescription].filter((x): x is string => !!x).map(norm);
    return names.some((n) => n && ` ${name} `.includes(` ${n} `));
  });
  // Prefer the longest drink name: "dirty martini" over "martini".
  const best = Math.max(0, ...hits.map((s) => norm(s.drink ?? "").length));
  return hits.filter((s) => norm(s.drink ?? "").length === best || norm(s.drink ?? "") === "");
}

async function main() {
  console.log(WRITE ? "APPLYING" : "DRY RUN");

  const rows = await db
    .select({
      code: skus.code,
      shortCode: skus.shortCode,
      sizeMl: skus.sizeMl,
      active: skus.active,
      drink: drinks.name,
      client: clients.name,
      customerDescription: skus.customerDescription,
    })
    .from(skus)
    .leftJoin(drinks, eq(drinks.id, skus.drinkId))
    .leftJoin(clients, eq(clients.id, skus.clientId));
  const bb: BBSku[] = rows
    .filter((r): r is typeof r & { shortCode: string } => !!r.shortCode && r.active)
    .map((r) => ({ ...r }));
  const byCode = new Map(bb.map((s) => [s.shortCode, s]));

  const token = await getAccessToken();
  if (!token) throw new Error("No QuickBooks access token. Sign in to Back Bar and visit /api/qb-auth, then re-run.");

  const items: QBItem[] = [];
  for (let start = 1; ; start += 1000) {
    const q = `SELECT * FROM Item STARTPOSITION ${start} MAXRESULTS 1000`;
    const res = await qbRequest<{ QueryResponse: { Item?: QBItem[] } }>(token, `query?query=${encodeURIComponent(q)}`);
    const page = res.QueryResponse.Item ?? [];
    items.push(...page);
    if (page.length < 1000) break;
  }
  const sellable = items.filter((i) => i.Active && i.Type !== "Category").sort((a, b) => a.Name.localeCompare(b.Name));

  type Plan = { item: QBItem; code: string | null; why: string };
  const plan: Plan[] = [];
  const unmatched: { item: QBItem; why: string }[] = [];

  for (const item of sellable) {
    if (item.Id in OVERRIDES) {
      const code = OVERRIDES[item.Id];
      if (code && !byCode.has(code)) throw new Error(`Override for item ${item.Id} names ${code}, which is not a Back Bar short code`);
      plan.push({ item, code, why: "override" });
      continue;
    }
    if (NO_SKU.some((re) => re.test(item.Name))) {
      plan.push({ item, code: null, why: "gift card, no SKU" });
      continue;
    }
    const c = candidates(item, bb);
    if (c.length === 1) plan.push({ item, code: c[0].shortCode, why: "name" });
    else if (c.length === 0) unmatched.push({ item, why: "no match" });
    else unmatched.push({ item, why: `ambiguous: ${c.map((s) => s.shortCode).join(", ")}` });
  }

  const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));

  console.log(`\nQuickBooks: ${items.length} items, ${sellable.length} active and sellable. Back Bar: ${bb.length} coded SKUs.\n`);
  console.log("PROPOSED MAPPING");
  console.log(`  ${pad("QB Id", 6)} ${pad("QuickBooks item", 48)} ${pad("Sku now", 16)} → ${pad("Sku after", 16)} why`);
  for (const p of plan) {
    const now = p.item.Sku ?? "";
    const after = p.code ?? "(none)";
    const flag = p.code === null ? "" : now === p.code ? "  unchanged" : now ? "  REPLACES existing Sku" : "";
    console.log(`  ${pad(p.item.Id, 6)} ${pad(p.item.Name, 48)} ${pad(now || "-", 16)} → ${pad(after, 16)} ${p.why}${flag}`);
  }

  console.log("\nQUICKBOOKS ITEMS LEFT UNMATCHED (no Sku will be set)");
  if (!unmatched.length) console.log("  none");
  for (const u of unmatched) console.log(`  ${pad(u.item.Id, 6)} ${pad(u.item.Name, 48)} ${pad(u.item.Sku ?? "-", 16)} ${u.why}`);

  const used = new Set(plan.map((p) => p.code).filter(Boolean));
  console.log("\nBACK BAR SKUS WITH NO QUICKBOOKS ITEM");
  const orphans = bb.filter((s) => !used.has(s.shortCode)).sort((a, b) => a.shortCode.localeCompare(b.shortCode));
  if (!orphans.length) console.log("  none");
  for (const s of orphans) console.log(`  ${pad(s.shortCode, 16)} ${s.drink ?? "?"} ${s.sizeMl}ml (${s.client ?? "no client"})`);

  const shared = [...used].filter((c) => plan.filter((p) => p.code === c).length > 1);
  if (shared.length) {
    console.log("\nSHORT CODES ON MORE THAN ONE ITEM (check these are meant)");
    for (const c of shared) console.log(`  ${c}: ${plan.filter((p) => p.code === c).map((p) => `${p.item.Id} ${p.item.Name}`).join("; ")}`);
  }

  const todo = plan.filter((p) => p.code !== null && p.item.Sku !== p.code);
  console.log(`\n${todo.length} item(s) to update.`);
  if (!WRITE) {
    console.log("Dry run only. Nothing written to QuickBooks. Re-run with --write once the mapping is approved.");
    return;
  }

  for (const p of todo) {
    await qbRequest(token, "item", {
      method: "POST",
      body: { Id: p.item.Id, SyncToken: p.item.SyncToken, sparse: true, Sku: p.code },
    });
    console.log(`  ${p.item.Id} ${p.item.Name}: ${p.item.Sku ?? "-"} → ${p.code}`);
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
