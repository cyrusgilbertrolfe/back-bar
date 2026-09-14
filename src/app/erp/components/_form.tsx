"use client";

/**
 * Shared form body for component create + edit.
 * Client component because PackPricer needs live calculation as the
 * operator types pack size and cost.
 */

import { useState } from "react";
import Link from "next/link";
import { COLOR } from "@/lib/design";
import { Field, Textarea, Select, buttonPrimary, buttonGhost, inputStyle, labelStyle } from "../_components/forms";
import type { Component } from "@/db/schema";
import { PackPricer } from "./_PackPricer";

const TYPE_OPTIONS = [
  { value: "ingredient", label: "Ingredient" },
  { value: "sub_recipe", label: "Sub-recipe (treat as ingredient in MVP)" },
  { value: "dry_good", label: "Dry good" },
  { value: "packaging", label: "Packaging" },
];

const UOM_OPTIONS = [
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "each", label: "each" },
  { value: "m", label: "m (length)" },
];

const ABV_SOURCE_OPTIONS = [
  { value: "bottle", label: "Read off the bottle" },
  { value: "manufacturer", label: "Producer's published spec" },
  { value: "supplier_invoice", label: "Stated on a supplier invoice" },
  { value: "assumed", label: "Assumed — nobody has checked" },
  { value: "placeholder", label: "Placeholder — known to be wrong" },
];

const SOURCE_LABEL: Record<string, string> = Object.fromEntries(
  ABV_SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

type Uom = "ml" | "g" | "each" | "m";

/** One line saying what the current ABV is and how much to trust it. */
function describeAbv(component?: Component): string {
  if (!component || component.abv == null) return "No ABV recorded yet.";
  const parts = [`Currently ${component.abv}%`];
  if (component.productName) parts.push(component.productName);
  parts.push(
    component.abvSource ? (SOURCE_LABEL[component.abvSource] ?? component.abvSource) : "source unknown",
  );
  if (component.abvSetAt) {
    parts.push(
      `set ${new Date(component.abvSetAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/London",
      })}`,
    );
  }
  return parts.join(" · ");
}

export function ComponentFormBody({
  component,
  suppliers,
}: {
  component?: Component;
  suppliers: { id: number; name: string }[];
}) {
  const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
  const [uom, setUom] = useState<Uom>((component?.uom as Uom) ?? "ml");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Field label="Name" name="name" defaultValue={component?.name} required autoFocus />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Select label="Type" name="type" defaultValue={component?.type ?? "ingredient"} required options={TYPE_OPTIONS} />
        <label style={{ display: "block" }}>
          <span style={labelStyle}>
            Unit of measure <span style={{ color: COLOR.flag, marginLeft: 4 }}>*</span>
          </span>
          <select
            name="uom"
            defaultValue={component?.uom ?? "ml"}
            required
            onChange={(e) => setUom(e.target.value as Uom)}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          >
            {UOM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PackPricer
        uom={uom}
        defaultPackSize={component?.packSize ?? null}
        defaultPackCost={component?.packCost ?? null}
      />

      <Select
        label="Default supplier"
        name="defaultSupplierId"
        defaultValue={component?.defaultSupplierId ? String(component.defaultSupplierId) : ""}
        options={supplierOptions}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Field
          label="Reorder threshold"
          name="reorderThreshold"
          type="number"
          step="0.001"
          min="0"
          defaultValue={component?.reorderThreshold ?? ""}
        />
        <Field
          label="Reorder quantity"
          name="reorderQuantity"
          type="number"
          step="0.001"
          min="0"
          defaultValue={component?.reorderQuantity ?? ""}
        />
        <Field
          label="Lead time (days)"
          name="leadTimeDays"
          type="number"
          min="0"
          defaultValue={component?.leadTimeDays ?? ""}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Field
          label="Storage location"
          name="storageLocation"
          placeholder="e.g. dry store, cold store, spirits cage"
          defaultValue={component?.storageLocation ?? ""}
        />
        <Field
          label="Shelf life (days)"
          name="shelfLifeDays"
          type="number"
          min="0"
          defaultValue={component?.shelfLifeDays ?? ""}
        />
      </div>

      <fieldset
        style={{
          border: `1px solid ${COLOR.rule}`,
          padding: 16,
          margin: 0,
          display: "grid",
          gap: 14,
        }}
      >
        <legend style={{ ...labelStyle, padding: "0 6px" }}>Alcohol by volume</legend>
        <p style={{ fontSize: 12, color: COLOR.muted, margin: 0 }}>{describeAbv(component)}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <Field
            label="ABV % (ingredients only)"
            name="abv"
            type="number"
            step="0.01"
            min="0"
            defaultValue={component?.abv ?? ""}
          />
          <Field
            label="Product"
            name="productName"
            placeholder="e.g. 58 and Co London Dry Gin"
            defaultValue={component?.productName ?? ""}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span style={labelStyle}>Where the ABV came from</span>
            {/* Deliberately always starts empty: see resolveAbvChange in actions.ts. */}
            <select name="abvSource" defaultValue="" style={{ ...inputStyle, fontFamily: "inherit" }}>
              <option value="">— only if you change ABV or product —</option>
              {ABV_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Reference"
            name="abvSourceRef"
            placeholder="Invoice number, producer URL, or where the bottle was read"
            defaultValue=""
          />
        </div>
        <p style={{ fontSize: 11, color: COLOR.muted, margin: 0 }}>
          Changing the ABV or the product needs a fresh source every time. These two fields
          start empty on purpose, so a new figure can never inherit the last one&rsquo;s source.
        </p>
      </fieldset>

      <Textarea label="Notes" name="notes" rows={3} defaultValue={component?.notes ?? ""} />

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button type="submit" style={buttonPrimary}>
          {component ? "Save changes" : "Create component"}
        </button>
        <Link
          href="/erp/components"
          style={{ ...buttonGhost, textDecoration: "none", display: "inline-block" }}
        >
          Cancel
        </Link>
      </div>

      <p style={{ fontSize: 11, color: COLOR.muted, marginTop: 4 }}>
        Editing pack cost or size stamps a price-history entry automatically. Changing the ABV or
        product stamps an ABV-history entry, and needs a source.
      </p>
    </div>
  );
}
