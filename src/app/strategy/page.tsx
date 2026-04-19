import { Metadata } from 'next'
import Link from 'next/link'

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
    background: '#0a0a0a',
    minHeight: '100vh',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, Arial, sans-serif',
  },
  topBar: {
    borderBottom: '1px solid #1a1a1a',
    padding: '20px 48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  backLink: {
    fontSize: 12,
    color: '#555',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    letterSpacing: 0.3,
  },
  pageTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: '#C9A84C',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  updatedNote: {
    fontSize: 11,
    color: '#444',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    minHeight: 'calc(100vh - 65px)',
  },
  sidebar: {
    borderRight: '1px solid #1a1a1a',
    padding: '32px 0',
    position: 'sticky' as const,
    top: 0,
    height: 'calc(100vh - 65px)',
    overflowY: 'auto' as const,
  },
  sidebarLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#444',
    textTransform: 'uppercase' as const,
    padding: '0 24px',
    marginBottom: 12,
    fontWeight: 600,
  },
  sidebarLink: (active: boolean) => ({
    display: 'block',
    padding: '9px 24px',
    fontSize: 12,
    color: active ? '#C9A84C' : '#666',
    textDecoration: 'none',
    borderLeft: active ? '2px solid #C9A84C' : '2px solid transparent',
    fontWeight: active ? 600 : 400,
    background: active ? '#111' : 'transparent',
    transition: 'color 0.1s',
  }),
  main: {
    padding: '48px 64px',
    maxWidth: 820,
  },
  sectionBlock: {
    marginBottom: 64,
    paddingBottom: 64,
    borderBottom: '1px solid #1a1a1a',
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#555',
    textTransform: 'uppercase' as const,
    fontWeight: 600,
  },
  statusBadge: (status: string) => ({
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 3,
    background: status === 'live' ? '#1e4d2b' : status === 'draft' ? '#2a1e0a' : '#1a1a1a',
    color: status === 'live' ? '#4caf50' : status === 'draft' ? '#FFC107' : '#555',
    border: `1px solid ${status === 'live' ? '#2d7a3a' : status === 'draft' ? '#7a5a00' : '#2a2a2a'}`,
  }),
  dateBadge: {
    fontSize: 10,
    color: '#444',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.3px',
    lineHeight: 1.2,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  body: {
    fontSize: 15,
    lineHeight: 1.8,
    color: '#ccc',
  },
  p: {
    marginBottom: 20,
  },
  highlight: {
    background: '#161610',
    border: '1px solid #2a2a1a',
    borderLeft: '3px solid #C9A84C',
    borderRadius: '0 6px 6px 0',
    padding: '16px 20px',
    margin: '24px 0',
    fontSize: 14,
    color: '#bbb',
    lineHeight: 1.7,
  },
  keyFact: {
    display: 'inline-block',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    padding: '12px 20px',
    margin: '4px',
    textAlign: 'center' as const,
    minWidth: 120,
  },
  keyFactValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#C9A84C',
    display: 'block',
    marginBottom: 2,
  },
  keyFactLabel: {
    fontSize: 10,
    color: '#555',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  factsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    margin: '24px 0',
  },
  plannedBlock: {
    background: '#0f0f0f',
    border: '1px dashed #222',
    borderRadius: 8,
    padding: '32px',
    textAlign: 'center' as const,
    color: '#444',
    fontSize: 13,
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
          wholesale price is calculated as <strong style={{ color: '#C9A84C' }}>COGS × 1.40 + shipping</strong>,
          where COGS reflects the true ingredient cost of each bottled cocktail and shipping covers the per-unit
          fulfilment cost. The 40% markup on cost (equivalent to roughly 28% gross margin) is the minimum needed
          to make wholesale commercially viable, while leaving retailers sufficient room to price at their standard
          30% margin and still land below our RRP including VAT.
        </p>

        <div style={S.highlight}>
          <strong style={{ color: '#C9A84C' }}>The retailer test:</strong> for any wholesale price to be viable,
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
      {/* Top bar */}
      <div style={S.topBar}>
        <Link href="/" style={S.backLink}>
          ← The Back Bar
        </Link>
        <div style={S.pageTitle}>Strategy & Targets</div>
        <div style={S.updatedNote}>
          {liveCount} of {SECTIONS.length} sections written
        </div>
      </div>

      <div style={S.layout}>
        {/* Sidebar nav */}
        <div style={S.sidebar}>
          <div style={S.sidebarLabel}>Sections</div>
          {SECTIONS.map(section => (
            <a
              key={section.id}
              href={`#${section.id}`}
              style={S.sidebarLink(false)}
            >
              {section.label}
              {section.status === 'live' && (
                <span style={{ marginLeft: 6, fontSize: 9, color: '#4caf50' }}>●</span>
              )}
              {section.status === 'planned' && (
                <span style={{ marginLeft: 6, fontSize: 9, color: '#333' }}>○</span>
              )}
            </a>
          ))}
        </div>

        {/* Main content */}
        <div style={S.main}>
          {SECTIONS.map((section, i) => (
            <div
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
                    {section.status === 'live' ? '● Live' : section.status === 'draft' ? '◑ Draft' : '○ Planned'}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
