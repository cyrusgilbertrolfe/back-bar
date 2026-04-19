import Nav from "@/components/Nav";
import { computeAllSkuBreakdowns, computeSummary } from "@/lib/cogs";
import ProfitabilityClient from "./ProfitabilityClient";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export default function ProfitabilityPage() {
  const breakdowns = computeAllSkuBreakdowns();
  const summary = computeSummary(breakdowns);
  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="profit-main"
        style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          Finances · COGS reconciliation
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(44px, 6vw, 56px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.02,
            marginBottom: 18,
            color: COLOR.ink,
          }}
        >
          COGS reconciliation
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 19,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 760,
            fontWeight: 300,
            marginBottom: 40,
          }}
        >
          Derived COGS — liquid from the ingredient master times recipe ratios, plus
          labour — compared to the hardcoded values in the wholesale pricing model.
          Packaging (bottle, label, hygiene) is tracked separately; it belongs in
          channel P&amp;L, not COGS, because it varies by delivery method. Click any
          SKU for the full ingredient-level breakdown.
        </p>
        <ProfitabilityClient breakdowns={breakdowns} summary={summary} />
      </main>
      <style>{`
        @media (max-width: 720px) {
          .profit-main { padding: 32px 16px 64px !important; }
        }
      `}</style>
    </div>
  );
}
