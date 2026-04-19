import Link from "next/link";
import { COLOR, FONT, smallCaps } from "./preview-theme";

/**
 * Frame wrapper used by every /preview page — sets the cream background,
 * loads Spectral/Inter/JetBrains Mono via layout-level font variables,
 * and paints a minimal top bar + banner linking back to the current treatment.
 */
export default function PreviewFrame({
  children,
  currentHref,
  currentLabel,
}: {
  children: React.ReactNode;
  /** The live (current treatment) URL this preview is modelled on. */
  currentHref: string;
  currentLabel: string;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: COLOR.paper,
        color: COLOR.ink,
        fontFamily: FONT.sans,
        fontSize: 16,
        lineHeight: 1.55,
      }}
    >
      {/* Preview banner — always at the top, makes it unmistakable this is a proposal */}
      <div
        className="preview-banner"
        style={{
          background: COLOR.ink,
          color: COLOR.paper,
          padding: "9px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          rowGap: 6,
          fontSize: 11,
          ...smallCaps,
        }}
      >
        <span>Preview — proposed editorial direction</span>
        <span style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href="/preview"
            style={{ color: COLOR.paper, opacity: 0.7, textDecoration: "none" }}
          >
            All preview screens
          </Link>
          <a
            href={currentHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: COLOR.paper,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              textDecorationThickness: 1,
            }}
          >
            Compare with current — {currentLabel} ↗
          </a>
        </span>
      </div>

      {/* Top bar — thin, editorial */}
      <header
        className="preview-header"
        style={{
          borderBottom: `1px solid ${COLOR.rule}`,
          padding: "16px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link
          href="/preview"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: COLOR.ink,
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/MFC Logo - Standard.png"
            alt="MFC"
            style={{
              width: 24,
              height: 24,
              objectFit: "contain",
              opacity: 0.9,
              filter: "invert(0.85) sepia(0.2) saturate(0.5) hue-rotate(15deg)",
            }}
          />
          <span
            style={{
              fontFamily: FONT.serif,
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            The Back Bar
          </span>
        </Link>
        <nav
          className="preview-nav"
          style={{ display: "flex", gap: 28, fontSize: 13, color: COLOR.inkSoft }}
        >
          {["Strategy", "Finances", "Production", "Sales", "Drinks"].map((label) => (
            <span key={label} style={{ cursor: "default" }}>
              {label}
            </span>
          ))}
        </nav>
        <span
          className="preview-issue"
          style={{
            fontSize: 10,
            color: COLOR.muted,
            flexShrink: 0,
            ...smallCaps,
          }}
        >
          Issue 01 · April 2026
        </span>
      </header>

      {children}

      <style>{`
        @media (max-width: 720px) {
          .preview-header { padding: 12px 20px !important; }
          .preview-nav, .preview-issue { display: none !important; }
          .preview-banner { padding: 8px 20px !important; font-size: 10px !important; }
        }
      `}</style>
    </div>
  );
}
