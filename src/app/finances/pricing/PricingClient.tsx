"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { setAgreedRrp, setAgreedWholesale } from "@/app/actions/pricing";
import type { PricingConfigView, SkuRow } from "../finance-types";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { CostTotalProvenance } from "@/components/CostSourceBadge";

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);

// Shared with the RRP page so the two tools run on one set of what-if
// assumptions per device. The saved config lives in the database
// (system_settings); this key only carries local experiments on top of it.
const STORAGE_CONFIG_KEY = "mfc_pricing_config_v2";

const round2 = (n: number) => Math.round(n * 100) / 100;

type Props = {
  rows: SkuRow[];
  config: PricingConfigView;
};

type EditField = "rrp" | "wholesale";

type WhatIf = { markup: number; retailerMargin: number; vat: number };

export default function PricingClient({ rows: serverRows, config }: Props) {
  const [whatIf, setWhatIf] = useState<WhatIf>({
    markup: config.markup,
    retailerMargin: config.retailerMargin,
    vat: config.vat,
  });
  const [localRrpEdits, setLocalRrpEdits] = useState<Record<number, number>>({});
  const [localWholesaleEdits, setLocalWholesaleEdits] = useState<Record<number, number>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterFails, setFilterFails] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // localStorage does not exist during the server render, so the saved what-if
  // config can only be read after mount. The page holds back its real render
  // until `hydrated` is true, so this cannot mismatch the server HTML.
  useEffect(() => {
    try {
      const sc = localStorage.getItem(STORAGE_CONFIG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration read; see above
      if (sc) setWhatIf((prev) => ({ ...prev, ...JSON.parse(sc) }));
    } catch {}
    setHydrated(true);
  }, []);

  const derived = serverRows.map((r) => {
    const rrp = localRrpEdits[r.skuId] ?? r.rrp;
    const wholesale = localWholesaleEdits[r.skuId] ?? r.wholesale;
    const rulePrice = round2(r.cogs * whatIf.markup + r.shipping);
    const shelf = wholesale === null ? null : round2(wholesale * whatIf.retailerMargin * whatIf.vat);
    const testPasses = shelf === null || rrp === null ? null : shelf <= rrp;
    const headroom = shelf === null || rrp === null ? null : round2(rrp - shelf);
    const margin = wholesale === null ? null : round2(wholesale - r.cogs - r.shipping);
    const marginPct =
      wholesale === null || wholesale === 0 || margin === null
        ? null
        : Math.round((margin / wholesale) * 1000) / 10;
    const gapToRule = wholesale === null ? null : round2(wholesale - rulePrice);
    return { r, rrp, wholesale, rulePrice, shelf, testPasses, headroom, marginPct, gapToRule };
  });

  const testable = derived.filter((d) => d.testPasses !== null);
  const failCount = testable.filter((d) => d.testPasses === false).length;
  const unpriced = derived.filter((d) => d.wholesale === null).length;
  const allPass = testable.length > 0 && failCount === 0;

  const displayed = filterFails ? derived.filter((d) => d.testPasses === false) : derived;

  const totalUnsavedEdits =
    Object.keys(localRrpEdits).length + Object.keys(localWholesaleEdits).length;
  const hasUnsavedEdits = totalUnsavedEdits > 0;

  const startEdit = (id: number, field: EditField, val: number | null) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(val === null ? "" : val.toFixed(2));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const commitEdit = useCallback(() => {
    if (editingId === null || !editingField) return;
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0) {
      cancelEdit();
      return;
    }
    if (editingField === "rrp") {
      setLocalRrpEdits((prev) => ({ ...prev, [editingId]: round2(val) }));
    } else {
      setLocalWholesaleEdits((prev) => ({ ...prev, [editingId]: round2(val) }));
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
        const res = await setAgreedRrp(Number(id), rrp);
        if (!res.ok) {
          setFeedback({ kind: "err", msg: res.error });
          return;
        }
      }
      for (const [id, ws] of wholesaleEntries) {
        const res = await setAgreedWholesale(Number(id), ws);
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
        msg: `${total} agreed price${total > 1 ? "s" : ""} recorded in the price book.`,
      });
    });
  };

  const saveWhatIf = (c: WhatIf) => {
    setWhatIf(c);
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(c));
    } catch {}
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
      style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 40px 96px" }}
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
            maxWidth: 760,
            fontWeight: 300,
          }}
        >
          What stockists pay. COGS is derived live from the database (liquid, primary
          packaging and wastage). The <strong>agreed</strong> price is the commitment on the
          current price list; the <strong>rule</strong> price is what the formula says today,
          shown alongside so the gap between them, the margin erosion since the last review,
          is always visible. The two are never substituted for each other. RRP is also
          managed in the{" "}
          <Link href="/finances/rrp" style={{ color: COLOR.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>
            RRP page
          </Link>
          .
        </p>
      </section>

      {/* Assumptions row (local what-if on top of the stored config) */}
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
            <PercentInput value={whatIf[key]} onChange={(n) => saveWhatIf({ ...whatIf, [key]: n })} />
          </label>
        ))}

        <span
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 14,
            color: COLOR.muted,
            marginLeft: "auto",
            maxWidth: 380,
          }}
        >
          Rule price = COGS × markup + shipping. What-if only on this device; the stored
          config lives in the database
          {config.listEffectiveFrom ? ` (list effective ${config.listEffectiveFrom})` : ""}.
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
          {testable.length === 0
            ? "No SKU has both an agreed wholesale and an agreed RRP yet."
            : allPass
            ? `All ${testable.length} priced SKUs pass the retailer test.`
            : `${failCount} of ${testable.length} priced SKUs fail the retailer test.`}
          {unpriced > 0 && (
            <span style={{ color: COLOR.muted, fontSize: 14 }}>
              {unpriced} with no agreed wholesale.
            </span>
          )}
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
                : `Save ${totalUnsavedEdits} agreed price${totalUnsavedEdits > 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </section>

      {/* Table */}
      <section style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}
        >
          <thead>
            <tr>
              {[
                { label: "Cocktail", align: "left" as const },
                { label: "Size", align: "left" as const },
                { label: "RRP (agreed)", align: "right" as const },
                { label: "COGS", align: "right" as const },
                { label: "Ship", align: "right" as const },
                { label: "Wholesale (agreed)", align: "right" as const },
                { label: "Rule price", align: "right" as const },
                { label: "Gap to rule", align: "right" as const },
                { label: "Retailer shelf", align: "right" as const },
                { label: "Test", align: "center" as const },
                { label: "Margin", align: "right" as const },
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
                  {label === "RRP (agreed)" && (
                    <Link
                      href="/finances/rrp"
                      style={{
                        marginLeft: 6,
                        color: COLOR.accent,
                        textDecoration: "none",
                        fontSize: 9,
                      }}
                      title="Manage RRP on the RRP page"
                    >
                      →
                    </Link>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(({ r, rrp, wholesale, rulePrice, shelf, testPasses, marginPct, gapToRule }) => {
              const isEditingRrp = editingId === r.skuId && editingField === "rrp";
              const isEditingWholesale = editingId === r.skuId && editingField === "wholesale";
              const isUnsavedRrpEdit = localRrpEdits[r.skuId] !== undefined;
              const isUnsavedWholesaleEdit = localWholesaleEdits[r.skuId] !== undefined;
              // Placeholders and unsourced lines are flagged by the badge under the
              // COGS figure. The ⚑ is for structural problems only.
              const hasCostFlags = r.problems.length > 0;

              return (
                <tr key={r.skuId} style={{ borderBottom: `1px solid ${COLOR.rule}` }} className="pricing-row">
                  <td style={{ padding: "18px 12px", color: COLOR.ink, fontFamily: FONT.serif, fontSize: 17 }}>
                    {r.name}
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        color: COLOR.mutedLight,
                        marginTop: 4,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {[r.clientName, r.gtin].filter(Boolean).join(" · ")}
                    </div>
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
                    {r.size}
                  </td>

                  {/* RRP (agreed), editable */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditingRrp ? "default" : "text",
                      color: isUnsavedRrpEdit ? COLOR.flag : rrp === null ? COLOR.mutedLight : COLOR.ink,
                      fontWeight: isUnsavedRrpEdit ? 600 : 400,
                    }}
                    onClick={() => !isEditingRrp && startEdit(r.skuId, "rrp", rrp)}
                  >
                    {isEditingRrp ? (
                      <EditInput
                        value={editValue}
                        onChange={setEditValue}
                        onCommit={commitEdit}
                        onCancel={cancelEdit}
                      />
                    ) : rrp === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic" }}>none agreed</span>
                    ) : (
                      <span style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}>
                        {GBP(rrp)}
                      </span>
                    )}
                  </td>

                  {/* COGS */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.inkSoft,
                    }}
                  >
                    <Link href={`/finances/cogs/${r.skuId}`} title="See how this COGS is built" style={{ color: "inherit", textDecorationColor: COLOR.rule }}>
                      {GBP(r.cogs)}
                    </Link>
                    {hasCostFlags && (
                      <span
                        title={r.problems.join("\n")}
                        style={{ marginLeft: 6, fontSize: 10, color: COLOR.flag, cursor: "help" }}
                      >
                        ⚑
                      </span>
                    )}
                    <CostTotalProvenance
                      source={r.costSource}
                      asOf={r.costAsOf}
                      placeholders={r.placeholders.length}
                      unsourced={r.unsourcedLines}
                    />
                  </td>

                  {/* Shipping */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.mutedLight,
                    }}
                  >
                    {GBP(r.shipping)}
                  </td>

                  {/* Wholesale (agreed), editable */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditingWholesale ? "default" : "text",
                      color: isUnsavedWholesaleEdit
                        ? COLOR.flag
                        : wholesale === null
                        ? COLOR.mutedLight
                        : COLOR.ink,
                      fontWeight: 600,
                    }}
                    onClick={() => !isEditingWholesale && startEdit(r.skuId, "wholesale", wholesale)}
                  >
                    {isEditingWholesale ? (
                      <EditInput
                        value={editValue}
                        onChange={setEditValue}
                        onCommit={commitEdit}
                        onCancel={cancelEdit}
                      />
                    ) : wholesale === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic", fontWeight: 400 }}>
                        none agreed
                      </span>
                    ) : (
                      <span
                        title={
                          r.wholesaleEffectiveFrom
                            ? `Agreed price, effective from ${r.wholesaleEffectiveFrom}`
                            : "Agreed price"
                        }
                        style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}
                      >
                        {GBP(wholesale)}
                      </span>
                    )}
                  </td>

                  {/* Rule price */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                    }}
                    title="COGS x markup + shipping at the assumptions above. Never a substitute for the agreed price."
                  >
                    {GBP(rulePrice)}
                  </td>

                  {/* Gap to rule */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color:
                        gapToRule === null
                          ? COLOR.mutedLight
                          : gapToRule < 0
                          ? COLOR.flag
                          : COLOR.positive,
                    }}
                  >
                    {gapToRule === null ? "·" : `${gapToRule >= 0 ? "+" : ""}${GBP(gapToRule)}`}
                  </td>

                  {/* Retailer shelf price (from the agreed wholesale) */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: COLOR.muted,
                    }}
                  >
                    {shelf === null ? "·" : GBP(shelf)}
                  </td>

                  {/* Retailer test */}
                  <td style={{ padding: "18px 12px", textAlign: "center" }}>
                    {testPasses === null ? (
                      <span style={{ fontSize: 10, color: COLOR.mutedLight, ...smallCaps }}>n/a</span>
                    ) : testPasses ? (
                      <Dot color={COLOR.accent} filled />
                    ) : (
                      <span style={{ fontSize: 10, color: COLOR.flag, ...smallCaps }}>Fails</span>
                    )}
                  </td>

                  {/* Margin */}
                  <td
                    style={{
                      padding: "18px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: marginPct === null ? COLOR.mutedLight : marginPct < 0 ? COLOR.flag : COLOR.muted,
                    }}
                  >
                    {marginPct === null ? "·" : `${marginPct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={11}
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
        {(() => {
          const priced = derived.filter((d) => d.wholesale !== null);
          const avg = (xs: number[]) =>
            xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
          const avgWholesale = avg(priced.map((d) => d.wholesale as number));
          const margins = priced
            .map((d) => d.marginPct)
            .filter((m): m is number => m !== null);
          const avgMargin = avg(margins);
          return [
            { label: "SKUs", value: derived.length.toString() },
            { label: "With agreed wholesale", value: `${priced.length} / ${derived.length}` },
            {
              label: "Retailer test",
              value:
                testable.length === 0
                  ? "n/a"
                  : `${testable.length - failCount} / ${testable.length} pass`,
            },
            {
              label: "Average agreed wholesale",
              value: avgWholesale === null ? "n/a" : GBP(avgWholesale),
            },
            {
              label: "Average margin",
              value: avgMargin === null ? "n/a" : `${avgMargin.toFixed(1)}%`,
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
          ));
        })()}
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

function EditInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
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
