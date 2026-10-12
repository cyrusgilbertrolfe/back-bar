import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { fmtCostDate } from "@/lib/erp/provenance";
import { gbp } from "@/lib/erp/rollup";
import { MOVE_FLAG, priceReview, type PriceReviewRow } from "@/lib/erp/price-review";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "moved", label: "Cost moved" },
  { key: "all", label: "Every SKU" },
] as const;

/** £ with sign, 2dp, or 4dp below a penny so a small movement is not shown as £0.00. */
function signed(x: number): string {
  const abs = Math.abs(x);
  const body = abs !== 0 && abs < 0.01 ? `£${abs.toFixed(4)}` : gbp(abs);
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${body}`;
}

function deltaColor(x: number): string {
  return x > 0 ? COLOR.flag : x < 0 ? COLOR.positive : COLOR.muted;
}

/**
 * The price review (roadmap week 5): every SKU's cost, agreed price and
 * margin, when the price was set, and a flag where COGS has moved since.
 */
export default async function PriceReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show = "moved" } = await searchParams;
  const showAll = show === "all";
  const { rows, trackingFrom } = await priceReview();

  const priced = rows.filter((r) => r.basis !== null);
  const unpriced = rows.filter((r) => r.basis === null);
  const flagged = priced.filter((r) => r.flagged);
  const up = flagged.filter((r) => r.delta! > 0).length;
  const beforeTracking = priced.filter((r) => r.then?.beforeTracking).length;
  const displayed = showAll ? priced : flagged;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="review-main" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/finances/pricing" style={{ color: COLOR.muted }}>
            Finances · Wholesale pricing
          </Link>{" "}
          · Price review
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
          Price review
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
          Every SKU&rsquo;s agreed price beside its cost today, when the price was set, and how far
          the cost has moved under it since. Agreed prices hold until the February review; this is
          the list to take into it.
        </p>
        <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 28, maxWidth: 760, lineHeight: 1.5 }}>
          Flagged when COGS has moved by {gbp(MOVE_FLAG)} a bottle or more, either way. Read against
          the wholesale price where there is one, otherwise the RRP. Margin is wholesale less COGS
          and shipping.
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
          <Stat label="SKUs with a price" value={String(priced.length)} />
          <Stat label="Cost moved since set" value={String(flagged.length)} />
          <Stat label="Up · down" value={`${up} · ${flagged.length - up}`} />
          <Stat label="No agreed price" value={String(unpriced.length)} />
        </section>

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {FILTERS.map((f) => {
            const active = f.key === (showAll ? "all" : "moved");
            return (
              <Link
                key={f.key}
                href={`/finances/price-review?show=${f.key}`}
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
          <Link
            href="/finances/cogs/movement"
            style={{ fontSize: 11, padding: "6px 14px", color: COLOR.muted, ...smallCaps }}
          >
            COGS movement →
          </Link>
        </nav>

        {beforeTracking > 0 && trackingFrom && (
          <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 24, maxWidth: 760, lineHeight: 1.5 }}>
            Cost history begins {fmtCostDate(trackingFrom)}, when the recipes were entered. {beforeTracking}{" "}
            price{beforeTracking === 1 ? " was" : "s were"} set earlier, so {beforeTracking === 1 ? "its" : "their"}{" "}
            movement is measured from {fmtCostDate(trackingFrom)}, marked †; the cost on the day{" "}
            {beforeTracking === 1 ? "it was" : "they were"} set is not known. ≈ marks a cost reconstructed from
            dated prices and recipe versions, close rather than exact.
          </p>
        )}

        {displayed.length === 0 ? (
          <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 16, color: COLOR.muted }}>
            No SKU&rsquo;s cost has moved since its price was set.
          </p>
        ) : (
          <div style={{ borderTop: `2px solid ${COLOR.ink}` }}>
            <div className="review-row review-head" style={{ padding: "10px 4px", borderBottom: `1px solid ${COLOR.ruleBold}` }}>
              <span>SKU</span>
              <span className="review-hide" style={{ textAlign: "right" }}>Price · set</span>
              <span className="review-hide" style={{ textAlign: "right" }}>COGS then</span>
              <span className="review-hide" style={{ textAlign: "right" }}>COGS now</span>
              <span style={{ textAlign: "right" }}>Moved</span>
              <span className="review-hide" style={{ textAlign: "right" }}>Margin</span>
            </div>
            {displayed.map((r) => (
              <Row key={r.p.skuId} r={r} />
            ))}
          </div>
        )}

        {unpriced.length > 0 && (
          <>
            <h2 style={{ ...sectionTitle, marginTop: 48 }}>No agreed price</h2>
            <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 12, lineHeight: 1.5 }}>
              Active SKUs with neither a wholesale price nor an RRP recorded, so there is nothing to review them
              against.
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${COLOR.rule}` }}>
              {unpriced.map((r) => (
                <li key={r.p.skuId} style={{ borderBottom: `1px solid ${COLOR.rule}`, padding: "10px 4px", fontSize: 14 }}>
                  <SkuName r={r} />
                  <span style={{ float: "right", fontFamily: FONT.mono, fontSize: 13, ...tabularNums }}>
                    <Link href={`/finances/cogs/${r.p.skuId}`} style={{ color: COLOR.ink, textDecorationColor: COLOR.rule }}>
                      {gbp(r.p.cost.total)}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <style>{`
        .review-row { display: grid; grid-template-columns: minmax(0, 2fr) 120px 100px 100px 100px 100px; gap: 4px 16px; align-items: baseline; }
        .review-head span { font-size: 10px; color: ${COLOR.muted}; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
        @media (max-width: 720px) {
          .review-main { padding: 32px 16px 64px !important; }
          .review-row { grid-template-columns: 1fr auto; }
          .review-row .review-hide { display: none; }
        }
      `}</style>
    </div>
  );
}

function SkuName({ r }: { r: PriceReviewRow }) {
  return (
    <>
      <Link
        href={`/finances/cogs/${r.p.skuId}`}
        style={{ fontFamily: FONT.serif, fontSize: 16, color: COLOR.ink, textDecorationColor: COLOR.rule }}
      >
        {r.p.drinkName ?? r.p.code}
      </Link>
      <span style={{ fontSize: 10, color: COLOR.accent, marginLeft: 8, ...smallCaps }}>
        {r.p.sizeMl}ml · {r.p.clientName ?? "no client"}
      </span>
    </>
  );
}

function Row({ r }: { r: PriceReviewRow }) {
  const price = r.basis === "wholesale" ? r.p.wholesale! : r.p.rrp!;
  const then = r.then;
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.rule}`, padding: "16px 4px" }}>
      <div className="review-row">
        <div>
          <SkuName r={r} />
        </div>
        <div className="review-hide" style={num()}>
          {gbp(price)}
          <div style={sub}>
            {r.basis === "rrp" ? "RRP · " : ""}
            {r.priceSetOn ? fmtCostDate(r.priceSetOn) : "—"}
          </div>
        </div>
        <div className="review-hide" style={{ ...num(), color: COLOR.muted }}>
          {then ? `${then.reconstructed ? "≈ " : ""}${gbp(then.total)}` : "—"}
          {then && (
            <div style={sub}>
              {then.beforeTracking ? "† " : ""}
              {fmtCostDate(then.asOf)}
            </div>
          )}
        </div>
        <div className="review-hide" style={num()}>
          {gbp(r.p.cost.total)}
          <div style={sub}>today</div>
        </div>
        <div style={{ ...num(14), color: r.delta === null ? COLOR.muted : deltaColor(r.flagged ? r.delta : 0) }}>
          {r.delta === null ? "—" : signed(r.delta)}
          <div style={{ fontSize: 10 }}>
            {r.deltaPct === null || r.delta === 0 ? "" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct.toFixed(1)}%`}
          </div>
        </div>
        <div className="review-hide" style={num()}>
          {r.p.margin === null ? "—" : gbp(r.p.margin)}
          <div style={sub}>{r.p.marginPct === null ? "" : `${r.p.marginPct.toFixed(1)}%`}</div>
        </div>
      </div>
      {r.flagged && r.lines.length > 0 && (
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
          {r.lines.slice(0, 4).map((l) => (
            <li key={`${l.kind}-${l.componentId}`} style={{ fontSize: 12, color: COLOR.inkSoft, lineHeight: 1.6 }}>
              <span style={{ fontFamily: FONT.mono, color: deltaColor(l.delta), display: "inline-block", minWidth: 84 }}>
                {signed(l.delta)}
              </span>
              {l.name} <span style={{ color: COLOR.muted }}>· {l.cause}{l.invoiceTo ? ` (${l.invoiceTo})` : ""}</span>
            </li>
          ))}
          {r.lines.length > 4 && (
            <li style={{ fontSize: 11, color: COLOR.mutedLight }}>
              and {r.lines.length - 4} more line{r.lines.length - 4 === 1 ? "" : "s"}
            </li>
          )}
          {Math.abs(r.wastageDelta) >= 0.00005 && (
            <li style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.6 }}>
              <span style={{ fontFamily: FONT.mono, color: deltaColor(r.wastageDelta), display: "inline-block", minWidth: 84 }}>
                {signed(r.wastageDelta)}
              </span>
              wastage on the moved subtotal
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>{label}</p>
      <p style={{ fontFamily: FONT.serif, fontSize: 22, lineHeight: 1.15, ...tabularNums }}>{value}</p>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10,
  color: COLOR.muted,
  marginBottom: 12,
  fontWeight: 500,
  ...smallCaps,
};

const sub: React.CSSProperties = { fontSize: 10, color: COLOR.muted };

function num(size = 13): React.CSSProperties {
  return { textAlign: "right", fontFamily: FONT.mono, fontSize: size, ...tabularNums };
}
