/**
 * MCP tools: pricing & ingredient writes.
 *
 * These wrap the Back Bar server actions, which write to the database:
 * ingredient prices update `components` and append a `component_price_history`
 * row (source "manual"); agreed prices close the current `sku_prices` row and
 * insert a new open one, so the history of what was actually charged is the
 * audit log.
 *
 * Writes require a write-tier token (see auth.ts).
 */

import { eq } from "drizzle-orm";

import { setAgreedRrp, setAgreedWholesale } from "@/app/actions/pricing";
import { updateIngredientPrice } from "@/app/actions/ingredients";
import { db } from "@/db";
import { skus, type Sku } from "@/db/schema";
import type { ToolArgs, ToolDefinition } from "../types";

function str(args: ToolArgs, key: string): string | null {
  const v = args[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/** Coerce a numeric argument that may arrive as a number or numeric string. */
function num(args: ToolArgs, key: string): number {
  const v = args[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error(`"${key}" must be a number.`);
  }
  return n;
}

/** Resolve a SKU by code (e.g. 'negroni-250') or numeric id. */
async function findSku(idArg: string): Promise<Sku> {
  const [byCode] = await db.select().from(skus).where(eq(skus.code, idArg));
  if (byCode) return byCode;
  const numeric = Number(idArg);
  if (Number.isInteger(numeric) && numeric > 0) {
    const [byId] = await db.select().from(skus).where(eq(skus.id, numeric));
    if (byId) return byId;
  }
  throw new Error(`Drink "${idArg}" not found. Use list_drinks to find the SKU code.`);
}

export const writeTools: ToolDefinition[] = [
  {
    name: "set_wholesale_price",
    title: "Set wholesale price",
    description:
      "Record a newly AGREED wholesale price (GBP, ex VAT) for one drink/SKU. " +
      "This closes the current agreed price and opens a new one effective " +
      "today; the formula rule price is unaffected and stays computed. Find " +
      "the drink id with list_drinks.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        drink_id: { type: "string", description: "SKU code (e.g. 'negroni-250') or numeric sku id." },
        wholesale: {
          type: "number",
          description: "Newly agreed wholesale price in GBP, ex VAT. Must be positive.",
        },
        note: {
          type: "string",
          description: "Optional note recorded on the price row, e.g. the review it came from.",
        },
      },
      required: ["drink_id", "wholesale"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const idArg = str(args, "drink_id");
      if (!idArg) throw new Error("drink_id is required.");
      const wholesale = num(args, "wholesale");
      const note = str(args, "note") ?? undefined;
      const sku = await findSku(idArg);

      const result = await setAgreedWholesale(sku.id, wholesale, { note });
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        drink: { skuId: sku.id, code: sku.code, sizeMl: sku.sizeMl },
        wholesale: Math.round(wholesale * 100) / 100,
        message: "Agreed wholesale price recorded in the database, effective today.",
      };
    },
  },
  {
    name: "set_rrp",
    title: "Set RRP",
    description:
      "Record a newly AGREED RRP (recommended retail price, GBP inc VAT) for " +
      "one drink/SKU. Closes the current agreed RRP and opens a new one " +
      "effective today. Find the drink id with list_drinks.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        drink_id: { type: "string", description: "SKU code (e.g. 'negroni-250') or numeric sku id." },
        rrp: {
          type: "number",
          description: "Newly agreed RRP in GBP, inc VAT. Must be positive.",
        },
        note: {
          type: "string",
          description: "Optional note recorded on the price row.",
        },
      },
      required: ["drink_id", "rrp"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const idArg = str(args, "drink_id");
      if (!idArg) throw new Error("drink_id is required.");
      const rrp = num(args, "rrp");
      const note = str(args, "note") ?? undefined;
      const sku = await findSku(idArg);

      const result = await setAgreedRrp(sku.id, rrp, { note });
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        drink: { skuId: sku.id, code: sku.code, sizeMl: sku.sizeMl },
        rrp: Math.round(rrp * 100) / 100,
        message: "Agreed RRP recorded in the database, effective today.",
      };
    },
  },
  {
    name: "set_ingredient_price",
    title: "Set ingredient price",
    description:
      "Update the current price of one ingredient in the buying master. For " +
      "pack-priced components (pack size > 1) the price is the PACK cost, e.g. " +
      "the bottle price; otherwise it is the per-unit cost. Appends a dated " +
      "manual entry to the price history. When the price was read from a " +
      "supplier invoice, pass invoice_supplier and invoice_ref so it counts as " +
      "invoice-backed; both may be given at an unchanged price to record that a " +
      "new invoice confirms it. Find the numeric ingredient id with list_ingredients.",
    access: "write",
    inputSchema: {
      type: "object",
      properties: {
        ingredient_id: {
          type: "number",
          description: "Numeric component id, e.g. 12.",
        },
        price: {
          type: "number",
          description: "New price in GBP (pack cost for pack-priced components). Must be zero or positive.",
        },
        note: {
          type: "string",
          description: "Optional note recorded with the price-history entry.",
        },
        invoice_supplier: {
          type: "string",
          description: "Who issued the invoice the price was read from, e.g. \"Matthew Clark\". Give with invoice_ref.",
        },
        invoice_ref: {
          type: "string",
          description: "The invoice number as printed, e.g. \"4417302\". Give with invoice_supplier.",
        },
      },
      required: ["ingredient_id", "price"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const componentId = num(args, "ingredient_id");
      if (!Number.isInteger(componentId) || componentId <= 0) {
        throw new Error("ingredient_id must be a positive integer.");
      }
      const price = num(args, "price");
      const note = str(args, "note") ?? undefined;
      const invoice = { supplier: str(args, "invoice_supplier"), ref: str(args, "invoice_ref") };

      const result = await updateIngredientPrice(componentId, price, note, invoice);
      if (!result.ok) throw new Error(result.error);
      return {
        ok: true,
        ingredient: result.ingredient,
        message:
          "Ingredient price updated in the database and stamped in the price history.",
      };
    },
  },
];
