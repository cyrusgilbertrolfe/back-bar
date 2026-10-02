"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CostScenario,
  COST_SCENARIOS,
  BoxOptionKey,
  BOX_OPTIONS,
  scenarioCogs,
  shopifyLine,
  wholesaleLine,
  shopifyShippingCost,
} from "@/lib/pnl-data";
import type { PricingConfigView, SkuRow } from "../finance-types";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { CostTotalProvenance } from "@/components/CostSourceBadge";

const GBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);

type Channel = "shopify" | "wholesale";
type SpecialBasket = "chooseSix" | "boxset" | null;

type Props = {
  rows: SkuRow[];
  config: PricingConfigView;
};

type PnlRow = {
  r: SkuRow;
  cogs: number;
  cogsDelta: number;
  /** Null when the price this channel needs has not been agreed. */
  revenue: number | null;
  fulfilment: number | null;
  contribution: number | null;
  contributionPct: number | null;
  shopify: ReturnType<typeof shopifyLine> | null;
  missing: string | null;
};

const BASKET_PILLS = [1, 2, 4, 6];

export default function PnlClient({ rows: serverRows, config }: Props) {
  const [scenario, setScenario] = useState<CostScenario>("today");
  const [channel, setChannel] = useState<Channel>("shopify");
  const [basket, setBasket] = useState<number>(6);
  const [customBasket, setCustomBasket] = useState<string>("");
  const [special, setSpecial] = useState<SpecialBasket>(null);
  const [box, setBox] = useState<BoxOptionKey>("smallSixBottle700");
  const [densityHigh, setDensityHigh] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(serverRows[0]?.skuId ?? null);

  const bottles = special ? 6 : basket;

  // Build a per-drink line for the active channel + scenario. Agreed prices
  // only: a SKU with no agreed RRP (Shopify) or no agreed wholesale price
  // (wholesale) shows that it has none rather than borrowing the rule price.
  const rows: PnlRow[] = serverRows.map((r) => {
    const cogs = scenarioCogs(r.cogs, r.code, scenario);
    const cogsDelta = Math.round((cogs - r.cogs) * 100) / 100;
    if (channel === "shopify") {
      if (r.rrp === null) {
        return {
          r,
          cogs,
          cogsDelta,
          revenue: null,
          fulfilment: null,
          contribution: null,
          contributionPct: null,
          shopify: null,
          missing: "No agreed RRP",
        };
      }
      const line = shopifyLine(r.rrp, cogs, config.vat, bottles, box);
      return {
        r,
        cogs,
        cogsDelta,
        revenue: line.revenueExVat,
        fulfilment: line.fulfilmentPerBottle,
        contribution: line.contribution,
        contributionPct: line.contributionPct,
        shopify: line,
        missing: null,
      };
    }
    if (r.wholesale === null) {
      return {
        r,
        cogs,
        cogsDelta,
        revenue: null,
        fulfilment: null,
        contribution: null,
        contributionPct: null,
        shopify: null,
        missing: "No agreed wholesale price",
      };
    }
    const line = wholesaleLine(r.wholesale, cogs, densityHigh);
    return {
      r,
      cogs,
      cogsDelta,
      revenue: line.wholesale,
      fulfilment: line.freightPerBottle,
      contribution: line.contribution,
      contributionPct: line.contributionPct,
      shopify: null,
      missing: null,
    };
  });

  const selected = rows.find((x) => x.r.skuId === selectedId) ?? rows[0];

  // Free-shipping hurdle (Shopify only): does basket contribution cover the carrier cost?
  const basketContribution =
    selected && selected.contribution !== null
      ? Math.round(selected.contribution * bottles * 100) / 100
      : null;
  const carrierCost = selected ? shopifyShippingCost(bottles, selected.r.size) : 0;
  const basketValue =
    selected && selected.r.rrp !== null ? Math.round(selected.r.rrp * bottles * 100) / 100 : null;
  const hurdleCovered = basketContribution !== null && basketContribution >= carrierCost;

  return (
    <main className="pnl-main" style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 40px 96px" }}>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
        Finances · Per-drink P&amp;L
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
          Per-drink P&amp;L
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
          Contribution margin per drink by channel, on agreed prices and database COGS
          (liquid, primary packaging and wastage), under three cost scenarios. Today&apos;s
          cost reflects what we actually pay now, including any written-off legacy
          inventory. True variable cost prices every input at replacement. Forward cost is
          the post-rebrand assumption.
        </p>
      </section>

      {/* Scenario toggle */}
      <ToggleRow label="Cost scenario">
        {(Object.keys(COST_SCENARIOS) as CostScenario[]).map((s) => (
          <Pill
            key={s}
            active={scenario === s}
            onClick={() => setScenario(s)}
            title={COST_SCENARIOS[s].description}
          >
            {COST_SCENARIOS[s].label}
          </Pill>
        ))}
      </ToggleRow>

      {/* Channel toggle */}
      <ToggleRow label="Channel">
        <Pill active={channel === "shopify"} onClick={() => setChannel("shopify")}>
          D2C Shopify
        </Pill>
        <Pill active={channel === "wholesale"} onClick={() => setChannel("wholesale")}>
          B2B Wholesale
        </Pill>
        <Pill active={false} disabled title="Awareness channel, not modelled.">
          Amazon
        </Pill>
      </ToggleRow>

      {/* Basket selector (Shopify) */}
      {channel === "shopify" && (
        <>
          <ToggleRow label="Basket">
            {BASKET_PILLS.map((n) => (
              <Pill
                key={n}
                active={!special && basket === n}
                onClick={() => {
                  setSpecial(null);
                  setBasket(n);
                }}
              >
                {n} bottle{n > 1 ? "s" : ""}
              </Pill>
            ))}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Pill
                active={!special && !BASKET_PILLS.includes(basket)}
                onClick={() => {
                  setSpecial(null);
                  const n = parseInt(customBasket);
                  if (!isNaN(n) && n > 0) setBasket(n);
                }}
              >
                Custom
              </Pill>
              <input
                value={customBasket}
                onChange={(e) => setCustomBasket(e.target.value.replace(/[^0-9]/g, ""))}
                onBlur={() => {
                  const n = parseInt(customBasket);
                  if (!isNaN(n) && n > 0) {
                    setSpecial(null);
                    setBasket(n);
                  }
                }}
                placeholder="n"
                style={{
                  width: 44,
                  fontFamily: FONT.mono,
                  fontSize: 13,
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${COLOR.ruleBold}`,
                  outline: "none",
                  color: COLOR.ink,
                }}
              />
            </span>
            <span style={{ width: 1, height: 22, background: COLOR.rule, margin: "0 4px" }} />
            <Pill active={special === "chooseSix"} onClick={() => setSpecial("chooseSix")}>
              Choose Six (6 × 50ml)
            </Pill>
            <Pill active={special === "boxset"} onClick={() => setSpecial("boxset")}>
              Boxset (6 × 50ml)
            </Pill>
          </ToggleRow>

          <ToggleRow label="Shipping box">
            {(Object.keys(BOX_OPTIONS) as BoxOptionKey[]).map((k) => (
              <Pill key={k} active={box === k} onClick={() => setBox(k)}>
                {BOX_OPTIONS[k].label} · {GBP(BOX_OPTIONS[k].cost)}
              </Pill>
            ))}
          </ToggleRow>
        </>
      )}

      {/* Density selector (Wholesale) */}
      {channel === "wholesale" && (
        <ToggleRow label="Pallet density">
          <Pill active={densityHigh} onClick={() => setDensityHigh(true)}>
            High density (90 cases/pallet)
          </Pill>
          <Pill active={!densityHigh} onClick={() => setDensityHigh(false)}>
            Low density (12 cases/pallet)
          </Pill>
        </ToggleRow>
      )}

      {/* Breakdown card */}
      {special ? (
        <FiftyMlTbdCard kind="breakdown" />
      ) : (
        selected && (
          <BreakdownCard
            row={selected}
            channel={channel}
            scenario={scenario}
            vat={config.vat}
            bottles={bottles}
          />
        )
      )}

      {/* Per-drink table */}
      <section style={{ marginTop: 44, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}>
          <thead>
            <tr>
              {[
                { label: "Cocktail", align: "left" as const },
                { label: "Size", align: "left" as const },
                { label: "RRP (agreed)", align: "right" as const },
                { label: "COGS", align: "right" as const },
                { label: channel === "shopify" ? "Revenue ex VAT" : "Wholesale (agreed)", align: "right" as const },
                { label: channel === "shopify" ? "Fulfilment" : "Freight", align: "right" as const },
                { label: "Contribution", align: "right" as const },
                { label: "Contribution %", align: "right" as const },
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
              const isSel = !special && x.r.skuId === selected?.r.skuId;
              return (
                <tr
                  key={x.r.skuId}
                  onClick={() => {
                    setSpecial(null);
                    setSelectedId(x.r.skuId);
                  }}
                  className="pnl-row"
                  style={{
                    borderBottom: `1px solid ${COLOR.rule}`,
                    cursor: "pointer",
                    background: isSel ? COLOR.paperDeep : "transparent",
                  }}
                >
                  <td style={{ padding: "16px 12px", color: COLOR.ink, fontFamily: FONT.serif, fontSize: 17 }}>
                    {x.r.name}
                    {x.r.clientName && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: COLOR.mutedLight, fontFamily: FONT.mono }}>
                        {x.r.clientName}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "16px 12px", color: COLOR.muted, fontFamily: FONT.mono, fontSize: 12, ...smallCaps }}>
                    {x.r.size}
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: x.r.rrp === null ? COLOR.mutedLight : COLOR.inkSoft }}>
                    {x.r.rrp === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic" }}>none</span>
                    ) : (
                      GBP(x.r.rrp)
                    )}
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.inkSoft }}>
                    {GBP(x.cogs)}
                    {scenario !== "today" && x.cogsDelta !== 0 && (
                      <span style={{ color: x.cogsDelta > 0 ? COLOR.flag : COLOR.positive, fontSize: 11, marginLeft: 6 }}>
                        {x.cogsDelta > 0 ? "+" : ""}
                        {GBP(x.cogsDelta)}
                      </span>
                    )}
                    <CostTotalProvenance
                      source={x.r.costSource}
                      asOf={x.r.costAsOf}
                      placeholders={x.r.placeholders.length}
                      unsourced={x.r.unsourcedLines}
                    />
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: x.revenue === null ? COLOR.mutedLight : COLOR.inkSoft }}>
                    {x.revenue === null ? (
                      <span style={{ fontSize: 11, fontStyle: "italic" }}>{x.missing}</span>
                    ) : (
                      GBP(x.revenue)
                    )}
                  </td>
                  <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: FONT.mono, color: COLOR.muted }}>
                    {x.fulfilment === null ? "·" : GBP(x.fulfilment)}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color:
                        x.contribution === null
                          ? COLOR.mutedLight
                          : x.contribution < 0
                          ? COLOR.flag
                          : x.contribution < 2
                          ? COLOR.accentSoft
                          : COLOR.positive,
                      fontWeight: 600,
                    }}
                  >
                    {x.contribution === null ? "·" : GBP(x.contribution)}
                  </td>
                  <td
                    style={{
                      padding: "16px 12px",
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      color: x.contributionPct === null ? COLOR.mutedLight : x.contributionPct < 0 ? COLOR.flag : COLOR.muted,
                    }}
                  >
                    {x.contributionPct === null ? "·" : `${x.contributionPct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Choose Six / Boxset card (Shopify only) */}
      {channel === "shopify" && (
        <div style={{ marginTop: 40 }}>
          <FiftyMlTbdCard kind="card" />
        </div>
      )}

      {/* Free shipping hurdle calculator (Shopify only) */}
      {channel === "shopify" && !special && selected && (
        <section
          style={{
            marginTop: 40,
            border: `1px solid ${COLOR.rule}`,
            borderLeft: `3px solid ${
              basketContribution === null ? COLOR.rule : hurdleCovered ? COLOR.positive : COLOR.flag
            }`,
            padding: "22px 26px",
            maxWidth: 820,
          }}
        >
          <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 12, ...smallCaps }}>
            Free shipping hurdle
          </p>
          {basketContribution === null || basketValue === null ? (
            <p style={{ fontFamily: FONT.serif, fontSize: 17, lineHeight: 1.7, color: COLOR.muted, fontStyle: "italic" }}>
              <strong>{selected.r.name}</strong> has no agreed RRP, so there is no basket to model.
            </p>
          ) : (
            <p style={{ fontFamily: FONT.serif, fontSize: 17, lineHeight: 1.7, color: COLOR.inkSoft }}>
              A {bottles}-bottle basket of <strong>{selected.r.name}</strong> ({COST_SCENARIOS[scenario].label})
              generates <strong style={{ color: COLOR.ink }}>{GBP(basketContribution)}</strong> of contribution
              against a carrier cost of <strong style={{ color: COLOR.ink }}>{GBP(carrierCost)}</strong> to ship it
              free. Basket value: {GBP(basketValue)}.{" "}
              <strong style={{ color: hurdleCovered ? COLOR.positive : COLOR.flag }}>
                {hurdleCovered ? "Covered." : "Not covered."}
              </strong>
            </p>
          )}
        </section>
      )}

      <p style={{ marginTop: 36, fontSize: 12, color: COLOR.mutedLight, fontStyle: "italic", fontFamily: FONT.serif, maxWidth: 820 }}>
        Carrier shipping is customer-paid and nets to zero on contribution; inbound shipping stays in
        COGS this iteration. Labour {GBP(20)}/hr and Shopify Payments 2% + {GBP(0.25)} are placeholders,
        edit in <Link href="https://github.com/cyrusgilbertrolfe/back-bar/blob/main/src/lib/pnl-data.ts" style={{ color: COLOR.accent }}>lib/pnl-data.ts</Link>.
      </p>

      <style>{`
        .pnl-row:hover td { background: ${COLOR.paperDeep}; }
        @media (max-width: 760px) {
          .pnl-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </main>
  );
}

// ─── Breakdown card ───────────────────────────────────────────────────────────

function BreakdownCard({
  row,
  channel,
  scenario,
  vat,
  bottles,
}: {
  row: PnlRow;
  channel: Channel;
  scenario: CostScenario;
  vat: number;
  bottles: number;
}) {
  const lines: { label: string; value: string; strong?: boolean; muted?: boolean; rule?: boolean; cogs?: boolean }[] = [];

  if (row.missing) {
    return (
      <section
        style={{
          marginTop: 36,
          border: `1px dashed ${COLOR.ruleBold}`,
          padding: "24px 28px",
          maxWidth: 640,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h2 style={{ fontFamily: FONT.serif, fontSize: 24, fontWeight: 500, color: COLOR.ink, letterSpacing: "-0.015em" }}>
            {row.r.name}
          </h2>
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLOR.muted, ...smallCaps }}>
            {row.r.size} · {channel === "shopify" ? "D2C" : "Wholesale"}
          </span>
        </div>
        <p style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: "italic", color: COLOR.flag, lineHeight: 1.6 }}>
          {row.missing}. Nothing is modelled for this SKU on this channel until a price is
          agreed; the rule price is deliberately not used as a stand-in.
        </p>
      </section>
    );
  }

  if (channel === "shopify" && row.shopify) {
    const s = row.shopify;
    lines.push({ label: "RRP inc VAT (agreed)", value: GBP(s.rrpIncVat) });
    lines.push({ label: `− VAT (1/${Math.round(vat / (vat - 1))})`, value: `− ${GBP(s.vatAmount)}`, muted: true });
    lines.push({ label: "= Revenue ex VAT", value: GBP(s.revenueExVat), rule: true });
    lines.push({ label: `− COGS (${COST_SCENARIOS[scenario].label})`, value: `− ${GBP(s.cogs)}`, muted: true, cogs: true });
    lines.push({
      label: `− Fulfilment (box ${GBP(s.boxPerBottle)} + pick&pack ${GBP(s.pickPackPerBottle)} + fees ${GBP(s.paymentPerBottle)}, per bottle @ ${bottles})`,
      value: `− ${GBP(s.fulfilmentPerBottle)}`,
      muted: true,
    });
    lines.push({ label: "= Contribution", value: GBP(s.contribution), strong: true, rule: true });
  } else if (row.revenue !== null && row.fulfilment !== null && row.contribution !== null) {
    lines.push({ label: "Wholesale price (agreed)", value: GBP(row.revenue) });
    lines.push({ label: `− COGS (${COST_SCENARIOS[scenario].label})`, value: `− ${GBP(row.cogs)}`, muted: true, cogs: true });
    lines.push({ label: "− Freight allocation (per bottle)", value: `− ${GBP(row.fulfilment)}`, muted: true });
    lines.push({ label: "= Contribution", value: GBP(row.contribution), strong: true, rule: true });
  }

  return (
    <section
      style={{
        marginTop: 36,
        border: `1px solid ${COLOR.rule}`,
        background: COLOR.paperDeep,
        padding: "24px 28px",
        maxWidth: 640,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h2 style={{ fontFamily: FONT.serif, fontSize: 24, fontWeight: 500, color: COLOR.ink, letterSpacing: "-0.015em" }}>
          {row.r.name}
        </h2>
        <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLOR.muted, ...smallCaps }}>
          {row.r.size} · {channel === "shopify" ? "D2C" : "Wholesale"}
        </span>
      </div>
      <div>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              padding: "8px 0",
              borderTop: l.rule ? `1px solid ${COLOR.ruleBold}` : "none",
            }}
          >
            <span
              style={{
                fontFamily: FONT.serif,
                fontSize: l.strong ? 16 : 14,
                color: l.strong ? COLOR.ink : l.muted ? COLOR.muted : COLOR.inkSoft,
                fontWeight: l.strong ? 600 : 400,
                lineHeight: 1.4,
              }}
            >
              {l.label}
              {l.cogs && (
                <CostTotalProvenance
                  source={row.r.costSource}
                  asOf={row.r.costAsOf}
                  placeholders={row.r.placeholders.length}
                  unsourced={row.r.unsourcedLines}
                  align="left"
                  fontSize={10}
                />
              )}
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: l.strong ? 18 : 14,
                color: l.strong
                  ? (row.contribution ?? 0) < 0
                    ? COLOR.flag
                    : COLOR.positive
                  : COLOR.inkSoft,
                fontWeight: l.strong ? 600 : 400,
                whiteSpace: "nowrap",
                ...tabularNums,
              }}
            >
              {l.value}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>Contribution margin</span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              color: (row.contributionPct ?? 0) < 0 ? COLOR.flag : COLOR.muted,
              ...tabularNums,
            }}
          >
            {row.contributionPct === null ? "·" : `${row.contributionPct.toFixed(1)}%`}
          </span>
        </div>
      </div>
    </section>
  );
}

function FiftyMlTbdCard({ kind }: { kind: "breakdown" | "card" }) {
  return (
    <section
      style={{
        marginTop: kind === "breakdown" ? 36 : 0,
        border: `1px dashed ${COLOR.ruleBold}`,
        padding: "24px 28px",
        maxWidth: 820,
        textAlign: "left",
      }}
    >
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 10, ...smallCaps }}>
        Choose Six &amp; Boxset · 50ml
      </p>
      <p style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: "italic", color: COLOR.muted, lineHeight: 1.6 }}>
        <strong style={{ color: COLOR.inkSoft, fontStyle: "normal" }}>TBD.</strong> Needs 50ml COGS input. See the
        DTC strategy section on{" "}
        <Link href="/strategy#dtc" style={{ color: COLOR.accent }}>/strategy</Link> for context; the 50ml format
        is flattered by zero-cost glass today. Populate{" "}
        <span style={{ fontFamily: FONT.mono, fontSize: 13 }}>PRODUCT_SCENARIO_ADJUSTMENTS</span> in lib/pnl-data.ts
        to model it.
      </p>
    </section>
  );
}

// ─── Toggle primitives ────────────────────────────────────────────────────────

function ToggleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        rowGap: 10,
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 10, color: COLOR.muted, minWidth: 96, ...smallCaps }}>{label}</span>
      {children}
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        fontFamily: FONT.sans,
        fontSize: 12,
        padding: "7px 14px",
        borderRadius: 999,
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${active ? COLOR.accent : COLOR.rule}`,
        background: active ? COLOR.accent : "transparent",
        color: active ? COLOR.paper : disabled ? COLOR.mutedLight : COLOR.inkSoft,
        opacity: disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      {children}
    </button>
  );
}
