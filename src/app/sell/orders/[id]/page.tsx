import Link from "next/link";
import { notFound } from "next/navigation";

import Nav from "@/components/Nav";
import { Field, Select, Textarea, buttonGhost, buttonPrimary, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { COLOR, FONT } from "@/lib/design";
import {
  dispatchDate,
  dueDate,
  getOrder,
  lineBottles,
  lineText,
  lineValue,
  liveLines,
  londonToday,
  orderSteps,
  orderValue,
  SOURCES,
  STAGES,
  waitingOn,
} from "@/lib/erp/orders";
import { getCaseLabelLine } from "@/lib/labels/case-label-data";
import {
  addLine,
  addMaterial,
  markConfirmationSent,
  removeLine,
  removeMaterial,
  setLinePrice,
  setMaterialsChecked,
  updateMaterial,
  updateOrder,
} from "../actions";
import { MATERIAL_STATUSES, materialStatusLabel, materialText } from "@/lib/erp/order-materials";
import { orderRequirements } from "@/lib/erp/order-requirements";
import { RequirementsTable } from "./_Requirements";
import { LineFields, skuOptions } from "../_LineFields";
import { shortDate } from "../_OrdersTable";

export const dynamic = "force-dynamic";

const heading = { fontSize: 18, fontWeight: 500, margin: "0 0 12px" };
const group = { fontSize: 14, fontWeight: 500, margin: "8px 0 0" };
const threeUp = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 };
const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; at?: string }>;
}) {
  const { id } = await params;
  const { error, at } = await searchParams;
  const lineError = at === "line" ? error : undefined;
  const materialsError = at === "materials" ? error : undefined;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  const requirements = await orderRequirements(order);
  const today = londonToday();
  const waiting = waitingOn(order, today);
  const [options, labelLines] = await Promise.all([
    skuOptions(),
    Promise.all(order.lines.map((l) => (l.skuId ? getCaseLabelLine(l.id) : null))),
  ]);
  const save = updateOrder.bind(null, order.id);
  const add = addLine.bind(null, order.id);
  const steps = orderSteps(order);
  const nextKey = steps.find((s) => !s.done)?.key;
  const value = orderValue(order);
  const confirmable = liveLines(order).length > 0 && liveLines(order).every((l) => l.unitPriceQuoted !== null);
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
        {order.gone?.dispatches.map((d) => (
          <p key={d.invoiceNumber} style={{ color: COLOR.inkSoft, margin: "0 0 4px" }}>
            Went {shortDate(d.shippedOn)}, on invoice {d.invoiceNumber} in QuickBooks
          </p>
        ))}
        <p style={{ fontSize: 13, color: COLOR.muted, marginBottom: 28 }}>
          {order.orderNumberIsOurs ? "Our dispatch number" : "Their PO"} · came by {source.toLowerCase()}
          {value !== null && ` · ${money(value)} ex VAT`}
        </p>
        {error && !lineError && !materialsError && <p role="alert" style={{ color: COLOR.flag, marginBottom: 16 }}>{error}</p>}

        <section style={{ marginBottom: 36 }}>
          <h2 style={heading}>Steps</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${COLOR.rule}` }}>
            {steps.map((s) => (
              <li key={s.key} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${COLOR.rule}`, fontSize: 14, fontWeight: s.key === nextKey ? 500 : 400, color: s.done ? COLOR.muted : COLOR.ink }}>
                <span aria-hidden style={{ width: 14, color: COLOR.accent }}>{s.done ? "✓" : s.key === nextKey ? "→" : ""}</span>
                <span>{s.label}{s.done ? <span className="sr-only"> (done)</span> : null}</span>
              </li>
            ))}
          </ol>
        </section>

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
                {Number(l.qty) > 0 && (
                  <form action={setLinePrice.bind(null, order.id, l.id)} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginTop: 8 }}>
                    <label style={{ fontSize: 12, color: COLOR.muted }}>
                      £ a bottle, ex VAT
                      <input name="unitPrice" type="number" step="0.01" min="0" defaultValue={l.unitPriceQuoted === null ? "" : Number(l.unitPriceQuoted)} style={{ ...inputStyle, width: 110, display: "block", marginTop: 4, padding: "6px 8px" }} />
                    </label>
                    <button type="submit" style={{ ...buttonGhost, padding: "6px 10px" }}>Set price</button>
                    <span style={{ fontSize: 13, color: COLOR.muted }}>
                      {lineBottles(l)} bottles{lineValue(l) !== null && `, ${money(lineValue(l)!)}`}
                    </span>
                  </form>
                )}
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
          <details id="add-line" open={Boolean(lineError)} style={{ borderTop: `1px solid ${COLOR.rule}`, paddingTop: 12 }}>
            <summary style={{ ...labelStyle, cursor: "pointer", marginBottom: 12 }}>Add a line</summary>
            {lineError && <p role="alert" style={{ color: COLOR.flag, margin: "0 0 12px" }}>The line was not added. {lineError}</p>}
            <form action={add} style={{ display: "grid", gap: 16 }}>
              <LineFields options={options} required />
              <div><button type="submit" style={buttonGhost}>Add line</button></div>
            </form>
          </details>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={heading}>Confirmation</h2>
          {!confirmable && (
            <p style={{ color: COLOR.muted, margin: 0 }}>
              {liveLines(order).length === 0 ? "Add a line first: there is nothing to confirm yet." : "Every line needs a price before it can be confirmed."}
            </p>
          )}
          {confirmable && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <Link href={`/sell/orders/${order.id}/confirmation`} style={{ ...buttonPrimary, textDecoration: "none" }}>
                {order.confirmationSentOn ? "Review and send again" : "Review and send"}
              </Link>
              {!order.confirmationSentOn && (
                <form action={markConfirmationSent.bind(null, order.id)}>
                  <button type="submit" style={buttonGhost}>It went another way</button>
                </form>
              )}
              {order.confirmationSentOn && <span style={{ fontSize: 14, color: COLOR.muted }}>Sent {shortDate(order.confirmationSentOn)}</span>}
            </div>
          )}
        </section>

        <section id="materials" style={{ marginBottom: 36 }}>
          <h2 style={heading}>Materials</h2>
          <p style={{ fontSize: 13, color: COLOR.muted, margin: "0 0 12px" }}>
            What has to be bought for this order: glass, ingredients, dry goods. Kept in Back Bar only, never on the confirmation.
          </p>
          {materialsError && <p role="alert" style={{ color: COLOR.flag, margin: "0 0 12px" }}>{materialsError}</p>}
          <RequirementsTable orderId={order.id} requirements={requirements} materials={order.materials} />
          {order.materials.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 }}>
              {order.materialsCheckedOn ? (
                <>
                  <span style={{ fontSize: 14 }}>Nothing to buy, checked {shortDate(order.materialsCheckedOn)}.</span>
                  <form action={setMaterialsChecked.bind(null, order.id, false)}>
                    <button type="submit" style={{ ...buttonGhost, padding: "6px 10px" }}>Undo</button>
                  </form>
                </>
              ) : (
                <form action={setMaterialsChecked.bind(null, order.id, true)}>
                  <button type="submit" style={buttonGhost}>Nothing to buy</button>
                </form>
              )}
            </div>
          )}
          {order.materials.map((m) => (
            <div key={m.id} style={{ borderTop: `1px solid ${COLOR.rule}`, padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ color: m.status === "cancelled" ? COLOR.muted : COLOR.ink }}>{materialText(m)}</div>
                  <div style={{ fontSize: 12, color: COLOR.muted }}>
                    {materialStatusLabel(m.status)}
                    {m.orderedOn && ` ${shortDate(m.orderedOn)}`}
                    {m.expectedOn && ` · due ${shortDate(m.expectedOn)}`}
                  </div>
                </div>
                <form action={removeMaterial.bind(null, order.id, m.id)}>
                  <button type="submit" style={{ ...buttonGhost, padding: "6px 10px" }}>Remove</button>
                </form>
              </div>
              <form action={updateMaterial.bind(null, order.id, m.id)} className="order-fields" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: 12, alignItems: "end", marginTop: 8 }}>
                <label style={{ fontSize: 12, color: COLOR.muted }}>
                  Where it is
                  <select name="status" defaultValue={m.status} style={{ ...inputStyle, display: "block", marginTop: 4, padding: "6px 8px" }}>
                    {MATERIAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: COLOR.muted }}>
                  Supplier
                  <input name="supplierName" defaultValue={m.supplierName ?? ""} style={{ ...inputStyle, display: "block", marginTop: 4, padding: "6px 8px" }} />
                </label>
                <label style={{ fontSize: 12, color: COLOR.muted }}>
                  Their reference
                  <input name="reference" defaultValue={m.reference ?? ""} style={{ ...inputStyle, display: "block", marginTop: 4, padding: "6px 8px" }} />
                </label>
                <label style={{ fontSize: 12, color: COLOR.muted }}>
                  Expected
                  <input name="expectedOn" type="date" defaultValue={m.expectedOn ?? ""} style={{ ...inputStyle, display: "block", marginTop: 4, padding: "6px 8px" }} />
                </label>
                <button type="submit" style={{ ...buttonGhost, padding: "6px 10px" }}>Save</button>
              </form>
            </div>
          ))}
          <details open={Boolean(materialsError) || (order.materials.length === 0 && !order.materialsCheckedOn)} style={{ borderTop: `1px solid ${COLOR.rule}`, paddingTop: 12 }}>
            <summary style={{ ...labelStyle, cursor: "pointer", marginBottom: 12 }}>Add something to buy</summary>
            <form action={addMaterial.bind(null, order.id)} style={{ display: "grid", gap: 16 }}>
              <Field label="What" name="description" required placeholder="Jeroboam bottles" />
              <div className="order-fields" style={threeUp}>
                <Field label="How many" name="qty" type="number" step="any" min="0" />
                <Field label="Of what" name="uom" placeholder="bottles, kg, litres" />
                <Field label="Supplier, if known" name="supplierName" />
              </div>
              <div className="order-fields" style={threeUp}>
                <Select label="Where it is" name="status" required defaultValue="needed" options={MATERIAL_STATUSES.filter((s) => s.value !== "cancelled").map((s) => ({ value: s.value, label: s.label }))} />
                <Field label="Expected" name="expectedOn" type="date" />
              </div>
              <div><button type="submit" style={buttonGhost}>Add</button></div>
            </form>
          </details>
        </section>

        <section>
          <h2 style={heading}>Where it stands</h2>
          <form action={save} style={{ display: "grid", gap: 16 }}>
            <div className="order-fields" style={threeUp}>
              <Field label="Date they want it" name="date" type="date" defaultValue={dueDate(order)} />
              <Field label="Order number" name="orderNumber" required defaultValue={order.orderNumber} />
              <Field label="Delivery charge, ex VAT" name="deliveryCharge" type="number" step="0.01" min="0" defaultValue={order.deliveryCharge === null ? null : Number(order.deliveryCharge)} />
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input type="checkbox" name="planned" defaultChecked={order.planned} /> Planned: we expect it, but it is not firm yet
            </label>
            <Field label="Price note, printed on the confirmation" name="priceNote" defaultValue={order.priceNote} placeholder="Quotation MFQ-2026-001" />

            <h3 style={group}>From the customer</h3>
            <Field label="What we need from them" name="customerNeeds" defaultValue={order.customerNeeds} placeholder="Artwork sign-off, their labels, a delivery slot" />
            <div className="order-fields" style={threeUp}>
              <Field label="Due" name="customerNeedsDue" type="date" defaultValue={order.customerSuppliedComponentsDue} />
              <Field label="Received" name="customerNeedsMetOn" type="date" defaultValue={order.customerNeedsMetOn} />
              <Field label="Confirmation sent" name="confirmationSentOn" type="date" defaultValue={order.confirmationSentOn} />
            </div>

            <h3 style={group}>Making it</h3>
            <div className="order-fields" style={threeUp}>
              <Field label="Production" name="productionOn" type="date" defaultValue={order.productionOn} />
              <Field label="Packing" name="packingOn" type="date" defaultValue={order.packingOn} />
              <Field label="Pallet build" name="palletBuildOn" type="date" defaultValue={order.palletBuildOn} />
            </div>

            <h3 style={group}>Getting it there</h3>
            <div className="order-fields" style={threeUp}>
              <Field label="Carrier" name="carrier" defaultValue={order.carrier} placeholder="Pallet Track" />
              <Field label="Carrier booked" name="carrierBookedOn" type="date" defaultValue={order.carrierBookedOn} />
              <Field label="Collection" name="collectionOn" type="date" defaultValue={order.collectionOn} />
              <Field label="Pallet packed" name="palletPackedOn" type="date" defaultValue={order.palletPackedOn} />
            </div>
            <p style={{ fontSize: 13, color: COLOR.muted, margin: 0 }}>
              The day it actually goes comes from the shipping date on its QuickBooks invoice, with this order&apos;s number in Tracking no. or the memo.
              {dispatchDate(order) && !order.collectionOn && " No collection booked yet, so it is held to the date they want it."}
            </p>

            <h3 style={group}>Anything else</h3>
            <label style={{ display: "block" }}>
              <span style={labelStyle}>Waiting on</span>
              <input name="waitingOn" defaultValue={order.waitingOn ?? ""} placeholder="Blank means its next stage" style={inputStyle} />
            </label>
            <Textarea label="Deliver to" name="deliveryAddress" rows={2} defaultValue={order.deliveryAddress} />
            <Textarea label="Notes" name="notes" rows={4} defaultValue={order.notes} />
            <details>
              <summary style={{ ...labelStyle, cursor: "pointer", marginBottom: 12 }}>Correct the stage by hand</summary>
              <Select label="Stage" name="status" required defaultValue={order.status} options={STAGES.map((s) => ({ value: s.value, label: s.label }))} />
            </details>
            <div><button type="submit" style={buttonPrimary}>Save</button></div>
          </form>
        </section>
      </main>
      <style>{`@media (max-width: 720px) { .orders-main { padding: 24px 16px 64px !important; } .order-fields { grid-template-columns: 1fr !important; } } .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }`}</style>
    </div>
  );
}
