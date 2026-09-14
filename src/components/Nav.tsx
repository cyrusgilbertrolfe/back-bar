"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLOR, FONT } from "@/lib/design";

export type NavSection = {
  label: string;
  href: string;
  /** Paths (startsWith) that should highlight this section as active. */
  match: string[];
};

/**
 * The four surfaces. Cyrus, 4 Sept 2026: "Back Bar is to keep track of make,
 * sell, buy, and analyse, and those are four different surfaces for the
 * business." The nav is those four and nothing else, so the top of the app
 * states the model rather than listing whatever happened to get built.
 *
 * Each `match` list carries the older routes that surface absorbed, so a
 * bookmark or a deep link still highlights the right section. The old hub
 * pages (/finances, /production, /sales) still work; they are simply no
 * longer the way in. See docs/roadmap.md.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Buy",
    href: "/buy",
    match: ["/buy", "/erp", "/finances/ingredients"],
  },
  {
    label: "Make",
    href: "/make",
    match: ["/make", "/drinks", "/recipes", "/calculator", "/production"],
  },
  {
    label: "Sell",
    href: "/sell",
    match: ["/sell", "/sales", "/finances/pricing", "/finances/rrp"],
  },
  {
    label: "Analyse",
    href: "/analyse",
    match: [
      "/analyse",
      "/dashboard",
      "/strategy",
      "/finances/pnl",
      "/finances/profitability",
      "/finances",
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  // Longest match wins, so /finances/ingredients lands on Buy rather than on
  // Analyse's catch-all /finances.
  const best = NAV_SECTIONS.flatMap((s) =>
    s.match
      .filter((m) => path === m || path.startsWith(m + "/"))
      .map((m) => ({ href: s.href, len: m.length })),
  ).sort((a, b) => b.len - a.len)[0];
  const sections = NAV_SECTIONS;

  return (
    <nav
      className="no-print sticky top-0 z-50"
      style={{
        background: "rgba(245, 241, 234, 0.92)",
        borderBottom: `1px solid ${COLOR.rule}`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="nav-inner"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
      >
        <Link
          href="/"
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
              width: 22,
              height: 22,
              objectFit: "contain",
              opacity: 0.85,
              filter: "invert(0.12)",
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

        <div
          className="nav-sections"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
            overflowX: "auto",
          }}
        >
          {sections.map((s) => {
            const active = best?.href === s.href;
            return (
              <NavLink key={s.href} href={s.href} active={active}>
                {s.label}
              </NavLink>
            );
          })}
        </div>

        <NavLink href="/settings" active={path === "/settings"} muted>
          Settings
        </NavLink>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .nav-inner { gap: 12px !important; padding: 0 16px !important; }
          .nav-inner > a > span { display: none !important; }
          .nav-sections { gap: 0 !important; flex-wrap: nowrap !important; }
          .nav-sections a { padding: 6px 8px !important; font-size: 12px !important; }
        }
        .nav-sections::-webkit-scrollbar { display: none; }
      `}</style>
    </nav>
  );
}

function NavLink({
  href,
  active,
  muted,
  children,
}: {
  href: string;
  active: boolean;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        color: active ? COLOR.accent : muted ? COLOR.mutedLight : COLOR.inkSoft,
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        whiteSpace: "nowrap",
        borderBottom: active ? `1px solid ${COLOR.accent}` : "1px solid transparent",
        paddingBottom: 5,
      }}
    >
      {children}
    </Link>
  );
}
