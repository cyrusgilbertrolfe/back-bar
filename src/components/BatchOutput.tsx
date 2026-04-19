"use client";

import { BatchCalculation } from "@/types";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";

interface Props {
  result: BatchCalculation;
}

export default function BatchOutput({ result }: Props) {
  const hasJerryCans = result.jerryCans.length > 0;
  const hasBottles = result.bottles.length > 0;
  const hasHouseMade = result.houseMade.length > 0;
  const hasDashes = result.dashes.length > 0;

  const allNotes: { ingredientName: string; note: string }[] = [
    ...result.jerryCans,
    ...result.bottles,
    ...result.houseMade,
    ...result.dashes,
  ]
    .filter((item) => item.note)
    .map((item) => ({ ingredientName: item.ingredientName, note: item.note! }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Header */}
      <header style={{ borderTop: `2px solid ${COLOR.ink}`, paddingTop: 20 }}>
        <h3
          style={{
            fontFamily: FONT.serif,
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: COLOR.ink,
            marginBottom: 6,
          }}
        >
          {result.recipeName}
        </h3>
        <p style={{ fontSize: 12, color: COLOR.accent, ...smallCaps }}>
          {result.targetLitres} L batch — {result.targetMl.toLocaleString()} ml total
        </p>
      </header>

      {/* Production notes — shown prominently before the quantities */}
      {allNotes.length > 0 && (
        <section
          style={{
            borderTop: `1px solid ${COLOR.accent}`,
            borderBottom: `1px solid ${COLOR.accent}`,
            padding: "16px 0",
            background: "rgba(122,90,43,0.04)",
          }}
        >
          <p style={{ fontSize: 11, color: COLOR.accent, marginBottom: 10, ...smallCaps }}>
            Before you start
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {allNotes.map(({ ingredientName, note }) => (
              <li
                key={ingredientName}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span style={{ color: COLOR.accent, fontSize: 13, paddingTop: 2 }}>⚠</span>
                <p
                  style={{
                    fontFamily: FONT.serif,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: COLOR.inkSoft,
                  }}
                >
                  <span style={{ fontWeight: 600, color: COLOR.ink }}>{ingredientName}:</span>{" "}
                  <span style={{ fontStyle: "italic" }}>{note}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasJerryCans && (
        <BatchSection title="Jerry cans">
          {result.jerryCans.map((item) => (
            <QuantityRow
              key={item.ingredientName}
              name={item.ingredientName}
              primary={`${item.ml.toLocaleString()} ml`}
            />
          ))}
        </BatchSection>
      )}

      {hasBottles && (
        <BatchSection title="Bottles">
          {result.bottles.map((item) => (
            <QuantityRow
              key={item.ingredientName}
              name={item.ingredientName}
              primary={`${item.ml.toLocaleString()} ml`}
              secondary={
                item.fullBottles > 0
                  ? `${item.fullBottles} full ${item.bottleSize} ml bottle${
                      item.fullBottles !== 1 ? "s" : ""
                    }${item.remainderMl > 0 ? ` + ${item.remainderMl} ml remaining` : ""}`
                  : `${item.remainderMl} ml from a ${item.bottleSize} ml bottle`
              }
            />
          ))}
        </BatchSection>
      )}

      {hasHouseMade && (
        <BatchSection title="House-made">
          {result.houseMade.map((item) => (
            <div key={item.ingredientName}>
              <QuantityRow
                name={item.ingredientName}
                primary={`${item.ml.toLocaleString()} ml`}
              />
              {item.subRecipeItems && item.subRecipeItems.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    marginLeft: 24,
                    padding: "14px 18px",
                    background: COLOR.paperDeep,
                    borderLeft: `2px solid ${COLOR.accent}`,
                  }}
                >
                  <p style={{ fontSize: 10, color: COLOR.accent, marginBottom: 10, ...smallCaps }}>
                    Sub-recipe — {item.ingredientName}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {item.subRecipeItems.map((sri) => (
                      <div key={sri.ingredientName}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "baseline",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: FONT.serif,
                              fontSize: 14,
                              color: COLOR.inkSoft,
                            }}
                          >
                            {sri.ingredientName}
                          </span>
                          <span
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: 14,
                              fontWeight: 500,
                              color: COLOR.ink,
                              ...tabularNums,
                            }}
                          >
                            {sri.amountG} g
                          </span>
                        </div>
                        {sri.isPhosphoricSolution && sri.phosphoricBreakdown && (
                          <div
                            style={{
                              marginTop: 6,
                              marginLeft: 12,
                              padding: "8px 12px",
                              fontSize: 12,
                              fontFamily: FONT.sans,
                              color: COLOR.muted,
                              borderLeft: `1px solid ${COLOR.ruleBold}`,
                            }}
                          >
                            <p
                              style={{
                                fontStyle: "italic",
                                marginBottom: 4,
                                fontFamily: FONT.serif,
                                color: COLOR.inkSoft,
                              }}
                            >
                              To prepare {sri.amountG} g of 1.25% solution:
                            </p>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                ...tabularNums,
                              }}
                            >
                              <span>Phosphoric acid (75%)</span>
                              <span style={{ color: COLOR.ink, fontFamily: FONT.mono }}>
                                {sri.phosphoricBreakdown.acidG} g
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                ...tabularNums,
                              }}
                            >
                              <span>Water</span>
                              <span style={{ color: COLOR.ink, fontFamily: FONT.mono }}>
                                {sri.phosphoricBreakdown.waterG} g
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </BatchSection>
      )}

      {hasDashes && (
        <BatchSection title="Bitters / dashes">
          {result.dashes.map((item) => (
            <QuantityRow
              key={item.ingredientName}
              name={item.ingredientName}
              primary={`${item.totalDashes} dashes`}
            />
          ))}
        </BatchSection>
      )}
    </div>
  );
}

function BatchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p
        style={{
          fontSize: 11,
          color: COLOR.muted,
          marginBottom: 10,
          borderBottom: `1px solid ${COLOR.ruleBold}`,
          paddingBottom: 10,
          ...smallCaps,
        }}
      >
        {title}
      </p>
      <div>{children}</div>
    </section>
  );
}

function QuantityRow({
  name,
  primary,
  secondary,
}: {
  name: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 0",
        borderBottom: `1px solid ${COLOR.rule}`,
      }}
    >
      <span style={{ fontFamily: FONT.serif, fontSize: 17, color: COLOR.ink, lineHeight: 1.3 }}>
        {name}
      </span>
      <span style={{ textAlign: "right" }}>
        <span
          style={{
            display: "block",
            fontFamily: FONT.mono,
            fontSize: 17,
            fontWeight: 500,
            color: COLOR.ink,
            ...tabularNums,
          }}
        >
          {primary}
        </span>
        {secondary && (
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: COLOR.muted,
              marginTop: 3,
              fontFamily: FONT.sans,
            }}
          >
            {secondary}
          </span>
        )}
      </span>
    </div>
  );
}
