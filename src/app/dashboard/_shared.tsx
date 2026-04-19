import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

export function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtShort(n: number) {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return fmt(n);
}

export function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function KpiCard({
  label,
  value,
  sub,
  accent,
  warning,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>{label}</p>
      <p
        style={{
          fontFamily: FONT.serif,
          fontSize: 26,
          fontWeight: 400,
          color: warning ? COLOR.flag : accent ? COLOR.accent : COLOR.ink,
          letterSpacing: "-0.01em",
          lineHeight: 1.15,
          ...tabularNums,
        }}
      >
        {value}
      </p>
      {sub && (
        <p
          style={{
            fontSize: 11,
            color: warning ? COLOR.flagSoft : COLOR.muted,
            marginTop: 4,
            lineHeight: 1.4,
            fontFamily: FONT.sans,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isLive = badge === "Live";
  return (
    <section style={{ marginBottom: 48 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
          rowGap: 8,
        }}
      >
        <p style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>{title}</p>
        <span
          style={{
            fontSize: 10,
            color: isLive ? COLOR.accent : COLOR.mutedLight,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            ...smallCaps,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: isLive ? COLOR.accent : "transparent",
              border: `1px solid ${isLive ? COLOR.accent : COLOR.ruleBold}`,
            }}
          />
          {badge}
        </span>
        {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
      </div>
      {children}
    </section>
  );
}

export function PeriodPills<T extends string | number>({
  values,
  selected,
  onChange,
  format,
}: {
  values: T[];
  selected: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {values.map((v) => {
        const isSelected = v === selected;
        return (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              background: "none",
              color: isSelected ? COLOR.accent : COLOR.muted,
              border: "1px solid",
              borderColor: isSelected ? COLOR.accent : "transparent",
              cursor: "pointer",
              fontFamily: FONT.sans,
              ...smallCaps,
            }}
          >
            {format ? format(v) : String(v)}
          </button>
        );
      })}
    </div>
  );
}
