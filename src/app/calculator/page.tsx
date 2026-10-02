import Link from "next/link";
import Nav from "@/components/Nav";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import {
  dbConfigured,
  getCalcRecipe,
  listClientsWithRecipes,
  listDrinksForClient,
} from "@/lib/drinks-db";
import CostSourceBadge from "@/components/CostSourceBadge";
import { costCaveat, summariseProvenance, type CostSource } from "@/lib/erp/provenance";
import { listAnchorOptions, planBatchFromAnchor, type AnchorPlan } from "@/lib/erp/batch";

export const dynamic = "force-dynamic";

const DEFAULT_LITRES = 9;
const MAX_LITRES = 500;

// No embedded recipe data lives here — the calculator reads recipes live from
// the database (recipes + recipe_lines, is_current = true) at request time.

function parseLitres(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LITRES;
  return Math.min(n, MAX_LITRES);
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    drink?: string;
    litres?: string;
    anchor?: string;
    bottles?: string;
  }>;
}) {
  const { client, drink, litres: litresRaw, anchor: anchorRaw, bottles: bottlesRaw } =
    await searchParams;
  const litres = parseLitres(litresRaw);

  const ready = dbConfigured();
  const clients = ready ? await listClientsWithRecipes() : [];
  const activeClient = client && clients.find((c) => c.slug === client) ? client : undefined;

  const drinks = activeClient ? await listDrinksForClient(activeClient) : [];
  const activeDrink = drink && drinks.find((d) => d.slug === drink) ? drink : undefined;

  const recipe = activeClient && activeDrink ? await getCalcRecipe(activeClient, activeDrink) : null;

  // Anchored batching: size the batch around one bottle of one ingredient
  // rather than around a target volume. The constraint on a short run is
  // usually a single awkward bottle, not a number of litres.
  const anchorOptions =
    activeClient && activeDrink ? await listAnchorOptions(activeClient, activeDrink) : [];
  const anchorId = Number(anchorRaw);
  const bottles = Math.max(1, Math.min(50, Number(bottlesRaw) || 1));
  const anchorPlan =
    activeClient && activeDrink && Number.isFinite(anchorId) && anchorId > 0
      ? await planBatchFromAnchor(activeClient, activeDrink, anchorId, bottles)
      : null;

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <main className="calc-main" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 16, ...smallCaps }}>
          Production · Batch calculator
        </p>
        <h1
          style={{
            fontFamily: FONT.serif,
            fontSize: "clamp(36px, 6vw, 48px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          Batch calculator
        </h1>
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 17,
            color: COLOR.inkSoft,
            lineHeight: 1.5,
            maxWidth: 560,
            fontWeight: 300,
            marginBottom: 32,
          }}
        >
          Pick a client, choose a drink, set the volume — exact ingredient quantities
          and ingredient cost for the batch, straight from the live recipe.
        </p>

        {!ready ? (
          <SetupNotice />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {/* Step 1 — Client */}
            <section>
              <StepHeader step={1} label="Client" />
              {clients.length === 0 ? (
                <Muted>No client recipes yet. Run the seed.</Muted>
              ) : (
                <ButtonRow>
                  {clients.map((c) => (
                    <PickButton key={c.slug} href={`/calculator?client=${c.slug}`} active={activeClient === c.slug}>
                      {c.name}
                    </PickButton>
                  ))}
                </ButtonRow>
              )}
            </section>

            {/* Step 2 — Drink */}
            {activeClient && (
              <section>
                <StepHeader step={2} label="Drink" />
                {drinks.length === 0 ? (
                  <Muted>No drinks have a recipe for this client yet.</Muted>
                ) : (
                  <ButtonRow>
                    {drinks.map((d) => (
                      <PickButton
                        key={d.slug}
                        href={`/calculator?client=${activeClient}&drink=${d.slug}`}
                        active={activeDrink === d.slug}
                      >
                        {d.name}
                      </PickButton>
                    ))}
                  </ButtonRow>
                )}
              </section>
            )}

            {/* Step 3 — Volume */}
            {activeClient && activeDrink && (
              <section>
                <StepHeader step={3} label="Volume" />
                <form method="get" action="/calculator" style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
                  <input type="hidden" name="client" value={activeClient} />
                  <input type="hidden" name="drink" value={activeDrink} />
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="number"
                      name="litres"
                      min="0.1"
                      max={MAX_LITRES}
                      step="0.1"
                      defaultValue={litres}
                      style={{
                        width: 130,
                        padding: "12px 30px 12px 14px",
                        fontSize: 15,
                        fontFamily: FONT.mono,
                        background: "transparent",
                        color: COLOR.ink,
                        border: `1px solid ${COLOR.rule}`,
                        outline: "none",
                        minHeight: 48,
                        ...tabularNums,
                      }}
                    />
                    <span style={{ position: "absolute", right: 12, fontSize: 13, color: COLOR.muted, pointerEvents: "none" }}>
                      L
                    </span>
                  </div>
                  <button
                    type="submit"
                    style={{ padding: "12px 22px", fontSize: 11, background: COLOR.accent, color: COLOR.paper, border: "none", cursor: "pointer", minHeight: 48, ...smallCaps }}
                  >
                    Calculate
                  </button>
                </form>

                {/* Or anchor the batch on one bottle of one ingredient. For a
                    short run the binding constraint is usually a single bottle
                    of something awkward, not a round number of litres. */}
                {anchorOptions.length > 0 && (
                  <form
                    method="get"
                    action="/calculator"
                    style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}
                  >
                    <input type="hidden" name="client" value={activeClient} />
                    <input type="hidden" name="drink" value={activeDrink} />
                    <span style={{ fontSize: 13, color: COLOR.muted }}>or build the batch around</span>
                    <input
                      type="number"
                      name="bottles"
                      min="1"
                      max="50"
                      step="1"
                      defaultValue={bottles}
                      aria-label="Number of containers"
                      style={{
                        width: 64,
                        padding: "12px 10px",
                        fontSize: 15,
                        fontFamily: FONT.mono,
                        background: "transparent",
                        color: COLOR.ink,
                        border: `1px solid ${COLOR.rule}`,
                        outline: "none",
                        minHeight: 48,
                        ...tabularNums,
                      }}
                    />
                    <select
                      name="anchor"
                      defaultValue={anchorPlan ? String(anchorId) : ""}
                      aria-label="Anchor ingredient"
                      style={{
                        padding: "12px 14px",
                        fontSize: 14,
                        background: "transparent",
                        color: COLOR.ink,
                        border: `1px solid ${COLOR.rule}`,
                        outline: "none",
                        minHeight: 48,
                        maxWidth: 300,
                      }}
                    >
                      <option value="">choose an ingredient</option>
                      {anchorOptions.map((o) => (
                        <option key={o.componentId} value={o.componentId} disabled={!o.packSize}>
                          {o.name}
                          {o.packSize ? ` (${o.packSize} ${o.uom})` : " (no pack size)"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      style={{ padding: "12px 22px", fontSize: 11, background: "transparent", color: COLOR.ink, border: `1px solid ${COLOR.rule}`, cursor: "pointer", minHeight: 48, ...smallCaps }}
                    >
                      Build around it
                    </button>
                  </form>
                )}
              </section>
            )}

            {/* Step 4 — Output */}
            {anchorPlan ? (
              <AnchorOutput plan={anchorPlan} />
            ) : (
              recipe && <Output recipe={recipe} litres={litres} />
            )}
          </div>
        )}
      </main>

      <style>{`@media (max-width: 640px) { .calc-main { padding: 28px 18px 64px !important; } }`}</style>
    </div>
  );
}

function Output({
  recipe,
  litres,
}: {
  recipe: NonNullable<Awaited<ReturnType<typeof getCalcRecipe>>>;
  litres: number;
}) {
  const targetMl = litres * 1000;
  const rows = recipe.lines.map((l) => {
    const volumeMl = (targetMl * l.percentage) / 100;
    const lineCost = volumeMl * l.unitCost; // unitCost is £ per ml
    return { ...l, volumeMl, lineCost };
  });
  const totalCost = rows.reduce((a, r) => a + r.lineCost, 0);
  const costPerMl = targetMl > 0 ? totalCost / targetMl : 0;
  const prov = summariseProvenance(rows.map((r) => ({ source: r.source, setAt: r.setAt })));
  const caveat = costCaveat({
    placeholders: rows.filter((r) => r.source === "placeholder").length,
    unsourced: rows.filter((r) => r.source === "unsourced").length,
  });

  return (
    <section>
      <StepHeader step={4} label="Batch sheet" />
      <p style={{ fontSize: 13, color: COLOR.muted, margin: "12px 0 16px" }}>
        {recipe.drinkName} · {litres} L ({targetMl.toLocaleString()} ml)
      </p>

      {/* Production method — shown before the ingredient table so it's read
          before batching (e.g. infusions that must happen ahead of production). */}
      {recipe.method && (
        <div
          style={{
            border: `1px solid ${COLOR.rule}`,
            borderLeft: `3px solid ${COLOR.accent}`,
            background: COLOR.paperDeep,
            padding: "14px 16px",
            margin: "0 0 24px",
          }}
        >
          <h3 style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>Method</h3>
          <p style={{ fontFamily: FONT.serif, fontSize: 15, lineHeight: 1.55, color: COLOR.ink, whiteSpace: "pre-wrap", margin: 0 }}>
            {recipe.method}
          </p>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}>
        <thead>
          <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            <Th>Ingredient</Th>
            <Th align="right">%</Th>
            <Th align="right">Volume</Th>
            <Th align="right">Unit price</Th>
            <Th align="right">Line cost</Th>
            <Th align="right">Source · as of</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
              <Td><span style={{ fontFamily: FONT.serif, fontSize: 16 }}>{r.componentName}</span></Td>
              <Td align="right" muted>{r.percentage.toFixed(1)}%</Td>
              <Td align="right">{Math.round(r.volumeMl).toLocaleString()} ml</Td>
              <Td align="right" muted>
                £{r.unitCost.toFixed(4)}<span style={{ fontSize: 11, color: COLOR.mutedLight }}>/{r.uom}</span>
              </Td>
              <Td align="right">£{r.lineCost.toFixed(2)}</Td>
              <Td align="right"><CostSourceBadge source={r.source} date={r.setAt} block /></Td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${COLOR.ink}` }}>
            <Td><span style={{ ...smallCaps, fontSize: 11, color: COLOR.muted }}>Ingredient cost</span></Td>
            <Td align="right" />
            <Td align="right" muted>{targetMl.toLocaleString()} ml</Td>
            <Td align="right" />
            <Td align="right"><strong>£{totalCost.toFixed(2)}</strong></Td>
            <Td align="right">
              <TotalProvenance source={prov.costSource} asOf={prov.costAsOf} caveat={caveat} />
            </Td>
          </tr>
        </tbody>
      </table>

      {/* Per-bottle at each available SKU size */}
      {recipe.skus.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 10, ...smallCaps }}>
            Ingredient cost per bottle
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {recipe.skus.map((s) => (
              <div key={s.code} style={{ border: `1px solid ${COLOR.rule}`, padding: "12px 16px", minWidth: 110 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 18, ...tabularNums }}>
                  £{(costPerMl * s.sizeMl).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>{s.sizeMl} ml</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 10, fontStyle: "italic" }}>
            Ingredient cost only — packaging, labels, and labour are not included here.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * The batch sheet when it has been built around one bottle rather than a target
 * volume. Adds the two things you need at the bench and nowhere else: how many
 * containers of each other ingredient to open, and how many finished bottles
 * this actually yields, including the awkward remainder.
 */
function AnchorOutput({ plan }: { plan: AnchorPlan }) {
  const anchorLine = plan.lines.find((l) => l.isAnchor);
  const caveat = costCaveat({ placeholders: plan.placeholderLines, unsourced: plan.unsourcedLines });

  return (
    <section>
      <StepHeader step={4} label="Batch sheet" />
      <p style={{ fontSize: 13, color: COLOR.muted, margin: "12px 0 4px" }}>
        {plan.drinkName} · built around {plan.anchorBottles}{" "}
        {plan.anchorBottles === 1 ? "container" : "containers"} of {plan.anchorName}
      </p>
      <p style={{ fontFamily: FONT.serif, fontSize: 17, color: COLOR.ink, margin: "0 0 20px" }}>
        {plan.anchorQuantity.toLocaleString()} {anchorLine?.uom ?? "ml"} of {plan.anchorName} at{" "}
        {anchorLine?.percentage}% makes{" "}
        <strong>
          {plan.batchLitres} litres ({plan.batchMl.toLocaleString()} ml)
        </strong>
      </p>

      {plan.method && (
        <div
          style={{
            border: `1px solid ${COLOR.rule}`,
            borderLeft: `3px solid ${COLOR.accent}`,
            background: COLOR.paperDeep,
            padding: "14px 16px",
            margin: "0 0 24px",
          }}
        >
          <h3 style={{ fontSize: 10, color: COLOR.muted, marginBottom: 6, ...smallCaps }}>Method</h3>
          <p style={{ fontFamily: FONT.serif, fontSize: 15, lineHeight: 1.55, color: COLOR.ink, whiteSpace: "pre-wrap", margin: 0 }}>
            {plan.method}
          </p>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...tabularNums }}>
        <thead>
          <tr style={{ borderTop: `2px solid ${COLOR.ink}`, borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            <Th>Ingredient</Th>
            <Th align="right">%</Th>
            <Th align="right">Need</Th>
            <Th align="right">Open</Th>
            <Th align="right">Left in last</Th>
            <Th align="right">Line cost</Th>
            <Th align="right">Source · as of</Th>
          </tr>
        </thead>
        <tbody>
          {plan.lines.map((l) => (
            <tr
              key={l.componentId}
              style={{
                borderBottom: `1px solid ${COLOR.rule}`,
                background: l.isAnchor ? COLOR.paperDeep : undefined,
              }}
            >
              <Td>
                <span style={{ fontFamily: FONT.serif, fontSize: 16 }}>{l.name}</span>
                {l.isAnchor && (
                  <span style={{ marginLeft: 8, fontSize: 10, color: COLOR.accent, ...smallCaps }}>anchor</span>
                )}
              </Td>
              <Td align="right" muted>{l.percentage.toFixed(1)}%</Td>
              <Td align="right">{l.quantity.toLocaleString()} {l.uom}</Td>
              <Td align="right" muted>{l.bottlesToOpen ?? "—"}</Td>
              <Td align="right" muted>{l.leftover === null ? "—" : `${l.leftover.toLocaleString()} ${l.uom}`}</Td>
              <Td align="right">£{l.cost.toFixed(2)}</Td>
              <Td align="right"><CostSourceBadge source={l.source} date={l.setAt} block /></Td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${COLOR.ink}` }}>
            <Td><span style={{ ...smallCaps, fontSize: 11, color: COLOR.muted }}>Ingredient cost</span></Td>
            <Td align="right" />
            <Td align="right" muted>{plan.batchMl.toLocaleString()} ml</Td>
            <Td align="right" />
            <Td align="right" muted>£{plan.costPerLitre.toFixed(2)}/L</Td>
            <Td align="right"><strong>£{plan.totalCost.toFixed(2)}</strong></Td>
            <Td align="right">
              <TotalProvenance source={plan.costSource} asOf={plan.costAsOf} caveat={caveat} />
            </Td>
          </tr>
        </tbody>
      </table>

      {plan.yields.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ fontSize: 11, color: COLOR.muted, marginBottom: 10, ...smallCaps }}>
            This batch fills
          </h3>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {plan.yields.map((y) => (
              <div key={y.code} style={{ border: `1px solid ${COLOR.rule}`, padding: "12px 16px", minWidth: 130 }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 20, ...tabularNums }}>{y.wholeBottles}</div>
                <div style={{ fontSize: 11, color: COLOR.muted, marginTop: 2 }}>
                  × {y.sizeMl} ml
                </div>
                {y.remainderMl > 0 && (
                  <div style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 4 }}>
                    {y.remainderMl.toLocaleString()} ml over
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: COLOR.mutedLight, marginTop: 10, fontStyle: "italic" }}>
            Ingredient cost only. Packaging and labels are not included here.
          </p>
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div
          style={{
            marginTop: 24,
            border: `1px solid ${COLOR.rule}`,
            borderLeft: `3px solid ${COLOR.accent}`,
            padding: "14px 16px",
          }}
        >
          <h3 style={{ fontSize: 10, color: COLOR.muted, marginBottom: 8, ...smallCaps }}>Check</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: COLOR.ink }}>
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Small presentational helpers ────────────────────────────────────────────

function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLOR.muted, letterSpacing: "0.08em" }}>
        {String(step).padStart(2, "0")}
      </span>
      <h2 style={{ fontFamily: FONT.serif, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>{label}</h2>
    </div>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 16 }}>
      {children}
    </div>
  );
}

function PickButton({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: "14px 16px",
        fontSize: 15,
        fontFamily: FONT.serif,
        textAlign: "left",
        background: active ? COLOR.ink : "transparent",
        color: active ? COLOR.paper : COLOR.ink,
        border: `1px solid ${active ? COLOR.ink : COLOR.rule}`,
        textDecoration: "none",
        minHeight: 52,
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </Link>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ marginTop: 16, fontFamily: FONT.serif, fontStyle: "italic", color: COLOR.muted }}>{children}</p>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ textAlign: align, padding: "10px 12px", fontSize: 10, color: COLOR.muted, fontWeight: 500, ...smallCaps }}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", muted }: { children?: React.ReactNode; align?: "left" | "right"; muted?: boolean }) {
  return (
    <td style={{ padding: "12px", textAlign: align, color: muted ? COLOR.muted : COLOR.ink }}>{children}</td>
  );
}

/** Batch total provenance: worst source, oldest input, and what is inside it. */
function TotalProvenance({
  source,
  asOf,
  caveat,
}: {
  source: CostSource | null;
  asOf: string | null;
  caveat: string | null;
}) {
  return (
    <div>
      <CostSourceBadge source={source} date={asOf} block />
      {caveat && (
        <div style={{ marginTop: 4, fontSize: 10, color: COLOR.flag, ...smallCaps }}>{caveat}</div>
      )}
    </div>
  );
}

function SetupNotice() {
  return (
    <div style={{ border: `1px dashed ${COLOR.rule}`, padding: "40px 24px", color: COLOR.muted }}>
      <p style={{ fontFamily: FONT.serif, fontSize: 18, fontStyle: "italic", marginBottom: 8 }}>
        The calculator now reads recipes from the database.
      </p>
      <p style={{ fontSize: 14, lineHeight: 1.6 }}>
        Set <code style={{ fontFamily: FONT.mono }}>DATABASE_URL</code> (Neon), then run{" "}
        <code style={{ fontFamily: FONT.mono }}>npm run db:migrate &amp;&amp; npm run db:seed</code>.
      </p>
    </div>
  );
}
