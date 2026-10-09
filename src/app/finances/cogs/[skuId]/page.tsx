import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import CostSourceBadge from "@/components/CostSourceBadge";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { buildCostRollup, gbp, type RollupNode } from "@/lib/erp/rollup";
import { costCaveat } from "@/lib/erp/provenance";

export const dynamic = "force-dynamic";

/**
 * One SKU's COGS as a tree, every step visible (spec §12: "Where did this
 * £14.83 come from?" → click → see the rollup tree). Every COGS figure in
 * Finances links here. Server-rendered with <details>, so it needs no client
 * code and prints as it reads.
 */
export default async function CogsRollupPage({
  params,
}: {
  params: Promise<{ skuId: string }>;
}) {
  const { skuId: idStr } = await params;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  let rollup;
  try {
    rollup = await buildCostRollup(id);
  } catch {
    notFound();
  }
  const { cost: b, root } = rollup;
  const caveat = costCaveat({ placeholders: b.placeholders.length, unsourced: b.unsourcedLines });

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="rollup-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/finances/profitability" style={{ color: COLOR.muted }}>
            Finances · COGS build
          </Link>{" "}
          · Rollup
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(36px, 5vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            marginBottom: 10,
          }}
        >
          {b.drinkName ?? b.skuCode}
        </h1>
        <p style={{ fontSize: 11, color: COLOR.accent, marginBottom: 24, ...smallCaps }}>
          {b.sizeMl}ml · {b.clientName ?? "no client"} · {b.skuCode}
        </p>

        <section
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: "8px 24px",
            borderTop: `2px solid ${COLOR.ink}`,
            borderBottom: `1px solid ${COLOR.rule}`,
            padding: "20px 0",
            marginBottom: 32,
          }}
        >
          <span style={{ fontFamily: FONT.mono, fontSize: 32, fontWeight: 600, ...tabularNums }}>{gbp(b.total)}</span>
          <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>COGS per bottle</span>
          <span>
            <span style={{ fontSize: 10, color: COLOR.muted, marginRight: 8, ...smallCaps }}>
              Weakest source, oldest input
            </span>
            <CostSourceBadge source={b.costSource} date={b.costAsOf} />
          </span>
          <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>
            {b.invoiceBackedPct.toFixed(1)}% invoice-backed
          </span>
          {caveat && <span style={{ fontSize: 11, color: COLOR.flag, ...smallCaps }}>{caveat}</span>}
        </section>

        {b.problems.map((p) => (
          <p key={p} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 14, color: COLOR.flag, marginBottom: 12 }}>
            {p}
          </p>
        ))}

        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 15,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 720,
            fontWeight: 300,
            marginBottom: 24,
          }}
        >
          Each line shows the arithmetic behind it and where its price came from. Click a
          component to see its price history. Indented grey lines are shown for the working
          and are not added again.
        </p>

        <div style={{ borderTop: `1px solid ${COLOR.ruleBold}` }}>
          <Node node={root} depth={0} />
        </div>
      </main>
      <style>{`
        .rollup-row { display: grid; grid-template-columns: 1fr 120px 150px; gap: 4px 16px; align-items: baseline; }
        .rollup-summary { list-style: none; cursor: pointer; }
        .rollup-summary::-webkit-details-marker { display: none; }
        .rollup-summary .rollup-caret { display: inline-block; width: 14px; color: ${COLOR.mutedLight}; transition: transform 0.1s; }
        details[open] > .rollup-summary .rollup-caret { transform: rotate(90deg); }
        @media (max-width: 720px) {
          .rollup-main { padding: 32px 16px 64px !important; }
          .rollup-row { grid-template-columns: 1fr auto; }
          .rollup-badge { grid-column: 1 / -1; justify-self: start; }
        }
      `}</style>
    </div>
  );
}

/** Pence to 2dp, but a sub-penny constituent keeps enough places to be seen. */
function amount(x: number): string {
  return x !== 0 && Math.abs(x) < 0.01 ? `£${x.toFixed(4)}` : gbp(x);
}

function Node({ node, depth }: { node: RollupNode; depth: number }) {
  const row = <Row node={node} depth={depth} hasChildren={node.children.length > 0} />;
  if (node.children.length === 0) {
    return (
      <div style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
        {row}
      </div>
    );
  }
  // Constituents of a sub-recipe start closed: they are the working behind a
  // line, not part of the sum.
  return (
    <details open={!node.outside} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
      <summary className="rollup-summary">{row}</summary>
      <div style={{ borderTop: `1px solid ${COLOR.rule}` }}>
        {node.children.map((c, i) => (
          <div key={c.key} style={i === node.children.length - 1 ? { marginBottom: -1 } : undefined}>
            <Node node={c} depth={depth + 1} />
          </div>
        ))}
      </div>
    </details>
  );
}

function Row({ node, depth, hasChildren }: { node: RollupNode; depth: number; hasChildren: boolean }) {
  const top = depth === 0;
  const muted = node.outside;
  const name = node.componentId ? (
    <Link href={`/erp/components/${node.componentId}`} style={{ color: "inherit", textDecorationColor: COLOR.rule }}>
      {node.label}
    </Link>
  ) : (
    node.label
  );

  return (
    <div className="rollup-row" style={{ padding: `${top ? 16 : 11}px 8px ${top ? 16 : 11}px ${8 + depth * 22}px` }}>
      <div>
        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: top ? 18 : 15,
            fontWeight: top ? 500 : 400,
            color: muted ? COLOR.muted : COLOR.ink,
          }}
        >
          <span className="rollup-caret" aria-hidden>
            {hasChildren ? "▸" : ""}
          </span>
          {name}
        </div>
        {node.working && (
          <div style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.muted, marginTop: 3, marginLeft: 14, lineHeight: 1.5 }}>
            {node.working}
          </div>
        )}
        {node.note && (
          <div
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 12,
              color: node.noteFlagged ? COLOR.flag : COLOR.muted,
              marginTop: 3,
              marginLeft: 14,
            }}
          >
            {node.note}
          </div>
        )}
      </div>
      <div
        style={{
          textAlign: "right",
          fontFamily: FONT.mono,
          fontSize: top ? 16 : 14,
          fontWeight: top ? 600 : 400,
          color: muted ? COLOR.mutedLight : COLOR.ink,
          ...tabularNums,
        }}
      >
        {node.amount === null ? "" : amount(node.amount)}
      </div>
      <div className="rollup-badge" style={{ textAlign: "right" }}>
        {node.source && !top && <CostSourceBadge source={node.source} date={node.setAt ?? null} fontSize={10} block />}
        {node.invoice && !top && (
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: COLOR.muted, marginTop: 2 }}>{node.invoice}</div>
        )}
      </div>
    </div>
  );
}
