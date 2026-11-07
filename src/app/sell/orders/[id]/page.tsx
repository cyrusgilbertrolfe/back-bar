import Link from "next/link";
import { notFound } from "next/navigation";

import Nav from "@/components/Nav";
import { Field, Select, Textarea, buttonGhost, buttonPrimary, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { COLOR, FONT } from "@/lib/design";
import { dueDate, getOrder, lineText, londonToday, SOURCES, STAGES, waitingOn } from "@/lib/erp/orders";
import { getCaseLabelLine } from "@/lib/labels/case-label-data";
import { addLine, removeLine, updateOrder } from "../actions";
import { LineFields, skuOptions } from "../_LineFields";

export const dynamic = "force-dynamic";

const heading = { fontSize: 18, fontWeight: 500, margin: "0 0 12px" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  const today = londonToday();
  const waiting = waitingOn(order, today);
  const [options, labelLines] = await Promise.all([
    skuOptions(),
    Promise.all(order.lines.map((l) => (l.skuId ? getCaseLabelLine(l.id) : null))),
  ]);
  const save = updateOrder.bind(null, order.id);
  const add = addLine.bind(null, order.id);
  const source = SOURCES.find((s) => s.value === order.source)?.label ?? order.source;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="orders-main" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 40px 96px" }}>
        <Link href="/sell/orders" style={{ fontSize: 13, color: COLOR.muted }}>Open orders</Link>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>
          {order.customerName} {order.orderNumber}
        </h1>
        <p style={{ color: waiting.overdue ? COLOR.flag : COLOR.inkSoft, margin: "0 0 4px" }}>{waiting.text}</p>
        <p style={{ fontSize: 13, color: COLOR.muted, marginBottom: 28 }}>
          {order.orderNumberIsOurs ? "Our dispatch number" : "Their PO"} · came by {source.toLowerCase()}
        </p>
        {error && <p role="alert" style={{ color: COLOR.flag, marginBottom: 16 }}>{error}</p>}

        <section style={{ marginBottom: 36 }}>
          <h2 style={heading}>Lines</h2>
          {order.lines.length === 0 && <p style={{ color: COLOR.muted }}>No lines yet.</p>}
          {order.lines.map((l, i) => {
            const label = labelLines[i];
            return (
              <div key={l.id} style={{ borderTop: `1px solid ${COLOR.rule}`, padding: "12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div>{lineText(l)}</div>
                    <div style={{ fontSize: 12, color: l.skuCode ? COLOR.muted : COLOR.flag }}>{l.skuCode ?? "No SKU matched yet"}</div>
                  </div>
                  <form action={removeLine.bind(null, order.id, l.id)}>
                    <button type="submit" style={{ ...buttonGhost, padding: "6px 10px" }}>Remove</button>
                  </form>
                </div>
                {label && label.problems.length > 0 && (
                  <ul style={{ fontSize: 13, color: COLOR.flag, margin: "8px 0 0", paddingLeft: 18 }}>
                    {label.problems.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                )}
                {label && label.problems.length === 0 && (
                  <form action={`/api/case-labels/${l.id}`} method="get" target="_blank" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginTop: 10 }}>
                    <label style={{ fontSize: 12, color: COLOR.muted }}>
                      Cases this shipment
                      <input name="cases" type="number" min="1" max={label.cases} step="1" defaultValue={label.cases} style={{ ...inputStyle, width: 90, display: "block", marginTop: 4, padding: "6px 8px" }} />
                    </label>
                    <label style={{ fontSize: 12, color: COLOR.muted }}>
                      Start at label
                      <select name="start" defaultValue="1" style={{ ...inputStyle, width: 70, display: "block", marginTop: 4, padding: "6px 8px" }}>
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <button type="submit" style={buttonPrimary}>Print case labels</button>
                  </form>
                )}
              </div>
            );
          })}
          <details style={{ borderTop: `1px solid ${COLOR.rule}`, paddingTop: 12 }}>
            <summary style={{ ...labelStyle, cursor: "pointer", marginBottom: 12 }}>Add a line</summary>
            <form action={add} style={{ display: "grid", gap: 16 }}>
              <LineFields options={options} />
              <div><button type="submit" style={buttonGhost}>Add line</button></div>
            </form>
          </details>
        </section>

        <section>
          <h2 style={heading}>Where it stands</h2>
          <form action={save} style={{ display: "grid", gap: 16 }}>
            <div className="order-fields" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
              <Select label="Stage" name="status" required defaultValue={order.status} options={STAGES.map((s) => ({ value: s.value, label: s.label }))} />
              <Field label="Dispatch or delivery date" name="date" type="date" defaultValue={dueDate(order)} />
              <Field label="Order number" name="orderNumber" required defaultValue={order.orderNumber} />
            </div>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Waiting on</span>
              <input name="waitingOn" defaultValue={order.waitingOn ?? ""} placeholder="Blank means its next stage" style={inputStyle} />
            </label>
            <Textarea label="Deliver to" name="deliveryAddress" rows={2} defaultValue={order.deliveryAddress} />
            <Textarea label="Notes" name="notes" rows={4} defaultValue={order.notes} />
            <div><button type="submit" style={buttonPrimary}>Save</button></div>
          </form>
        </section>
      </main>
      <style>{`@media (max-width: 720px) { .orders-main { padding: 24px 16px 64px !important; } .order-fields { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
