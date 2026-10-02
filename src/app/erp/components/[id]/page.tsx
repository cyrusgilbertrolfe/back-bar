import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { components, suppliers, componentPriceHistory } from "@/db/schema";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import CostSourceBadge from "@/components/CostSourceBadge";
import { ComponentFormBody } from "../_form";
import { buttonGhost } from "../../_components/forms";
import { updateComponent, setComponentActive } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditComponentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number.parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const [component] = await db.select().from(components).where(eq(components.id, id)).limit(1);
  if (!component) notFound();

  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.active, true))
    .orderBy(asc(suppliers.name));

  const history = await db
    .select()
    .from(componentPriceHistory)
    .where(eq(componentPriceHistory.componentId, id))
    .orderBy(desc(componentPriceHistory.effectiveDate), desc(componentPriceHistory.id))
    .limit(20);

  const updateAction = updateComponent.bind(null, id);
  const toggleActive = async () => {
    "use server";
    await setComponentActive(id, !component.active);
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 40px 96px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>
          {component.name}
        </h1>
        <span style={{ fontSize: 11, color: component.active ? COLOR.positive : COLOR.mutedLight, ...smallCaps }}>
          {component.active ? "Active" : "Inactive"}
        </span>
      </div>

      <form action={updateAction}>
        <ComponentFormBody component={component} suppliers={supplierRows} />
      </form>

      <hr style={{ margin: "40px 0 24px", border: "none", borderTop: `1px solid ${COLOR.rule}` }} />

      <h2 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 12, ...smallCaps }}>
        Price history · {history.length}
      </h2>
      {history.length === 0 ? (
        <p style={{ fontSize: 13, color: COLOR.mutedLight, fontStyle: "italic", marginBottom: 24 }}>
          No price-history entries yet.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 32, ...tabularNums }}>
          <thead>
            <tr style={{ borderTop: `1px solid ${COLOR.ruleBold}`, borderBottom: `1px solid ${COLOR.rule}` }}>
              <th style={th()}>Date</th>
              <th style={th("right")}>Unit cost</th>
              <th style={th()}>Source</th>
              <th style={th()}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td style={td()}>{h.effectiveDate}</td>
                <td style={td("right")}>£{Number(h.unitCost).toFixed(4)}</td>
                <td style={td()}>
                  <CostSourceBadge source={h.source} date={h.effectiveDate} fontSize={11} />
                </td>
                <td style={td()}>
                  <span style={{ color: COLOR.muted }}>{h.notes ?? "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={toggleActive}>
        <button
          type="submit"
          style={{
            ...buttonGhost,
            color: component.active ? COLOR.flag : COLOR.positive,
            borderColor: component.active ? COLOR.flagSoft : COLOR.positive,
          }}
        >
          {component.active ? "Deactivate component" : "Reactivate component"}
        </button>
        <p style={{ marginTop: 10, fontSize: 12, color: COLOR.muted }}>
          Deactivating hides the component from new recipes and inbounds. Existing recipes and lots
          are preserved.
        </p>
      </form>

      <p style={{ marginTop: 32, fontSize: 11, color: COLOR.mutedLight, ...smallCaps }}>
        Created {component.createdAt.toISOString().slice(0, 10)} · Updated{" "}
        {component.updatedAt.toISOString().slice(0, 10)}
      </p>
    </main>
  );
}

function th(align: "left" | "right" = "left"): React.CSSProperties {
  return {
    textAlign: align,
    padding: "8px 10px",
    fontSize: 10,
    color: COLOR.muted,
    fontWeight: 500,
    ...smallCaps,
  };
}
function td(align: "left" | "right" = "left"): React.CSSProperties {
  return { padding: "10px", textAlign: align, color: COLOR.ink, verticalAlign: "top" };
}
