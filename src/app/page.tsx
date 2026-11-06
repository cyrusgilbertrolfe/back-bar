import Link from "next/link";

import Nav from "@/components/Nav";
import { COLOR, FONT, tabularNums } from "@/lib/design";
import { COGS_CHECK_JOB, lastCronRuns } from "@/lib/erp/cron-runs";
import { listInvoices } from "@/lib/erp/invoice-check/list";
import { listOpenOrders, londonToday, orderPrompts, type OrderPrompt, type OrderRow } from "@/lib/erp/orders";
import { OrdersTable } from "@/app/sell/orders/_OrdersTable";

export const dynamic = "force-dynamic";

/**
 * The home page says what needs doing and what is stuck, and stops there
 * (Cyrus, 6 Nov 2026, replacing the four surface tiles of 13 Sept, which the top
 * nav already carries). Every line leads to where it is dealt with. It is the
 * Cocktails Weekly's agenda kept live, not a dashboard: no revenue, no margins,
 * nothing that does not tell someone what to do. Each part fails on its own, so
 * one bad read says so instead of taking the page down.
 */

async function read<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[home] could not read ${what}`, err);
    return null;
  }
}

function invoicePrompts(invoices: Awaited<ReturnType<typeof listInvoices>>): OrderPrompt[] {
  const href = "/finances/invoice-check";
  const urgent = invoices.filter((i) => i.urgent && (i.pending > 0 || i.status === "unreadable")).length;
  const waiting = invoices.reduce((n, i) => n + i.pending, 0);
  const prompts: OrderPrompt[] = [];
  if (urgent) prompts.push({ text: `${urgent} urgent supplier invoice${urgent === 1 ? "" : "s"}`, href, urgent: true });
  if (waiting) prompts.push({ text: `${waiting} price${waiting === 1 ? "" : "s"} waiting for approval`, href, urgent: false });
  return prompts;
}

/** A daily job that has not succeeded for over a day and a bit has stopped. */
const STALE_MS = 26 * 60 * 60 * 1000;

const CHECKS = [
  { job: COGS_CHECK_JOB, label: "COGS check" },
  { job: "invoice-check", label: "Invoice check" },
];

/** Whether a check has gone quiet, measured now. */
function isStale(lastOk: { ranAt: Date } | null): boolean {
  return !lastOk || Date.now() - lastOk.ranAt.getTime() > STALE_MS;
}

function ranAt(d: Date, today: string): string {
  const day = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  return day === today ? `${time} today` : `${time}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`;
}

const sectionHead = { fontFamily: FONT.serif, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", margin: "0 0 12px" };
const unavailable = { color: COLOR.flag, margin: 0 };

export default async function Home() {
  const today = londonToday();
  const [orders, invoices, checks] = await Promise.all([
    read<OrderRow[]>("open orders", () => listOpenOrders(today)),
    read("the invoice check", () => listInvoices({ includeClosed: false })),
    Promise.all(CHECKS.map(async (c) => ({ ...c, runs: await lastCronRuns(c.job) }))),
  ]);

  const prompts = [...(orders ? orderPrompts(orders, today) : []), ...(invoices ? invoicePrompts(invoices) : [])].sort(
    (a, b) => Number(b.urgent) - Number(a.urgent),
  );

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="home-main" style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 40px 96px" }}>
        <h1 className="sr-only">The Back Bar</h1>

        <section style={{ marginBottom: 48 }}>
          <h2 style={sectionHead}>Needs doing</h2>
          {prompts.length === 0 && orders && invoices && <p style={{ color: COLOR.muted, margin: 0 }}>Nothing waiting.</p>}
          {prompts.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${COLOR.rule}` }}>
              {prompts.map((p) => (
                <li key={p.text} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                  <Link href={p.href} className="home-row" style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", color: p.urgent ? COLOR.flag : COLOR.ink, textDecoration: "none" }}>
                    <span>{p.text}</span>
                    <span aria-hidden style={{ color: COLOR.accent }}>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!invoices && <p style={{ ...unavailable, marginTop: 12 }}>The invoice check could not be read just now.</p>}
        </section>

        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
            <h2 style={sectionHead}>Open orders</h2>
            <Link href="/sell/orders/new" style={{ fontSize: 14, color: COLOR.accent, whiteSpace: "nowrap" }}>New order</Link>
          </div>
          {!orders && <p style={unavailable}>Orders could not be read just now.</p>}
          {orders && orders.length === 0 && <p style={{ color: COLOR.muted, margin: 0 }}>Nothing open.</p>}
          {orders && orders.length > 0 && <OrdersTable orders={orders} today={today} />}
        </section>

        <section>
          <h2 style={sectionHead}>Can we trust this?</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: "12px 0 0", borderTop: `1px solid ${COLOR.rule}`, display: "flex", flexWrap: "wrap", gap: "6px 32px", fontSize: 14, ...tabularNums }}>
            {checks.map((c) => {
              const { last, lastOk } = c.runs;
              const stale = isStale(lastOk);
              const failed = last ? !last.ok : false;
              return (
                <li key={c.job} style={{ color: stale || failed ? COLOR.flag : COLOR.muted }}>
                  {c.label}{" "}
                  {!last ? "has no recorded run" : failed ? `failed at ${ranAt(last.ranAt, today)}` : stale ? `last ran ${ranAt(last.ranAt, today)}` : `ran ${ranAt(last.ranAt, today)}`}
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <style>{`
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        .home-row:hover { background: ${COLOR.paperDeep}; }
        .home-row:focus-visible { outline: 2px solid ${COLOR.accent}; outline-offset: 2px; }
        @media (max-width: 720px) { .home-main { padding: 28px 16px 64px !important; } }
      `}</style>
    </div>
  );
}
