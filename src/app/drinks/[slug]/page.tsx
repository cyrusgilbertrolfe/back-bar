import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import {
  dbConfigured,
  getDrinkDetail,
  listAllClients,
  type AbvView,
  type ClientRecipeView,
} from "@/lib/drinks-db";
import { GATE_1_TOLERANCE_POINTS } from "@/lib/erp/canon";
import { listCaseLabelLines, listClientSkus } from "@/lib/labels/case-label-data";

import SkuIdentityForm from "./_SkuIdentityForm";

/** Real capitals for the case-label panel: small caps would lowercase codes like FM-APPR. */
const allCaps = { textTransform: "uppercase" as const, letterSpacing: "0.06em" };

export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DrinkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { slug } = await params;
  const { client: clientParam } = await searchParams;

  if (!dbConfigured()) notFound();
  const drink = await getDrinkDetail(slug);
  if (!drink) notFound();

  const allClients = await listAllClients();
  const withRecipe = new Set(drink.recipesByClient.map((r) => r.clientSlug));
  const missingClients = allClients.filter((c) => !withRecipe.has(c.slug));

  // Active tab: ?client=slug if it has a recipe, else the first (MFC) tab.
  const active: ClientRecipeView | undefined =
    drink.recipesByClient.find((r) => r.clientSlug === clientParam) ?? drink.recipesByClient[0];

  const sum = active ? active.lines.reduce((a, l) => a + l.percentage, 0) : 0;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 96px" }}>
        <Link href="/drinks" style={{ fontSize: 11, color: COLOR.muted, textDecoration: "none", ...smallCaps }}>
          ← Drinks
        </Link>

        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: FONT.serif, fontSize: "clamp(32px, 5vw, 42px)", fontWeight: 400, letterSpacing: "-0.025em" }}>
            {drink.name}
          </h1>
          {drink.status === "archived" && (
            <span style={{ fontSize: 10, color: COLOR.flag, ...smallCaps }}>Archived</span>
          )}
        </div>

        {drink.recipesByClient.length === 0 ? (
          <p style={{ marginTop: 24, fontFamily: FONT.serif, fontStyle: "italic", color: COLOR.muted }}>
            No recipes yet for this drink.
          </p>
        ) : (
          <>
            {/* Client tabs */}
            <div style={{ display: "flex", gap: 4, marginTop: 28, borderBottom: `1px solid ${COLOR.rule}` }}>
              {drink.recipesByClient.map((r) => {
                const isActive = r.clientSlug === active?.clientSlug;
                return (
                  <Link
                    key={r.clientSlug}
                    href={`/drinks/${drink.slug}?client=${r.clientSlug}`}
                    style={{
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? COLOR.accent : COLOR.inkSoft,
                      borderBottom: `2px solid ${isActive ? COLOR.accent : "transparent"}`,
                      marginBottom: -1,
                      textDecoration: "none",
                    }}
                  >
                    {r.clientName}
                  </Link>
                );
              })}
            </div>

            {active && <RecipePanel recipe={active} sum={sum} drinkSlug={drink.slug} />}
          </>
        )}

        <CaseLabelsPanel drinkId={drink.id} drinkSlug={drink.slug} />

        {/* Add-a-recipe-for-this-drink */}
        {missingClients.length > 0 && (
          <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {missingClients.map((c) => (
              <Link
                key={c.slug}
                href={`/drinks/${drink.slug}/new?client=${c.slug}`}
                style={{
                  fontSize: 12,
                  color: COLOR.inkSoft,
                  border: `1px solid ${COLOR.rule}`,
                  padding: "8px 14px",
                  textDecoration: "none",
                  ...smallCaps,
                }}
              >
                + Add {c.name} recipe
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Outer-case labels for partner orders, e.g. Fortnum's. Only appears for a
 * drink sold under a partner's name. The label comes from the order line and
 * inherits the product's identity from the SKU; see lib/labels.
 */
async function CaseLabelsPanel({ drinkId, drinkSlug }: { drinkId: number; drinkSlug: string }) {
  const [clientSkus, lines] = await Promise.all([listClientSkus(drinkId), listCaseLabelLines(drinkId)]);
  if (clientSkus.length === 0) return null;

  return (
    <section style={{ marginTop: 40, borderTop: `1px solid ${COLOR.rule}`, paddingTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ fontSize: 10, color: COLOR.muted, ...allCaps, margin: 0 }}>Case labels</h2>
        <a
          href="/api/case-labels/calibration"
          target="_blank"
          style={{ fontSize: 11, color: COLOR.accent, textDecoration: "underline", textUnderlineOffset: 3, ...allCaps }}
        >
          Calibration sheet
        </a>
      </div>

      {lines.length === 0 ? (
        <p style={{ fontSize: 13, color: COLOR.muted, marginTop: 12 }}>No open orders for this drink.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {lines.map((l) => (
            <li key={l.lineId} style={{ borderBottom: `1px solid ${COLOR.rule}`, padding: "14px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ ...tabularNums }}>
                  <div style={{ fontFamily: FONT.serif, fontSize: 16 }}>
                    {l.orderNumber} · {l.customerName}
                  </div>
                  <div style={{ fontSize: 12, color: COLOR.muted, marginTop: 2 }}>
                    {l.cases} cases{l.facts ? ` of ${l.facts.unitsPerCase}` : ""} · {l.skuCode}
                    {l.raisedOn ? ` · raised ${l.raisedOn}` : ""}
                  </div>
                </div>
                {l.problems.length === 0 && (
                  <form action={`/api/case-labels/${l.lineId}`} method="get" target="_blank" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label style={{ fontSize: 11, color: COLOR.muted }}>
                      start at label{" "}
                      <select name="start" defaultValue="1" style={{ fontSize: 12, padding: "4px 6px" }}>
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      style={{ background: COLOR.ink, color: COLOR.paper, border: "none", padding: "8px 14px", fontSize: 12, cursor: "pointer", ...allCaps }}
                    >
                      Download {l.cases} labels
                    </button>
                  </form>
                )}
              </div>
              {l.problems.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: COLOR.flag, lineHeight: 1.55 }}>
                  {l.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {clientSkus.map((s) => (
        <details key={s.skuId} style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: COLOR.muted, ...allCaps }}>
            {s.clientName} identity · {s.code}
            {s.shortCode ? ` · ${s.shortCode}` : " · no short code yet"}
          </summary>
          <SkuIdentityForm drinkSlug={drinkSlug} sku={s} />
        </details>
      ))}
    </section>
  );
}

function RecipePanel({
  recipe,
  sum,
  drinkSlug,
}: {
  recipe: ClientRecipeView;
  sum: number;
  drinkSlug: string;
}) {
  const sumOk = Math.abs(sum - 100) < 0.05;
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>
          {recipe.clientName} · version {recipe.version}
        </span>
        <Link
          href={`/drinks/${drinkSlug}/edit?client=${recipe.clientSlug}`}
          style={{ fontSize: 11, color: COLOR.accent, textDecoration: "underline", textUnderlineOffset: 3, ...smallCaps }}
        >
          Edit
        </Link>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}>
        <tbody>
          {recipe.lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
              <td style={{ padding: "12px 12px 12px 0", fontFamily: FONT.serif, fontSize: 16 }}>{l.componentName}</td>
              <td style={{ padding: "12px 0", textAlign: "right", color: COLOR.inkSoft, width: 80 }}>
                {l.percentage.toFixed(1)}%
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${COLOR.ink}` }}>
            <td style={{ padding: "12px 12px 12px 0", fontSize: 11, color: COLOR.muted, ...smallCaps }}>Total</td>
            <td style={{ padding: "12px 0", textAlign: "right", color: sumOk ? COLOR.muted : COLOR.flag, fontWeight: 500 }}>
              {sum.toFixed(1)}%
            </td>
          </tr>
        </tbody>
      </table>

      <AbvPanel abv={recipe.abv} />

      {/* Production method / instructions */}
      {recipe.method && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 10, color: COLOR.muted, ...smallCaps, marginBottom: 8 }}>Method</h3>
          <p style={{ fontFamily: FONT.serif, fontSize: 15, lineHeight: 1.6, color: COLOR.ink, whiteSpace: "pre-wrap", margin: 0 }}>
            {recipe.method}
          </p>
        </div>
      )}

      {/* Version history */}
      {recipe.history.length > 1 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 11, color: COLOR.muted, ...smallCaps }}>
            Version history · {recipe.history.length}
          </summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
            {recipe.history.map((v) => (
              <li key={v.version} style={{ fontSize: 13, color: COLOR.muted, padding: "4px 0" }}>
                Version {v.version} · {fmtDate(v.createdAt)}
                {v.createdBy ? ` by ${v.createdBy}` : ""}
                {v.isCurrent ? <span style={{ color: COLOR.accent, marginLeft: 8, ...smallCaps, fontSize: 10 }}>current</span> : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/**
 * Computed beside declared, with the gap and the verdict.
 *
 * The three states are visually distinct on purpose, and the third is the
 * reason the panel exists:
 *
 *   pass        the two numbers agree inside the legal tolerance
 *   fail        they disagree by more than it — the recipe cannot be saved
 *   unverified  NOBODY HAS READ THE BOTTLE. Rendered as an explicit
 *               "not recorded", never as a blank, a dash or a zero, and never
 *               styled to resemble agreement. A null that looks like a pass is
 *               precisely the confusion that let seventeen label figures be
 *               overwritten on 14 Aug 2026 without anyone noticing.
 */
function AbvPanel({ abv }: { abv: AbvView }) {
  const notRecorded = abv.declared === null;
  const failed = abv.status === "fail";

  const tone = failed ? COLOR.flag : notRecorded ? COLOR.muted : COLOR.positive;
  const verdict = failed
    ? `Over tolerance by ${(abv.gap! - GATE_1_TOLERANCE_POINTS).toFixed(1)}`
    : notRecorded
      ? "Unverified"
      : "Within tolerance";

  return (
    <section
      style={{
        marginTop: 24,
        border: `1px solid ${failed ? COLOR.flag : COLOR.rule}`,
        borderLeft: `3px solid ${tone}`,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h3 style={{ fontSize: 10, color: COLOR.muted, ...smallCaps, margin: 0 }}>Alcoholic strength</h3>
        <span style={{ fontSize: 10, color: tone, fontWeight: 500, ...smallCaps }}>{verdict}</span>
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", ...tabularNums }}>
        <div>
          <div style={{ fontSize: 10, color: COLOR.muted, ...smallCaps, marginBottom: 4 }}>Computed</div>
          <div style={{ fontFamily: FONT.serif, fontSize: 26, color: COLOR.ink }}>
            {abv.computed.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 2 }}>from this recipe</div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: COLOR.muted, ...smallCaps, marginBottom: 4 }}>Declared</div>
          {notRecorded ? (
            <>
              <div style={{ fontFamily: FONT.serif, fontSize: 20, fontStyle: "italic", color: COLOR.muted }}>
                Not recorded
              </div>
              <div style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 2 }}>nobody has read the bottle</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: FONT.serif, fontSize: 26, color: COLOR.ink }}>
                {abv.declared!.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 2 }}>
                on the label
                {abv.declaredNoted ? ` · read ${abv.declaredNoted}` : ""}
              </div>
            </>
          )}
        </div>

        <div>
          <div style={{ fontSize: 10, color: COLOR.muted, ...smallCaps, marginBottom: 4 }}>Gap</div>
          {notRecorded ? (
            <div style={{ fontFamily: FONT.serif, fontSize: 20, fontStyle: "italic", color: COLOR.muted }}>—</div>
          ) : (
            <div style={{ fontFamily: FONT.serif, fontSize: 26, color: failed ? COLOR.flag : COLOR.ink }}>
              {abv.gap!.toFixed(1)}
            </div>
          )}
          <div style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 2 }}>
            tolerance {GATE_1_TOLERANCE_POINTS.toFixed(1)} points
          </div>
        </div>
      </div>

      {notRecorded && (
        <p style={{ fontSize: 12, color: COLOR.muted, lineHeight: 1.55, margin: "14px 0 0" }}>
          No declared ABV is recorded, so the label and the recipe cannot be compared and this
          recipe is <strong style={{ color: COLOR.inkSoft }}>unverified</strong>. Edits will still
          save. This is not agreement — it means the check has never been run.
        </p>
      )}

      {failed && (
        <p style={{ fontSize: 12, color: COLOR.flag, lineHeight: 1.55, margin: "14px 0 0" }}>
          The recipe and the label disagree by more than the {GATE_1_TOLERANCE_POINTS.toFixed(1)}-point
          legal tolerance for spirit drinks, so recipe edits are refused. One of the two numbers is
          wrong and nobody has established which. Never edit one to match the other.
        </p>
      )}

      {abv.declaredSource && !notRecorded && (
        <p style={{ fontSize: 11, color: COLOR.mutedLight, margin: "12px 0 0" }}>
          Declared figure source: {abv.declaredSource}
        </p>
      )}

      {abv.nullAbvComponents.length > 0 && (
        <p style={{ fontSize: 12, color: COLOR.flag, lineHeight: 1.55, margin: "12px 0 0" }}>
          {abv.nullAbvComponents.join(", ")} {abv.nullAbvComponents.length === 1 ? "has" : "have"} no
          ABV recorded, so the computed figure above is understated.
        </p>
      )}
    </section>
  );
}
