import { buttonGhost } from "@/app/erp/_components/forms";
import { COLOR } from "@/lib/design";
import { materialStatusLabel, type MaterialRow } from "@/lib/erp/order-materials";
import { needText, packText, shortName, type Requirements } from "@/lib/erp/order-requirements";
import { addRequirement } from "../actions";

const money = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cell = { padding: "8px 12px 8px 0", borderTop: `1px solid ${COLOR.rule}`, verticalAlign: "top" as const };
const head = { ...cell, borderTop: "none", fontSize: 12, fontWeight: 400, color: COLOR.muted, textAlign: "left" as const };
const right = { textAlign: "right" as const };

export function RequirementsTable({
  orderId,
  requirements: r,
  materials,
}: {
  orderId: number;
  requirements: Requirements;
  materials: MaterialRow[];
}) {
  if (r.items.length === 0 && r.unmatched.length === 0 && r.problems.length === 0) return null;
  const onList = new Map(materials.filter((m) => m.status !== "cancelled" && m.componentId !== null).map((m) => [m.componentId, m]));
  const margin = r.goodsValue && r.goodsValue > 0 ? ((r.goodsValue - r.total) / r.goodsValue) * 100 : null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>What this order needs</h3>
      <p style={{ fontSize: 13, color: COLOR.muted, margin: "0 0 8px" }}>
        Worked out from the recipe and bill of materials. Liquid includes {Number((r.wastagePct * 100).toFixed(1))}% wastage. Stock is not recorded yet, so check what we have and add what needs buying.
      </p>
      {r.problems.map((p) => <p key={p} role="alert" style={{ fontSize: 13, color: COLOR.flag, margin: "0 0 4px" }}>{p}</p>)}
      {r.unmatched.map((u) => <p key={u} role="alert" style={{ fontSize: 13, color: COLOR.flag, margin: "0 0 4px" }}>Not worked out, no product on the line: {u}</p>)}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={head}>Item</th>
              <th style={{ ...head, ...right }}>Need</th>
              <th style={{ ...head, ...right }}>Cost</th>
              <th style={head}>In stock</th>
              <th style={head} />
            </tr>
          </thead>
          <tbody>
            {r.items.map((i) => {
              const listed = onList.get(i.componentId);
              const pack = packText(i);
              return (
                <tr key={i.componentId}>
                  <td style={cell}>
                    {shortName(i.name)}
                    {i.madeHere && <div style={{ fontSize: 12, color: COLOR.muted }}>We make this</div>}
                    {i.usedIn.length > 0 && <div style={{ fontSize: 12, color: COLOR.muted }}>For {[...new Set(i.usedIn)].join(", ")}</div>}
                  </td>
                  <td style={{ ...cell, ...right, whiteSpace: "nowrap" }}>
                    {needText(i)}
                    {pack && <div style={{ fontSize: 12, color: COLOR.muted }}>{pack}</div>}
                  </td>
                  <td style={{ ...cell, ...right }}>{i.cost === null ? "" : money(i.cost)}</td>
                  <td style={{ ...cell, color: COLOR.muted }}>{i.suppliedByCustomer ? "Customer supplies" : i.madeHere ? "" : "Don't know"}</td>
                  <td style={{ ...cell, ...right }}>
                    {listed ? (
                      <span style={{ fontSize: 12, color: COLOR.muted }}>{materialStatusLabel(listed.status)}</span>
                    ) : !i.suppliedByCustomer && !i.madeHere ? (
                      <form action={addRequirement.bind(null, orderId, i.componentId)}>
                        <button type="submit" style={{ ...buttonGhost, padding: "6px 10px", whiteSpace: "nowrap" }}>To order</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 14, marginTop: 8 }}>
        Cost of goods {money(r.total)}
        <span style={{ color: COLOR.muted }}>
          {" "}including {money(r.wastage)} wastage{r.eprCost > 0 ? ` and ${money(r.eprCost)} EPR` : ""}
          {margin !== null ? ` · ${margin.toFixed(0)}% margin on ${money(r.goodsValue!)}` : ""}
        </span>
      </div>
    </div>
  );
}
