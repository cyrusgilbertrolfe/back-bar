"use client";

/**
 * Pack-size + landed pack-cost entry with a live unit-cost preview.
 *
 * Operators think in "a 700ml bottle of X for £15.86", not "£0.0227 per ml".
 * They enter the pack format; the system derives £/UOM for the recipe engine
 * and shows the result live so they can sanity-check before saving.
 *
 * Every cost is landed (Cyrus, 2 Oct 2026), so the pack cost is entered as
 * its two parts, the goods and this pack's share of the invoice's fees
 * (delivery, carriage, surcharges; never EPR, which is its own line), and the
 * pack cost is their sum. Fees printed against an item go to that item;
 * otherwise they are split by goods value (Cyrus, 9 Oct 2026), which the
 * helper below works out from the invoice's totals.
 */

import { useId, useState } from "react";
import { COLOR, FONT } from "@/lib/design";
import { inputStyle, labelStyle } from "../_components/forms";

type Props = {
  uom: "ml" | "g" | "each" | "m";
  defaultPackSize?: string | null;
  /** The goods part of the pack cost; the whole pack cost for a price never split. */
  defaultGoods?: string | null;
  defaultFees?: string | null;
  defaultFeesNote?: string | null;
};

function num(s: string): number {
  return s.trim() === "" ? NaN : Number(s);
}

export function PackPricer({ uom, defaultPackSize, defaultGoods, defaultFees, defaultFeesNote }: Props) {
  const sizeId = useId();
  const goodsId = useId();
  const feesId = useId();
  const [size, setSize] = useState(defaultPackSize ?? (uom === "each" || uom === "m" ? "1" : ""));
  const [goods, setGoods] = useState(defaultGoods ?? "");
  const [fees, setFees] = useState(defaultFees ?? "");
  const [feesNote, setFeesNote] = useState(defaultFeesNote ?? "");
  const [invFees, setInvFees] = useState("");
  const [invGoods, setInvGoods] = useState("");

  const sizeNum = num(size);
  const goodsNum = num(goods);
  const feesNum = fees.trim() === "" ? 0 : Number(fees);
  const ready =
    Number.isFinite(sizeNum) && sizeNum > 0 && Number.isFinite(goodsNum) && goodsNum >= 0 && Number.isFinite(feesNum) && feesNum >= 0;
  const landed = ready ? goodsNum + feesNum : 0;
  const unitCost = ready ? landed / sizeNum : 0;

  // By value: this pack's share of the invoice's fees is its share of the goods.
  const invFeesNum = num(invFees);
  const invGoodsNum = num(invGoods);
  const byValue =
    Number.isFinite(goodsNum) && Number.isFinite(invFeesNum) && Number.isFinite(invGoodsNum) && invGoodsNum > 0
      ? (goodsNum * invFeesNum) / invGoodsNum
      : null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <label htmlFor={sizeId} style={{ display: "block" }}>
          <span style={labelStyle}>Pack size ({uom})</span>
          <input
            id={sizeId}
            name="packSize"
            type="number"
            step={uom === "each" || uom === "m" ? "1" : "0.001"}
            min="0"
            required
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder={uom === "ml" ? "e.g. 700" : uom === "g" ? "e.g. 500" : "e.g. 1"}
            style={inputStyle}
          />
        </label>
        <label htmlFor={goodsId} style={{ display: "block" }}>
          <span style={labelStyle}>Goods per pack (£, ex VAT)</span>
          <input
            id={goodsId}
            name="packGoods"
            type="number"
            step="0.0001"
            min="0"
            required
            value={goods}
            onChange={(e) => setGoods(e.target.value)}
            placeholder="e.g. 15.86"
            style={inputStyle}
          />
        </label>
        <label htmlFor={feesId} style={{ display: "block" }}>
          <span style={labelStyle}>Fees per pack (£)</span>
          <input
            id={feesId}
            name="packFees"
            type="number"
            step="0.0001"
            min="0"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            placeholder="delivery, carriage; not EPR"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 16, alignItems: "end" }}>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Invoice fees (£)</span>
          <input type="number" step="0.01" min="0" value={invFees} onChange={(e) => setInvFees(e.target.value)} placeholder="total, ex VAT" style={inputStyle} />
        </label>
        <label style={{ display: "block" }}>
          <span style={labelStyle}>Invoice goods (£)</span>
          <input type="number" step="0.01" min="0" value={invGoods} onChange={(e) => setInvGoods(e.target.value)} placeholder="total, ex VAT" style={inputStyle} />
        </label>
        <div style={{ fontSize: 12, color: COLOR.muted, paddingBottom: 8 }}>
          {byValue === null ? (
            "To split an invoice's fees by value, enter its totals."
          ) : (
            <>
              By value: £{byValue.toFixed(4)} per pack{" "}
              <button
                type="button"
                onClick={() => {
                  setFees(byValue.toFixed(4));
                  setFeesNote(`£${invFeesNum.toFixed(2)} fees over £${invGoodsNum.toFixed(2)} goods, by value`);
                }}
                style={{ border: `1px solid ${COLOR.rule}`, background: "transparent", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}
              >
                Use
              </button>
            </>
          )}
        </div>
      </div>

      <label style={{ display: "block" }}>
        <span style={labelStyle}>How the fees were worked out</span>
        <input
          name="feesNote"
          value={feesNote}
          onChange={(e) => setFeesNote(e.target.value)}
          placeholder="e.g. Viamaster £57.95 over 932 bottles"
          style={inputStyle}
        />
      </label>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          color: ready ? COLOR.accent : COLOR.mutedLight,
          padding: "6px 0",
        }}
      >
        {ready ? (
          <>
            Landed £{landed.toFixed(4)} per pack = <strong style={{ fontWeight: 600 }}>£{unitCost.toFixed(4)}</strong> per {uom}
            {feesNum > 0 && (
              <span style={{ color: COLOR.muted }}>
                {" "}
                (£{goodsNum.toFixed(4)} goods + £{feesNum.toFixed(4)} fees)
              </span>
            )}
          </>
        ) : (
          <>Enter pack size and goods cost to see unit cost.</>
        )}
      </div>
    </div>
  );
}
