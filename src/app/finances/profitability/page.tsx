import Link from "next/link";
import Nav from "@/components/Nav";
import { computeAllSkuCosts } from "@/lib/erp/cogs";
import ProfitabilityClient, { type CogsPageSummary } from "./ProfitabilityClient";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  const breakdowns = await computeAllSkuCosts();

  const totalSubtotal = breakdowns.reduce((s, b) => s + b.subtotal, 0);
  const totalInvoiceBacked = breakdowns.reduce(
    (s, b) => s + (b.invoiceBackedPct / 100) * b.subtotal,
    0,
  );
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const summary: CogsPageSummary = {
    totalSkus: breakdowns.length,
    clean: breakdowns.filter(
      (b) => b.unsourced.length === 0 && b.placeholders.length === 0 && b.problems.length === 0,
    ).length,
    withUnsourced: breakdowns.filter((b) => b.unsourced.length > 0).length,
    withPlaceholders: breakdowns.filter((b) => b.placeholders.length > 0).length,
    withProblems: breakdowns.filter((b) => b.problems.length > 0).length,
    totalCogs: round2(breakdowns.reduce((s, b) => s + b.total, 0)),
    totalLiquid: round2(breakdowns.reduce((s, b) => s + b.liquidTotal, 0)),
    totalPackaging: round2(breakdowns.reduce((s, b) => s + b.packagingTotal, 0)),
    totalWastage: round2(breakdowns.reduce((s, b) => s + b.wastage, 0)),
    invoiceBackedPct:
      totalSubtotal > 0 ? Math.round((totalInvoiceBacked / totalSubtotal) * 1000) / 10 : 0,
    wastagePct: breakdowns[0]?.wastagePct ?? 0,
    unsourcedNames: [...new Set(breakdowns.flatMap((b) => b.unsourced))].sort(),
    placeholderNames: [...new Set(breakdowns.flatMap((b) => b.placeholders))].sort(),
  };

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="profit-main"
        style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px" }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          Finances · COGS build
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
          COGS build
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
          Every SKU costed line by line from the database: liquid from the live recipe,
          primary packaging from the bill of materials, and wastage on top. Carriage is the
          only thing out. Each line carries its provenance, so a hand-typed figure can never
          pass as an invoice-backed one. Click any SKU for the full breakdown.
        </p>
        <p style={{ marginTop: -24, marginBottom: 40 }}>
          <Link href="/finances/cogs/movement" style={{ fontSize: 11, color: COLOR.ink, ...smallCaps }}>
            What moved, and why →
          </Link>
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
