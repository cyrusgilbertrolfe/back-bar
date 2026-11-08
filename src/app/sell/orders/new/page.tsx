import Link from "next/link";
import { asc, eq } from "drizzle-orm";

import Nav from "@/components/Nav";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { Field, Select, Textarea, buttonGhost, buttonPrimary, labelStyle, inputStyle } from "@/app/erp/_components/forms";
import { COLOR, FONT } from "@/lib/design";
import { INVOICE_TIMINGS, londonToday, SOURCES } from "@/lib/erp/orders";
import { createOrder } from "../actions";
import { LineFields, skuOptions } from "../_LineFields";

export const dynamic = "force-dynamic";

const heading = { fontSize: 16, fontWeight: 500, margin: "12px 0 0" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [customerRows, options] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.isActive, true)).orderBy(asc(customers.name)),
    skuOptions(),
  ]);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="orders-main" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 40px 96px" }}>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 8 }}>New order</h1>
        <p style={{ color: COLOR.muted, marginBottom: 24 }}>Only the customer is needed. Put in what you have and fill in the rest as it firms up.</p>
        {error && <p role="alert" style={{ color: COLOR.flag, marginBottom: 16 }}>{error}</p>}

        <form action={createOrder} style={{ display: "grid", gap: 16 }}>
          <Select
            label="Customer"
            name="customerId"
            options={customerRows.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <details>
            <summary style={{ ...labelStyle, cursor: "pointer", marginBottom: 12 }}>A new customer</summary>
            <div className="order-fields" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <Field label="Name" name="newCustomerName" />
              <Field label="Four-letter code" name="newCustomerCode" placeholder="CRPS" />
            </div>
          </details>

          <div className="order-fields" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <Field label="Their PO" name="orderNumber" placeholder="None: we issue a number" />
            <Select label="Came by" name="source" required defaultValue="mailbox" options={SOURCES.filter((s) => s.value !== "portal").map((s) => ({ value: s.value, label: s.label }))} />
            <Select label="Invoice" name="invoiceTiming" required defaultValue="on_despatch" options={INVOICE_TIMINGS.map((t) => ({ value: t.value, label: t.label }))} />
            <Field label="Order date" name="raisedOn" type="date" defaultValue={londonToday()} />
          </div>

          <h2 style={heading}>What they want</h2>
          <LineFields options={options} />

          <h2 style={heading}>Where it stands</h2>
          <div className="order-fields" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            <Field label="Dispatch or delivery date" name="date" type="date" />
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Waiting on</span>
              <input name="waitingOn" placeholder="The Fortnum's order finishing" style={inputStyle} />
            </label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" name="planned" /> Planned: we expect it, but it is not firm yet
          </label>
          <Textarea label="Deliver to" name="deliveryAddress" rows={2} />
          <Textarea label="Notes" name="notes" rows={3} />

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="submit" style={buttonPrimary}>Create order</button>
            <Link href="/sell/orders" style={{ ...buttonGhost, textDecoration: "none", display: "inline-block" }}>Cancel</Link>
          </div>
        </form>
      </main>
      <style>{`@media (max-width: 720px) { .orders-main { padding: 24px 16px 64px !important; } .order-fields { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
