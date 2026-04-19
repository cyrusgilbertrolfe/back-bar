import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export default function RecipesPage() {
  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: 880, margin: "0 auto", padding: "64px 40px 120px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          Drinks · Recipes
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
          Recipes
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 19,
            color: COLOR.inkSoft,
            lineHeight: 1.55,
            maxWidth: 640,
            fontWeight: 300,
            marginBottom: 48,
          }}
        >
          Browse and edit the canonical spec for every cocktail — ratios, production
          notes, and the drinks available to each client.
        </p>

        <div
          style={{
            borderTop: `1px solid ${COLOR.rule}`,
            borderBottom: `1px solid ${COLOR.rule}`,
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 11, color: COLOR.accent, marginBottom: 8, ...smallCaps }}>
            Planned
          </p>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 16,
              color: COLOR.muted,
              maxWidth: 400,
              margin: "0 auto",
              lineHeight: 1.55,
            }}
          >
            The recipe browser is on the list. Batch quantities for every drink are
            already live in the Batch calculator.
          </p>
        </div>
      </main>
    </div>
  );
}
