import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT } from "@/lib/design";

/**
 * The home page is the four surfaces and nothing else (13 Sept 2026). Cyrus
 * asked for it "clean and crisp": no masthead copy, no section count, no
 * legend, no footer. The order follows the work itself — buy the ingredients,
 * make the drinks, sell them, see whether it worked — and the top nav uses the
 * same order. Each surface's detail lives on its own hub page.
 */
const SURFACES = [
  { href: "/buy", title: "Buy", line: "What we buy, and what it costs" },
  { href: "/make", title: "Make", line: "What each drink is made of" },
  { href: "/sell", title: "Sell", line: "What we sell, and at what price" },
  { href: "/analyse", title: "Analyse", line: "Whether it's working" },
] as const;

export default function Home() {
  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="home-main"
        style={{ maxWidth: 960, margin: "0 auto", padding: "64px 40px 96px" }}
      >
        <h1 className="sr-only">The Back Bar</h1>
        <ul
          className="home-grid"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {SURFACES.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="home-tile"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 32,
                  minHeight: 220,
                  padding: "28px 32px",
                  border: `1px solid ${COLOR.rule}`,
                  background: COLOR.paper,
                  color: COLOR.ink,
                  textDecoration: "none",
                }}
              >
                <span
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: "clamp(40px, 6vw, 64px)",
                    fontWeight: 500,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  {s.title}
                </span>
                <span
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: 15, color: COLOR.muted, lineHeight: 1.4 }}>
                    {s.line}
                  </span>
                  <span aria-hidden className="home-arrow" style={{ fontSize: 18, color: COLOR.accent }}>
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <style>{`
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
        }
        .home-tile { transition: background-color 0.15s ease, border-color 0.15s ease; }
        .home-tile:hover {
          background: ${COLOR.paperDeep} !important;
          border-color: ${COLOR.ruleBold} !important;
        }
        .home-tile:focus-visible { outline: 2px solid ${COLOR.accent}; outline-offset: 2px; }
        .home-arrow { transition: transform 0.15s ease; }
        .home-tile:hover .home-arrow { transform: translateX(4px); }
        @media (max-width: 640px) {
          .home-main { padding: 32px 16px 64px !important; }
          .home-grid { grid-template-columns: 1fr !important; }
          .home-tile { min-height: 140px !important; padding: 22px 24px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .home-tile, .home-arrow { transition: none; }
        }
      `}</style>
    </div>
  );
}
