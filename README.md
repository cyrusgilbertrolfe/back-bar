# Back Bar

The internal operations system for **Myatt's Fields Cocktails**. Next.js 16 on
Vercel, Postgres (Neon) via Drizzle, password-gated, live at
`admin.myattsfields.com`.

> **Read the Back Bar roadmap in Lifemaxxing before adding anything** (`Domains/Cocktails/Back Bar/`, the index named in this repo's `CLAUDE.md`). It is the
> statement of scope. `docs/erp-spec.md` describes a much larger system and was
> superseded on 4 September 2026; it is kept only as the design reference for
> parked work.

## What Back Bar is

Back Bar keeps track of four things, and they are four different surfaces —
which is also what the top nav is:

| Surface | The question it answers | State |
|---|---|---|
| **Make** | What is each drink made of, and how do we make it? | Recipes live; production parked |
| **Buy** | What do we buy, from whom, at what cost? | Costs live; receiving parked |
| **Sell** | What do we sell, to whom, at what price? | Pricing live; orders parked |
| **Analyse** | Is any of it working? | Cost and revenue live; channel mix blocked |

Underneath all four sits the thing they all depend on, and the only thing being
built until March 2027:

> **The chain from component → recipe → SKU → price, with every figure sourced
> and dated.**

## What is real

Read live from the database, 4 September 2026:

| | |
|---|---|
| Components (the buying master) | 110, with 116 recorded price changes |
| Drinks / recipes / recipe lines | 27 / 40 / 157 |
| SKUs / bill-of-materials lines / prices | 104 / 392 / 129 |
| Clients | 3 — MFC, F&M, Cripps |

Four mechanisms are worth knowing about before you change anything:

- **[`docs/revenue-provenance.md`](docs/revenue-provenance.md)** — every figure
  carries a `source` and an `asOf`; hand-typed numbers render a visible warning;
  partial years are labelled partial. This exists because a fabricated revenue
  table nearly caused the DTC channel to be defunded. **Do not add a number to
  this app that cannot be traced to a source system.**
- **Gate 1 — declared ABV.** `skus.declared_abv` is what the *physical label*
  says, and it is never the computed figure. `NULL` means nobody has read the
  bottle; it must never be filled by copying the computed ABV. See the comment
  on the column in `src/db/schema.ts`.
- **`npm run audit`** — read-only integrity check across every recipe: that
  percentages sum to 100, that computed ABV matches the label within 0.3 points,
  and that its own arithmetic still agrees with the app's `canon.ts`.
- **The MCP connector** at `/api/mcp` — see [MCP connector](#mcp-connector).

## What is parked

Parked is not cancelled, and it is not "coming soon". It means we have stopped,
deliberately, and each has a stated interim answer. Inbounds, inventory,
production runs, bottle serials, price lists, quotes, CRM, and the
revenue-by-channel split. Full list and reasoning in
the Back Bar roadmap in Lifemaxxing, §4.

Six tables exist and hold zero rows (`suppliers`, `customers`,
`wholesale_orders`, `wholesale_order_lines`, `wholesale_order_bookings`,
`purchase_commitments`). They were built ahead of a workflow that never arrived.
They stay in the schema, but they are dead until unparked — **don't build on
them without unparking first.**

## Running it

```bash
npm install
npm run dev
```

Needs `.env.local` with at least `DATABASE_URL` (Neon pooled connection string),
`AUTH_PASSWORD`, and `AUTH_SECRET`. Note that `AUTH_SECRET` lives in
`.env.production.local` — local login fails without it being copied across:

```bash
grep '^AUTH_SECRET=' .env.production.local >> .env.local
```

Set `SPEED_RAIL_ENABLED=1` and `NEXT_PUBLIC_SPEED_RAIL_ENABLED=1` to expose the
`/erp/*` routes. First-time database setup is in
[`docs/erp-setup.md`](docs/erp-setup.md).

## Checks

Every release must pass all four:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run audit       # recipe + ABV integrity, read-only
npm run build       # next build
```

`npm run audit` currently **fails**, and that is honest rather than broken: 19 of
the 25 checkable recipes are more than 0.3 points from their label ABV. Closing
that is the week of 18 September. Do not make the audit lenient to get it green.

## Layout

```
src/app/{make,buy,sell,analyse}   the four surfaces (top nav)
src/app/{drinks,calculator}       Make — the canon and batch volumes
src/app/erp/*                     Buy — components, suppliers, costing settings
src/app/finances/*                Sell + Analyse — pricing, RRP, COGS, P&L
src/app/sales/*                   Sell — wholesale outreach
src/app/dashboard, /strategy      Analyse
src/db/schema.ts                  every table, with the reasoning in comments
src/lib/erp/canon.ts              ABV and water computation — the source of truth
scripts/erp/                      seeds and maintained scripts
scripts/archive/                  one-off scripts already run; history, not tools
```

The older hub routes (`/finances`, `/production`, `/sales`) still work but are no
longer in the nav — the four surfaces replaced them on 4 September 2026.

## Conventions

- **Don't add a table before the workflow that uses it.** Six empty tables are
  the standing reminder.
- **Prefer a screen over a one-off script.** `scripts/archive/` holds 68 of them;
  that habit is what the roadmap's cycle 2 exists to end.
- **Recipes are never disclosed**, redacted or otherwise. There is no
  `disclosure_level` field anywhere and there must not be one.
- Costing is **latest-cost only** — never weighted average.
- Migrations: edit `src/db/schema.ts`, `npm run db:generate`, review the SQL in
  `drizzle/`, `npm run db:migrate`. Commit the migration with the change.

## MCP connector

The app exposes a Model Context Protocol server at `/api/mcp` so trusted AI
agents can read and write Back Bar business data (pricing, ingredients, recipes,
revenue). Two ways to connect:

- **Bearer (programmatic).** Call `/api/mcp` with
  `Authorization: Bearer <MCP_TOKEN>` (read+write) or
  `Authorization: Bearer <MCP_READONLY_TOKEN>` (read-only).
- **OAuth 2.1 (Claude connector UI).** Claude's "Add custom connector" only
  speaks OAuth. A thin wrapper sits on the bearer machinery: Claude does Dynamic
  Client Registration + PKCE, the user enters the Back Bar password on a consent
  screen, and the token endpoint returns **the existing `MCP_TOKEN` verbatim as
  the `access_token`**. OAuth is only a way to obtain the bearer token through a
  flow Claude understands.

To connect: Settings → Connectors → Add custom connector → URL
`https://admin.myattsfields.com/api/mcp` (no client ID/secret).

**Revoking access** means rotating `MCP_TOKEN` in Vercel. Because the OAuth
access token *is* `MCP_TOKEN`, there is no per-client revocation — rotating it
invalidates every issued grant at once.

### OAuth wrapper internals

Stateless by design — no database, no KV. Short-lived OAuth state is encoded as
HMAC-SHA256 signed JWTs (`src/lib/mcp/oauth.ts`):

- `client_id` — signed JWT `{ redirect_uris }`, 1-year expiry, issued by DCR.
- `authorization_code` — signed JWT bound to the PKCE challenge and
  redirect_uri, 60-second expiry.
- `access_token` — the existing `MCP_TOKEN`, not a JWT.

`redirect_uri` is strictly allowlisted to Claude's callbacks — this is the
flow's key security boundary against open-redirect token leaks. Discovery
metadata is served unauthenticated at both
`/.well-known/oauth-authorization-server` and
`/api/mcp/.well-known/oauth-authorization-server`.

### Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string. |
| `AUTH_PASSWORD` | The Back Bar password, checked at `/login` and on the OAuth consent screen. |
| `AUTH_SECRET` | Session cookie secret. Lives in `.env.production.local`. |
| `MCP_TOKEN` | Full read+write bearer token. Also the OAuth `access_token`. |
| `MCP_READONLY_TOKEN` | Optional read-only bearer token. |
| `MCP_OAUTH_SIGNING_KEY` | HMAC key for signing OAuth JWTs. 48 bytes of URL-safe base64. |
| `SPEED_RAIL_ENABLED` | 404s the `/erp/*` routes when unset. |
| `NEXT_PUBLIC_SPEED_RAIL_ENABLED` | Client-side copy of the same flag. |
