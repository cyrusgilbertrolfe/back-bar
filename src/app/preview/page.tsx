import Link from "next/link";
import { COLOR, FONT, smallCaps } from "./preview-theme";

export const metadata = {
  title: "Preview — The Back Bar",
};

const SCREENS = [
  {
    href: "/preview/home",
    title: "Home",
    gloss:
      "The masthead, the contents page — navigation reimagined as an editorial index.",
    currentHref: "/",
  },
  {
    href: "/preview/pricing",
    title: "Wholesale pricing",
    gloss:
      "A dense numerical table styled as a weekend-edition data page — hairline rules, tabular figures, no boxes.",
    currentHref: "/finances/pricing",
  },
];

export default function PreviewIndex() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: COLOR.paper,
        color: COLOR.ink,
        fontFamily: FONT.sans,
        padding: "80px 40px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            fontSize: 10,
            color: COLOR.accent,
            marginBottom: 16,
            ...smallCaps,
          }}
        >
          Preview — Proposed editorial direction
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: 56,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            marginBottom: 20,
          }}
        >
          Two sample screens, styled up.
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 20,
            color: COLOR.inkSoft,
            lineHeight: 1.5,
            marginBottom: 48,
            maxWidth: 560,
          }}
        >
          Each preview is a re-skin of an existing page — same data, same logic,
          new typography and hierarchy. Click through, react, and we&apos;ll shape
          the system from there.
        </p>

        <div style={{ borderTop: `1px solid ${COLOR.rule}` }}>
          {SCREENS.map((s) => (
            <div
              key={s.href}
              style={{
                padding: "32px 0",
                borderBottom: `1px solid ${COLOR.rule}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24 }}>
                <div>
                  <h2
                    style={{
                      fontFamily: FONT.serif,
                      fontSize: 28,
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      marginBottom: 6,
                    }}
                  >
                    <Link
                      href={s.href}
                      style={{ color: COLOR.ink, textDecoration: "none" }}
                    >
                      {s.title}
                    </Link>
                  </h2>
                  <p
                    style={{
                      fontFamily: FONT.serif,
                      fontStyle: "italic",
                      fontSize: 16,
                      color: COLOR.muted,
                      lineHeight: 1.45,
                      maxWidth: 520,
                    }}
                  >
                    {s.gloss}
                  </p>
                </div>
                <Link
                  href={s.href}
                  style={{
                    fontSize: 11,
                    color: COLOR.accent,
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    ...smallCaps,
                  }}
                >
                  Open preview →
                </Link>
              </div>
              <p style={{ marginTop: 14, fontSize: 12, color: COLOR.mutedLight }}>
                Compare with the current version at{" "}
                <a
                  href={s.currentHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: COLOR.muted,
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                  }}
                >
                  {s.currentHref}
                </a>
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 48,
            fontSize: 13,
            color: COLOR.muted,
            lineHeight: 1.7,
          }}
        >
          No shipped page has been touched. Fonts: Spectral (serif), Inter (sans),
          JetBrains Mono (tabular). A licensed production build would swap these
          for GT Sectra, Söhne, and Söhne Mono with no code changes.
        </p>
      </div>
    </div>
  );
}
