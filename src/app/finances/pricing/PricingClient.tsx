"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  PricingConfig,
  PricingProduct,
  calcWholesale,
  calcRetailerPrice,
  passesRetailerTest,
  calcMargin,
} from "@/lib/pricing-data";
import {
  updateRrpOverride,
  resetRrpOverrides,
  updateWholesaleOverride,
  resetWholesaleOverrides,
} from "@/app/actions/pricing";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);

const STORAGE_CONFIG_KEY = "mfc_pricing_config";

type Props = {
  products: PricingProduct[];
  defaultConfig: PricingConfig;
  rrpOverrides: Record<string, number>;
  wholesaleOverrides: Record<string, number>;
};

type EditField = "rrp" | "wholesale";

export default function PricingClient({
  products: serverProducts,
  defaultConfig,
  rrpOverrides: serverRrpOverrides,
  wholesaleOverrides: serverWholesaleOverrides,
}: Props) {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [localRrpEdits, setLocalRrpEdits] = useState<Record<string, number>>({});
  const [localWholesaleEdits, setLocalWholesaleEdits] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterFails, setFilterFails] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    try {
      const sc = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (sc) setConfig({ ...defaultConfig, ...JSON.parse(sc) });
    } catch {}
    setHydrated(true);
  }, [defaultConfig]);

  const products: PricingProduct[] = serverProducts.map((p) => ({
    ...p,
    rrp: localRrpEdits[p.id] ?? p.rrp,
    wholesaleOverride:
      localWholesaleEdits[p.id] !== undefined
        ? localWholesaleEdits[p.id]
        : p.wholesaleOverride,
  }));

  const allPass = products.every((p) => passesRetailerTest(p, config));
  const failCount = products.filter((p) => !passesRetailerTest(p, config)).length;
  const displayed = filterFails
    ? products.filter((p) => !passesRetailerTest(p, config))
    : products;
  const totalUnsavedEdits =
    Object.keys(localRrpEdits).length + Object.keys(localWholesaleEdits).length;
  const hasUnsavedEdits = totalUnsavedEdits > 0;

  const startEdit = (id: string, field: EditField, val: number) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(val.toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const commitEdit = useCallback(() => {
    if (!editingId || !editingField) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      cancelEdit();
      return;
    }
    if (editingField === "rrp") {
      setLocalRrpEdits((prev) => ({ ...prev, [editingId]: val }));
    } else {
      setLocalWholesaleEdits((prev) => ({ ...prev, [editingId]: val }));
    }
    cancelEdit();
    setFeedback(null);
  }, [editingId, editingField, editValue]);

  const saveAllEdits = () => {
    setFeedback(null);
    const rrpEntries = Object.entries(localRrpEdits);
    const wholesaleEntries = Object.entries(localWholesaleEdits);
    if (rrpEntries.length + wholesaleEntries.length === 0) return;
    startTransition(async () => {
      for (const [id, rrp] of rrpEntries) {
        const product = serverProducts.find((p) => p.id === id);
        if (!product) continue;
        const res = await updateRrpOverride(id, product.name, product.size, rrp);
        if (!res.ok) {
          setFeedback({ kind: "err", msg: res.error });
          return;
        }
      }
      for (const [id, ws] of wholesaleEntries) {
        const product = serverProducts.find((p) => p.id === id);
        if (!product) continue;
        const res = await updateWholesaleOverride(id, product.name, product.size, ws);
        if (!res.ok) {
          setFeedback({ kind: "err", msg: res.error });
          return;
        }
      }
      setLocalRrpEdits({});
      setLocalWholesaleEdits({});
      const total = rrpEntries.length + wholesaleEntries.length;
      setFeedback({
        kind: "ok",
        msg: `${total} change${total > 1 ? "s" : ""} saved — site redeploys in ~30s.`,
      });
    });
  };

  const handleResetRrp = () => {
    startTransition(async () => {
      const res = await resetRrpOverrides();
      if (res.ok) {
        setLocalRrpEdits({});
        setFeedback({ kind: "ok", msg: "RRP overrides cleared. Defaults restored." });
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  };

  const handleResetWholesale = () => {
    startTransition(async () => {
      const res = await resetWholesaleOverrides();
      if (res.ok) {
        setLocalWholesaleEdits({});
        setFeedback({ kind: "ok", msg: "Wholesale overrides cleared. Formula restored." });
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  };

  const saveConfig = (c: PricingConfig) => {
    setConfig(c);
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(c));
  };

  if (!hydrated) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLOR.muted,
          fontFamily: FONT.serif,
          fontStyle: "italic",
        }}
      >
        Loading pricing…
      </div>
    );
  }

  return (
    <main
      className="pricing-main"
      style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}
    >
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
        Finances · Wholesale pricing
      </p>

      <section style={{ marginBottom: 44 }}>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(44px, 6vw, 56px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
            marginBottom: 18,
            color: COLOR.ink,
          }}
        >
          Wholesale pricing
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 19,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 720,
            fontWeight: 300,
          }}
        >
          COGS derived live from the ingredient master (liquid plus labour); wholesale is COGS
          times markup, plus shipping. Adjust the assumptions inline. Both RRP and wholesale are
          click-to-edit — overrides persist to git across every device, and the retailer test runs
          against whatever wholesale is shown.
        </p>
      </section>

      {/* Assumptions row */}
      <section
        style={{
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "20px 0",
          marginBottom: 32,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 40,
          rowGap: 16,
        }}
      >
        {[
          { label: "Markup on COGS", key: "markup" as const },
          { label: "Retailer margin", key: "retailerMargin" as const },
          { label: "VAT rate", key: "vat" as const },
        ].map(({ label, key }) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 110 }}>
            <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>{label}</span>
            <PercentInput value={config[key]} onChange={(n) => saveConfig({ ...config, [key]: n })} />
          </label>
        ))}

        <span
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 14,
            color: COLOR.muted,
            marginLeft: "auto",
            maxWidth: 360,
          }}
        >
          Wholesale = COGS × (1 + markup) + shipping.
        </span>
      </section>

      {/* Status + actions */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
          rowGap: 12,
        }}
      >
        <span
          style={{
            fontFamily: FONT.serif,
            fontSize: 17,
            color: allPass ? COLOR.accent : COLOR.flag,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Dot color={allPass ? COLOR.accent : COLOR.flag} filled />
          {allPass
            ? `All ${products.length} SKUs pass the retailer test.`
            : `${failCount} of ${products.length} SKUs fail the retailer test.`}
        </span>

        <TextButton
          onClick={() => setFilterFails((f) => !f)}
          color={filterFails ? COLOR.flag : COLOR.inkSoft}
        >
          {filterFails ? "Show all SKUs" : "Show fails only"}
        </TextButton>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", rowGap: 8 }}>
          {feedback && (
            <span
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 14,
                color: feedback.kind === "ok" ? COLOR.accent : COLOR.flag,
                maxWidth: 400,
              }}
            >
              {feedback.msg}
            </span>
          )}
          {hasUnsavedEdits && (
            <button
              onClick={saveAllEdits}
              disabled={isPending}
              style={{
                background: COLOR.ink,
                color: COLOR.paper,
                border: "none",
                padding: "10px 18px",
                fontSize: 11,
                cursor: isPending ? "default" : "pointer",
                opacity: isPending ? 0.5 : 1,
                ...smallCaps,
              }}
            >
              {isPending
                ? "Saving…"
                : `Save ${totalUnsavedEdits} change${totalUnsavedEdits > 1 ? "s" : ""}`}
            </button>
          )}
          <TextButton onClick={handleResetRrp} color={COLOR.muted} disabled={isPending}>
            Reset RRP overrides
          </TextButton>
          <TextButton onClick={handleResetWholesale} color={COLOR.muted} disabled={isPending}>
            Reset wholesale overrides
          </TextButton>
        </div>
      </section>

      {/* Table */}
      <section>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}
        >
          <thead>
            <tr>
              {[
                { label: "Cocktail", align: "left" as const },
                { label: "Size", align: "left" as const },
                { label: "RRP", align: "right" as const },
                { label: "COGS", align: "right" as const },
                { label: "Ship", align: "right" as const },
                { label: "Wholesale", align: "right" as const },
                { label: "Retailer +30%", align: "right" as const },
                { label: "Test", align: "center" as const },
                { label: "Headroom", align: "right" as const },
                { label: "Markup", align: "right" as const },
              ].map(({ label, align }) => (
                <th
                  key={label}
                  style={{
                    padding: "14px 12px",
                    textAlign: align,
                    fontSize: 10,
                    color: COLOR.muted,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    position: "sticky",
                    top: 0,
                    background: COLOR.paper,
                    zIndex: 2,
                    borderTop: `2px solid ${COLOR.ink}`,
                    borderBottom: `1px solid ${COLOR.ruleBold}`,
                    ...smallCaps,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => {
              const ws = calcWholesale(p, config);
              const rp = calcRetailerPrice(ws, config);
              const passes = rp <= p.rrp;
              const headroom = Math.round((p.rrp - rp) * 100) / 100;
              const margin = calcMargin(p, config);
              const isEditingRrp = editingId === p.id && editingField === "rrp";
              const isEditingWholesale = editingId === p.id && editingField === "wholesale";
              const hasRrpOverride =
                localRrpEdits[p.id] !== undefined || serverRrpOverrides[p.id] !== undefined;
              const isUnsavedRrpEdit = localRrpEdits[p.id] !== undefined;
              const hasWholesaleOverride =
                localWholesaleEdits[p.id] !== undefined ||
                serverWholesaleOverrides[p.id] !== undefined;
              const isUnsavedWholesaleEdit = localWholesaleEdits[p.id] !== undefined;

              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }} className="pricing-row">
                  <td style={{ padding: "18px 12px", color: COLOR.ink, fontFamily: FONT.serif, fontSize: 17 }}>
                    {p.name}
                    {p.gtin && (
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10,
                          color: COLOR.mutedLight,
                          marginTop: 4,
                          letterSpacing: "0.02em",
                        }}
                      >
                        {p.gtin}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      color: COLOR.muted,
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      ...smallCaps,
                    }}
                  >
                    {p.size}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditingRrp ? "default" : "text",
                      color: isUnsavedRrpEdit
                        ? COLOR.flag
                        : hasRrpOverride
                        ? COLOR.accent
                        : COLOR.ink,
                      fontWeight: hasRrpOverride || isUnsavedRrpEdit ? 600 : 400,
                    }}
                    onClick={() => !isEditingRrp && startEdit(p.id, "rrp", p.rrp)}
                  >
                    {isEditingRrp ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        style={{
                          width: 72,
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLOR.accent,
                          background: COLOR.paperDeep,
                          border: `1px solid ${COLOR.accent}`,
                          padding: "4px 6px",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <span style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}>
                        {GBP(p.rrp)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.inkSoft,
                    }}
                  >
                    {GBP(p.cogs)}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.mutedLight,
                    }}
                  >
                    {GBP(p.shipping)}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditingWholesale ? "default" : "text",
                      color: isUnsavedWholesaleEdit
                        ? COLOR.flag
                        : hasWholesaleOverride
                        ? COLOR.accent
                        : COLOR.ink,
                      fontWeight: 600,
                    }}
                    onClick={() => !isEditingWholesale && startEdit(p.id, "wholesale", ws)}
                  >
                    {isEditingWholesale ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        style={{
                          width: 72,
                          textAlign: "right",
                          fontFamily: FONT.mono,
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLOR.accent,
                          background: COLOR.paperDeep,
                          border: `1px solid ${COLOR.accent}`,
                          padding: "4px 6px",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <span style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}>
                        {GBP(ws)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                    }}
                  >
                    {GBP(rp)}
                  </td>
                  <td style={{ padding: "18px 12px", textAlign: "center" }}>
                    {passes ? (
                      <Dot color={COLOR.accent} filled />
                    ) : (
                      <span style={{ fontSize: 10, color: COLOR.flag, ...smallCaps }}>
                        Below test
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color:
                        headroom < 0
                          ? COLOR.flag
                          : headroom < 0.5
                          ? COLOR.accent
                          : COLOR.inkSoft,
                      fontWeight: headroom < 0.5 ? 600 : 400,
                    }}
                  >
                    {headroom >= 0 ? "+" : ""}
                    {GBP(headroom)}
                  </td>
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                    }}
                  >
                    {margin.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={10}
                style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }}
              />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Summary */}
      <section
        style={{
          marginTop: 40,
          display: "flex",
          gap: 56,
          flexWrap: "wrap",
          rowGap: 20,
        }}
      >
        {[
          { label: "SKUs", value: products.length.toString() },
          {
            label: "Pass rate",
            value: allPass ? "100%" : `${products.length - failCount} / ${products.length}`,
          },
          {
            label: "Average wholesale",
            value: GBP(
              products.reduce((s, p) => s + calcWholesale(p, config), 0) / products.length,
            ),
          },
          {
            label: "Average markup",
            value:
              (products.reduce((s, p) => s + calcMargin(p, config), 0) / products.length).toFixed(
                1,
              ) + "%",
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>
              {label}
            </p>
            <p
              style={{
                fontFamily: FONT.serif,
                fontSize: 28,
                fontWeight: 400,
                color: COLOR.ink,
                letterSpacing: "-0.01em",
                ...tabularNums,
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </section>

      <style>{`
        .pricing-row:hover { background: ${COLOR.paperDeep}; }
        @media (max-width: 720px) {
          .pricing-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </main>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [local, setLocal] = useState(((value - 1) * 100).toFixed(0));
  useEffect(() => {
    setLocal(((value - 1) * 100).toFixed(0));
  }, [value]);
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 2 }}>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value.replace("%", ""))}
        onBlur={() => {
          const n = parseFloat(local);
          if (!isNaN(n) && n > 0 && n < 200) onChange(1 + n / 100);
          else setLocal(((value - 1) * 100).toFixed(0));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        style={{
          width: 56,
          fontFamily: FONT.mono,
          fontSize: 22,
          fontWeight: 500,
          color: COLOR.ink,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${COLOR.ruleBold}`,
          padding: "2px 0",
          outline: "none",
          textAlign: "left",
          ...tabularNums,
        }}
      />
      <span style={{ fontFamily: FONT.mono, fontSize: 18, color: COLOR.muted }}>%</span>
    </span>
  );
}

function TextButton({
  onClick,
  children,
  color,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        fontSize: 11,
        color,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textDecoration: "underline",
        textUnderlineOffset: 3,
        textDecorationThickness: 1,
        ...smallCaps,
      }}
    >
      {children}
    </button>
  );
}

function Dot({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: filled ? color : "transparent",
        border: `1px solid ${color}`,
      }}
    />
  );
}
