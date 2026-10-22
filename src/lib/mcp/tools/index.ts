/**
 * Back Bar MCP connector — tool modules.
 *
 * Each domain contributes a module of tools. To add a new domain (e.g. the
 * Speed Rail ERP tools backed by Postgres once that merges into main), create
 * a new file in this folder and append its module here — nothing else in the
 * connector needs to change.
 */

import type { ToolModule } from "../types";
import { pricingTools } from "./pricing";
import { ingredientTools } from "./ingredients";
import { revenueTools } from "./revenue";
import { writeTools } from "./writes";
import { salesTools } from "./sales";
import { recipeTools } from "./recipes";
import { invoiceCheckTools } from "./invoice-check";

export const TOOL_MODULES: ToolModule[] = [
  { domain: "pricing", tools: pricingTools },
  { domain: "ingredients", tools: ingredientTools },
  { domain: "revenue", tools: revenueTools },
  { domain: "writes", tools: writeTools },
  { domain: "sales", tools: salesTools },
  { domain: "recipes", tools: recipeTools },
  { domain: "invoice-check", tools: invoiceCheckTools },
];
