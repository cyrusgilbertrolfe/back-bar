import Nav from "@/components/Nav";
import Link from "next/link";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export type HubModule = {
  href: string;
  label: string;
  sublabel: string;
  description: string;
  status: "live" | "building" | "soon";
};

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  modules: HubModule[];
};

export default function HubPage({ eyebrow, title, intro, modules }: Props) {
  const liveCount = modules.filter((m) => m.status === "live").length;
  const plannedCount = modules.length - liveCount;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main
        className="hub-main"
        style={{ maxWidth: 1040, margin: "0 auto", padding: "64px 40px 120px" }}
      >
        {/* Masthead */}
        <section
          style={{
            borderBottom: `1px solid ${COLOR.rule}`,
            paddingBottom: 48,
            marginBottom: 48,
          }}
        >
          <p style={{ fontSize: 10, color: COLOR.accent, marginBottom: 18, ...smallCaps }}>
            {eyebrow}
          </p>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: "clamp(48px, 7vw, 72px)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              marginBottom: 20,
              color: COLOR.ink,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 19,
              color: COLOR.inkSoft,
              lineHeight: 1.55,
              maxWidth: 680,
              fontWeight: 300,
            }}
          >
            {intro}
          </p>
        </section>

        {/* Contents list */}
        <section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 20,
              flexWrap: "wrap",
              rowGap: 8,
            }}
          >
            <h2 style={{ fontSize: 11, color: COLOR.muted, ...smallCaps }}>
              In this section — {liveCount} live, {plannedCount} planned
            </h2>
          </div>

          <ol
            style={{
              borderTop: `2px solid ${COLOR.ink}`,
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {modules.map((m, i) => (
              <li key={m.href} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <HubRow module={m} index={i + 1} />
              </li>
            ))}
          </ol>
        </section>
      </main>

      <style>{`
        @media (max-width: 720px) {
          .hub-main { padding: 40px 20px 80px !important; }
          .hub-row { grid-template-columns: 40px 1fr !important; gap: 14px !important; }
          .hub-row > :last-child { grid-column: 2 / -1; padding-top: 8px !important; }
        }
      `}</style>
    </div>
  );
}

function HubRow({ module: m, index }: { module: HubModule; index: number }) {
  const isLive = m.status === "live";
  const number = String(index).padStart(2, "0");

  const inner = (
    <>
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 12,
          color: COLOR.muted,
          letterSpacing: "0.08em",
          paddingTop: 8,
        }}
      >
        {number}
      </span>
      <div>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>
          {m.sublabel}
        </p>
        <h3
          style={{
            fontFamily: FONT.serif,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            marginBottom: 8,
            color: isLive ? COLOR.ink : COLOR.inkSoft,
          }}
        >
          {m.label}
        </h3>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 16,
            color: COLOR.muted,
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          {m.description}
        </p>
      </div>
      <StatusTag status={m.status} />
    </>
  );

  const baseStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "56px 1fr auto",
    alignItems: "baseline",
    gap: 28,
    padding: "26px 0 24px",
    textDecoration: "none",
    color: COLOR.ink,
  };

  if (isLive) {
    return (
      <Link href={m.href} className="hub-row" style={baseStyle}>
        {inner}
      </Link>
    );
  }
  return (
    <div className="hub-row" style={{ ...baseStyle, opacity: 0.82 }}>
      {inner}
    </div>
  );
}

function StatusTag({ status }: { status: "live" | "building" | "soon" }) {
  const config = {
    live: { color: COLOR.accent, label: "Live", filled: true },
    building: { color: COLOR.accentSoft, label: "In progress", filled: true },
    soon: { color: COLOR.mutedLight, label: "Planned", filled: false },
  }[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: config.color,
        paddingTop: 10,
        whiteSpace: "nowrap",
        ...smallCaps,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.filled ? config.color : "transparent",
          border: `1px solid ${config.color}`,
        }}
      />
      {config.label}
    </span>
  );
}
