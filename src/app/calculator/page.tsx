import Nav from "@/components/Nav";
import Calculator from "@/components/Calculator";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export default function CalculatorPage() {
  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="calc-main"
        style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Production · Batch calculator
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(36px, 6vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            marginBottom: 12,
            color: COLOR.ink,
          }}
        >
          Batch calculator
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 17,
            color: COLOR.inkSoft,
            lineHeight: 1.5,
            maxWidth: 560,
            fontWeight: 300,
            marginBottom: 32,
          }}
        >
          Select a client, choose a recipe, set the volume — get exact ingredient
          quantities for the batch. Built to use on a phone, in a kitchen.
        </p>
        <Calculator />
      </main>

      <style>{`
        @media (max-width: 640px) {
          .calc-main { padding: 28px 18px 64px !important; }
        }
      `}</style>
    </div>
  );
}
