"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { setAgreedRrp } from "@/app/actions/pricing";
import {
  updateAmazonOverride,
  resetAmazonOverrides,
  updateRrpNote,
  markShopifyRrpSynced,
} from "@/app/actions/rrp";
import type { PricingConfigView, SkuRow } from "../finance-types";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { CostTotalProvenance } from "@/components/CostSourceBadge";

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
  }).format(n);

// Same key the wholesale pricing tool uses, so the two pages share one set of
// what-if assumptions on a device and never diverge.
const STORAGE_CONFIG_KEY = "mfc_pricing_config_v2";
const AMAZON_MULTIPLIER = 1.15;

type Props = {
  rows: SkuRow[];
  config: PricingConfigView;
  amazonOverrides: Record<string, number>;
  rrpNotes: Record<string, string>;
  shopifySync: Record<string, number>;
};

type EditField = "rrp" | "amazon" | "note";

type WhatIf = { markup: number; retailerMargin: number; vat: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function RrpClient({
  rows: serverRows,
  config,
  amazonOverrides: serverAmazonOverrides,
  rrpNotes: serverNotes,
  shopifySync,
}: Props) {
  const [whatIf, setWhatIf] = useState<WhatIf>({
    markup: config.markup,
    retailerMargin: config.retailerMargin,
    vat: config.vat,
  });
  const [localRrpEdits, setLocalRrpEdits] = useState<Record<number, number>>({});
  const [localAmazonEdits, setLocalAmazonEdits] = useState<Record<string, number>>({});
  const [localNoteEdits, setLocalNoteEdits] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
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

  const effRrp = (r: SkuRow): number | null => localRrpEdits[r.skuId] ?? r.rrp;
  const effAmazon = (r: SkuRow): number | null => {
    const explicit = localAmazonEdits[r.code] ?? serverAmazonOverrides[r.code];
    if (explicit !== undefined) return explicit;
    const rrp = effRrp(r);
    return rrp === null ? null : round2(rrp * AMAZON_MULTIPLIER);
  };
  const effNote = (r: SkuRow) => localNoteEdits[r.code] ?? serverNotes[r.code] ?? "";

  const rows = serverRows.map((r) => {
    const rrp = effRrp(r);
    // The rule floor is the pure formula. It ignores the agreed wholesale on
    // purpose: an agreed price is a commitment, not a floor.
    const floor = round2(r.cogs * whatIf.markup + r.shipping);
    const retailerTest = round2(floor * whatIf.retailerMargin * whatIf.vat);
    const headroom = rrp === null ? null : round2(rrp - retailerTest);
    const amazonOverridden =
      localAmazonEdits[r.code] !== undefined || serverAmazonOverrides[r.code] !== undefined;
    return {
      r,
      rrp,
      rrpExVat: rrp === null ? null : round2(rrp / whatIf.vat),
      floor,
      retailerTest,
      headroom,
      amazon: effAmazon(r),
      amazonOverridden,
      note: effNote(r),
    };
  });

  const withRrp = rows.filter((x) => x.headroom !== null);
  const noRrp = rows.length - withRrp.length;
  const thinOrNegative = withRrp.filter((x) => (x.headroom as number) < 0.5).length;
  const negative = withRrp.filter((x) => (x.headroom as number) < 0).length;
  const allHealthy = thinOrNegative === 0 && noRrp === 0;

  const totalUnsavedEdits =
    Object.keys(localRrpEdits).length +
    Object.keys(localAmazonEdits).length +
    Object.keys(localNoteEdits).length;
  const hasUnsavedEdits = totalUnsavedEdits > 0;

  // Push to Shopify: diff live agreed RRPs against the last synced baseline.
  const hasBaseline = Object.keys(shopifySync).length > 0;
  const pending = rows.filter((x) => {
    if (!hasBaseline || x.rrp === null) return false;
    const synced = shopifySync[x.r.code];
    return synced === undefined || round2(x.rrp) !== round2(synced);
  });

  const startEdit = (id: number, field: EditField, val: string) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(val);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
  };

  const commitEdit = useCallback(() => {
    if (editingId === null || !editingField) return;
    const row = serverRows.find((r) => r.skuId === editingId);
    if (!row) return cancelEdit();
    if (editingField === "note") {
      setLocalNoteEdits((prev) => ({ ...prev, [row.code]: editValue }));
    } else {
      const val = parseFloat(editValue);
      if (isNaN(val) || val <= 0) {
        cancelEdit();
        return;
      }
      if (editingField === "rrp") {
        setLocalRrpEdits((prev) => ({ ...prev, [editingId]: round2(val) }));
      } else {
        setLocalAmazonEdits((prev) => ({ ...prev, [row.code]: round2(val) }));
      }
    }
    cancelEdit();
    setFeedback(null);
  }, [editingId, editingField, editValue, serverRows]);

  const saveAllEdits = () => {
    setFeedback(null);
    if (!hasUnsavedEdits) return;
    startTransition(async () => {
      for (const [id, rrp] of Object.entries(localRrpEdits)) {
        const res = await setAgreedRrp(Number(id), rrp);
        if (!res.ok) return setFeedback({ kind: "err", msg: res.error });
      }
      for (const [code, price] of Object.entries(localAmazonEdits)) {
        const row = serverRows.find((r) => r.code === code);
        if (!row) continue;
        const res = await updateAmazonOverride(code, row.name, row.size, price);
        if (!res.ok) return setFeedback({ kind: "err", msg: res.error });
      }
      for (const [code, note] of Object.entries(localNoteEdits)) {
        const row = serverRows.find((r) => r.code === code);
        if (!row) continue;
        const res = await updateRrpNote(code, row.name, row.size, note);
        if (!res.ok) return setFeedback({ kind: "err", msg: res.error });
      }
      setLocalRrpEdits({});
      setLocalAmazonEdits({});
      setLocalNoteEdits({});
      setFeedback({
        kind: "ok",
        msg: `${totalUnsavedEdits} change${totalUnsavedEdits > 1 ? "s" : ""} saved.`,
      });
    });
  };

  const handleResetAmazon = () => {
    startTransition(async () => {
      const res = await resetAmazonOverrides();
      if (res.ok) {
        setLocalAmazonEdits({});
        setFeedback({ kind: "ok", msg: "Amazon overrides cleared. Back to RRP + 15%." });
      } else setFeedback({ kind: "err", msg: res.error });
    });
  };

  const handleMarkSynced = () => {
    if (hasUnsavedEdits) {
      setFeedback({ kind: "err", msg: "Save your RRP changes before marking them synced." });
      return;
    }
    const map: Record<string, number> = {};
    rows.forEach((x) => {
      if (x.rrp !== null) map[x.r.code] = round2(x.rrp);
    });
    startTransition(async () => {
      const res = await markShopifyRrpSynced(map);
      if (res.ok) setFeedback({ kind: "ok", msg: "Current RRPs recorded as the Shopify baseline." });
      else setFeedback({ kind: "err", msg: res.error });
    });
  };

  const copyCsv = async () => {
    const list = (hasBaseline ? pending : rows).filter((x) => x.rrp !== null);
    const header = "sku,cocktail,size,rrp_inc_vat";
    const body = list
      .map((x) => `${x.r.gtin ?? x.r.code},${x.r.name},${x.r.size},${(x.rrp as number).toFixed(2)}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(`${header}\n${body}\n`);
      setFeedback({ kind: "ok", msg: `${list.length} RRP row${list.length === 1 ? "" : "s"} copied as CSV.` });
    } catch {
      setFeedback({ kind: "err", msg: "Clipboard blocked. Copy manually from the panel." });
    }
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
        Loading RRP…
      </div>
    );
  }

  return (
    <main className="rrp-main" style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 40px 96px" }}>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
        Finances · RRP
      </p>

      <section style={{ marginBottom: 36 }}>
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
          Recommended retail price
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
          What we charge end customers across our own channels. RRP is agreed by positioning,
          not by cost, but it must clear the rule floor (COGS × markup + shipping) by enough
          headroom to give a stockist a 30% margin plus VAT and still land below our own price.
          A SKU with no agreed RRP shows exactly that: no number is invented for it.
        </p>
      </section>

      {/* Position narrative card */}
      <section
        style={{
          borderLeft: `3px solid ${COLOR.accent}`,
          background: COLOR.paperDeep,
          padding: "20px 24px",
          marginBottom: 36,
          maxWidth: 820,
        }}
      >
        <p style={{ fontFamily: FONT.serif, fontSize: 16, lineHeight: 1.7, color: COLOR.inkSoft }}>
          MFC is a premium cocktail maker, real ingredients, in-house production, partnerships we
          are proud to put on a bottle, and the RRP reflects that position, not a cost-plus formula.{" "}
          <strong style={{ color: COLOR.accent }}>COGS × 1.40 + shipping is the floor underneath</strong>,
          the cost discipline that keeps the position profitable; the headroom above it is the
          strategic surface area. See the{" "}
          <Link href="/strategy#dtc" style={{ color: COLOR.accent, textDecoration: "underline", textUnderlineOffset: 3 }}>
            DTC strategy
          </Link>{" "}
          for the full reasoning.
        </p>
      </section>

      {/* Assumptions row (shared with the wholesale tool) */}
      <section
        style={{
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "20px 0",
          marginBottom: 28,
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
          What-if only, shared with the{" "}
          <Link href="/finances/pricing" style={{ color: COLOR.accent }}>wholesale tool</Link>. The
          stored config lives in the database.
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
            color: allHealthy ? COLOR.accent : negative > 0 ? COLOR.flag : COLOR.accentSoft,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Dot color={allHealthy ? COLOR.accent : negative > 0 ? COLOR.flag : COLOR.accentSoft} filled />
          {allHealthy
            ? `All ${rows.length} RRPs agreed and clear of the floor.`
            : [
                negative > 0
                  ? `${negative} agreed RRP${negative > 1 ? "s" : ""} below the floor`
                  : thinOrNegative > 0
                  ? `${thinOrNegative} with thin headroom (under £0.50)`
                  : null,
                noRrp > 0 ? `${noRrp} SKU${noRrp > 1 ? "s" : ""} with no agreed RRP` : null,
              ]
                .filter(Boolean)
                .join("; ") + "."}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", rowGap: 8 }}>
          {feedback && (
            <span
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 14,
                color: feedback.kind === "ok" ? COLOR.accent : COLOR.flag,
                maxWidth: 380,
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
              {isPending ? "Saving…" : `Save ${totalUnsavedEdits} change${totalUnsavedEdits > 1 ? "s" : ""}`}
            </button>
          )}
          <TextButton onClick={() => setPanelOpen(true)} color={COLOR.inkSoft}>
            Push to Shopify{hasBaseline ? ` (${pending.length})` : ""}
          </TextButton>
          <TextButton onClick={handleResetAmazon} color={COLOR.muted} disabled={isPending}>
            Reset Amazon overrides
          </TextButton>
        </div>
      </section>

      {/* Table */}
      <section style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}>
          <thead>
            <tr>
              {[
                { label: "Cocktail", align: "left" as const },
                { label: "Size", align: "left" as const },
                { label: "RRP inc VAT (agreed)", align: "right" as const },
                { label: "RRP ex VAT", align: "right" as const },
                { label: "Rule floor", align: "right" as const },
                { label: "Retailer +30% +VAT", align: "right" as const },
                { label: "Headroom", align: "right" as const },
                { label: "Amazon +15%", align: "right" as const },
                { label: "Notes", align: "left" as const },
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
            {rows.map((x) => {
              const { r } = x;
              const isEditRrp = editingId === r.skuId && editingField === "rrp";
              const isEditAmazon = editingId === r.skuId && editingField === "amazon";
              const isEditNote = editingId === r.skuId && editingField === "note";
              const isUnsavedRrp = localRrpEdits[r.skuId] !== undefined;
              const isUnsavedAmazon = localAmazonEdits[r.code] !== undefined;
              const isUnsavedNote = localNoteEdits[r.code] !== undefined;
              const headColor =
                x.headroom === null
                  ? COLOR.mutedLight
                  : x.headroom < 0
                  ? COLOR.flag
                  : x.headroom < 0.5
                  ? COLOR.accentSoft
                  : COLOR.positive;

              return (
                <tr key={r.skuId} style={{ borderBottom: `1px solid ${COLOR.rule}` }} className="rrp-row">
                  <td style={{ padding: "16px 12px", color: COLOR.ink, fontFamily: FONT.serif, fontSize: 17 }}>
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
                  <td style={{ padding: "16px 12px", color: COLOR.muted, fontFamily: FONT.mono, fontSize: 12, ...smallCaps }}>
                    {r.size}
                  </td>

                  {/* RRP inc VAT, editable, agreed */}
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditRrp ? "default" : "text",
                      color: isUnsavedRrp ? COLOR.flag : x.rrp === null ? COLOR.mutedLight : COLOR.ink,
                      fontWeight: isUnsavedRrp ? 600 : 400,
                    }}
                    onClick={() => !isEditRrp && startEdit(r.skuId, "rrp", x.rrp === null ? "" : x.rrp.toFixed(2))}
                  >
                    {isEditRrp ? (
                      <EditInput value={editValue} onChange={setEditValue} onCommit={commitEdit} onCancel={cancelEdit} />
                    ) : x.rrp === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic" }}>none agreed</span>
                    ) : (
                      <span style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}>
                        {GBP(x.rrp)}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.mutedLight }}>
                    {x.rrpExVat === null ? "·" : GBP(x.rrpExVat)}
                  </td>
                  <td
                    style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.inkSoft }}
                    title="COGS x markup + shipping. Formula output, not an agreed price."
                  >
                    {GBP(x.floor)}
                    <CostTotalProvenance
                      source={r.costSource}
                      asOf={r.costAsOf}
                      placeholders={r.placeholders.length}
                      unsourced={r.unsourcedLines}
                    />
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.muted }}>
                    {GBP(x.retailerTest)}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: headColor,
                      fontWeight: x.headroom !== null && x.headroom < 0.5 ? 600 : 400,
                    }}
                  >
                    {x.headroom === null
                      ? "·"
                      : `${x.headroom >= 0 ? "+" : ""}${GBP(x.headroom)}`}
                  </td>

                  {/* Amazon, editable */}
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      cursor: isEditAmazon ? "default" : "text",
                      color: isUnsavedAmazon
                        ? COLOR.flag
                        : x.amazon === null
                        ? COLOR.mutedLight
                        : x.amazonOverridden
                        ? COLOR.accent
                        : COLOR.muted,
                      fontWeight: x.amazonOverridden || isUnsavedAmazon ? 600 : 400,
                    }}
                    onClick={() =>
                      !isEditAmazon &&
                      startEdit(r.skuId, "amazon", x.amazon === null ? "" : x.amazon.toFixed(2))
                    }
                  >
                    {isEditAmazon ? (
                      <EditInput value={editValue} onChange={setEditValue} onCommit={commitEdit} onCancel={cancelEdit} />
                    ) : x.amazon === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic", fontWeight: 400 }}>needs RRP</span>
                    ) : (
                      <span style={{ borderBottom: `1px dotted ${COLOR.ruleBold}`, paddingBottom: 1 }}>
                        {GBP(x.amazon)}
                      </span>
                    )}
                  </td>

                  {/* Notes, editable text */}
                  <td
                    style={{ padding: "16px 12px", fontFamily: FONT.serif, fontSize: 13, color: isUnsavedNote ? COLOR.flag : COLOR.muted, minWidth: 180, cursor: isEditNote ? "default" : "text" }}
                    onClick={() => !isEditNote && startEdit(r.skuId, "note", x.note)}
                  >
                    {isEditNote ? (
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
                          width: "100%",
                          minWidth: 160,
                          fontFamily: FONT.serif,
                          fontSize: 13,
                          color: COLOR.ink,
                          background: COLOR.paperDeep,
                          border: `1px solid ${COLOR.accent}`,
                          padding: "4px 6px",
                          outline: "none",
                        }}
                      />
                    ) : x.note ? (
                      <span style={{ borderBottom: `1px dotted ${COLOR.rule}` }}>{x.note}</span>
                    ) : (
                      <span style={{ color: COLOR.mutedLight, fontStyle: "italic" }}>add note</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={9} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Push to Shopify drawer */}
      {panelOpen && (
        <ShopifyPanel
          rows={rows
            .filter((x) => x.rrp !== null)
            .map((x) => ({
              id: x.r.code,
              name: x.r.name,
              size: x.r.size,
              gtin: x.r.gtin ?? undefined,
              rrp: x.rrp as number,
            }))}
          pendingIds={new Set(pending.map((x) => x.r.code))}
          hasBaseline={hasBaseline}
          isPending={isPending}
          onClose={() => setPanelOpen(false)}
          onCopy={copyCsv}
          onMarkSynced={handleMarkSynced}
        />
      )}

      <style>{`
        .rrp-row:hover { background: ${COLOR.paperDeep}; }
        @media (max-width: 760px) {
          .rrp-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </main>
  );
}

// ─── Push to Shopify drawer ────────────────────────────────────────────────────

function ShopifyPanel({
  rows,
  pendingIds,
  hasBaseline,
  isPending,
  onClose,
  onCopy,
  onMarkSynced,
}: {
  rows: { id: string; name: string; size: string; gtin?: string; rrp: number }[];
  pendingIds: Set<string>;
  hasBaseline: boolean;
  isPending: boolean;
  onClose: () => void;
  onCopy: () => void;
  onMarkSynced: () => void;
}) {
  const pending = hasBaseline ? rows.filter((r) => pendingIds.has(r.id)) : rows;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(26,24,21,0.32)", zIndex: 40 }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "min(440px, 92vw)",
          background: COLOR.paper,
          borderLeft: `1px solid ${COLOR.ruleBold}`,
          zIndex: 41,
          padding: "32px 28px",
          overflowY: "auto",
          boxShadow: "-12px 0 40px rgba(26,24,21,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <p style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>Push to Shopify</p>
          <TextButton onClick={onClose} color={COLOR.muted}>Close</TextButton>
        </div>
        <h2
          style={{
            fontFamily: FONT.serif,
            fontSize: 26,
            fontWeight: 400,
            color: COLOR.ink,
            letterSpacing: "-0.02em",
            marginBottom: 12,
          }}
        >
          {hasBaseline
            ? pending.length
              ? `${pending.length} RRP${pending.length > 1 ? "s" : ""} changed since last sync`
              : "All RRPs match the last sync"
            : "No Shopify baseline yet"}
        </h2>
        <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 14, color: COLOR.muted, lineHeight: 1.6, marginBottom: 24 }}>
          {hasBaseline
            ? "Copy these as CSV, update the prices in Shopify, then mark them synced. This page never writes to Shopify directly."
            : "Mark the current RRPs as the baseline once Shopify matches them; future changes will then surface here for syncing."}
        </p>

        {pending.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24, ...tabularNums }}>
            <thead>
              <tr>
                {["Cocktail", "Size", "RRP"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 2 ? "right" : "left",
                      padding: "8px 6px",
                      fontSize: 10,
                      color: COLOR.muted,
                      borderBottom: `1px solid ${COLOR.ruleBold}`,
                      ...smallCaps,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                  <td style={{ padding: "8px 6px", fontFamily: FONT.serif, color: COLOR.ink }}>{r.name}</td>
                  <td style={{ padding: "8px 6px", fontFamily: FONT.mono, fontSize: 11, color: COLOR.muted, ...smallCaps }}>{r.size}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.ink }}>{GBP(r.rrp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <button
            onClick={onCopy}
            disabled={pending.length === 0}
            style={{
              background: COLOR.ink,
              color: COLOR.paper,
              border: "none",
              padding: "12px 18px",
              fontSize: 11,
              cursor: pending.length === 0 ? "default" : "pointer",
              opacity: pending.length === 0 ? 0.4 : 1,
              ...smallCaps,
            }}
          >
            Copy {hasBaseline ? "pending" : "all"} as CSV
          </button>
          <TextButton onClick={onMarkSynced} color={COLOR.inkSoft} disabled={isPending}>
            {isPending ? "Saving…" : hasBaseline ? "Mark these as synced" : "Set current RRPs as baseline"}
          </TextButton>
        </div>
      </aside>
    </>
  );
}

// ─── Shared small components (mirrors the wholesale pricing tool) ──────────────

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

function PercentInput({ value, onChange }: { value: number; onChange: (next: number) => void }) {
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
