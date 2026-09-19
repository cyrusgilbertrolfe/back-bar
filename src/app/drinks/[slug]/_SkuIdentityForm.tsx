"use client";

import { useActionState } from "react";

import { buttonPrimary, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { COLOR } from "@/lib/design";
import type { ClientSkuIdentity } from "@/lib/labels/case-label-data";

import { saveSkuIdentity, type IdentityState } from "./case-label-actions";

export default function SkuIdentityForm({ drinkSlug, sku }: { drinkSlug: string; sku: ClientSkuIdentity }) {
  const [state, action, pending] = useActionState<IdentityState, FormData>(
    saveSkuIdentity.bind(null, drinkSlug, sku.skuId),
    null,
  );

  return (
    <form action={action} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
      <label>
        <span style={labelStyle}>Supplier SKU (short code)</span>
        <input
          name="shortCode"
          defaultValue={sku.shortCode ?? ""}
          readOnly={sku.shortCode !== null}
          placeholder="FM-XXXX"
          style={{ ...inputStyle, color: sku.shortCode ? COLOR.muted : COLOR.ink }}
        />
      </label>
      <label>
        <span style={labelStyle}>{sku.clientName} product reference</span>
        <input name="customerItemCode" defaultValue={sku.customerItemCode ?? ""} style={inputStyle} />
      </label>
      <label style={{ gridColumn: "1 / -1" }}>
        <span style={labelStyle}>{sku.clientName} product description, exactly as on their PO</span>
        <input name="customerDescription" defaultValue={sku.customerDescription ?? ""} style={inputStyle} />
      </label>
      <label>
        <span style={labelStyle}>Case quantity</span>
        <input
          name="unitsPerCase"
          type="number"
          min={1}
          step={1}
          defaultValue={sku.unitsPerCase ?? ""}
          style={inputStyle}
        />
      </label>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <button type="submit" disabled={pending} style={buttonPrimary}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state && "saved" in state && <span style={{ fontSize: 12, color: COLOR.positive }}>Saved</span>}
      </div>
      {state && "error" in state && (
        <p style={{ gridColumn: "1 / -1", fontSize: 12, color: COLOR.flag, margin: 0 }}>{state.error}</p>
      )}
    </form>
  );
}
