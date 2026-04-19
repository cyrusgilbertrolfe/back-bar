"use client";

import { useState } from "react";
import { fmt, fmtShort, pct, KpiCard, Section, PeriodPills } from "./_shared";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

type YearData = {
  totalIncome: number;
  netIncome: number;
  grossProfit: number;
  totalExpenses: number;
  incomeByAccount: Record<string, number>;
};

type ShopifyLive = {
  totalRevenue: number;
  orderCount: number;
} | null;

export default function RevenueClient({
  years,
  lastUpdated,
  currentYear,
  shopify,
}: {
  years: Record<string, YearData>;
  lastUpdated: string;
  currentYear: number;
  shopify: ShopifyLive;
}) {
  const availableYears = Object.keys(years)
    .map(Number)
    .sort((a, b) => b - a);

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const data = years[String(selectedYear)];
  const isCurrent = selectedYear === currentYear;

  const qbAmazon = data?.incomeByAccount?.["Amazon Sales"] ?? 0;
  const qbShopify = data?.incomeByAccount?.["Shopify Sales"] ?? 0;
  const qbWholesale =
    (data?.incomeByAccount?.["Sales - wholesale"] ?? 0) +
    (data?.incomeByAccount?.["Sales of Product Income"] ?? 0) +
    (data?.incomeByAccount?.["Sales - channel"] ?? 0) +
    (data?.incomeByAccount?.["Sales - retail"] ?? 0);

  const dtcValue = isCurrent && shopify ? shopify.totalRevenue : qbShopify + qbAmazon;
  const dtcSub = isCurrent && shopify ? `${shopify.orderCount} orders (live)` : "From QB";

  const totalLabel = isCurrent ? `${selectedYear} total YTD` : `${selectedYear} total`;
  const totalSub = isCurrent
    ? `From QuickBooks · Updated ${lastUpdated}`
    : "Full year · From QuickBooks";

  const yearPicker = (
    <PeriodPills values={availableYears} selected={selectedYear} onChange={setSelectedYear} />
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
          rowGap: 8,
        }}
      >
        <p style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>Revenue period</p>
        {yearPicker}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 40,
          borderTop: `1px solid ${COLOR.rule}`,
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "24px 0",
          marginBottom: 48,
        }}
      >
        <KpiCard label={totalLabel} value={fmtShort(data?.totalIncome ?? 0)} sub={totalSub} accent />
        <KpiCard
          label="Wholesale"
          value={fmtShort(qbWholesale)}
          sub="Product + channel + retail"
        />
        <KpiCard label="Amazon" value={fmtShort(qbAmazon)} sub="FBA sales" />
        <KpiCard label="Shopify" value={fmtShort(dtcValue)} sub={dtcSub} />
        <KpiCard
          label="Net income"
          value={fmtShort(data?.netIncome ?? 0)}
          sub="After all expenses"
          warning={(data?.netIncome ?? 0) < 0}
        />
      </section>

      <Section title="Annual revenue (QuickBooks)" badge="QB">
        <QBRevenueTable
          years={years}
          selectedYear={selectedYear}
          currentYear={currentYear}
        />
      </Section>
    </>
  );
}

function QBRevenueTable({
  years,
  selectedYear,
  currentYear,
}: {
  years: Record<string, YearData>;
  selectedYear: number;
  currentYear: number;
}) {
  const rows = Object.entries(years)
    .map(([year, d]) => ({ year, ...d }))
    .sort((a, b) => b.year.localeCompare(a.year));

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
            {["Year", "Total income", "Gross profit", "Expenses", "Net income", "YoY"].map(
              (col, i) => (
                <th
                  key={col}
                  style={{
                    padding: "12px 12px",
                    textAlign: i === 0 ? "left" : "right",
                    fontSize: 10,
                    color: COLOR.muted,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    ...smallCaps,
                  }}
                >
                  {col}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prev = rows[i + 1]?.totalIncome ?? null;
            const yoyPct = prev ? ((row.totalIncome - prev) / prev) * 100 : null;
            const yearNum = Number(row.year);
            const isCurrent = yearNum === currentYear;
            const isSelected = yearNum === selectedYear;
            return (
              <tr
                key={row.year}
                style={{
                  borderBottom: `1px solid ${COLOR.rule}`,
                  background: isSelected ? COLOR.paperDeep : "transparent",
                }}
              >
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 16,
                    color: isSelected ? COLOR.accent : COLOR.ink,
                    fontWeight: isSelected ? 500 : 400,
                  }}
                >
                  {row.year}
                  {isCurrent ? " YTD" : ""}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.ink,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.totalIncome)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.inkSoft,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.grossProfit)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.muted,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.totalExpenses)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: row.netIncome >= 0 ? COLOR.positive : COLOR.flag,
                    fontWeight: 600,
                    ...tabularNums,
                  }}
                >
                  {fmt(row.netIncome)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color:
                      yoyPct === null
                        ? COLOR.mutedLight
                        : yoyPct >= 0
                        ? COLOR.positive
                        : COLOR.flag,
                    ...tabularNums,
                  }}
                >
                  {yoyPct === null ? "—" : pct(yoyPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
