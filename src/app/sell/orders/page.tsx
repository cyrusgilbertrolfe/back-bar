import Link from "next/link";

import Nav from "@/components/Nav";
import { COLOR, FONT } from "@/lib/design";
import { listOpenOrders, londonToday } from "@/lib/erp/orders";
import { buttonPrimary } from "@/app/erp/_components/forms";
import { OrdersTable } from "./_OrdersTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const today = londonToday();
  const orders = await listOpenOrders(today);
  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="orders-main" style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 40px 96px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Open orders</h1>
          <Link href="/sell/orders/new" style={{ ...buttonPrimary, textDecoration: "none", whiteSpace: "nowrap" }}>
            New order
          </Link>
        </div>
        {orders.length === 0 ? (
          <p style={{ color: COLOR.muted }}>Nothing open. Enter the next order when it comes in.</p>
        ) : (
          <OrdersTable orders={orders} today={today} />
        )}
      </main>
      <style>{`@media (max-width: 720px) { .orders-main { padding: 24px 16px 64px !important; } }`}</style>
    </div>
  );
}
