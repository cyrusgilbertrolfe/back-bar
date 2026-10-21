import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { gbp } from "@/lib/erp/rollup";
import { listCounts } from "@/lib/erp/stock-count";
import { buttonPrimary, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { startCount } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Stock counts (unparked 21 Oct 2026): the year-end stock figure for the
 * accounts, counted against Back Bar's own list and valued from its costs.
 */
export default async function StockCountsPage() {
  const counts = await listCounts();

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="audit-main" style={{ maxWidth: 880, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/production" style={{ color: COLOR.muted }}>Production</Link> / Stock count
        </p>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 40, fontWeight: 400, margin: "0 0 12px" }}>Stock count</h1>
        <p style={{ color: COLOR.inkSoft, fontSize: 15, lineHeight: 1.6, maxWidth: 640, margin: "0 0 40px" }}>
          The year-end stock figure for the accounts. Every SKU and every component is listed for you to count, and
          each line is valued at Back Bar&apos;s cost as at the count&apos;s date. Closing a count freezes its figures.
        </p>

        <section style={{ borderTop: `1px solid ${COLOR.ruleBold}`, marginBottom: 48 }}>
          {counts.length === 0 && (
            <p style={{ color: COLOR.muted, fontSize: 14, padding: "16px 0" }}>No counts yet.</p>
          )}
          {counts.map((c) => (
            <Link
              key={c.id}
              href={`/production/audit/${c.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                padding: "16px 0",
                borderBottom: `1px solid ${COLOR.rule}`,
                color: COLOR.ink,
                textDecoration: "none",
              }}
            >
              <span>
                As at {c.asAt}
                {c.countedOn && c.countedOn !== c.asAt ? `, counted ${c.countedOn}` : ""}
                {c.basis ? <span style={{ color: COLOR.muted }}> · {c.basis}</span> : null}
              </span>
              <span style={{ ...tabularNums, color: c.status === "closed" ? COLOR.ink : COLOR.accent, whiteSpace: "nowrap" }}>
                {c.status === "closed" ? gbp(Number(c.closedTotal ?? 0)) : "Draft"}
              </span>
            </Link>
          ))}
        </section>

        <h2 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 400, margin: "0 0 16px" }}>Start a count</h2>
        <form action={startCount} style={{ display: "grid", gap: 16, maxWidth: 520 }}>
          <label>
            <span style={labelStyle}>As at (the year end)</span>
            <input name="asAt" type="date" required defaultValue="2026-03-31" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Counted on</span>
            <input name="countedOn" type="date" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Counted by</span>
            <input name="countedBy" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>Basis</span>
            <input
              name="basis"
              placeholder="e.g. Estimate: counted 22 Oct 2026, wound back to 31 Mar 2026"
              style={inputStyle}
            />
          </label>
          <div>
            <button type="submit" style={buttonPrimary}>Start the count</button>
          </div>
        </form>
      </main>
      <style>{`@media (max-width: 640px) { .audit-main { padding: 32px 16px 64px !important; } }`}</style>
    </div>
  );
}
