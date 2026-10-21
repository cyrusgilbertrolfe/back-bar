import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import Nav from "@/components/Nav";
import { db } from "@/db";
import { skus } from "@/db/schema";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import { gbp } from "@/lib/erp/rollup";
import { bulkOptions, KIND_LABEL, KIND_ORDER, valueCount, type ValuedLine } from "@/lib/erp/stock-count";
import { buttonGhost, buttonPrimary, inputStyle, labelStyle } from "@/app/erp/_components/forms";
import { addLine, close, reopen, updateCountDetails } from "../actions";
import { LineRow } from "./_LineRow";

export const dynamic = "force-dynamic";

const SHOW = [
  { key: "all", label: "Everything" },
  { key: "uncounted", label: "Not counted" },
  { key: "counted", label: "Counted" },
] as const;

const th = {
  textAlign: "left" as const,
  fontSize: 10,
  color: COLOR.muted,
  padding: "8px",
  borderBottom: `1px solid ${COLOR.ruleBold}`,
  fontWeight: 400,
  ...smallCaps,
};

function groupBy(lines: ValuedLine[]): [string, ValuedLine[]][] {
  const m = new Map<string, ValuedLine[]>();
  for (const l of lines) m.set(l.group, [...(m.get(l.group) ?? []), l]);
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([g, ls]) => [g, ls.sort((a, b) => a.name.localeCompare(b.name) || a.line.location.localeCompare(b.line.location))]);
}

/**
 * One stock count: walk the list, type what is there, and the value builds up
 * as you go. Closing freezes it for the accountant.
 */
export default async function StockCountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { id } = await params;
  const { show = "all" } = await searchParams;
  const countId = Number(id);
  if (!Number.isInteger(countId)) notFound();
  const v = await valueCount(countId);
  if (!v) notFound();
  const { count } = v;
  const closed = count.status === "closed";
  const [recipes, skuRows] = closed
    ? [[], []]
    : await Promise.all([bulkOptions(), db.select().from(skus).where(eq(skus.active, true)).orderBy(asc(skus.code))]);

  const visible = v.lines.filter((l) =>
    show === "counted" ? l.line.quantity != null : show === "uncounted" ? l.line.quantity == null : true,
  );
  const counted = v.lines.filter((l) => l.line.quantity != null).length;
  const estimate = count.countedOn != null && count.countedOn !== count.asAt;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="audit-main" style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 40px 96px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 20, ...smallCaps }}>
          <Link href="/production" style={{ color: COLOR.muted }}>Production</Link> /{" "}
          <Link href="/production/audit" style={{ color: COLOR.muted }}>Stock count</Link> / As at {count.asAt}
        </p>
        <h1 style={{ fontFamily: FONT.serif, fontSize: 40, fontWeight: 400, margin: "0 0 8px" }}>
          Stock as at {count.asAt}
        </h1>
        <p style={{ color: COLOR.inkSoft, fontSize: 14, margin: "0 0 32px" }}>
          {closed ? `Closed ${count.closedAt?.toISOString().slice(0, 10)}` : "Draft, valued live"}
          {count.countedOn ? ` · counted ${count.countedOn}` : ""}
          {count.countedBy ? ` by ${count.countedBy}` : ""}
          {estimate ? " · an estimate, wound back to the year end" : ""}
        </p>

        {/* Totals */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: COLOR.rule, border: `1px solid ${COLOR.rule}`, marginBottom: 16 }}>
          <div style={{ background: COLOR.paper, padding: 16 }}>
            <div style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>Total</div>
            <div style={{ fontFamily: FONT.serif, fontSize: 28, ...tabularNums }}>{gbp(v.total)}</div>
            <div style={{ fontSize: 11, color: COLOR.muted }}>
              {counted} of {v.lines.length} lines counted · {v.invoiceBackedPct.toFixed(0)}% invoice-backed
            </div>
          </div>
          {KIND_ORDER.map((k) => (
            <div key={k} style={{ background: COLOR.paper, padding: 16 }}>
              <div style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>{KIND_LABEL[k]}</div>
              <div style={{ fontSize: 20, ...tabularNums }}>{gbp(v.byKind[k].value)}</div>
              <div style={{ fontSize: 11, color: COLOR.muted }}>
                {v.byKind[k].counted} of {v.byKind[k].lines} counted
              </div>
            </div>
          ))}
        </section>
        <p style={{ fontSize: 12, color: COLOR.muted, margin: "0 0 32px" }}>
          {v.writtenDown > 0 ? `${v.writtenDown} line${v.writtenDown === 1 ? "" : "s"} written down to nil as obsolete. ` : ""}
          {v.unvalued > 0 ? (
            <span style={{ color: COLOR.flag }}>
              {v.unvalued} counted line{v.unvalued === 1 ? " has" : "s have"} no cost and add nothing to the total.{" "}
            </span>
          ) : null}
          <a href={`/production/audit/${count.id}/export`} style={{ color: COLOR.accent }}>Download CSV</a>
        </p>

        {/* Count details */}
        <details style={{ marginBottom: 32 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: COLOR.inkSoft }}>Count details and basis</summary>
          <form action={updateCountDetails.bind(null, count.id)} style={{ display: "grid", gap: 12, maxWidth: 560, marginTop: 16 }}>
            <label><span style={labelStyle}>Counted on</span><input name="countedOn" type="date" defaultValue={count.countedOn ?? ""} disabled={closed} style={inputStyle} /></label>
            <label><span style={labelStyle}>Counted by</span><input name="countedBy" defaultValue={count.countedBy ?? ""} disabled={closed} style={inputStyle} /></label>
            <label><span style={labelStyle}>Basis</span><input name="basis" defaultValue={count.basis ?? ""} disabled={closed} style={inputStyle} /></label>
            <label><span style={labelStyle}>Notes</span><textarea name="notes" defaultValue={count.notes ?? ""} disabled={closed} rows={3} style={inputStyle} /></label>
            {!closed && <div><button type="submit" style={buttonGhost}>Save details</button></div>}
          </form>
        </details>

        {/* Filter */}
        <nav style={{ display: "flex", gap: 16, fontSize: 13, marginBottom: 16 }}>
          {SHOW.map((s) => (
            <Link
              key={s.key}
              href={`/production/audit/${count.id}${s.key === "all" ? "" : `?show=${s.key}`}`}
              style={{ color: show === s.key ? COLOR.ink : COLOR.muted, textDecoration: show === s.key ? "underline" : "none" }}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {KIND_ORDER.map((k) => {
          const lines = visible.filter((l) => l.line.kind === k);
          if (lines.length === 0) return null;
          return (
            <section key={k} style={{ marginBottom: 40 }}>
              <h2 style={{ fontFamily: FONT.serif, fontSize: 24, fontWeight: 400, margin: "0 0 8px" }}>{KIND_LABEL[k]}</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={th}>Item</th>
                      <th style={th}>Quantity</th>
                      <th style={{ ...th, textAlign: "right" }}>Unit cost</th>
                      <th style={{ ...th, textAlign: "right" }}>Value</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  {groupBy(lines).map(([group, ls]) => (
                    <tbody key={group}>
                      {group && k !== "bulk" && k !== "other" && (
                        <tr>
                          <td colSpan={5} style={{ padding: "16px 8px 4px", fontSize: 11, color: COLOR.accent, ...smallCaps }}>{group}</td>
                        </tr>
                      )}
                      {ls.map((l) => (
                        <LineRow
                          key={l.line.id}
                          countId={count.id}
                          lineId={l.line.id}
                          name={l.name}
                          units={l.units}
                          quantity={l.line.quantity}
                          unit={l.line.unit}
                          obsolete={l.line.obsolete}
                          note={l.line.note}
                          location={l.line.location}
                          unitCost={l.unitCost}
                          value={l.value}
                          source={l.source}
                          costNote={l.costNote}
                          closed={closed}
                          removable={l.line.kind === "bulk" || l.line.kind === "other" || l.line.location !== "Unit"}
                        />
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </section>
          );
        })}

        {!closed && (
          <section style={{ borderTop: `1px solid ${COLOR.ruleBold}`, paddingTop: 24, marginBottom: 40 }}>
            <h2 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 400, margin: "0 0 16px" }}>Add a line</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 32 }}>
              <form action={addLine.bind(null, count.id)} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="kind" value="bulk" />
                <p style={{ fontSize: 13, color: COLOR.inkSoft, margin: 0 }}>Bulk liquid, made and not yet bottled</p>
                <label><span style={labelStyle}>Drink</span>
                  <select name="recipe" required style={inputStyle}>
                    {recipes.map((r) => <option key={`${r.drinkId}:${r.clientId}`} value={`${r.drinkId}:${r.clientId}`}>{r.label}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Litres</span><input name="quantity" type="number" inputMode="decimal" step="any" min={0} style={inputStyle} /></label>
                <label><span style={labelStyle}>Location</span><input name="location" defaultValue="Unit" style={inputStyle} /></label>
                <div><button type="submit" style={buttonGhost}>Add bulk liquid</button></div>
              </form>
              <form action={addLine.bind(null, count.id)} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="kind" value="finished" />
                <p style={{ fontSize: 13, color: COLOR.inkSoft, margin: 0 }}>Bottles held somewhere else, e.g. Amazon FBA</p>
                <label><span style={labelStyle}>SKU</span>
                  <select name="skuId" required style={inputStyle}>
                    {skuRows.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                </label>
                <label><span style={labelStyle}>Bottles</span><input name="quantity" type="number" inputMode="decimal" step="any" min={0} style={inputStyle} /></label>
                <label><span style={labelStyle}>Location</span><input name="location" defaultValue="Amazon FBA" style={inputStyle} /></label>
                <div><button type="submit" style={buttonGhost}>Add bottles</button></div>
              </form>
              <form action={addLine.bind(null, count.id)} style={{ display: "grid", gap: 10 }}>
                <input type="hidden" name="kind" value="other" />
                <p style={{ fontSize: 13, color: COLOR.inkSoft, margin: 0 }}>Something Back Bar does not list</p>
                <label><span style={labelStyle}>What it is</span><input name="description" required style={inputStyle} /></label>
                <label><span style={labelStyle}>Quantity</span><input name="quantity" type="number" inputMode="decimal" step="any" min={0} style={inputStyle} /></label>
                <label><span style={labelStyle}>Unit</span><input name="unit" defaultValue="each" style={inputStyle} /></label>
                <label><span style={labelStyle}>Unit cost £</span><input name="unitCost" type="number" inputMode="decimal" step="any" min={0} style={inputStyle} /></label>
                <label><span style={labelStyle}>Location</span><input name="location" defaultValue="Unit" style={inputStyle} /></label>
                <div><button type="submit" style={buttonGhost}>Add line</button></div>
              </form>
            </div>
          </section>
        )}

        <section style={{ borderTop: `1px solid ${COLOR.ruleBold}`, paddingTop: 24 }}>
          {closed ? (
            <form action={reopen.bind(null, count.id)} style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <p style={{ fontSize: 13, color: COLOR.inkSoft, margin: 0 }}>
                Closed at {gbp(v.total)}. Reopening revalues it live and keeps a note that it was reopened.
              </p>
              <label><span style={labelStyle}>Why it is being reopened</span><input name="reason" required style={inputStyle} /></label>
              <div><button type="submit" style={buttonGhost}>Reopen</button></div>
            </form>
          ) : (
            <form action={close.bind(null, count.id)}>
              <p style={{ fontSize: 13, color: COLOR.inkSoft, margin: "0 0 12px" }}>
                Closing freezes every line&apos;s cost and the total, {gbp(v.total)}, so later price corrections do not move it.
              </p>
              <button type="submit" style={buttonPrimary}>Close the count</button>
            </form>
          )}
        </section>
      </main>
      <style>{`@media (max-width: 640px) { .audit-main { padding: 32px 16px 64px !important; } }`}</style>
    </div>
  );
}
