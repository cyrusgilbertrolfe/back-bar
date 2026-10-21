"use client";

/**
 * One counted line. Saves as it is typed, on blur, so a count walked on a
 * phone loses nothing if the page is left. A cleared quantity reads "not
 * counted", which is different from a counted zero.
 */

import { useState, useTransition } from "react";
import { COLOR, FONT, tabularNums } from "@/lib/design";
import { removeLine, saveLine } from "../actions";

type Props = {
  countId: number;
  lineId: number;
  name: string;
  units: string[];
  quantity: string | null;
  unit: string;
  obsolete: boolean;
  note: string | null;
  location: string;
  unitCost: number | null;
  value: number | null;
  source: string | null;
  costNote: string | null;
  closed: boolean;
  /** Lines added by hand can be removed; the listed ones are left uncounted instead. */
  removable: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  inbound: "Invoice",
  manual: "Manual",
  placeholder: "Placeholder",
  unsourced: "Unsourced",
};

function money(x: number | null): string {
  if (x == null) return "—";
  return `£${x.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function unitMoney(x: number | null): string {
  if (x == null) return "—";
  return x !== 0 && x < 0.1 ? `£${x.toFixed(4)}` : money(x);
}

const cell = { padding: "10px 8px", borderBottom: `1px solid ${COLOR.rule}`, verticalAlign: "top" as const };

export function LineRow(p: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(Boolean(p.note));

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
  const flagged = p.source === "placeholder" || p.source === "unsourced";

  return (
    <tr style={{ opacity: pending ? 0.6 : 1, background: counted ? "transparent" : undefined }}>
      <td style={{ ...cell, width: "38%" }}>
        <div style={{ fontSize: 14, color: counted ? COLOR.ink : COLOR.inkSoft }}>{p.name}</div>
        <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
          {p.location !== "Unit" ? `${p.location} · ` : ""}
          {p.costNote ?? ""}
        </div>
        {showNote && (
          <input
            defaultValue={p.note ?? ""}
            disabled={p.closed}
            placeholder="How this was arrived at"
            onBlur={(e) => e.target.value !== (p.note ?? "") && save({ note: e.target.value })}
            style={{ marginTop: 6, width: "100%", fontSize: 12, padding: "4px 6px", border: `1px solid ${COLOR.rule}`, background: "transparent", fontFamily: FONT.sans }}
          />
        )}
        {error && <div style={{ fontSize: 11, color: COLOR.flag, marginTop: 4 }}>{error}</div>}
      </td>
      <td style={{ ...cell, whiteSpace: "nowrap" }}>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          defaultValue={p.quantity ?? ""}
          disabled={p.closed}
          aria-label={`Quantity of ${p.name}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== (p.quantity == null ? "" : String(Number(p.quantity)))) save({ quantity: v === "" ? null : v });
          }}
          style={{ width: 84, fontSize: 16, padding: "8px 8px", border: `1px solid ${counted ? COLOR.ruleBold : COLOR.rule}`, background: "transparent", fontFamily: FONT.sans, ...tabularNums }}
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
        {p.source && (
          <div style={{ fontSize: 10, color: flagged ? COLOR.flag : COLOR.muted, marginTop: 2 }}>
            {SOURCE_LABEL[p.source] ?? p.source}
          </div>
        )}
      </td>
      <td style={{ ...cell, textAlign: "right", fontSize: 14, ...tabularNums }}>
        {p.obsolete && counted ? (
          <span style={{ color: COLOR.flag }}>£0.00</span>
        ) : (
          money(counted ? p.value : null)
        )}
      </td>
      <td style={{ ...cell, fontSize: 11, color: COLOR.muted, whiteSpace: "nowrap" }}>
        <label style={{ display: "block", cursor: p.closed ? "default" : "pointer" }}>
          <input
            type="checkbox"
            defaultChecked={p.obsolete}
            disabled={p.closed}
            onChange={(e) => save({ obsolete: e.target.checked })}
          />{" "}
          Obsolete
        </label>
        {!p.closed && (
          <button type="button" className="text-link" onClick={() => setShowNote((s) => !s)} style={{ marginTop: 4 }}>
            {showNote ? "Hide note" : "Note"}
          </button>
        )}
        {p.removable && !p.closed && (
          <button
            type="button"
            className="text-link"
            onClick={() => start(() => removeLine(p.countId, p.lineId))}
            style={{ display: "block", marginTop: 4, color: COLOR.flag }}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}
