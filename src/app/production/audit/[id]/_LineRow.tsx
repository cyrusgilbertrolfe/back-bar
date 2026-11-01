"use client";

/**
 * One counted line. Saves as it is typed, on blur, so a count walked on a
 * phone loses nothing if the page is left. A cleared quantity reads "not
 * counted", which is different from a counted zero.
 *
 * The row carries only what a counter needs: the item, one line of working,
 * the quantity and the value. The caveats behind the cost, the note, the
 * write-off and removal sit behind "More" (Cyrus, 1 Nov 2026: a source label
 * and an obsolete box on every row made the page hard to read).
 */

import { Fragment, useState, useTransition } from "react";
import { COLOR, FONT, tabularNums } from "@/lib/design";
import { removeLine, saveLine } from "../actions";

type Props = {
  countId: number;
  lineId: number;
  /** The item, or under a drink heading just its size. */
  name: string;
  /** Indented beneath a drink heading. */
  nested?: boolean;
  units: string[];
  quantity: string | null;
  unit: string;
  obsolete: boolean;
  note: string | null;
  location: string;
  unitCost: number | null;
  value: number | null;
  source: string | null;
  /**
   * Flag a placeholder price on the row. Set for a component, whose own price
   * it is; not for a bottle, where one placeholder part of many would brand
   * the whole cost (the 29p EPR on the £81.52 Jeroboam). That goes in More.
   */
  placeholderFlag?: boolean;
  working: string | null;
  caveats: string[];
  closed: boolean;
  /** Lines added by hand can be removed; the listed ones are left uncounted instead. */
  removable: boolean;
};

/** Units counted in whole numbers. Litres, kilos and grams take decimals. */
const WHOLE = new Set(["bottle", "each", "pack"]);

function money(x: number | null): string {
  if (x == null) return "—";
  return `£${x.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function unitMoney(x: number | null): string {
  if (x == null) return "—";
  return x !== 0 && x < 0.1 ? `£${x.toFixed(4)}` : money(x);
}

/** "12", not "12.000": the column is numeric(12,3), the reading is not. */
function qtyText(q: string | null): string {
  return q == null ? "" : String(Number(q));
}

const cell = { padding: "10px 8px", borderBottom: `1px solid ${COLOR.rule}`, verticalAlign: "top" as const };

export function LineRow(p: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const save = (patch: Parameters<typeof saveLine>[2]) =>
    start(async () => {
      setError(null);
      try {
        await saveLine(p.countId, p.lineId, patch);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Not saved");
      }
    });

  const counted = p.quantity != null;
  const whole = WHOLE.has(p.unit);

  return (
    <Fragment>
      <tr style={{ opacity: pending ? 0.6 : 1 }}>
        <td style={{ ...cell, paddingLeft: p.nested ? 24 : 8 }}>
          <div style={{ fontSize: 14, color: counted ? COLOR.ink : COLOR.inkSoft }}>
            {p.name}
            {p.location !== "Unit" && <span style={{ fontSize: 11, color: COLOR.muted }}> · {p.location}</span>}
            {p.note && <span title={p.note} style={{ fontSize: 11, color: COLOR.muted }}> · noted</span>}
          </div>
          {p.working && <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2, ...tabularNums }}>{p.working}</div>}
          {error && <div style={{ fontSize: 11, color: COLOR.flag, marginTop: 4 }}>{error}</div>}
        </td>
        <td style={{ ...cell, whiteSpace: "nowrap" }}>
          <input
            type="number"
            inputMode={whole ? "numeric" : "decimal"}
            min={0}
            step={whole ? 1 : "any"}
            defaultValue={qtyText(p.quantity)}
            disabled={p.closed}
            aria-label={`Quantity of ${p.name}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== qtyText(p.quantity)) save({ quantity: v === "" ? null : v });
            }}
            style={{ width: 76, fontSize: 16, padding: "8px 8px", border: `1px solid ${counted ? COLOR.ruleBold : COLOR.rule}`, background: "transparent", fontFamily: FONT.sans, ...tabularNums }}
          />{" "}
          {p.units.length > 1 && !p.closed ? (
            <select
              defaultValue={p.unit}
              onChange={(e) => save({ unit: e.target.value })}
              aria-label="Unit"
              style={{ fontSize: 12, padding: "6px 4px", border: `1px solid ${COLOR.rule}`, background: "transparent", fontFamily: FONT.sans }}
            >
              {p.units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, color: COLOR.muted }}>{p.unit}</span>
          )}
        </td>
        <td style={{ ...cell, textAlign: "right", fontSize: 13, ...tabularNums }}>
          {unitMoney(p.unitCost)}
          {p.source === "placeholder" && p.placeholderFlag && <div style={{ fontSize: 10, color: COLOR.flag, marginTop: 2 }}>Placeholder price</div>}
        </td>
        <td style={{ ...cell, textAlign: "right", fontSize: 14, ...tabularNums }}>
          {money(counted ? p.value : null)}
          {p.obsolete && <div style={{ fontSize: 10, color: COLOR.flag, marginTop: 2 }}>Written off</div>}
        </td>
        <td style={{ ...cell, textAlign: "right" }}>
          <button type="button" className="text-link" onClick={() => setOpen((o) => !o)} style={{ fontSize: 11 }} aria-expanded={open}>
            {open ? "Less" : "More"}
            {!open && p.caveats.length > 0 ? " ·" : ""}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ ...cell, paddingLeft: p.nested ? 24 : 8, background: COLOR.paperDeep, fontSize: 12 }}>
            {p.caveats.length > 0 && (
              <ul style={{ margin: "0 0 10px", paddingLeft: 16, color: COLOR.inkSoft }}>
                {p.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <input
              defaultValue={p.note ?? ""}
              disabled={p.closed}
              placeholder="Note: how this was arrived at"
              onBlur={(e) => e.target.value !== (p.note ?? "") && save({ note: e.target.value })}
              style={{ width: "100%", maxWidth: 640, fontSize: 12, padding: "6px 8px", border: `1px solid ${COLOR.rule}`, background: "transparent", fontFamily: FONT.sans }}
            />
            {!p.closed && (
              <div style={{ display: "flex", gap: 20, marginTop: 10, color: COLOR.muted }}>
                <label style={{ cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked={p.obsolete} onChange={(e) => save({ obsolete: e.target.checked })} /> Write off to nil
                </label>
                {p.removable && (
                  <button type="button" className="text-link" onClick={() => start(() => removeLine(p.countId, p.lineId))} style={{ color: COLOR.flag }}>
                    Remove line
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}
