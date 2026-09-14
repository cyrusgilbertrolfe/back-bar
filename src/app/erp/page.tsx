import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { components, suppliers, systemSettings, SETTING_KEYS } from "@/db/schema";
import { COLOR, FONT, smallCaps } from "@/lib/design";

export const dynamic = "force-dynamic";

async function loadCounts() {
  const [supplierCount] = await db.select({ n: sql<number>`count(*)::int` }).from(suppliers);
  const [componentCount] = await db.select({ n: sql<number>`count(*)::int` }).from(components);
  const settings = await db.select().from(systemSettings);
  return {
    suppliers: supplierCount?.n ?? 0,
    components: componentCount?.n ?? 0,
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) as Record<string, string>,
  };
}

export default async function ErpHome() {
  const data = await loadCounts();

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "16px 40px 96px",
      }}
    >
      <p
        style={{
          fontFamily: FONT.serif,
          fontStyle: "italic",
          fontSize: 18,
          color: COLOR.inkSoft,
          maxWidth: 640,
          marginBottom: 36,
          lineHeight: 1.5,
        }}
      >
        The component master and the costing settings underneath every price in the
        business. Scope was cut to costing and pricing on 4 September 2026, so this
        is the bedrock, not a spine still being assembled in slices.
      </p>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          The component master
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: `1px solid ${COLOR.rule}`,
          }}
        >
          <ModuleRow
            href="/erp/suppliers"
            title="Suppliers"
            gloss="Where everything we buy comes from. Nothing entered yet — this becomes useful when inbounds are unparked."
            count={`${data.suppliers}`}
          />
          <ModuleRow
            href="/erp/components"
            title="Components"
            gloss="Every ingredient, sub-recipe, dry good, and packaging item — with current latest cost."
            count={`${data.components}`}
          />
          <ModuleRow
            href="/erp/settings"
            title="Settings"
            gloss={`Wastage ${pctOrDash(data.settings[SETTING_KEYS.WASTAGE_PCT])} · Labour £${data.settings[SETTING_KEYS.LABOUR_RATE_GBP_PER_HOUR] ?? "—"}/hr · Next serial ${data.settings[SETTING_KEYS.NEXT_SERIAL_NUMBER] ?? "—"}`}
            count="3"
          />
        </ul>
      </section>

      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Built, and living elsewhere in the app
        </h2>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: `1px solid ${COLOR.rule}`,
          }}
        >
          <ModuleRow
            href="/drinks"
            title="Recipes (BOM)"
            gloss="27 drinks, 40 recipes, percentages validated to sum to 100."
            count="Make"
          />
          <ModuleRow
            href="/finances/profitability"
            title="Cost rollup"
            gloss="Every SKU costed line by line from latest component costs."
            count="Analyse"
          />
          <ModuleRow
            href="/finances/pricing"
            title="Prices"
            gloss="Agreed wholesale and RRP beside the formula rule price."
            count="Sell"
          />
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Parked — deliberately, not forgotten
        </h2>
        <p
          style={{
            fontSize: 14,
            color: COLOR.muted,
            lineHeight: 1.55,
            maxWidth: 620,
            marginBottom: 18,
          }}
        >
          Scope was cut to costing and pricing on 4 September 2026. These are not in
          progress and nobody is working on them. The batch spreadsheet and paper
          labels continue meanwhile. See the Back Bar roadmap in Lifemaxxing.
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            borderTop: `1px solid ${COLOR.rule}`,
          }}
        >
          <Pending title="Inbounds" gloss="Receive a delivery → updates cost + stock." />
          <Pending title="Production runs + serials" gloss="Run, consume, output batch, issue serials, print labels." />
          <Pending title="Price lists (Owner only)" gloss="Per-channel price list builder + PDF." />
          <Pending title="% revenue by channel" gloss="Blocked on the £92k unclassified QuickBooks bucket, not on code." />
        </ul>
      </section>
    </main>
  );
}

function pctOrDash(raw: string | undefined): string {
  if (!raw) return "—";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function ModuleRow({
  href,
  title,
  gloss,
  count,
}: {
  href: string;
  title: string;
  gloss: string;
  count: string;
}) {
  return (
    <li style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
      <Link
        href={href}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 28,
          alignItems: "baseline",
          padding: "20px 0",
          textDecoration: "none",
          color: COLOR.ink,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: FONT.serif,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            {title}
          </h3>
          <p style={{ fontSize: 14, color: COLOR.muted, lineHeight: 1.45 }}>{gloss}</p>
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 13,
            color: COLOR.muted,
            paddingTop: 6,
          }}
        >
          {count}
        </span>
      </Link>
    </li>
  );
}

function Pending({ title, gloss }: { title: string; gloss: string }) {
  return (
    <li
      style={{
        borderBottom: `1px solid ${COLOR.rule}`,
        padding: "16px 0",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 28,
        alignItems: "baseline",
        color: COLOR.mutedLight,
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: FONT.serif,
            fontSize: 17,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.45 }}>{gloss}</p>
      </div>
      <span style={{ fontSize: 11, ...smallCaps }}>Parked</span>
    </li>
  );
}
