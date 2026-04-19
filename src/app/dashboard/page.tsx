import Nav from "@/components/Nav";
import { getShopifyRevenueData, getRecentShopifyOrders } from "@/lib/shopify";
import { STATIC_ALERTS } from "@/lib/static-data";
import qbRevenue from "@/data/qb-revenue.json";
import qbCustomers from "@/data/qb-customers.json";
import { fmt, Section } from "./_shared";
import RevenueClient from "./RevenueClient";
import WholesaleClient from "./WholesaleClient";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

export default async function RevenuePage() {
  const [shopifyData, shopifyOrders] = await Promise.all([
    getShopifyRevenueData(),
    getRecentShopifyOrders(),
  ]);

  const isShopifyLive = !!shopifyData;
  const currentYear = new Date().getFullYear();

  const years = qbRevenue.years as Record<
    string,
    {
      totalIncome: number;
      netIncome: number;
      grossProfit: number;
      totalExpenses: number;
      incomeByAccount: Record<string, number>;
    }
  >;

  const partners = qbCustomers.partners as Record<
    string,
    {
      revenue: Record<string, number>;
      total: number;
      subEntities?: Record<string, Record<string, number>>;
    }
  >;
  const partnerOrder = [
    "Cripps & Co.",
    "Fortnum & Mason",
    "Bayley & Sage",
    "Dugard & Daughters",
    "Italo",
    "Mother Superior",
    "Macknade",
  ];

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="dashboard-main"
        style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}
      >
        {/* Masthead */}
        <section style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
            Finances · Revenue overview
          </p>
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
            Revenue overview
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
            {currentYear} financial overview. Revenue pulled from QuickBooks via
            Claude — refreshes automatically every Monday. Last updated {qbRevenue.lastUpdated}.
          </p>
        </section>

        {/* Connection status + alerts */}
        <section
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 32,
            flexWrap: "wrap",
            rowGap: 10,
          }}
        >
          <StatusBadge label="Shopify" live={isShopifyLive} />
          <StatusBadge
            label="QuickBooks"
            live={true}
            note={`updated ${qbRevenue.lastUpdated}`}
          />
        </section>

        {STATIC_ALERTS.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
            {STATIC_ALERTS.map((alert) => (
              <AlertBanner key={alert.title} {...alert} />
            ))}
          </div>
        )}

        <RevenueClient
          years={years}
          lastUpdated={qbRevenue.lastUpdated}
          currentYear={currentYear}
          shopify={
            shopifyData
              ? { totalRevenue: shopifyData.totalRevenue, orderCount: shopifyData.orderCount }
              : null
          }
        />

        <WholesaleClient
          partners={partners}
          partnerOrder={partnerOrder}
          periods={qbCustomers.periods as string[]}
        />

        <Section title="Recent DTC orders" badge={isShopifyLive ? "Live" : "Offline"}>
          <LiveOrdersTable orders={shopifyOrders} />
        </Section>
      </main>

      <style>{`
        @media (max-width: 720px) {
          .dashboard-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </div>
  );
}

function StatusBadge({ label, live, note }: { label: string; live: boolean; note?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: live ? COLOR.accent : COLOR.mutedLight,
        ...smallCaps,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: live ? COLOR.accent : "transparent",
          border: `1px solid ${live ? COLOR.accent : COLOR.ruleBold}`,
        }}
      />
      {label} {live ? "live" : note ?? "offline"}
    </span>
  );
}

function AlertBanner({ type, title, message }: { type: "warning" | "info"; title: string; message: string }) {
  const isWarning = type === "warning";
  const color = isWarning ? COLOR.flag : COLOR.accent;
  return (
    <div
      style={{
        borderLeft: `2px solid ${color}`,
        padding: "10px 16px",
        display: "flex",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 14, color, flexShrink: 0 }}>{isWarning ? "⚠" : "ℹ"}</span>
      <div>
        <p style={{ fontSize: 12, color, ...smallCaps, marginBottom: 2 }}>{title}</p>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 14,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

function LiveOrdersTable({
  orders,
}: {
  orders: Awaited<ReturnType<typeof getRecentShopifyOrders>>;
}) {
  if (!orders.length) {
    return (
      <p
        style={{
          fontFamily: FONT.serif,
          fontStyle: "italic",
          fontSize: 14,
          color: COLOR.muted,
          textAlign: "center",
          padding: "32px 0",
        }}
      >
        Connect Shopify API to see live orders
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            {["Order", "Date", "Items", "Total", "Status"].map((col) => (
              <th
                key={col}
                style={{
                  padding: "12px 12px",
                  textAlign: col === "Total" ? "right" : "left",
                  fontSize: 10,
                  color: COLOR.muted,
                  fontWeight: 500,
                  ...smallCaps,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const items =
              (order as unknown as { line_items?: Array<{ title: string; quantity: number }> })
                .line_items ?? [];
            const itemSummary = items
              .map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ""}${i.title}`)
              .join(", ");
            return (
              <tr key={order.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.mono,
                    color: COLOR.accent,
                    fontSize: 13,
                  }}
                >
                  {order.name}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    whiteSpace: "nowrap",
                    color: COLOR.muted,
                    fontSize: 13,
                  }}
                >
                  {new Date(order.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 14,
                    color: COLOR.inkSoft,
                    maxWidth: 300,
                  }}
                >
                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {itemSummary || "—"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    textAlign: "right",
                    fontFamily: FONT.mono,
                    color: COLOR.ink,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    ...tabularNums,
                  }}
                >
                  {fmt(parseFloat(order.total_price))}
                </td>
                <td style={{ padding: "14px 12px" }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: order.financial_status === "paid" ? COLOR.positive : COLOR.muted,
                      ...smallCaps,
                    }}
                  >
                    {order.financial_status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
