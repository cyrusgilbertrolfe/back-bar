"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export type NavSection = {
  label: string;
  href: string;
  /** Paths (startsWith) that should highlight this section as active. */
  match: string[];
};

export const NAV_SECTIONS: NavSection[] = [
  { label: "Strategy", href: "/strategy", match: ["/strategy"] },
  { label: "Finances", href: "/finances", match: ["/finances", "/dashboard"] },
  { label: "Production", href: "/production", match: ["/production", "/calculator"] },
  { label: "Sales", href: "/sales", match: ["/sales"] },
  { label: "Drinks", href: "/drinks", match: ["/drinks", "/recipes"] },
];

export default function Nav() {
  const path = usePathname();

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
          {NAV_SECTIONS.map((s) => {
            const active = s.match.some((m) => path === m || path.startsWith(m + "/"));
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
