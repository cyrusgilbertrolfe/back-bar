import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { cogsMovementSince, type LineMovement, type SkuMovement } from "@/lib/erp/cogs-movement";
import { fmtCostDate } from "@/lib/erp/provenance";
import { gbp, unitPrice } from "@/lib/erp/rollup";

export const dynamic = "force-dynamic";

const PERIODS: { key: string; label: string; days?: number; date?: string }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "Since records began", date: "2000-01-01" },
];

function sinceFor(key: string): string {
  const p = PERIODS.find((x) => x.key === key) ?? PERIODS[1];
  if (p.date) return p.date;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (p.days ?? 30));
  return d.toISOString().slice(0, 10);
}

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
 * COGS movement: which SKUs' costs moved over a period, by how much, and the
 * lines that moved them. Built from sku_cogs_snapshots (Cyrus, 9 Oct 2026).
 */
export default async function CogsMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "30d" } = await searchParams;
  const since = sinceFor(period);
  const report = await cogsMovementSince(since);
  const up = report.moved.filter((m) => m.delta > 0).length;
  const down = report.moved.length - up;
  const anyReconstructed = report.moved.some((m) => m.from.reconstructed || m.to.reconstructed);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="move-main" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/finances/profitability" style={{ color: COLOR.muted }}>
            Finances · COGS build
          </Link>{" "}
          · Movement
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
          COGS movement
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
            marginBottom: 28,
          }}
        >
          Every SKU whose cost moved over the period, by how much, and the lines that moved it:
          a price change, a recipe change, or a line added or removed. A SKU&rsquo;s cost is
          recorded whenever it changes, so nothing moves without a trace.
        </p>

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {PERIODS.map((p) => {
            const active = p.key === period || (!PERIODS.some((x) => x.key === period) && p.key === "30d");
            return (
              <Link
                key={p.key}
                href={`/finances/cogs/movement?period=${p.key}`}
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
                {p.label}
              </Link>
            );
          })}
        </nav>

        {report.empty ? (
          <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 16, color: COLOR.muted }}>
            No COGS has been recorded yet. The first snapshot is taken when a price, recipe or
            wastage rate is saved, or by the daily check.
          </p>
        ) : (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 28,
                borderTop: `1px solid ${COLOR.rule}`,
                borderBottom: `1px solid ${COLOR.rule}`,
                padding: "20px 0",
                marginBottom: 40,
              }}
            >
              <Stat label="Period" value={since === "2000-01-01" ? "All" : `From ${fmtCostDate(since)}`} />
              <Stat label="SKUs moved" value={String(report.moved.length)} />
              <Stat label="Up · down" value={`${up} · ${down}`} />
              <Stat label="Last recorded" value={report.latestAsOf ? fmtCostDate(report.latestAsOf) : "—"} />
            </section>

            {anyReconstructed && (
              <p style={{ fontSize: 12, color: COLOR.muted, marginBottom: 24, maxWidth: 760, lineHeight: 1.5 }}>
                ≈ marks a figure reconstructed from dated prices and recipe versions, recorded before
                tracking began. It uses today&rsquo;s bill of materials and wastage rate, so it is close
                rather than exact.
              </p>
            )}

            {report.moved.length === 0 ? (
              <p style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 16, color: COLOR.muted }}>
                No SKU&rsquo;s COGS moved in this period.
              </p>
            ) : (
              <>
                <h2 style={sectionTitle}>What drove it</h2>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 48 }}>
                  <thead>
                    <tr style={headRow}>
                      <th style={th("left")}>Component</th>
                      <th style={th("left")}>Cause</th>
                      <th style={th("right")}>SKUs</th>
                      <th style={th("right")}>Summed per bottle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.drivers.slice(0, 12).map((d) => (
                      <tr key={d.componentId} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                        <td style={td()}>
                          <Link href={`/erp/components/${d.componentId}`} style={{ color: COLOR.ink, textDecorationColor: COLOR.rule }}>
                            {d.name}
                          </Link>
                        </td>
                        <td style={{ ...td(), color: COLOR.muted, fontSize: 12 }}>{d.causes.join(", ")}</td>
                        <td style={{ ...td("right"), fontFamily: FONT.mono }}>{d.skus}</td>
                        <td style={{ ...td("right"), fontFamily: FONT.mono, color: deltaColor(d.delta) }}>{signed(d.delta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h2 style={sectionTitle}>By SKU</h2>
                <div style={{ borderTop: `2px solid ${COLOR.ink}` }}>
                  {report.moved.map((m) => (
                    <SkuRow key={m.skuId} m={m} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
      <style>{`
        .move-row { display: grid; grid-template-columns: minmax(0, 2fr) 110px 110px 110px; gap: 4px 16px; align-items: baseline; }
        @media (max-width: 720px) {
          .move-main { padding: 32px 16px 64px !important; }
          .move-row { grid-template-columns: 1fr auto; }
          .move-row .move-hide { display: none; }
        }
      `}</style>
    </div>
  );
}

function SkuRow({ m }: { m: SkuMovement }) {
  const approx = (r: boolean) => (r ? "≈ " : "");
  return (
    <div style={{ borderBottom: `1px solid ${COLOR.rule}`, padding: "16px 4px" }}>
      <div className="move-row">
        <div>
          <Link
            href={`/finances/cogs/${m.skuId}`}
            style={{ fontFamily: FONT.serif, fontSize: 16, color: COLOR.ink, textDecorationColor: COLOR.rule }}
          >
            {m.drinkName ?? m.code}
          </Link>
          <span style={{ fontSize: 10, color: COLOR.accent, marginLeft: 8, ...smallCaps }}>
            {m.sizeMl}ml · {m.clientName ?? "no client"}
          </span>
        </div>
        <div className="move-hide" style={{ textAlign: "right", fontFamily: FONT.mono, fontSize: 13, color: COLOR.muted, ...tabularNums }}>
          {approx(m.from.reconstructed)}
          {gbp(m.from.total)}
          <div style={{ fontSize: 10 }}>{fmtCostDate(m.from.asOf)}</div>
        </div>
        <div className="move-hide" style={{ textAlign: "right", fontFamily: FONT.mono, fontSize: 13, ...tabularNums }}>
          {approx(m.to.reconstructed)}
          {gbp(m.to.total)}
          <div style={{ fontSize: 10, color: COLOR.muted }}>{fmtCostDate(m.to.asOf)}</div>
        </div>
        <div style={{ textAlign: "right", fontFamily: FONT.mono, fontSize: 14, color: deltaColor(m.delta), ...tabularNums }}>
          {signed(m.delta)}
          <div style={{ fontSize: 10 }}>{m.deltaPct === null ? "" : `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct.toFixed(1)}%`}</div>
        </div>
      </div>
      <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
        {m.lines.map((l) => (
          <li key={`${l.kind}-${l.componentId}`} style={{ fontSize: 12, color: COLOR.inkSoft, lineHeight: 1.6 }}>
            <span style={{ fontFamily: FONT.mono, color: deltaColor(l.delta), display: "inline-block", minWidth: 84 }}>
              {signed(l.delta)}
            </span>
            {l.name} <span style={{ color: COLOR.muted }}>· {describe(l)}</span>
          </li>
        ))}
        {Math.abs(m.wastageDelta) > 0.00005 && (
          <li style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.6 }}>
            <span style={{ fontFamily: FONT.mono, color: deltaColor(m.wastageDelta), display: "inline-block", minWidth: 84 }}>
              {signed(m.wastageDelta)}
            </span>
            wastage on the moved subtotal
          </li>
        )}
        {m.triggers.length > 0 && (
          <li style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 4 }}>Recorded after: {m.triggers.join(" · ")}</li>
        )}
      </ul>
    </div>
  );
}

function describe(l: LineMovement): string {
  switch (l.cause) {
    case "added":
      return "added";
    case "removed":
      return "removed";
    case "quantity":
      return "quantity changed (recipe or bill of materials)";
    default: {
      const uom = l.kind === "liquid" ? "ml" : "each";
      const price =
        l.unitFrom !== undefined && l.unitTo !== undefined ? `price ${priceChange(l.unitFrom, l.unitTo, uom)}` : "price";
      const inv = l.invoiceTo ? ` (${l.invoiceTo})` : "";
      return l.cause === "price and quantity" ? `${price}${inv}, and quantity changed` : `${price}${inv}`;
    }
  }
}

/**
 * "£0.78 each → £0.84 each". When both round to the same figure (the 19mm cork,
 * £0.1650 → £0.1671), they are shown to 4dp so the change is visible.
 */
function priceChange(from: number, to: number, uom: string): string {
  const a = unitPrice(from, uom);
  const b = unitPrice(to, uom);
  if (a !== b) return `${a} → ${b}`;
  const unit = uom === "each" ? "each" : `per ${uom}`;
  return `£${from.toFixed(4)} ${unit} → £${to.toFixed(4)} ${unit}`;
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

const headRow: React.CSSProperties = { borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` };

function th(align: "left" | "right"): React.CSSProperties {
  return { padding: "10px 12px", textAlign: align, fontSize: 10, color: COLOR.muted, fontWeight: 500, ...smallCaps };
}

function td(align: "left" | "right" = "left"): React.CSSProperties {
  return { padding: "12px 12px", textAlign: align, ...tabularNums };
}
