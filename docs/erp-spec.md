> **SUPERSEDED — 4 September 2026.**
> This document is no longer the statement of scope. Back Bar's scope was cut to
> **costing and pricing only** until March 2027; see the Back Bar roadmap in Lifemaxxing, `Domains/Cocktails/Back Bar/`.
> Most of what follows — inbounds, inventory lots, production runs, bottle
> serials, price lists, quotes, the channel-mix dashboard — is **parked**, and
> was never built. It is kept here because it is a good design reference for
> whenever those are unparked, not because it describes the plan.

# Back Bar ERP — Spec v0.2

**Codename:** Speed Rail
**Slug:** `speed-rail` (use for branches, feature flags, label prefixes)
**For:** Code
**From:** Cyrus (with Claude)
**Date:** 2026-05-04
**Status:** Decisions baked in. Ready to build.

> *Speed Rail — the row of well bottles within the bartender's reach. Always-there, always-fast, the spine of the bar. That's what we're building: the system that puts every operational answer (cost, stock, batch, margin, channel mix) within reach instead of in someone's head or in a spreadsheet.*

**Changelog from v0.1:**
- Costing: latest-cost only (weighted-average dropped from roadmap entirely).
- Wastage: single global figure with per-recipe override route open later.
- Price override authority: Cyrus only (Clemency view-only on prices in v1).
- Labour: included in cost rollup from MVP.
- Hospitality formats: free-text in v1; consumer-side moves to 100/300/600ml at rebrand.
- Recipe disclosure: removed entirely. We never disclose.
- **New:** §5.7a Production batches and bottle serial numbers — promoted to MVP.

---

## 1. Why we're building this

MFC has outgrown spreadsheets. We have:

- A live B2C site with multiple SKUs (Martini Flight, Choose Six, individuals, LEs).
- 6 active B2B clients including F&M (Clementini), with more in the pipeline.
- A growing hospitality pull — multiple inbound requests where revenue per relationship dwarfs retail wholesale.
- In-house production: ingredients in, production runs, finished bottles out.
- Custom partnerships (Myatt's Sours, Hibiscus) and an evolving spirits supply (in-house gin/vodka deal pending).

We don't have a single source of truth for cost-of-goods, inventory on hand, what we owe production, or whether a quote we sent out is still profitable after the last supplier price change. Pricing is currently rebuilt from memory each time someone asks. That has to stop before hospitality scales.

Back Bar already owns customer/wholesale records. The ERP module extends Back Bar so the same system also owns: what we make it from, what we make it in, what it costs, how much we have, and what it's worth.

---

## 2. Goals

1. **One source of truth** for ingredients, dry goods, packaging, finished products, costs, and inventory.
2. **Production is data**, not a memory exercise. Every batch is logged, traceable, and deducts inventory automatically.
3. **Pricing is derived**, not typed. Every customer-facing price is computed from current cost + margin rules + channel.
4. **Hospitality is a first-class channel** alongside DTC and retail wholesale, with its own pricing, formats, and document needs.
5. **Inbound is auditable.** Every receipt updates inventory and unit cost; price changes from suppliers are visible historically.
6. **It lives in Back Bar** — same auth, same data layer, same UI patterns, no separate login.

## 3. Non-goals (for now)

- Full accounting. QuickBooks remains the system of record for ledgers, tax, and AP/AR.
- Full WMS (warehouse management with bin locations, pick paths, etc.).
- Manufacturing scheduling / MRP. We're not optimising production sequences; we're recording them.
- Customer-facing inventory display ("only 4 left!") — Shopify already does this for DTC.
- Forecasting / demand planning models. Reorder thresholds are flat numbers in v1.

---

## 4. Glossary

| Term | Definition |
|---|---|
| **Ingredient** | A consumable raw input: spirits, citrus, sugar, herbs, in-house syrups before bottling. |
| **Sub-recipe** | An intermediate product made from ingredients and used to make finished products (e.g. Myatt's Sours base, hibiscus reduction). Has its own production runs and cost. |
| **Dry good** | A non-consumable component of a finished bottle: bottle, stopper, neck seal, label, neck tag. |
| **Packaging** | Outer materials: gift box, shipping carton, infill, tape, inserts, ice pack. |
| **Component** | Umbrella term for ingredient + sub-recipe + dry good + packaging. |
| **Product** | A sellable SKU: Martini Flight, Clementini 700ml, Choose Six box, etc. |
| **Recipe / BOM** | Bill of materials: which components, in what quantities, make one unit of a Product or Sub-recipe. |
| **Production run** | A logged batch — recipe × multiplier — that consumes components and produces a Product or Sub-recipe. |
| **Inbound** | A delivery from a supplier that increases component inventory. |
| **Channel** | DTC, retail wholesale, hospitality. Drives pricing, formats, document templates. |
| **Lot / Batch** | A traceable group of bottles or component units — comes from one inbound or one production run. Used interchangeably (operators say "batch", schema says "lot"). |
| **Bottle serial** | A unique per-bottle code issued from a batch, stamped on the back label. Enables recall, traceability, and per-bottle margin reporting. |

---

## 5. Data model

The shape below is the conceptual model. Code can map it to Postgres tables (or whatever the Back Bar stack uses) however makes sense. Field lists are illustrative, not exhaustive.

### 5.1 Suppliers

```
Supplier
  id, name, contact_email, contact_phone, address
  payment_terms (e.g. "30 days"), default_currency
  notes, active (bool)
  created_at, updated_at
```

### 5.2 Components

A single `Component` table with a discriminator is simpler than four parallel tables and matches how production actually thinks about things ("what goes into the bottle").

```
Component
  id, name, type (ingredient | sub_recipe | dry_good | packaging)
  unit_of_measure (ml, g, each, m)
  default_supplier_id → Supplier
  unit_cost (cached, last-known per UOM)
  reorder_threshold, reorder_quantity
  lead_time_days
  storage_location (free text v1: "dry store", "cold store", "spirits cage")
  notes, active
  created_at, updated_at
```

For ingredients we also want:

```
IngredientDetails (1:1 with Component where type = ingredient)
  abv (nullable, for spirits)
  allergen_flags (jsonb)
  shelf_life_days (nullable)
```

For sub-recipes:

```
SubRecipeDetails (1:1)
  recipe_id → Recipe   (sub-recipes have their own BOM)
  yield_quantity, yield_uom
  shelf_life_days
```

### 5.3 Component pricing history

Cost is not a single number; it changes every time we receive an inbound. Keep history.

```
ComponentPriceHistory
  id, component_id, supplier_id
  unit_cost, currency, uom
  effective_date, source (inbound_id | manual)
  notes
```

`Component.unit_cost` is a denormalised cache of the most recent entry. Costing decisions can use either "latest cost" or "weighted average over last N inbounds" — flag on the component, default to latest.

### 5.4 Inventory

```
InventoryLot
  id, component_id (or product_id — see 5.6)
  lot_code (auto: YYYYMMDD-NN or supplier batch number)
  source_type (inbound | production_run | manual_adjustment)
  source_id
  quantity_received, quantity_on_hand, uom
  unit_cost_at_receipt
  received_at, expires_at (nullable)
  status (active | depleted | quarantined | written_off)
```

Inventory is lot-based, not just a single "qty on hand" number. This gives:

- Traceability (which Clementini batch went to F&M).
- FIFO costing (oldest lot consumed first by default).
- Proper handling of price changes between deliveries.

A view `ComponentStock` rolls lots up to a per-component on-hand total for the UI.

### 5.5 Recipes (BOM)

```
Recipe
  id, name (e.g. "Clementini 700ml v3"), version
  product_id (nullable — null for sub-recipe recipes; non-null for finished products)
  sub_recipe_component_id (nullable — set if this recipe produces a sub-recipe)
  batch_size, batch_uom (the quantity one "run" produces, e.g. 50L mother batch → 70 × 700ml)
  yield_units (how many sellable units one batch produces, with expected wastage factored in)
  wastage_pct (default 2-5%)
  status (draft | active | archived)
  created_at, updated_at, archived_at

RecipeLine
  id, recipe_id, component_id
  quantity, uom
  notes (e.g. "post-rest", "added at bottling")
  ordering
```

Recipes are versioned. A new version creates a new Recipe row and archives the old one. Production runs always reference a specific Recipe version, so historical batch costs stay correct after a recipe change.

### 5.6 Products

```
Product
  id, name, sku, type (single_cocktail | flight | choose_n | gift_box | limited_edition)
  current_recipe_id → Recipe
  format (e.g. "100ml × 4", "700ml", "200ml")
  active, archived_at, notes

ProductBundle (for flights, Choose Six, gift sets)
  id, product_id (the bundle), child_product_id, quantity
```

Bundles (Choose Six, Martini Flight) are products whose recipe is "1× each child product + dry goods + packaging." Cost rolls up through the bundle.

### 5.7 Production runs

```
ProductionRun
  id, recipe_id (specific version)
  target_id (product_id or sub_recipe_component_id — what we're making)
  multiplier (integer, e.g. 3 = three batches)
  planned_yield, actual_yield
  status (planned | in_progress | completed | cancelled)
  started_at, completed_at
  operator (user_id), notes

ProductionRunConsumption
  id, production_run_id, inventory_lot_id
  quantity_consumed, uom
  cost_at_consumption (snapshot)

ProductionRunOutput
  id, production_run_id, inventory_lot_id (the lot created)
  quantity_produced, uom, lot_code
  cost_per_unit (computed: total inputs ÷ actual_yield, after wastage)
```

A completed production run does four things atomically:

1. Decrements `quantity_on_hand` on the consumed input lots (FIFO).
2. Creates a new `InventoryLot` for the output product/sub-recipe.
3. Stamps `cost_per_unit` from rolled-up input cost + wastage + labour. This becomes the basis for pricing.
4. Issues bottle serial numbers (see §5.7a).

**Labour on production runs:**

```
ProductionRun
  + labour_minutes (operator-entered on completion)
  + labour_rate_id → LabourRate (snapshotted at completion)
  + labour_cost (computed: minutes/60 × rate)

LabourRate
  id, name (e.g. "Production standard"), hourly_rate, currency
  effective_from, effective_to
```

Labour cost is added to the rolled-up input cost before dividing by yield, so `cost_per_unit` reflects time as well as ingredients.

### 5.7a Production batches and bottle serial numbers

Today: a spreadsheet says "we are making 60 bottles of Negroni 250ml," allocates serial numbers, and operators stamp those numbers onto paper back labels. This needs to be a one-click action in Back Bar.

**Concept:** every completed production run produces a **batch** (which is the `InventoryLot` from §5.4) and the batch can issue **bottle serials** — one row per bottle, each with a unique code that gets printed and stamped.

```
BottleSerial
  id, inventory_lot_id (the batch this serial belongs to)
  serial_code (unique, e.g. "NEG250-2026W18-0042")
  status (issued | applied | sold | written_off | recalled)
  applied_at (nullable — when the operator marked it stamped)
  sold_at (nullable — when the bottle leaves inventory via order)
  customer_id (nullable — set on outbound)
  notes
```

**Serial code format** (proposal — open to redo at rebrand):

```
{PRODUCT_CODE}-{YEAR}W{ISO_WEEK}-{NNNN}
e.g. NEG250-2026W18-0042
```

Year-week is more useful than YYYY-MM-DD for batch traceability and matches how production thinks about time. The four-digit suffix resets per batch, not per year.

**Serial issuance flow:**

1. Operator completes a production run, enters actual yield (e.g. 60 bottles).
2. System auto-issues 60 `BottleSerial` rows in `status = issued`.
3. Operator clicks **Print labels** → PDF generates with serial numbers in a label-printer-friendly layout. (v1: single-column list; v1.5: actual label sheet template.)
4. Operator stamps labels and applies to bottles, then in Back Bar marks the batch as **applied** (single click confirms all 60, or scans individual serials if a bottle is rejected).
5. Rejected bottles go to `status = written_off` with a reason.

**Serial → order linkage (v1.5):**

When a wholesale or hospitality order ships, the operator (or the system, given a scanner) assigns specific serials to the order. This gives full traceability: which exact bottles went to F&M, which to Macknade, etc. In MVP this is optional metadata; v1.5 makes it a first-class part of the dispatch flow.

**Why this matters beyond stamping labels:**

- **Recall capability.** If a batch has an issue, we know exactly which bottles went where.
- **F&M / hospitality demands.** Premium clients increasingly expect per-bottle traceability.
- **Lot-level economics.** Each serial inherits its batch's `cost_per_unit`, so when it sells we know the exact margin.
- **Repurposing for the rebrand.** When we move to 100/300/600ml, the serial system follows.

### 5.8 Inbounds (supplier deliveries)

```
PurchaseOrder (optional in v1, useful in v2)
  id, supplier_id, status (draft | sent | received | cancelled)
  expected_delivery_date, total_value, notes

Inbound
  id, supplier_id, purchase_order_id (nullable)
  received_at, received_by (user_id)
  invoice_reference, invoice_total, currency
  notes, attachments

InboundLine
  id, inbound_id, component_id
  quantity, uom
  unit_cost (what we paid this time)
  lot_code (supplier's, or generated)
  expires_at (nullable)
```

On submit, an Inbound creates one `InventoryLot` per line, writes a `ComponentPriceHistory` entry, and updates `Component.unit_cost`.

### 5.9 Customers and channels

Extends existing Back Bar customer records:

```
Customer (existing — extend)
  + channel (dtc | retail_wholesale | hospitality)
  + pricing_tier_id (nullable — overrides channel default)
  + payment_terms_override
  + notes

PricingTier
  id, name (e.g. "Hospitality Standard", "F&M", "Macknade"), channel
  margin_rule (jsonb: see §6)
  effective_from, effective_to
```

### 5.10 Quotes and price lists

```
PriceList
  id, name, channel, customer_id (nullable — customer-specific)
  effective_from, effective_to, status (draft | active | archived)

PriceListLine
  id, price_list_id, product_id
  computed_unit_cost (snapshot at generation)
  margin_pct, computed_unit_price
  manual_override_price (nullable)
  notes

Quote
  id, customer_id, status (draft | sent | accepted | rejected | expired)
  price_list_id (or inline lines)
  sent_at, valid_until, accepted_at
  total_value
```

---

## 6. Pricing engine

This is the bit that earns the system. The rules:

**Costing rule: latest-cost only.** Every component holds its most-recently-paid unit cost. We do not compute weighted-averages. Reason: in a market where prices only move up, latest cost is the honest read on what we'd pay to make this bottle today, and that's what should drive pricing decisions. Customer prices may be locked by an active price list (see below), but our internal margin view is always against latest cost.

**For any product, the unit cost is computed as:**

```
unit_cost = (sum(recipe_line.quantity × component.unit_cost) × (1 + wastage_pct))
          + labour_cost_per_unit
```

…recursively for sub-recipes, and including dry goods and packaging. `wastage_pct` is the global figure (see §13 #2). `labour_cost_per_unit` is the labour cost on the relevant production run divided by yield, or — for a never-yet-produced product — a forecast based on a reference recipe.

**Channel default margins** (configurable, illustrative):

| Channel | Default margin on top of cost | Notes |
|---|---|---|
| DTC | 70-75% | Plus VAT, shipping rules separate |
| Retail wholesale | 50-55% | RRP visible, retailer expects c.40% off RRP |
| Hospitality | 45-55% | Format-dependent; kegs/larger formats take lower margin per ml |

**Per-customer overrides** (Pricing Tier) sit on top of channel defaults. A B2B customer locked to a price list ignores cost movements until the price list expires or is regenerated.

**The price list lifecycle:**

1. Operator generates a draft price list for a customer or channel.
2. System snapshots current unit costs and applies margin rule.
3. Operator can override individual lines (e.g. round to a clean number, match a competitor).
4. List is approved and becomes active. Quotes/orders against an active list use those prices, not the live cost.
5. List has an expiry. A weekly job flags lists where underlying cost has moved >X% so we know to renegotiate.

**Why this matters for hospitality:** a hospitality client buying a 5L keg-pour format wants stable pricing for a quarter. Snapshotting protects them and us. When their price list expires, we look at current cost and re-issue.

---

## 7. Hospitality channel specifics

Hospitality is not just "wholesale with a different margin." First-class treatment means:

### 7.1 Formats

Hospitality products live alongside retail products but with their own SKU and recipe. **Format is free text in v1** — we're early in repositioning and don't want to lock the offer prematurely. Common candidates: 1L, 2L, 5L pouches or kegs alongside or instead of retail bottles, with lower per-ml dry goods cost and different (often shorter) shelf life. Once two or three formats prove themselves, we promote them to a controlled list.

Consumer side moves to a hard-edged enum at rebrand: 100ml, 300ml, 600ml.

Model: each hospitality format is a `Product` with `type = single_cocktail` and its own `Recipe`. The mother batch (sub-recipe) is shared with retail; the bottling step is what differs.

### 7.2 Documents per relationship

Hospitality clients expect, and we should generate from Back Bar:

- **Spec sheet** (PDF): cocktail name, ABV, serving size, glassware, garnish, shelf life, allergens. **Never recipes or ingredient lists.**
- **Service training one-pager**: how to pour, how to store, how to garnish.
- **Allergen / nutrition declaration**.
- **Per-batch certificate of analysis** for venues that ask (especially hotels). Pulls from the batch lot + bottle serial range.

These render from a fixed safe-fields template against `Product` + active `InventoryLot` data. Templates live in Back Bar.

### 7.3 Recipe disclosure: never

We do not disclose recipes, redacted or otherwise. There is no `disclosure_level` field on `Recipe`. The recipe table is internal-only, gated by Owner role. Spec-sheet templates pull only from the safe-fields list above; if a field isn't on that list, it cannot end up in a customer-facing document by accident.

### 7.4 Empties / returns (v2)

If we go down the keg-return route, we need a `Returnable` flag on dry goods and a basic empties-out / empties-in log. Out of MVP scope but worth keeping in mind so we don't paint ourselves into a corner with the dry goods schema.

---

## 8. User journeys

### 8.1 Receive a delivery

1. Operator opens **Inbounds → New**.
2. Selects supplier, enters invoice ref + invoice total.
3. Adds lines: component, quantity, unit cost, optional lot code & expiry.
4. Submits → system creates inventory lots, writes price history, refreshes `Component.unit_cost`.
5. If unit cost moved >5% from previous, system flags affected price lists for review.

### 8.2 Run production

1. Operator opens **Production → New Run**, picks a Recipe and a multiplier (e.g. "60 bottles of Negroni 250ml").
2. System shows planned consumption, flags any component that's short.
3. Operator marks run as in-progress.
4. On completion, operator enters actual yield, labour minutes, and any wastage notes.
5. Submit → system consumes input lots FIFO, creates output batch with computed cost-per-unit (input + wastage + labour ÷ yield).
6. System auto-issues N bottle serial numbers (N = actual yield).
7. Operator clicks **Print labels** → PDF with serials drops out, ready for stamping.
8. Once stamped, operator marks batch **applied** (one click for the whole batch, or per-serial scanning if any are rejected).

### 8.3 Build a quote for a hospitality prospect

1. Operator opens **Customers → [prospect] → New Quote**.
2. Picks products, quantities, format.
3. System pulls the customer's pricing tier (or hospitality default) and applies it to current rolled-up cost.
4. Operator can override prices line by line.
5. Operator generates a PDF quote + spec sheets for each cocktail.
6. Quote status flips to "sent"; expiry is 30 days by default.
7. On acceptance, the quote can be promoted to an active customer-specific price list.

### 8.4 Spot a problem

The dashboard should answer four questions at a glance:

- What am I about to run out of? (anything below `reorder_threshold`)
- Which price lists are stale? (cost has moved, or expiry approaching)
- Which production runs are mid-flight?
- This week's COGS by channel — DTC vs retail wholesale vs hospitality.

---

## 9. Integrations

### 9.1 Shopify (DTC)

- Existing Back Bar ↔ Shopify customer sync stays.
- **New:** when a Shopify order ships, post a `StockMovement` event to the ERP that decrements finished-product inventory and writes COGS at the cost of the consumed lot(s).
- **New:** `Product.is_synced_to_shopify` flag. Inventory levels can optionally push to Shopify so the storefront stays accurate (DTC only — wholesale/hospitality stock isn't Shopify-visible).

### 9.2 QuickBooks

- On Inbound submit → create a Bill in QB linked to the supplier. Map our line items to a single COGS account in v1; refine to multiple accounts later.
- On a wholesale invoice (issued from Back Bar) → push to QB as a Sales Receipt or Invoice.
- Don't try to two-way-sync the chart of accounts. QB stays the source of truth for accounting.

### 9.3 Existing wholesale customer/order records

- The Customer extension is additive — `channel` defaults to `retail_wholesale` for existing rows so we don't break anything.
- Existing wholesale orders should retroactively get a COGS calculation based on cost-at-time-of-shipment. Best-effort if we don't have lot data; flag estimates.

---

## 10. MVP slice (build first)

The minimum that delivers value end-to-end. Ship this in 2–3 weeks; everything else iterates on top.

**In MVP:**

- Suppliers (CRUD).
- Components — all four types — with `unit_cost`, `reorder_threshold`, `default_supplier`. (CRUD.)
- Inbounds: receive a delivery, update cost + create simple stock-on-hand totals (single bucket per component, NOT lots yet — see §11 v1.5).
- Recipes (BOM) for finished products. No sub-recipe support yet (treat sub-recipes as ingredients with manually-entered cost).
- Production runs: pick a recipe, multiplier, mark complete → consume components, increment finished-product stock, capture labour minutes.
- **Bottle serial issuance** (§5.7a): completing a run auto-issues N serials; one-click "print labels" PDF; one-click "mark batch applied".
- Global wastage % as a system setting (one number, used by every recipe).
- Labour rate as a system setting; labour cost rolled into product cost.
- Cost rollup: for any product, show current unit cost computed from latest component costs + wastage + labour.
- Channel (DTC / retail wholesale / hospitality) + pricing tier on customers.
- Manual price list builder: pick products, system shows cost, Cyrus enters margin or override price, generate PDF. Cyrus is sole price-override authority; Clemency view-only on prices in v1.
- Dashboard with five numbers: components below threshold, finished products on hand, last week's runs, last week's COGS, **% revenue by channel** (this is the metric we're dying to know).

**Explicitly out of MVP:**

- Lot-level inventory beyond batches (defer to v1.5 — but design the schema so we can switch on without migration pain).
- Sub-recipe production runs (manual cost entry until v1.5).
- Shopify and QuickBooks integration (manual export/CSV until v2).
- Spec-sheet PDF generation (use the existing Word/Drive flow until v2).
- Quote → price list promotion (manual until v2).
- Empties / returns.
- Forecasting, multi-warehouse, per-recipe wastage overrides.
- Per-serial sale linkage (issued and printable in MVP; sale linkage is v1.5).

## 11. Roadmap after MVP

**v1.5 (next 4–6 weeks after MVP):**

- Lot-level inventory + FIFO consumption.
- Sub-recipes with their own production runs.
- Customer-specific price lists with snapshotting and stale-list flagging.
- Hospitality spec sheet PDF generation from product + recipe data.

**v2 (next quarter):**

- Shopify ↔ ERP COGS / inventory sync.
- QuickBooks Bills + Invoices integration.
- Quote workflow end-to-end (draft → sent → accepted → price list).
- Returnable dry goods / empties tracking.
- Cost-movement alerts on active price lists.

**v3 / nice-to-have:**

- Purchase orders (raise PO → expected delivery → match against inbound).
- Multi-location inventory.
- Demand-driven reorder suggestions based on planned production.
- Per-recipe wastage overrides on top of the global figure.
- QR codes on bottle serials for end-customer scan-to-trace.

---

## 12. UI principles

- **Speed over polish.** This is operator software. Forms should be one-screen, keyboard-driven, no modal towers.
- **Consistent with existing Back Bar patterns** — same auth, same nav, same component library. Operator should not feel they've left.
- **No hidden state.** Every cost calculation should be inspectable: "Where did this £14.83 come from?" → click → see the rollup tree.
- **Time-aware everywhere.** Costs, prices, inventory, customer terms — all change. Show "as of" timestamps, never just a bare number.

---

## 13. Decisions

Decisions Cyrus made on 2026-05-04. These are not open — they're inputs to the build.

1. **Costing: latest-cost only.** No weighted-average, ever. Reasoning: market is one-way upward, latest cost is the honest read on what we'd pay today, and that's what should drive profitability decisions. Customer prices may be locked by an active price list, but our internal margin view is always against latest cost.

2. **Wastage: single global figure** as a system setting in MVP. Per-recipe overrides are a v3 nice-to-have, only if the global figure proves to mask real differences.

3. **Price override authority: Cyrus only.** Clemency has full read access to the system and full write access to operational data (inbounds, production runs, batch applications, dispatch), but cannot edit prices or generate price lists. Permission model: Operator vs Owner roles. Cyrus = Owner. Clemency = Operator.

4. **Labour included in cost rollup from MVP.** Single global hourly rate as a system setting. Production runs capture minutes; labour cost rolls into `cost_per_unit`. Per-operator hourly rates is a v2-or-later refinement.

5. **Hospitality formats: free text in v1.** We're early in repositioning. Consumer side moves to 100/300/600ml at the rebrand and that will be enum-locked. Hospitality stays exploratory — let the market tell us. Once we see two or three formats repeating, we promote those to a controlled list.

6. **Recipe disclosure: never.** No `disclosure_level` field anywhere. Recipes are internal-only. If a hospitality client asks, they get a tasting note and ABV — nothing else. Spec sheets in v1.5 generate from a fixed safe-fields template (name, ABV, serving size, glassware, garnish, allergens, shelf life) and pull only from those fields, regardless of what's in the recipe.

---

## 14. Why this gets built now (and fast)

Two business reasons sit behind the build. Both are urgent.

**Hospitality % of revenue is unknown — and that's the answer we're dying for.** Cyrus's working hypothesis is that hospitality is now the centre of gravity, but no one can see the actual split today. The MVP dashboard's "% revenue by channel" tile is the single most important number in this build. Until it exists, every strategic conversation about where to focus is opinion. Ship MVP fast precisely so this question stops being theoretical.

**Cyrus and Clemency are committed to adopting the new process.** This is not a tool we're building "for someone." It's a tool the two-person ops team will use every day. Skip MVP polish, ship the spine, iterate with real workflow data. v1.5 will be specced from how it actually feels to use, not from how we imagined it would.

## 15. Build order suggestion for Code

Not a hard sequence, but the dependency order that minimises rework:

1. **Foundations:** Suppliers + Components (CRUD), system settings (wastage %, labour rate), Owner/Operator roles.
2. **Inbounds:** receive a delivery → updates component cost, increments stock-on-hand. This is the simplest end-to-end loop and unblocks costing.
3. **Recipes (BOM):** for finished products only in MVP; sub-recipes are flat ingredients.
4. **Cost rollup view:** for any product, show the current latest-cost-based unit cost with breakdown.
5. **Production runs + serial issuance:** the heart of the system. Run → consume → output batch → issue serials → print labels.
6. **Customer channels + manual price list builder:** Cyrus generates a price list, system shows cost, Cyrus enters margin or override, PDF drops out.
7. **Dashboard:** the five-number summary, with % revenue by channel as the headline.

Each step ships behind a feature flag and is dogfooded for 1–2 days before the next is layered on. Anything that takes longer than its slice of the 2–3 week budget triggers a scope cut, not a deadline slip.

---

*Document version: v0.2, 2026-05-04. Decisions baked. Production batches & serial numbers added. Send to Code.*
