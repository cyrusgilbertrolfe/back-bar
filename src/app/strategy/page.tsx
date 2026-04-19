import { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { COLOR, FONT, smallCaps, tabularNums } from '@/lib/design'

export const metadata: Metadata = {
  title: 'Strategy & Targets — The Back Bar',
  description: 'Myatt\'s Fields Cocktails — strategic direction, goals, and how we are getting there.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Section {
  id: string
  label: string        // short nav label
  title: string        // full section title
  subtitle: string     // one-line descriptor
  status: 'live' | 'draft' | 'planned'
  updatedDate: string
  content: React.ReactNode
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    background: COLOR.paper,
    minHeight: '100vh',
    color: COLOR.ink,
    fontFamily: FONT.sans,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr',
    maxWidth: 1200,
    margin: '0 auto',
  },
  sidebar: {
    padding: '56px 28px 56px 40px',
    position: 'sticky' as const,
    top: 60,
    height: 'calc(100vh - 60px)',
    overflowY: 'auto' as const,
    borderRight: `1px solid ${COLOR.rule}`,
  },
  sidebarLabel: {
    fontSize: 10,
    color: COLOR.muted,
    marginBottom: 14,
    fontWeight: 500,
    ...smallCaps,
  },
  sidebarLink: (active: boolean) => ({
    display: 'block',
    padding: '8px 0',
    fontSize: 13,
    color: active ? COLOR.accent : COLOR.inkSoft,
    textDecoration: 'none',
    fontWeight: active ? 500 : 400,
    fontFamily: FONT.serif,
  }),
  main: {
    padding: '56px 48px 96px',
    maxWidth: 820,
  },
  intro: {
    borderBottom: `1px solid ${COLOR.rule}`,
    paddingBottom: 40,
    marginBottom: 48,
  },
  eyebrow: {
    fontSize: 10,
    color: COLOR.muted,
    marginBottom: 18,
    ...smallCaps,
  },
  pageHeading: {
    fontFamily: FONT.serif,
    fontSize: 'clamp(44px, 6vw, 56px)',
    fontWeight: 400,
    letterSpacing: '-0.025em',
    lineHeight: 1.02,
    marginBottom: 18,
    color: COLOR.ink,
  },
  pageSubtitle: {
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
    fontSize: 18,
    color: COLOR.inkSoft,
    lineHeight: 1.55,
    maxWidth: 680,
    fontWeight: 300,
  },
  sectionBlock: {
    marginBottom: 80,
    paddingBottom: 72,
    borderBottom: `1px solid ${COLOR.rule}`,
  },
  sectionHeader: {
    marginBottom: 28,
  },
  sectionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    flexWrap: 'wrap' as const,
  },
  sectionLabel: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: COLOR.muted,
    letterSpacing: '0.08em',
  },
  statusBadge: (status: string) => ({
    fontSize: 10,
    color:
      status === 'live' ? COLOR.accent : status === 'draft' ? COLOR.accentSoft : COLOR.mutedLight,
    ...smallCaps,
  }),
  dateBadge: {
    fontSize: 10,
    color: COLOR.mutedLight,
    ...smallCaps,
  },
  sectionTitle: {
    fontFamily: FONT.serif,
    fontSize: 32,
    fontWeight: 500,
    color: COLOR.ink,
    letterSpacing: '-0.015em',
    lineHeight: 1.15,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
    fontSize: 15,
    color: COLOR.muted,
    lineHeight: 1.55,
  },
  body: {
    fontFamily: FONT.serif,
    fontSize: 17,
    lineHeight: 1.75,
    color: COLOR.inkSoft,
  },
  p: {
    marginBottom: 20,
  },
  highlight: {
    borderLeft: `3px solid ${COLOR.accent}`,
    padding: '8px 0 8px 18px',
    margin: '28px 0',
    fontFamily: FONT.serif,
    fontSize: 16,
    color: COLOR.inkSoft,
    lineHeight: 1.7,
    fontStyle: 'italic' as const,
  },
  keyFact: {
    display: 'inline-block',
    padding: '12px 20px',
    textAlign: 'center' as const,
    minWidth: 100,
  },
  keyFactValue: {
    fontFamily: FONT.serif,
    fontSize: 28,
    fontWeight: 400,
    color: COLOR.ink,
    display: 'block',
    marginBottom: 2,
    letterSpacing: '-0.01em',
    ...tabularNums,
  },
  keyFactLabel: {
    fontSize: 10,
    color: COLOR.muted,
    ...smallCaps,
  },
  factsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 24,
    margin: '32px 0',
    borderTop: `1px solid ${COLOR.rule}`,
    borderBottom: `1px solid ${COLOR.rule}`,
    padding: '20px 0',
  },
  plannedBlock: {
    borderTop: `1px solid ${COLOR.rule}`,
    borderBottom: `1px solid ${COLOR.rule}`,
    padding: '40px 24px',
    textAlign: 'center' as const,
    color: COLOR.muted,
    fontSize: 14,
    fontFamily: FONT.serif,
    fontStyle: 'italic' as const,
  },
}

// ─── Content sections ─────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'wholesale-pricing',
    label: 'Wholesale Pricing',
    title: 'Wholesale Pricing Strategy',
    subtitle: 'How we arrived at a cost-forward model and what it changes',
    status: 'live',
    updatedDate: 'April 2026',
    content: (
      <div style={S.body}>
        <p style={S.p}>
          For most of Myatt&apos;s Fields&apos; history, wholesale pricing was set reactively — working backwards
          from RRP using a fixed margin formula that bore no systematic relationship to the actual cost of making
          each cocktail. As the range grew and ingredient costs fluctuated, this left pricing inconsistent across
          the catalogue and made it impossible to know, at a glance, whether a given product was generating a
          sustainable return at wholesale.
        </p>

        <p style={S.p}>
          In April 2026, we built a single source of truth for pricing. The approach is cost-forward: every
          wholesale price is calculated as <strong style={{ color: COLOR.accent }}>COGS × 1.40 + shipping</strong>,
          where COGS reflects the true ingredient cost of each bottled cocktail and shipping covers the per-unit
          fulfilment cost. The 40% markup on cost (equivalent to roughly 28% gross margin) is the minimum needed
          to make wholesale commercially viable, while leaving retailers sufficient room to price at their standard
          30% margin and still land below our RRP including VAT.
        </p>

        <div style={S.highlight}>
          <strong style={{ color: COLOR.accent }}>The retailer test:</strong> for any wholesale price to be viable,
          Wholesale × 1.30 (retailer margin) × 1.20 (VAT) must be ≤ RRP. If a retailer cannot mark our product
          up to their standard margin and still price it below our own RRP, they will not stock it — or they will
          discount it in ways that undercut us online.
        </div>

        <p style={S.p}>
          In building this model, we audited all 34 active SKUs, discontinued four defunct products (Kecello,
          Limoncello, and Yuzu Negroni), and updated RRPs across 12 products where the previous price was too
          low to support the formula. The largest change was the Manhattan 500ml, which moved from £38.50 to
          £41.00, reflecting its award-winning status and the genuine cost of the rye and vermouth that go into it.
        </p>

        <div style={S.factsRow}>
          {[
            { value: '29', label: 'Active SKUs' },
            { value: '40%', label: 'Markup on COGS' },
            { value: '29/29', label: 'Pass retailer test' },
            { value: '12', label: 'RRPs updated' },
            { value: '4', label: 'SKUs discontinued' },
          ].map(({ value, label }) => (
            <div key={label} style={S.keyFact}>
              <span style={S.keyFactValue}>{value}</span>
              <span style={S.keyFactLabel}>{label}</span>
            </div>
          ))}
        </div>

        <p style={S.p}>
          The result is 29 SKUs with confirmed wholesale prices, all of which pass the retailer test, and a live
          pricing module in The Back Bar where COGS can be updated as ingredient costs change — with the impact
          flowing through to wholesale prices instantly. This moves pricing from a periodic, manual exercise
          to a live business tool.
        </p>

        <p style={{ ...S.p, marginBottom: 0 }}>
          The next step is to use these confirmed prices as the basis for our first proactive wholesale
          outreach campaign — the 500-unit gift box campaign targeting florists, corporates, delis, and gift
          shops ahead of the 2027 rebrand.
        </p>
      </div>
    ),
  },
  {
    id: 'wholesale-growth',
    label: 'Wholesale Growth',
    title: 'Wholesale Growth Strategy',
    subtitle: 'Box campaign, new accounts, and moving from reactive to proactive',
    status: 'planned',
    updatedDate: 'Coming soon',
    content: null,
  },
  {
    id: 'dtc',
    label: 'Direct to Consumer',
    title: 'Direct to Consumer',
    subtitle: 'Shopify, Amazon, and the DTC channel strategy',
    status: 'planned',
    updatedDate: 'Coming soon',
    content: null,
  },
  {
    id: 'rebrand',
    label: '2027 Rebrand',
    title: '2027 Rebrand',
    subtitle: 'Planning the next chapter of the brand',
    status: 'planned',
    updatedDate: 'Coming soon',
    content: null,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const liveCount = SECTIONS.filter(s => s.status === 'live').length

  return (
    <div style={S.page}>
      <Nav />
      <div style={S.layout} className="strategy-layout">
        <aside style={S.sidebar} className="strategy-sidebar">
          <div style={S.sidebarLabel}>Sections</div>
          {SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              style={S.sidebarLink(false)}
            >
              {section.label}
              {section.status === 'live' && (
                <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.accent }}>●</span>
              )}
              {section.status === 'planned' && (
                <span style={{ marginLeft: 8, fontSize: 9, color: COLOR.mutedLight }}>○</span>
              )}
            </a>
          ))}
        </aside>

        <main style={S.main} className="strategy-main">
          <div style={S.intro}>
            <p style={S.eyebrow}>Strategy & targets</p>
            <h1 style={S.pageHeading}>Direction & goals</h1>
            <p style={S.pageSubtitle}>
              {liveCount} of {SECTIONS.length} sections written — how we are pricing,
              growing wholesale, and getting to the 2027 rebrand.
            </p>
          </div>

          {SECTIONS.map((section, i) => (
            <section
              key={section.id}
              id={section.id}
              style={i < SECTIONS.length - 1 ? S.sectionBlock : { marginBottom: 0 }}
            >
              <div style={S.sectionHeader}>
                <div style={S.sectionMeta}>
                  <span style={S.sectionLabel}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={S.statusBadge(section.status)}>
                    {section.status === 'live'
                      ? 'Live'
                      : section.status === 'draft'
                      ? 'Draft'
                      : 'Planned'}
                  </span>
                  <span style={S.dateBadge}>{section.updatedDate}</span>
                </div>
                <div style={S.sectionTitle}>{section.title}</div>
                <div style={S.sectionSubtitle}>{section.subtitle}</div>
              </div>

              {section.content ?? (
                <div style={S.plannedBlock}>
                  This section will be added after we work through it together.
                </div>
              )}
            </section>
          ))}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .strategy-layout { grid-template-columns: 1fr !important; }
          .strategy-sidebar {
            position: static !important;
            height: auto !important;
            border-right: none !important;
            border-bottom: 1px solid ${COLOR.rule} !important;
            padding: 24px 20px !important;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
          }
          .strategy-main { padding: 32px 20px 64px !important; }
        }
      `}</style>
    </div>
  )
}
