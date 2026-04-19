"use client";

import { useState } from "react";
import { fmt, fmtShort, pct, Section, PeriodPills } from "./_shared";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

type Partner = {
  revenue: Record<string, number>;
  total: number;
  subEntities?: Record<string, Record<string, number>>;
};

export default function WholesaleClient({
  partners,
  partnerOrder,
  periods,
}: {
  partners: Record<string, Partner>;
  partnerOrder: string[];
  periods: string[];
}) {
  const defaultPeriod =
    [...periods]
      .reverse()
      .find((p) => partnerOrder.some((name) => (partners[name]?.revenue?.[p] ?? 0) > 0)) ??
    periods[periods.length - 1];

  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriod);
  const selectedIdx = periods.indexOf(selectedPeriod);
  const prevPeriod = selectedIdx > 0 ? periods[selectedIdx - 1] : null;

  const picker = (
    <PeriodPills values={periods} selected={selectedPeriod} onChange={setSelectedPeriod} />
  );

  return (
    <Section title="Wholesale partners" badge="QB" right={picker}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 32,
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "20px 0",
          marginBottom: 32,
        }}
      >
        {partnerOrder.map((pName) => {
          const p = partners[pName];
          const latest = p?.revenue?.[selectedPeriod] ?? 0;
          const prev = prevPeriod ? p?.revenue?.[prevPeriod] ?? 0 : 0;
          const trend = prev > 0 ? ((latest - prev) / prev) * 100 : null;
          return (
            <div key={pName}>
              <p
                style={{
                  fontSize: 10,
                  color: COLOR.muted,
                  marginBottom: 6,
                  ...smallCaps,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pName}
              </p>
              <p
                style={{
                  fontFamily: FONT.serif,
                  fontSize: 22,
                  fontWeight: 400,
                  color: latest > 0 ? COLOR.ink : COLOR.mutedLight,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  ...tabularNums,
                }}
              >
                {latest > 0 ? fmtShort(latest) : "—"}
              </p>
              <p
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color:
                    trend === null ? COLOR.muted : (trend ?? 0) >= 0 ? COLOR.positive : COLOR.flag,
                  ...tabularNums,
                }}
              >
                {latest > 0 ? selectedPeriod : "No orders"}
                {trend !== null ? ` · ${pct(trend)}` : ""}
              </p>
            </div>
          );
        })}
      </div>

      <PartnerHistoryTable
        partners={partners}
        partnerOrder={partnerOrder}
        periods={periods}
        selectedPeriod={selectedPeriod}
      />
    </Section>
  );
}

function PartnerHistoryTable({
  partners,
  partnerOrder,
  periods,
  selectedPeriod,
}: {
  partners: Record<string, Partner>;
  partnerOrder: string[];
  periods: string[];
  selectedPeriod: string;
}) {
  const selectedIdx = periods.indexOf(selectedPeriod);
  const endIdx = selectedIdx >= 0 ? selectedIdx + 1 : periods.length;
  const startIdx = Math.max(0, endIdx - 5);
  const displayPeriods = periods.slice(startIdx, endIdx);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr
            style={{
              borderTop: `2px solid ${COLOR.ink}`,
              borderBottom: `1px solid ${COLOR.ruleBold}`,
            }}
          >
            <th
              style={{
                padding: "12px 12px",
                textAlign: "left",
                fontSize: 10,
                color: COLOR.muted,
                fontWeight: 500,
                ...smallCaps,
              }}
            >
              Partner
            </th>
            {displayPeriods.map((p) => (
              <th
                key={p}
                style={{
                  padding: "12px 12px",
                  textAlign: "right",
                  fontSize: 10,
                  color: p === selectedPeriod ? COLOR.accent : COLOR.muted,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  ...smallCaps,
                }}
              >
                {p}
              </th>
            ))}
            <th
              style={{
                padding: "12px 12px",
                textAlign: "right",
                fontSize: 10,
                color: COLOR.accent,
                fontWeight: 500,
                ...smallCaps,
              }}
            >
              All-time
            </th>
          </tr>
        </thead>
        <tbody>
          {partnerOrder.map((pName) => {
            const p = partners[pName];
            return (
              <tr key={pName} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 16,
                    color: COLOR.ink,
                  }}
                >
                  {pName}
                </td>
                {displayPeriods.map((period) => {
                  const val = p?.revenue?.[period] ?? 0;
                  const isSelected = period === selectedPeriod;
                  return (
                    <td
                      key={period}
                      style={{
                        padding: "14px 12px",
                        textAlign: "right",
                        fontFamily: FONT.mono,
                        color:
                          val > 0
                            ? isSelected
                              ? COLOR.accent
                              : COLOR.ink
                            : COLOR.mutedLight,
                        fontWeight: isSelected ? 600 : 400,
                        ...tabularNums,
                      }}
                    >
                      {val > 0 ? fmt(val) : "—"}
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.accent,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(p?.total ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={displayPeriods.length + 2}
              style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }}
            />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
