import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { components, suppliers } from "@/db/schema";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { buttonPrimary } from "../_components/forms";
import CostSourceBadge from "@/components/CostSourceBadge";
import { listIngredients } from "@/lib/erp/ingredients";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  ingredient: "Ingredient",
  sub_recipe: "Sub-recipe",
  dry_good: "Dry good",
  packaging: "Packaging",
};

export default async function ComponentsPage() {
  const rows = await db
    .select({
      id: components.id,
      name: components.name,
      type: components.type,
      uom: components.uom,
      packSize: components.packSize,
      packCost: components.packCost,
      unitCost: components.unitCost,
      reorderThreshold: components.reorderThreshold,
      active: components.active,
      supplierName: suppliers.name,
    })
    .from(components)
    .leftJoin(suppliers, eq(suppliers.id, components.defaultSupplierId))
    .orderBy(asc(components.type), asc(components.name));

  // Source and as-of date come from the newest price-history row, the same
  // read the ingredient register uses, so this list cannot disagree with it.
  const priced = new Map(
    (await listIngredients({ includeInactive: true })).map((i) => [i.id, i]),
  );

  // Group by type for readability — cocktail people think in categories.
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 40px 96px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              marginBottom: 6,
            }}
          >
            Components
          </h1>
          <p style={{ fontSize: 13, color: COLOR.muted }}>
            {rows.length} on file · {rows.filter((r) => r.active).length} active
          </p>
        </div>
        <Link href="/erp/components/new" style={{ ...buttonPrimary, textDecoration: "none" }}>
          New component
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        Object.keys(TYPE_LABELS)
          .filter((t) => grouped[t]?.length)
          .map((t) => (
            <section key={t} style={{ marginBottom: 40 }}>
              <h2
                style={{
                  fontSize: 11,
                  color: COLOR.muted,
                  marginBottom: 10,
                  ...smallCaps,
                }}
              >
                {TYPE_LABELS[t]} · {grouped[t].length}
              </h2>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                  ...tabularNums,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderTop: `2px solid ${COLOR.ink}`,
                      borderBottom: `1px solid ${COLOR.ruleBold}`,
                    }}
                  >
                    <Th>Name</Th>
                    <Th align="right">Pack</Th>
                    <Th align="right">Pack cost</Th>
                    <Th align="right">Unit cost</Th>
                    <Th>Supplier</Th>
                    <Th align="right">Source · as of</Th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[t].map((c) => (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                      <Td>
                        <Link
                          href={`/erp/components/${c.id}`}
                          style={{
                            color: c.active ? COLOR.ink : COLOR.mutedLight,
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {c.name}
                        </Link>
                        {!c.active && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: COLOR.mutedLight, ...smallCaps }}>
                            inactive
                          </span>
                        )}
                      </Td>
                      <Td align="right" muted>
                        {c.packSize ? `${formatPack(c.packSize)}${c.uom}` : <span style={{ color: COLOR.mutedLight }}>—</span>}
                      </Td>
                      <Td align="right">
                        {c.packCost ? `£${Number(c.packCost).toFixed(2)}` : <span style={{ color: COLOR.mutedLight }}>—</span>}
                      </Td>
                      <Td align="right" muted>
                        £{Number(c.unitCost).toFixed(4)}<span style={{ fontSize: 11, color: COLOR.mutedLight }}>/{c.uom}</span>
                      </Td>
                      <Td muted>
                        {c.supplierName || <span style={{ color: COLOR.mutedLight }}>—</span>}
                      </Td>
                      <Td align="right" muted>
                        <CostSourceBadge
                          source={priced.get(c.id)?.provenance}
                          date={priced.get(c.id)?.unitCostSetAt ?? null}
                          fontSize={11}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
      )}
    </main>
  );
}

function formatPack(packSize: string): string {
  // Drop trailing zeros from the numeric stored as string ("700.000" → "700").
  const n = Number(packSize);
  if (!Number.isFinite(n)) return packSize;
  return Number.isInteger(n) ? String(n) : n.toString();
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 10,
        color: COLOR.muted,
        fontWeight: 500,
        ...smallCaps,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  muted,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: "12px",
        textAlign: align,
        color: muted ? COLOR.muted : COLOR.ink,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: `1px dashed ${COLOR.rule}`,
        padding: "48px 24px",
        textAlign: "center",
        color: COLOR.muted,
      }}
    >
      <p style={{ fontFamily: FONT.serif, fontSize: 18, fontStyle: "italic", marginBottom: 16 }}>
        No components yet. Run <code style={{ fontFamily: "var(--font-jetbrains-mono), monospace" }}>npm run db:seed</code>{" "}
        to import the 20-row starter, or add one by hand.
      </p>
      <Link href="/erp/components/new" style={{ ...buttonPrimary, textDecoration: "none" }}>
        Add a component
      </Link>
    </div>
  );
}
