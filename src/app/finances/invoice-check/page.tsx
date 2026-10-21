import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { fmtCostDate } from "@/lib/erp/provenance";
import { lastCronRuns } from "@/lib/erp/cron-runs";
import { listInvoices, type ListedInvoice, type ListedLine } from "@/lib/erp/invoice-check/list";
import { CONFIRMED_WITHIN, MOVED_AT } from "@/lib/erp/invoice-check/rules";
import { approveConfirmed, approveProposal, queryProposal, rejectProposal } from "./actions";

export const dynamic = "force-dynamic";

const FLAG_LABEL: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed by invoice",
  changed: "Changed",
  moved: "Moved",
  pack_size_changed: "Pack size changed",
  older_than_current: "Older than price in use",
};

const KIND_LABEL: Record<string, string> = {
  fee: "Fee",
  pallet: "Pallet",
  duty: "Duty, in goods cost",
  epr: "EPR, not a fee",
  zero: "£0, never a price",
  other: "Other",
};

const money = (x: string | number | null, dp = 4) => (x === null ? "—" : `£${Number(x).toFixed(dp)}`);

function mailLink(inv: ListedInvoice): string | null {
  if (!inv.threadId || !inv.mailbox) return null;
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(inv.mailbox)}#all/${inv.threadId}`;
}

/**
 * The invoice price check (roadmap week 6): every price a supplier invoice
 * implies, landed and referenced, waiting for Cyrus. Captured daily from
 * cocktails@; worked in the Cocktails Weekly, area 4. Nothing reaches a
 * component's price until a row here is approved.
 */
export default async function InvoiceCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const includeClosed = show === "all";
  const [invoices, runs] = await Promise.all([listInvoices({ includeClosed }), lastCronRuns("invoice-check")]);

  const waiting = invoices.reduce((n, i) => n + i.pending, 0);
  const urgent = invoices.filter((i) => i.urgent && (i.pending > 0 || i.status === "unreadable")).length;
  const toRule = invoices.reduce((n, i) => n + i.lines.filter((l) => l.issue).length, 0);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="ic-main" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/finances/ingredients" style={{ color: COLOR.muted }}>
            Buy · Ingredients
          </Link>{" "}
          · Invoice check
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(40px, 6vw, 56px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
            marginBottom: 18,
          }}
        >
          Invoice check
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 18,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 760,
            fontWeight: 300,
            marginBottom: 12,
          }}
        >
          Every price a supplier invoice implies, landed and referenced, waiting for you. Nothing is written to a
          component&rsquo;s price until you approve it here.
        </p>
        <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 28, maxWidth: 760, lineHeight: 1.5 }}>
          Landed per pack, ex VAT. Fees printed against items go to them; other fees and pallets split by goods value;
          duty printed apart is part of the goods cost; EPR is never a fee. Confirmed means the same goods price and landed
          within {CONFIRMED_WITHIN * 100}%; moved means {MOVED_AT * 100}% or more either way, and a rise that big is
          urgent: query it before paying. An approved price takes the invoice
          date.
          {runs.last && (
            <>
              {" "}
              Last capture{" "}
              {runs.last.ranAt.toLocaleString("en-GB", {
                timeZone: "Europe/London",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {runs.last.ok ? "" : ", which failed"}.
            </>
          )}
        </p>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 28,
            borderTop: `1px solid ${COLOR.rule}`,
            borderBottom: `1px solid ${COLOR.rule}`,
            padding: "20px 0",
            marginBottom: 32,
          }}
        >
          <Stat label="Prices waiting" value={String(waiting)} />
          <Stat label="Urgent invoices" value={String(urgent)} flag={urgent > 0} />
          <Stat label="For you to rule" value={String(toRule)} />
        </section>

        <nav style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[
            { key: "open", label: "Waiting" },
            { key: "all", label: "Including decided" },
          ].map((f) => {
            const active = (f.key === "all") === includeClosed;
            return (
              <Link
                key={f.key}
                href={`/finances/invoice-check?show=${f.key}`}
                style={{
                  fontSize: 11,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? COLOR.accent : COLOR.rule}`,
                  background: active ? COLOR.accent : "transparent",
                  color: active ? COLOR.paper : COLOR.inkSoft,
                  textDecoration: "none",
                  ...smallCaps,
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {invoices.length === 0 ? (
          <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 16, color: COLOR.muted }}>
            Nothing waiting. Every captured invoice has been decided.
          </p>
        ) : (
          invoices.map((inv) => <InvoiceCard key={inv.id} inv={inv} />)
        )}
      </main>
      <style>{`
        .ic-row { display: grid; grid-template-columns: minmax(0, 2.2fr) 110px 150px 90px minmax(0, 1.4fr); gap: 4px 16px; align-items: baseline; }
        .ic-head span { font-size: 10px; color: ${COLOR.muted}; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
        .ic-btn { font-size: 11px; padding: 4px 10px; border-radius: 999px; border: 1px solid ${COLOR.rule}; background: transparent; color: ${COLOR.inkSoft}; cursor: pointer; }
        .ic-btn:hover { background: ${COLOR.paperDeep}; }
        .ic-btn-go { border-color: ${COLOR.accent}; background: ${COLOR.accent}; color: ${COLOR.paper}; }
        .ic-btn-go:hover { background: ${COLOR.accentSoft}; }
        .ic-note { font-size: 12px; padding: 3px 8px; border: 1px solid ${COLOR.rule}; background: transparent; width: 140px; }
        @media (max-width: 760px) {
          .ic-main { padding: 32px 16px 64px !important; }
          .ic-row { grid-template-columns: 1fr auto; }
          .ic-row .ic-hide { display: none; }
        }
      `}</style>
    </div>
  );
}

function InvoiceCard({ inv }: { inv: ListedInvoice }) {
  const link = mailLink(inv);
  const confirmedWaiting = inv.lines.filter(
    (l) => l.proposal?.status === "pending" && l.proposal.flag === "confirmed",
  ).length;
  const toRule = inv.lines.filter((l) => l.issue);
  const priced = inv.lines.filter((l) => l.proposal);
  const other = inv.lines.filter((l) => !l.proposal && !l.issue);

  return (
    <article style={{ borderTop: `2px solid ${inv.urgent ? COLOR.flag : COLOR.ink}`, padding: "16px 0 28px", marginBottom: 12 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 400 }}>
          {inv.supplierName} {inv.invoiceRef}
        </h2>
        <span style={{ fontSize: 13, color: COLOR.muted }}>
          {fmtCostDate(inv.invoiceDate)}
          {inv.orderRef ? ` · order ${inv.orderRef}` : ""} · net {money(inv.netTotal, 2)}
        </span>
        <span style={{ fontSize: 11, color: inv.reconciles ? COLOR.positive : COLOR.flag, ...smallCaps }}>
          {inv.reconciles ? "✓ Lines reconcile" : "Lines don't reconcile"}
        </span>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: COLOR.accent }}>
            Open the email{inv.attachmentName ? ` · ${inv.attachmentName}` : ""} →
          </a>
        )}
        {confirmedWaiting > 1 && (
          <form action={approveConfirmed.bind(null, inv.id)} style={{ marginLeft: "auto" }}>
            <button className="ic-btn ic-btn-go">Approve all {confirmedWaiting} confirmed</button>
          </form>
        )}
      </header>

      {inv.urgentReason && (
        <p style={{ fontSize: 13, color: COLOR.flag, marginBottom: 12, maxWidth: 820, lineHeight: 1.5 }}>
          Urgent: {inv.urgentReason}
        </p>
      )}

      {priced.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="ic-row ic-head" style={{ padding: "8px 4px", borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            <span>Component · invoice line</span>
            <span className="ic-hide" style={{ textAlign: "right" }}>Now / pack</span>
            <span style={{ textAlign: "right" }}>Proposed / pack</span>
            <span className="ic-hide" style={{ textAlign: "right" }}>Move</span>
            <span className="ic-hide">Decision</span>
          </div>
          {priced.map((l) => (
            <ProposalRow key={l.id} l={l} />
          ))}
        </div>
      )}

      {toRule.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 10, color: COLOR.flag, margin: "10px 0 6px", fontWeight: 500, ...smallCaps }}>
            For you to rule: nothing below is written
          </p>
          {toRule.map((l) => (
            <p key={l.id} style={{ fontSize: 13, padding: "6px 4px", borderBottom: `1px solid ${COLOR.rule}`, lineHeight: 1.45 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 12, ...tabularNums }}>{money(l.lineTotal, 2)}</span>{" "}
              {l.description}
              {l.supplierCode ? <span style={{ color: COLOR.muted }}> ({l.supplierCode})</span> : null}
              <br />
              <span style={{ color: COLOR.flag }}>{l.issue}</span>
            </p>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <p style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.6 }}>
          {other.map((l) => `${l.description}, ${money(l.lineTotal, 2)} (${KIND_LABEL[l.kind] ?? l.kind})`).join(" · ")}
        </p>
      )}
    </article>
  );
}

function ProposalRow({ l }: { l: ListedLine }) {
  const p = l.proposal!;
  const pct = p.changePct === null ? null : Number(p.changePct);
  const loud = p.urgent || p.flag === "older_than_current";
  const waiting = p.status === "pending" || p.status === "queried";
  return (
    <div className="ic-row" style={{ padding: "10px 4px", borderBottom: `1px solid ${COLOR.rule}` }}>
      <div>
        <Link href={`/erp/components/${p.componentId}`} style={{ color: COLOR.ink, fontSize: 14 }}>
          {l.componentName}
        </Link>
        <p style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.45 }}>
          {l.lineNo}. {l.description}
          {l.supplierCode ? ` (${l.supplierCode})` : ""} · {Number(l.qty)} × {l.packUnit ?? "unit"} ·{" "}
          {money(l.lineTotal, 2)}
        </p>
        <p style={{ fontSize: 11, color: l.matchNote?.startsWith("Claude") ? COLOR.accent : COLOR.mutedLight, lineHeight: 1.45 }}>
          {l.matchNote}
        </p>
        {p.feesNote && <p style={{ fontSize: 11, color: COLOR.mutedLight, lineHeight: 1.45 }}>Fees: {p.feesNote}</p>}
      </div>
      <span className="ic-hide" style={{ textAlign: "right", fontFamily: FONT.mono, fontSize: 13, ...tabularNums }}>
        {/* The price in use, on the same pack as the proposal, so the two read side by side. */}
        {p.currentUnitCost === null ? "—" : money(Number(p.currentUnitCost) * Number(p.packSize))}
        <br />
        <span style={{ fontSize: 11, color: COLOR.muted }}>{money(p.currentUnitCost)}/unit</span>
      </span>
      <span style={{ textAlign: "right", fontFamily: FONT.mono, fontSize: 13, ...tabularNums }}>
        {money(Number(p.goodsCost) + Number(p.feesCost))}
        <br />
        <span style={{ fontSize: 11, color: COLOR.muted }}>
          {money(p.goodsCost)} + {money(p.feesCost)}
        </span>
        <br />
        <span style={{ fontSize: 11, color: COLOR.muted }}>
          per {Number(p.packSize)} · {money(p.proposedUnitCost)}/unit
        </span>
      </span>
      <span className="ic-hide" style={{ textAlign: "right" }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: loud ? COLOR.flag : COLOR.inkSoft, ...tabularNums }}>
          {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
        </span>
        <br />
        <span style={{ fontSize: 10, color: loud ? COLOR.flag : COLOR.muted, ...smallCaps }}>{FLAG_LABEL[p.flag]}</span>
      </span>
      <div className="ic-hide" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {waiting ? (
          <>
            {p.flag !== "older_than_current" && (
              <form action={approveProposal.bind(null, p.id)}>
                <button className="ic-btn ic-btn-go">Approve</button>
              </form>
            )}
            <form action={rejectProposal.bind(null, p.id)} style={{ display: "flex", gap: 6 }}>
              <input name="note" placeholder="Reason (optional)" className="ic-note" aria-label="Reason" />
              <button className="ic-btn">Reject</button>
            </form>
            {p.status === "pending" && (
              <form action={queryProposal.bind(null, p.id)}>
                <button className="ic-btn">Queried with supplier</button>
              </form>
            )}
            {p.status === "queried" && <span style={{ fontSize: 11, color: COLOR.accent, ...smallCaps }}>Queried</span>}
          </>
        ) : (
          <span style={{ fontSize: 11, color: p.status === "approved" ? COLOR.positive : COLOR.muted, ...smallCaps }}>
            {p.status}
            {p.decisionNote ? `: ${p.decisionNote}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>{label}</p>
      <p style={{ fontFamily: FONT.serif, fontSize: 22, lineHeight: 1.15, color: flag ? COLOR.flag : COLOR.ink, ...tabularNums }}>
        {value}
      </p>
    </div>
  );
}
