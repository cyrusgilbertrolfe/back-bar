/**
 * Speed Rail (Back Bar ERP) Postgres schema — Drizzle.
 *
 * Spec source: docs/erp-spec.md §5. Field lists are illustrative per the spec —
 * we inline ingredient-specific columns on `components` rather than splitting
 * IngredientDetails out into its own table for slice 1. We can extract later if
 * the column count balloons.
 *
 * Slice 1 (Foundations): suppliers, components, component_price_history, system_settings.
 * Later slices add: inventory_lots, inbounds, inbound_lines, recipes, recipe_lines,
 * products, production_runs, production_run_consumption, production_run_outputs,
 * bottle_serials, customers, pricing_tiers, price_lists, price_list_lines.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const componentTypeEnum = pgEnum("component_type", [
  "ingredient",
  "sub_recipe",
  "dry_good",
  "packaging",
]);

export const uomEnum = pgEnum("uom", ["ml", "g", "each", "m"]);

/**
 * Where a price came from.
 *
 * "inbound" arrived through a goods-receipt record. "manual" was entered by a
 * person, usually from a supplier invoice in hand. "placeholder" is neither: it
 * is a number standing in until a real one exists, and it must never be
 * mistaken for either of the other two. Added 30 Jul 2026 so a figure like the
 * £4 per litre on house-brewed espresso, which is waiting on a yield
 * experiment, is visibly a stand-in rather than quietly authoritative.
 */
export const priceSourceEnum = pgEnum("price_source", ["inbound", "manual", "placeholder"]);

/**
 * Where an ABV figure came from. Ordered strongest to weakest on purpose: the
 * whole reason this enum exists is that "somebody read the bottle" and "it is
 * probably 40% like everything else" were indistinguishable until 12 Sept 2026.
 *
 * `assumed` is not a soft version of `bottle`. It means nobody has checked, and
 * on 12 Sept 2026 it was the honest label for 46 of 52 alcoholic components —
 * ten of which were recorded at exactly 40.00%.
 */
export const abvSourceEnum = pgEnum("abv_source", [
  /** Read off the physical bottle in the store. The strongest evidence there is. */
  "bottle",
  /** The producer's own published specification, with the URL in source_ref. */
  "manufacturer",
  /** Stated on a purchase invoice, with the invoice reference in source_ref. */
  "supplier_invoice",
  /**
   * A UK retailer's product listing, with the URL in source_ref. Added 13 Sept
   * 2026. A UK listing describes the UK bottling, which can differ from the
   * strength a producer quotes for other markets. Ranked below the producer's
   * own spec and below an invoice because a retailer can copy an error — but a
   * listing someone read is evidence, and `assumed` is not.
   */
  "retailer_listing",
  /** Taken from the category because nobody has checked. Not a reading. */
  "assumed",
  /** Entered to make something work, known at the time to be wrong. */
  "placeholder",
]);

/**
 * What job a component does on a SKU's bill of materials.
 *
 * The first five are PRIMARY packaging: they are on every bottle no matter how
 * it ships, so they belong inside COGS (Cyrus's ruling, 30 Jul 2026). The last
 * two are SECONDARY, they vary by channel, and they belong in the Channel P&L.
 * The `include_in_cogs` flag on the row is what actually decides; this enum is
 * for reporting and for catching a row filed under the wrong job.
 */
export const skuComponentRoleEnum = pgEnum("sku_component_role", [
  "bottle",
  "closure",
  "front_label",
  "back_label",
  "hygiene_label",
  "epr",
  "outer_carton",
  "shipping",
]);

// ─── Suppliers — spec §5.1 ──────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  defaultCurrency: text("default_currency").notNull().default("GBP"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Components — spec §5.2 ─────────────────────────────────────────────────

export const components = pgTable(
  "components",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: componentTypeEnum("type").notNull(),
    uom: uomEnum("uom").notNull(),

    defaultSupplierId: integer("default_supplier_id").references(
      () => suppliers.id,
      { onDelete: "set null" },
    ),

    /**
     * Operator entry: how the supplier sells it.
     * e.g. a 700ml bottle of Cocchi Torino: pack_size = 700, pack_cost = 15.17 (in UOM units).
     * For each-/m-UOM components pack_size is typically 1.
     */
    packSize: numeric("pack_size", { precision: 12, scale: 3 }),
    packCost: numeric("pack_cost", { precision: 12, scale: 2 }),

    /**
     * Derived: pack_cost / pack_size, in £ per UOM. Cached for fast recipe rollup.
     * Recipes consume in UOM units, so this is the canonical figure for cost engine.
     */
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull().default("0"),
    /** When the cached unitCost was last set. */
    unitCostSetAt: timestamp("unit_cost_set_at", { withTimezone: true }),

    /**
     * Sub-recipe only. How much the base batch yields, in this component's own
     * UOM. Myatt's Sours yields 326.2, so a 3 litre ask scales by 3000/326.2.
     * Null for anything that is bought rather than made.
     */
    batchYield: numeric("batch_yield", { precision: 12, scale: 4 }),
    /** Sub-recipe only. How to actually make it. */
    batchMethod: text("batch_method"),

    reorderThreshold: numeric("reorder_threshold", { precision: 12, scale: 3 }),
    reorderQuantity: numeric("reorder_quantity", { precision: 12, scale: 3 }),
    leadTimeDays: integer("lead_time_days"),
    storageLocation: text("storage_location"),
    notes: text("notes"),

    // Ingredient-only fields (nullable for other types). Per spec §5.2 these
    // could live in an IngredientDetails table; inlining for now.
    abv: numeric("abv", { precision: 5, scale: 2 }),
    /**
     * Provenance for `abv`, added 12 Sept 2026. Cached from the most recent
     * `component_abv_history` row, exactly as `unit_cost` caches the latest
     * price-history row.
     *
     * This column exists because the table already treated cost as a
     * time-varying, sourced, versioned fact — `unit_cost_set_at` was populated
     * on 71 of 72 ingredients and `component_price_history` held 116 rows —
     * while `abv` was a bare number with no date and no source. ABV is not a
     * constant: it changes when the product changes. That is not theoretical.
     * The house vodka moved from Bimber (37.5%) to Thames NGS (40.1%) in July
     * 2026, the switch was recorded as prose in a component name, and nothing
     * told anyone that Espresso Martini's computed ABV had moved and its label
     * needed re-checking. It still has not been.
     *
     * NULL means the figure predates this column and its origin is unknown.
     * Do not read NULL as `bottle`.
     */
    abvSource: abvSourceEnum("abv_source"),
    /** When `abv` was last set, mirroring `unit_cost_set_at`. */
    abvSetAt: timestamp("abv_set_at", { withTimezone: true }),
    /**
     * The actual product currently filling this component — "58 and Co London
     * Dry Gin" behind "Gin (in-house)". Added 13 Sept 2026. Cached from the
     * latest `component_abv_history` row.
     *
     * The component name is the recipe-facing item and stays stable when the
     * supplier changes; the product is a dated attribute of it, recorded with
     * the ABV it brings. Renaming the component instead would have put product
     * identity into the field every recipe points at, so the next substitution
     * would force either an in-place edit (losing what older batches were made
     * from) or a new row and a repoint — the route the house vodka took in July,
     * after which its label never followed. This is the cheap subset of an
     * item-master / supplier-part split, chosen so that split can come later
     * without repointing a single recipe line.
     */
    productName: text("product_name"),
    allergenFlags: jsonb("allergen_flags"),
    shelfLifeDays: integer("shelf_life_days"),

    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("components_type_idx").on(t.type),
    index("components_active_idx").on(t.active),
    index("components_default_supplier_idx").on(t.defaultSupplierId),
  ],
);

// ─── Component price history — spec §5.3 ────────────────────────────────────

export const componentPriceHistory = pgTable(
  "component_price_history",
  {
    id: serial("id").primaryKey(),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("GBP"),
    uom: uomEnum("uom").notNull(),
    effectiveDate: date("effective_date").notNull(),
    source: priceSourceEnum("source").notNull(),
    /** For inbound-sourced rows, the inbound id; null for manual entries. */
    sourceId: text("source_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("component_price_history_component_idx").on(t.componentId),
    index("component_price_history_effective_date_idx").on(t.effectiveDate),
  ],
);

/**
 * What a sub-recipe component is made of. Added 30 Jul 2026.
 *
 * The component_type enum has carried "sub_recipe" since slice 1 and nothing
 * ever used it, so a house-made input like Myatt's Sours sat in the register as
 * a flat hand-typed £5 a litre with no constituents behind it. This table is
 * the exact parallel of sku_components, one level down: a parent component and
 * the children that go into one base batch of it.
 *
 * Two things fall out. Cost derives rather than being asserted, so when the
 * citric acid price moves, Sours moves and so does every drink using it. And
 * batch scaling becomes a query: quantities are per base batch, the parent
 * carries batch_yield, so N units wanted scales every child by N / batch_yield.
 *
 * Nesting is allowed and needed: the phosphoric acid 1.25% stock is itself a
 * sub-recipe that Sours consumes.
 */
/**
 * ABV history, added 12 Sept 2026 — the exact shape of
 * `component_price_history`, for the same reason.
 *
 * Cost got this treatment from the start and ABV did not, so a cost change was
 * an auditable dated event with a source while an ABV change was an overwrite.
 * That asymmetry sat inside one table for four months and produced two real
 * consequences: the Espresso Martini label that never followed its vodka
 * change, and an in-house gin recorded at 41.2% when every 58 & Co invoice
 * since November 2025 states 43%.
 *
 * Never overwrite `components.abv` without writing a row here. The row is the
 * evidence that the figure was ever different, and the evidence is the point.
 */
export const componentAbvHistory = pgTable(
  "component_abv_history",
  {
    id: serial("id").primaryKey(),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    abv: numeric("abv", { precision: 5, scale: 2 }).notNull(),
    /** Which product this reading is for. A change of product is a new row. */
    productName: text("product_name"),
    effectiveDate: date("effective_date").notNull(),
    source: abvSourceEnum("source").notNull(),
    /**
     * What to go and look at to check this: an invoice number, a URL, a
     * shelf location. Free text on purpose — the provenance of a number is a
     * sentence, not an enum, and flattening it is how provenance gets lost.
     */
    sourceRef: text("source_ref"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("component_abv_history_component_idx").on(t.componentId),
    index("component_abv_history_effective_date_idx").on(t.effectiveDate),
  ],
);

export const componentRecipes = pgTable(
  "component_recipes",
  {
    id: serial("id").primaryKey(),
    parentComponentId: integer("parent_component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    childComponentId: integer("child_component_id")
      .notNull()
      .references(() => components.id, { onDelete: "restrict" }),
    /** Quantity of the child, in the CHILD's UOM, per one base batch. */
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("component_recipes_parent_idx").on(t.parentComponentId),
    index("component_recipes_child_idx").on(t.childComponentId),
    uniqueIndex("component_recipes_parent_child_uq").on(t.parentComponentId, t.childComponentId),
    check("component_recipes_qty_positive", sql`${t.quantity} > 0`),
    check("component_recipes_no_self_ref", sql`${t.parentComponentId} <> ${t.childComponentId}`),
  ],
);

/** What kind of price a sku_prices row records. */
export const priceTypeEnum = pgEnum("sku_price_type", ["wholesale", "rrp"]);

/**
 * Agreed prices for a SKU, with the period they apply to. Added 30 Jul 2026.
 *
 * The important thing this encodes (Cyrus, 30 Jul 2026): wholesale prices are
 * REISSUED ONCE A YEAR, after the government announces the annual duty rise.
 * They are a commitment to a retailer for a period, not an output of a formula.
 * So the price lives here as a fact with an effective date, and the formula
 * price (COGS x markup + shipping) is computed live for comparison only and is
 * never written anywhere.
 *
 * That comparison is the point. Between annual reviews, costs move and the
 * agreed price does not, so the gap between the two IS the margin erosion, and
 * it is what tells us what to ask for at the next review.
 *
 * Client scoping comes free: a SKU already carries client_id, so the Cripps
 * 700ml and the own-brand 500ml are different rows by construction.
 */
export const skuPrices = pgTable(
  "sku_prices",
  {
    id: serial("id").primaryKey(),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    priceType: priceTypeEnum("price_type").notNull(),
    /** Wholesale is ex VAT. RRP is inc VAT, as printed to the customer. */
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    /** Null means this is the price in force now. */
    effectiveTo: date("effective_to"),
    /** Per-bottle shipping assumed when this price was agreed. */
    shipping: numeric("shipping", { precision: 12, scale: 4 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sku_prices_sku_idx").on(t.skuId),
    index("sku_prices_type_idx").on(t.priceType),
    uniqueIndex("sku_prices_current_uq")
      .on(t.skuId, t.priceType)
      .where(sql`${t.effectiveTo} is null`),
    check("sku_prices_amount_positive", sql`${t.amount} > 0`),
  ],
);

// ─── System settings — key/value ────────────────────────────────────────────
// Spec §10 + §13 #2/#4: wastage_pct, labour_rate, plus the global serial counter
// for the bottle-serial spine.

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Drinks / Recipes layer ─────────────────────────────────────────────────
// Source: "Drinks, Recipes, and the Calculator rebuild" brief (2026-06-02).
// Lifts recipe knowledge out of the calculator into a first-class Drink with
// one client-scoped Recipe beneath it. Recipes are versioned and percentage-
// based (proportions, scaled to any batch size by the calculator).
//
// Note on PK style: the brief specifies UUID PKs, but the Slice 1 foundation
// uses serial integers throughout — we match the foundation so FKs into
// `components` (and everywhere else) stay consistent.

export const drinkStatusEnum = pgEnum("drink_status", ["active", "archived"]);

/**
 * How a drink is served: straight from the freezer, over ice in the glass, or
 * shaken. TYPED, not derived — Cyrus decides by tasting, and the value is a
 * fact he asserts, never a formula output. A water line in the recipe was
 * tested as a rule on 15 Aug 2026 and rejected: the Cold Brew Negroni carries
 * no water by any route and freezes well, while the Negroni also carries none
 * and does not. The water percentage is still computed as a diagnostic (see
 * src/lib/erp/canon.ts) but it does not decide the serve.
 */
export const serveMethodEnum = pgEnum("serve_method", ["freezer", "ice_in_glass", "shake"]);

/** Clients a recipe can be scoped to. Exactly three seeded: mfc, fm, cripps. */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** true for MFC only — the default recipe a new client recipe is cloned from. */
  isDefault: boolean("is_default").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A cocktail. Slug + name + status since slice 1; the canon columns below were
 * added 15 Aug 2026 so that what we SAY about a drink — serve, garnish, story,
 * copy — lives on the drink and not scattered across Shopify, the Choose Six
 * API and people's heads. Everything canon is nullable: an empty field means
 * "not yet decided", and the generators must treat it that way rather than
 * inventing a value.
 *
 * Two of these columns are TYPED where a formula was tempting, and the reason
 * is recorded on each. The derived counterparts (ABV, water percentage, the
 * rest-weeks floor) are computed at read time in src/lib/erp/canon.ts and are
 * never stored, on the same principle as the rule price in sku_prices: a fact
 * someone asserted and a number a formula produced must never share a column.
 */
export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: drinkStatusEnum("status").notNull().default("active"),
  notes: text("notes"),

  // ── Serve ─────────────────────────────────────────────────────────────────

  /**
   * TYPED, not derived — see the note on serveMethodEnum. Cyrus decides by
   * tasting; the water diagnostic in the canon lib informs the tasting, it
   * does not make the call.
   */
  serveMethod: serveMethodEnum("serve_method"),
  /** Why the serve is what it is, where it would surprise someone. */
  serveNote: text("serve_note"),
  glass: text("glass"),
  garnish: text("garnish"),
  /**
   * Whether the garnish ships in the box. Kept apart from `garnish` because a
   * customer reading "Sakura blossom" needs to know if they must go and buy
   * one, and the answer can differ by format — hence the note alongside.
   */
  garnishSupplied: boolean("garnish_supplied"),
  /** e.g. Sakura blossom ships with the 250ml, not the minis. */
  garnishSuppliedNote: text("garnish_supplied_note"),

  // ── Rest ──────────────────────────────────────────────────────────────────

  /**
   * TYPED, only Cyrus fills this. The derived floor (6 weeks when vermouth or
   * sherry is present, see canon.ts) is computed, never stored: vermouth is a
   * trigger, not a limit (Cyrus, 14 Aug 2026), and drinks without it are aged
   * anyway. This column is the confirmed answer for one drink, from tasting.
   */
  restWeeksConfirmed: integer("rest_weeks_confirmed"),
  /** When Cyrus confirmed it, so a stale confirmation is visible as stale. */
  restConfirmedOn: timestamp("rest_confirmed_on", { withTimezone: true }),

  /**
   * Why a printed label legitimately differs from the computed figure. Exists
   * so a label/database mismatch can be a recorded decision rather than a
   * defect someone "fixes" by overwriting the computed truth.
   */
  labelVarianceNote: text("label_variance_note"),

  // ── Story ─────────────────────────────────────────────────────────────────

  originPlace: text("origin_place"),
  /** TEXT, not integer: real values are "1890s", "circa 1938". */
  originYear: text("origin_year"),
  originPerson: text("origin_person"),
  /** The one true thing about this drink that only we can say. */
  ownableTruth: text("ownable_truth"),
  /** Claims we must never make — the guard rail for every generator and draft. */
  neverSay: text("never_say"),

  // ── Copy ──────────────────────────────────────────────────────────────────

  lede: text("lede"),
  description: text("description"),
  detailedDescription: text("detailed_description"),

  // ── Joins outward ─────────────────────────────────────────────────────────

  /**
   * The join to Shopify. Generation resolves by handle, never by a remembered
   * numeric id, because ids drift when products are recreated and a wrong id
   * fails silently onto the wrong product.
   */
  shopifyHandle: text("shopify_handle"),
  /**
   * The Choose Six configurator's handle. Kept separate because it genuinely
   * differs from our slug: Baby Otis is baby-otis-cuban-rum-manhattan there.
   */
  chooseSixHandle: text("choose_six_handle"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A versioned, client-scoped recipe for a drink. Editing creates a new row
 * (version + 1, is_current = true) and flips the old row's is_current to false;
 * past versions and their lines are immutable history, so a re-price of a past
 * batch always finds the same lines.
 */
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    drinkId: integer("drink_id")
      .notNull()
      .references(() => drinks.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    // Free-text production method/instructions (e.g. infusions, filtering).
    // Versioned with the rest of the recipe — each edit carries it forward.
    method: text("method"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recipes_drink_client_idx").on(t.drinkId, t.clientId),
    uniqueIndex("recipes_drink_client_version_uq").on(t.drinkId, t.clientId, t.version),
    // Exactly one current row per (drink, client).
    uniqueIndex("recipes_current_uq")
      .on(t.drinkId, t.clientId)
      .where(sql`${t.isCurrent}`),
  ],
);

/**
 * One ingredient line of a recipe, by percentage of the batch. Per-line CHECK
 * keeps each share in [0, 100]; the stricter "lines sum to exactly 100" rule is
 * a cross-row aggregate (not expressible as a row-level CHECK) and is enforced
 * in the seed and the edit server action.
 */
export const recipeLines = pgTable(
  "recipe_lines",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "restrict" }),
    percentage: numeric("percentage", { precision: 6, scale: 3 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    index("recipe_lines_recipe_idx").on(t.recipeId),
    check("recipe_lines_pct_range", sql`${t.percentage} >= 0 AND ${t.percentage} <= 100`),
  ],
);

/**
 * Sellable bottle formats (e.g. negroni-250, negroni-500), migrated from the
 * legacy per-drink GTIN map. `drink_id` is the §8 FK (nullable for sets like
 * Martini Flight that aren't a single drink). The calculator reads sizeMl to
 * show per-bottle cost at each available size. COGS-from-recipe is a follow-up;
 * the FK is wired but not yet read for costing.
 */
export const skus = pgTable(
  "skus",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    drinkId: integer("drink_id").references(() => drinks.id, { onDelete: "set null" }),
    /**
     * Which client's recipe this format sells under. Added 30 Jul 2026.
     *
     * Without it the table cannot express "Cripps Espresso Martini 700ml":
     * drink 6 carries both an own-brand recipe and a Cripps recipe, so
     * (drink_id, size_ml) is ambiguous the moment a partner shares a drink
     * name with the own-brand range. That ambiguity is why the flagship, about
     * half of all wholesale, had no SKU and had to be costed by hand.
     *
     * Nullable for now so the migration is purely additive. The 29 pre-existing
     * rows are all own-brand and are backfilled to Myatt's Fields by a separate
     * data step, after which this should be tightened to NOT NULL.
     */
    clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }),
    sizeMl: integer("size_ml").notNull(),
    gtin: text("gtin"),
    active: boolean("active").notNull().default(true),

    /**
     * How this format is known to the client who buys it. Added 19 Sep 2026
     * for the Fortnum's case labels.
     *
     * These live on the SKU, not the drink and not the order. The drink is
     * ours: "Apples & Pears". The client's name for it, "Apples 'n' Pears
     * Cocktail 19% 50cl", carries their spelling, a strength and a size, so
     * it would be wrong on our own-brand bottle of the same liquid. And it
     * does not change from one purchase order to the next, so it is entered
     * once here rather than retyped per order. The order line keeps its own
     * verbatim copy (wholesale_order_lines.customer_description) and the two
     * are compared, never merged: a disagreement is how a wrong case size or
     * a wrong bottle gets caught.
     *
     * short_code is ours, the "Your item number" on their PO. Standard agreed
     * by Cyrus 19 Sep 2026: client prefix, hyphen, four-letter mnemonic of the
     * drink in capitals (FM-EDAQ, FM-APPR). Assigned once, never changed or
     * reused. No size in the code unless one drink ships to the same client
     * in two sizes, then a suffix (-35, -50).
     */
    shortCode: text("short_code").unique(),
    /** Their code for this product, e.g. 5248400 at Fortnum's. */
    customerItemCode: text("customer_item_code"),
    /** Their description, VERBATIM off their PO. */
    customerDescription: text("customer_description"),
    /** Bottles per outer case, as the client has it set up. */
    unitsPerCase: integer("units_per_case"),

    /**
     * What the PHYSICAL LABEL says. Added 30 Aug 2026.
     *
     * This is not the computed ABV and must never be confused with it. Back
     * Bar derives an ABV from the recipe (see abvComputed in lib/erp/canon);
     * the bottle carries a printed figure that somebody chose and a printer
     * set in ink. They are two different facts, and until this column existed
     * the database had room for only one of them.
     *
     * That is not hypothetical. At 14:53:08 on 14 Aug 2026 seventeen of
     * twenty `custom.abv` metafields on Shopify were overwritten in a single
     * write with values computed from the recipe database, and because
     * `custom.abv` was the only place the label figure lived, nine drinks
     * lost their number outright. They were recoverable only by asking
     * Cyrus. This column is the place that can never happen to again.
     *
     * NULL means NOBODY HAS READ THE BOTTLE. It does not mean "agrees with
     * computed", and it must NEVER be filled by copying the computed value —
     * that single act is the mistake the column exists to prevent. Gate 1
     * cannot run against a NULL, so such a recipe saves but is flagged
     * unverified rather than passing silently.
     */
    declaredAbv: numeric("declared_abv", { precision: 4, scale: 1 }),
    /**
     * Where the figure came from, so a reading off a bottle and a figure
     * taken from a printer's artwork stay distinguishable later. Free text on
     * purpose: the provenance of a recovered number is a sentence, not an
     * enum, and flattening it to a code is how provenance gets lost.
     */
    declaredAbvSource: text("declared_abv_source"),
    /** When it was read or recorded, so a stale reading is visible as stale. */
    declaredAbvNoted: date("declared_abv_noted"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("skus_drink_idx").on(t.drinkId),
    index("skus_client_idx").on(t.clientId),
  ],
);

/**
 * Bill of materials: which dry goods and packaging go on a given SKU, and how
 * many of each. Added 30 Jul 2026 to close the gap the 20 Jul reconciliation
 * found, that no table linked any dry good to any SKU, so packaging cost could
 * never roll up and the honest build had to be assembled by hand.
 *
 * `include_in_cogs` is the mechanism for Cyrus's 30 Jul ruling: primary
 * packaging (bottle, closure, front label, hygiene label, EPR) sits inside
 * COGS because it is on every bottle regardless of channel; mailers, cases and
 * carriage sit outside it, in the Channel P&L, because they genuinely vary.
 */
export const skuComponents = pgTable(
  "sku_components",
  {
    id: serial("id").primaryKey(),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "restrict" }),
    /** How many of this component per finished bottle. Usually 1. */
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("1"),
    role: skuComponentRoleEnum("role").notNull(),
    includeInCogs: boolean("include_in_cogs").notNull().default(true),
    /**
     * The customer supplies this component, so we never pay for it. Added
     * 19 Aug 2026, named as a needed column by the 12 Aug order model.
     *
     * This is NOT the same thing as include_in_cogs being false, and
     * conflating the two is why it needed its own column. A false
     * include_in_cogs says "we pay for this and it belongs in the Channel
     * P&L rather than COGS", which is true of a mailer. This says "we do not
     * pay for this at all", which is true of Fortnum's glass, corks and
     * labels on the distillery editions (Cyrus, confirmed 12 Aug 2026, per
     * Stina Lundberg's line of 10 Jul).
     *
     * The row survives rather than being deleted, deliberately, so a later
     * reader can tell a component we do not pay for from one nobody
     * remembered to add. That distinction is exactly what the 12 Aug audit
     * of PU215780 could not make, and the Angostura it found missing from
     * the Apples & Pears bill of materials is the case it could not tell
     * apart.
     *
     * Consequence worth holding: EPR follows the component. If Fortnum's
     * supply the glass, the EPR liability is theirs under the 22 Jul split.
     */
    suppliedByCustomer: boolean("supplied_by_customer").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sku_components_sku_idx").on(t.skuId),
    index("sku_components_component_idx").on(t.componentId),
    uniqueIndex("sku_components_sku_component_uq").on(t.skuId, t.componentId),
    check("sku_components_qty_positive", sql`${t.quantity} > 0`),
  ],
);

// ─── Wholesale orders ───────────────────────────────────────────────────────
// Design: Projects/Cocktails/Back Bar/2026-08-21 Wholesale orders in Back Bar,
// the record, the states and the migration [Design].md. SPECIFIED there, not
// yet built: this schema and migration 0011 exist on disk but the migration
// has not been applied.
//
// Five tables. `customers` is the customer master that did not exist before
// this: the wholesale accounts (Fortnum & Mason, Bayley & Sage, Cripps,
// Macknade, Italo) previously lived only in QuickBooks. `wholesale_orders`
// and `wholesale_order_lines` are the order and its keyed lines, read from a
// supplier PDF by a person, never machine parsed. `wholesale_order_bookings`
// is a child row per delivery slot, because a delivery gets booked, rebooked
// and sometimes split. `purchase_commitments` answers "did we buy it" and
// deliberately stops short of "do we have it": a row is written at the
// moment of ordering and never becomes a receipt.

export const wholesaleOrderStatusEnum = pgEnum("wholesale_order_status", [
  "received",
  "acknowledged",
  "priced",
  "committed",
  "in_production",
  "dispatched",
  "invoiced",
  "closed",
]);

export const purchaseCommitmentStatusEnum = pgEnum("purchase_commitment_status", [
  "placed",
  "arrived",
  "cancelled",
]);

/**
 * The customer master. Minimal on purpose: QuickBooks remains the financial
 * master, this exists only to give a wholesale order somewhere to point.
 *
 * Deliberately not merged with `accounts`, the wholesale outreach tracker: a
 * prospect and a customer are different objects with different lifecycles.
 * Cross-reference them, never fuse them (design doc, 21 Aug 2026).
 */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quickbooksCustomerId: text("quickbooks_customer_id"),
  /** Their code for us, e.g. MY010 at Fortnum's. */
  accountCode: text("account_code"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const wholesaleOrders = pgTable(
  "wholesale_orders",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    /** Their order number, e.g. PU215780, PO113429. */
    orderNumber: text("order_number").notNull(),
    /** The date on their document. */
    raisedOn: date("raised_on"),
    /** When it hit the mailbox. */
    receivedAt: timestamp("received_at", { withTimezone: true }),
    /** The Superhuman thread id, the permanent link back to the world. */
    sourceThreadId: text("source_thread_id"),
    /** The attachment filename. */
    documentRef: text("document_ref"),
    status: wholesaleOrderStatusEnum("status").notNull().default("received"),
    requestedDeliveryFrom: date("requested_delivery_from"),
    requestedDeliveryTo: date("requested_delivery_to"),
    bookingDeadline: timestamp("booking_deadline", { withTimezone: true }),
    deliveryAddress: text("delivery_address"),
    bookingChannel: text("booking_channel"),
    /**
     * When the customer's own glass, corks and labels reach us, for an
     * own-label edition. On PU215780 this has never been requested, has no
     * date and is on nobody's list, while every downstream date depends on
     * it (design doc, 21 Aug 2026).
     */
    customerSuppliedComponentsDue: date("customer_supplied_components_due"),
    /**
     * The shelf price the customer intends. Their number, not ours, and the
     * only correct input to pricing an own-label edition.
     */
    customerRrp: numeric("customer_rrp", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wholesale_orders_status_idx").on(t.status),
    uniqueIndex("wholesale_orders_customer_order_uq").on(t.customerId, t.orderNumber),
  ],
);

export const wholesaleOrderLines = pgTable(
  "wholesale_order_lines",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => wholesaleOrders.id, { onDelete: "cascade" }),
    lineNo: integer("line_no"),
    /** Their code, e.g. 5246820. */
    customerItemCode: text("customer_item_code"),
    /**
     * VERBATIM off their document. What makes the format check possible:
     * "Gingertini Christmas Cocktail 17.6% 50cl" against a Back Bar SKU that
     * said 350ml is how the 12 Aug session found the wrong bottle in twenty
     * minutes. Paraphrase it and the check dies.
     */
    customerDescription: text("customer_description"),
    /**
     * Nullable, deliberately: an unmatched line is an honest state the
     * schema should be able to hold. A schema that demands a match invites
     * a guess (design doc, 21 Aug 2026).
     */
    skuId: integer("sku_id").references(() => skus.id, { onDelete: "set null" }),
    qty: numeric("qty", { precision: 12, scale: 2 }).notNull(),
    /** e.g. "Case 6". */
    unitDescription: text("unit_description"),
    unitsPerCase: integer("units_per_case"),
    /**
     * What their PO says, e.g. £0.00 on PU215780. A different fact from
     * unitPriceQuoted, and merging them loses the disagreement, which is
     * the point.
     */
    unitPriceStated: numeric("unit_price_stated", { precision: 12, scale: 4 }),
    unitPriceQuoted: numeric("unit_price_quoted", { precision: 12, scale: 4 }),
    quotedOn: date("quoted_on"),
  },
  (t) => [index("wholesale_order_lines_order_idx").on(t.orderId)],
);

/**
 * A child row per delivery slot rather than columns on the order, because a
 * delivery gets booked, rebooked and sometimes split.
 *
 * cases/pallets are stored rather than derived, a deliberate exception to
 * the derive-everything rule: they are not a calculation, they are what we
 * told a third party, and the number that matters when a delivery is turned
 * away is the number on the booking, not the number the recipe implies.
 */
export const wholesaleOrderBookings = pgTable(
  "wholesale_order_bookings",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => wholesaleOrders.id, { onDelete: "cascade" }),
    /** A timestamp, because 14:30 is part of the commitment. */
    bookedFor: timestamp("booked_for", { withTimezone: true }),
    /** e.g. FM127958. */
    reference: text("reference"),
    /** e.g. Pallet Track. */
    haulier: text("haulier"),
    cases: integer("cases"),
    pallets: integer("pallets"),
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
    bookedBy: text("booked_by"),
    isCurrent: boolean("is_current").notNull().default(true),
  },
  (t) => [
    index("wholesale_order_bookings_order_current_idx")
      .on(t.orderId)
      .where(sql`${t.isCurrent}`),
  ],
);

/**
 * Records that we placed an order: supplier, what, how much, when placed,
 * when expected, and which wholesale order it serves. Answers "did we buy
 * it" and deliberately refuses to answer "do we have it". A row is not a
 * receipt and never becomes one; a short delivery is a note and a second
 * commitment, not a schema feature (design doc, 21 Aug 2026).
 *
 * unitPrice here is a different fact from components.unitCost: that column
 * holds what a thing costs for costing purposes, this holds what we
 * actually agreed to pay on one occasion. Where they disagree, the
 * component price is stale.
 */
export const purchaseCommitments = pgTable(
  "purchase_commitments",
  {
    id: serial("id").primaryKey(),
    supplierName: text("supplier_name").notNull(),
    /** Nullable: you can commit to something the register does not carry yet. */
    componentId: integer("component_id").references(() => components.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    /**
     * Free text, not the existing `uom` enum: that enum covers ml/g/each/m
     * and a purchase commitment needs units it does not carry, e.g. litres
     * on the 118L Ginger Amalthea Gin order. Left as text per the design
     * doc rather than widening the enum, which is a separate decision.
     */
    uom: text("uom"),
    unitPrice: numeric("unit_price", { precision: 12, scale: 4 }),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    orderedOn: date("ordered_on").notNull(),
    expectedOn: date("expected_on"),
    /** Nullable: not every purchase serves a specific order. */
    wholesaleOrderId: integer("wholesale_order_id").references(() => wholesaleOrders.id, {
      onDelete: "set null",
    }),
    /** Their proforma or order number. */
    reference: text("reference"),
    status: purchaseCommitmentStatusEnum("status").notNull().default("placed"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("purchase_commitments_wholesale_order_idx").on(t.wholesaleOrderId),
    index("purchase_commitments_status_idx").on(t.status),
  ],
);

// ─── Inferred types ─────────────────────────────────────────────────────────

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;

export type ComponentPriceHistoryRow = typeof componentPriceHistory.$inferSelect;
export type NewComponentPriceHistoryRow = typeof componentPriceHistory.$inferInsert;
export type NewComponentAbvHistoryRow = typeof componentAbvHistory.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Drink = typeof drinks.$inferSelect;
export type NewDrink = typeof drinks.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type RecipeLine = typeof recipeLines.$inferSelect;
export type NewRecipeLine = typeof recipeLines.$inferInsert;

export type Sku = typeof skus.$inferSelect;
export type NewSku = typeof skus.$inferInsert;

export type SkuComponent = typeof skuComponents.$inferSelect;
export type NewSkuComponent = typeof skuComponents.$inferInsert;

export type ComponentRecipe = typeof componentRecipes.$inferSelect;
export type NewComponentRecipe = typeof componentRecipes.$inferInsert;

export type SkuPrice = typeof skuPrices.$inferSelect;
export type NewSkuPrice = typeof skuPrices.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type WholesaleOrder = typeof wholesaleOrders.$inferSelect;
export type NewWholesaleOrder = typeof wholesaleOrders.$inferInsert;

export type WholesaleOrderLine = typeof wholesaleOrderLines.$inferSelect;
export type NewWholesaleOrderLine = typeof wholesaleOrderLines.$inferInsert;

export type WholesaleOrderBooking = typeof wholesaleOrderBookings.$inferSelect;
export type NewWholesaleOrderBooking = typeof wholesaleOrderBookings.$inferInsert;

export type PurchaseCommitment = typeof purchaseCommitments.$inferSelect;
export type NewPurchaseCommitment = typeof purchaseCommitments.$inferInsert;

// ─── Setting keys ───────────────────────────────────────────────────────────

export const SETTING_KEYS = {
  /** Global wastage percentage applied to every recipe rollup. Stored as decimal string, e.g. "0.02". */
  WASTAGE_PCT: "wastage_pct",
  /** Single global labour rate in GBP per hour. Stored as decimal string, e.g. "15.00". */
  LABOUR_RATE_GBP_PER_HOUR: "labour_rate_gbp_per_hour",
  /** Next bottle-serial suffix to issue. Global counter. Stored as integer string, e.g. "35001". */
  NEXT_SERIAL_NUMBER: "next_serial_number",
  /** Wholesale markup on COGS, e.g. "1.40". Used for the rule price, never written to a price. */
  PRICING_MARKUP: "pricing_markup",
  /** Margin a retailer is assumed to add, e.g. "1.30". Used by the retailer test. */
  PRICING_RETAILER_MARGIN: "pricing_retailer_margin",
  /** VAT multiplier, e.g. "1.20". */
  PRICING_VAT: "pricing_vat",
  /** Date the current wholesale price list took effect. Reissued annually after the duty rise. */
  PRICING_LIST_EFFECTIVE_FROM: "pricing_list_effective_from",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
