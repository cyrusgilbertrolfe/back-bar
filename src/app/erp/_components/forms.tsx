/**
 * Tiny shared form primitives for the ERP. Inline styling kept on purpose so
 * operators can read the markup and authors don't have to dig through CSS.
 */

import { CSSProperties } from "react";
import { COLOR, FONT } from "@/lib/design";

/**
 * Form-field labels render in real ALL CAPS (not OpenType small-caps).
 * Cyrus's preference — small-caps glyphs read thinner than expected at 10px,
 * uppercase has more presence above the input.
 */
const allCaps: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 500,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT.sans,
  background: "transparent",
  border: `1px solid ${COLOR.rule}`,
  color: COLOR.ink,
  outline: "none",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10,
  color: COLOR.muted,
  marginBottom: 6,
  ...allCaps,
};

export const buttonPrimary: CSSProperties = {
  background: COLOR.ink,
  color: COLOR.paper,
  border: "none",
  padding: "11px 20px",
  fontSize: 12,
  fontFamily: FONT.sans,
  cursor: "pointer",
  ...allCaps,
};

export const buttonGhost: CSSProperties = {
  background: "transparent",
  color: COLOR.inkSoft,
  border: `1px solid ${COLOR.rule}`,
  padding: "10px 18px",
  fontSize: 12,
  fontFamily: FONT.sans,
  cursor: "pointer",
  ...allCaps,
};

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  step,
  min,
  autoFocus,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: "text" | "email" | "tel" | "number" | "date";
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: string;
  autoFocus?: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>
        {label}
        {required && <span style={{ color: COLOR.flag, marginLeft: 4 }}>*</span>}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        autoFocus={autoFocus}
        style={inputStyle}
      />
    </label>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        style={{ ...inputStyle, fontFamily: FONT.sans, resize: "vertical" }}
      />
    </label>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>
        {label}
        {required && <span style={{ color: COLOR.flag, marginLeft: 4 }}>*</span>}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        style={{ ...inputStyle, fontFamily: FONT.sans }}
      >
        {!required && <option value="">—</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
