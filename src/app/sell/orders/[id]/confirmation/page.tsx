import Link from "next/link";
import { notFound } from "next/navigation";

import Nav from "@/components/Nav";
import { Textarea, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { COLOR, FONT } from "@/lib/design";
import { confirmationMessage, confirmationSubject } from "@/lib/erp/order-confirmation";
import { getOrder, liveLines } from "@/lib/erp/orders";
import { sendConfirmation } from "../../actions";
import { SendButton } from "./_SendButton";

export const dynamic = "force-dynamic";

/** Look at what the customer will get, then send it with one click. */
export default async function ConfirmationPage({
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

  const back = `/sell/orders/${order.id}`;
  const lines = liveLines(order);
  const ready = lines.length > 0 && lines.every((l) => l.unitPriceQuoted !== null);
  const pdf = `/api/order-confirmation/${order.id}`;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="orders-main" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 40px 96px" }}>
        <Link href={back} style={{ fontSize: 13, color: COLOR.muted }}>{order.customerName} {order.orderNumber}</Link>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", margin: "8px 0 24px" }}>Review and send</h1>
        {error && <p role="alert" style={{ color: COLOR.flag, marginBottom: 16 }}>{error}</p>}
        {!ready && <p style={{ color: COLOR.flag }}>Every line needs a price first.</p>}
        {ready && (
          <>
            {order.paymentTermsDays === null && (
              <p style={{ color: COLOR.flag, marginBottom: 16 }}>No payment terms on record for {order.customerName}, so none are printed.</p>
            )}
            <form action={sendConfirmation.bind(null, order.id)} style={{ display: "grid", gap: 16, marginBottom: 28 }}>
              <label style={{ display: "block" }}>
                <span style={labelStyle}>To</span>
                <input name="to" type="email" required defaultValue={order.customerOrderEmail ?? ""} placeholder="Whoever placed the order" style={inputStyle} />
              </label>
              <p style={{ fontSize: 14, margin: 0 }}>
                <span style={{ color: COLOR.muted }}>From trade@myattsfields.com. Replies and a copy go to cocktails@myattsfields.com. Subject: </span>
                {confirmationSubject(order)}
              </p>
              <Textarea label="Message" name="message" rows={10} defaultValue={confirmationMessage(order)} />
              <div><SendButton again={Boolean(order.confirmationSentOn)} to={order.customerOrderEmail ?? ""} /></div>
            </form>
            <p style={{ fontSize: 13, color: COLOR.muted, marginBottom: 8 }}>
              The attachment. <a href={pdf} target="_blank" rel="noreferrer" style={{ color: COLOR.accent }}>Open it on its own</a>
            </p>
            <iframe src={pdf} title="The order confirmation" style={{ width: "100%", height: 720, border: `1px solid ${COLOR.rule}` }} />
          </>
        )}
      </main>
      <style>{`@media (max-width: 720px) { .orders-main { padding: 24px 16px 64px !important; } }`}</style>
    </div>
  );
}
