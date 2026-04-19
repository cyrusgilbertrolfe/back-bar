import Link from "next/link";
import PreviewFrame from "../PreviewFrame";
import { COLOR, FONT, smallCaps } from "../preview-theme";

export const metadata = {
  title: "Home — Preview — The Back Bar",
};

type ModuleEntry = {
  number: string;
  href: string;
  title: string;
  gloss: string;
  status: "live" | "planned";
};

const MODULES: ModuleEntry[] = [
  {
    number: "01",
    href: "/strategy",
    title: "Strategy",
    gloss:
      "Where we are going and how we plan to get there — pricing, wholesale growth, and the 2027 rebrand.",
    status: "live",
  },
  {
    number: "02",
    href: "/finances",
    title: "Finances",
    gloss:
      "Revenue, wholesale pricing, channel profitability, audit — and the live read on where the business makes money.",
    status: "live",
  },
  {
    number: "03",
    href: "/production",
    title: "Production",
    gloss:
      "Batching, recipe ratios, inventory, and stock audit — the operational side of making cocktails.",
    status: "live",
  },
  {
    number: "04",
    href: "/sales",
    title: "Sales",
    gloss:
      "Wholesale accounts, caterers, Amazon, and the CRM about to be built.",
    status: "planned",
  },
  {
    number: "05",
    href: "/drinks",
    title: "Drinks",
    gloss:
      "Recipes, the active range, photography, content plan, and new product development.",
    status: "planned",
  },
];

export default function PreviewHome() {
  return (
    <PreviewFrame currentHref="/" currentLabel="home">
      <main
        className="preview-home-main"
        style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 40px 120px" }}
      >
        {/* Masthead */}
        <section style={{ borderBottom: `1px solid ${COLOR.rule}`, paddingBottom: 56, marginBottom: 56 }}>
          <p
            style={{
              fontSize: 10,
              color: COLOR.accent,
              marginBottom: 24,
              ...smallCaps,
            }}
          >
            Myatt&apos;s Fields Cocktails · Operations & Strategy
          </p>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: "clamp(64px, 9vw, 112px)",
              fontWeight: 400,
              letterSpacing: "-0.035em",
              lineHeight: 0.96,
              marginBottom: 24,
              color: COLOR.ink,
            }}
          >
            The Back Bar
          </h1>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 22,
              color: COLOR.inkSoft,
              lineHeight: 1.5,
              maxWidth: 640,
              fontWeight: 300,
            }}
          >
            A working journal of what Myatt&apos;s Fields makes, sells, and plans —
            kept for the small number of people who run it.
          </p>
        </section>

        {/* Contents */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 28,
            }}
          >
            <h2
              style={{
                fontSize: 11,
                color: COLOR.muted,
                ...smallCaps,
              }}
            >
              In this issue — five sections
            </h2>
            <span
              style={{
                fontSize: 11,
                color: COLOR.mutedLight,
                ...smallCaps,
              }}
            >
              Last updated 18 April 2026
            </span>
          </div>

          <ol style={{ borderTop: `2px solid ${COLOR.ink}`, listStyle: "none", padding: 0, margin: 0 }}>
            {MODULES.map((m) => (
              <li key={m.href} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <Link
                  href={m.href}
                  className="group preview-home-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "64px 1fr auto",
                    alignItems: "baseline",
                    gap: 28,
                    padding: "28px 0 26px",
                    textDecoration: "none",
                    color: COLOR.ink,
                    transition: "color 120ms ease",
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      color: COLOR.muted,
                      letterSpacing: "0.08em",
                      paddingTop: 10,
                    }}
                  >
                    {m.number}
                  </span>
                  <div>
                    <h3
                      className="group-hover:text-[color:var(--accent)]"
                      style={{
                        fontFamily: FONT.serif,
                        fontSize: 32,
                        fontWeight: 500,
                        letterSpacing: "-0.015em",
                        lineHeight: 1.1,
                        marginBottom: 8,
                      }}
                    >
                      {m.title}
                    </h3>
                    <p
                      style={{
                        fontFamily: FONT.serif,
                        fontStyle: "italic",
                        fontSize: 17,
                        color: COLOR.muted,
                        lineHeight: 1.45,
                        maxWidth: 640,
                      }}
                    >
                      {m.gloss}
                    </p>
                  </div>
                  <StatusTag status={m.status} />
                </Link>
              </li>
            ))}
          </ol>

          {/* Colophon / legend */}
          <div
            style={{
              marginTop: 48,
              display: "flex",
              gap: 28,
              fontSize: 12,
              color: COLOR.muted,
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Dot filled />
              <span style={smallCaps}>Live — in daily use</span>
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Dot />
              <span style={smallCaps}>Planned — on the list, not yet built</span>
            </span>
          </div>
        </section>
      </main>

      <style>{`
        @media (max-width: 720px) {
          .preview-home-main { padding: 40px 20px 80px !important; }
          .preview-home-row { grid-template-columns: 40px 1fr !important; gap: 14px !important; }
          .preview-home-row > :last-child { grid-column: 2 / -1; padding-top: 8px !important; }
        }
      `}</style>

      {/* Footer note — editorial signature */}
      <footer
        style={{
          borderTop: `1px solid ${COLOR.rule}`,
          padding: "32px 40px",
          maxWidth: 1040,
          margin: "0 auto",
          fontSize: 12,
          color: COLOR.mutedLight,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={smallCaps}>Myatt&apos;s Fields Cocktails · London SE5</span>
        <span style={{ fontFamily: FONT.serif, fontStyle: "italic" }}>
          Internal — not for circulation.
        </span>
      </footer>
    </PreviewFrame>
  );
}

function StatusTag({ status }: { status: "live" | "planned" }) {
  const isLive = status === "live";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: isLive ? COLOR.accent : COLOR.mutedLight,
        paddingTop: 12,
        whiteSpace: "nowrap",
        ...smallCaps,
      }}
    >
      <Dot filled={isLive} />
      {isLive ? "Live" : "Planned"}
    </span>
  );
}

function Dot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: filled ? COLOR.accent : "transparent",
        border: `1px solid ${filled ? COLOR.accent : COLOR.ruleBold}`,
      }}
    />
  );
}
