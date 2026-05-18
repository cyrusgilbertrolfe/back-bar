"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import {
  CATEGORIES,
  STATUSES,
  TIERS,
  TOUCHPOINT_TYPES,
  type Account,
  type Category,
  type Status,
  type Tier,
  type Touchpoint,
  type TouchpointType,
} from "@/lib/sales-data";
import {
  addTouchpoint,
  updateAccount,
  type UpdateAccountInput,
} from "@/app/actions/sales";
import {
  Field,
  StatusBadge,
  inputStyle,
} from "@/app/sales/accounts/AccountsClient";

const fmtDate = (ymd: string) => {
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type EditState = Omit<UpdateAccountInput, "id">;

function toEditState(a: Account): EditState {
  return {
    name: a.name,
    category: a.category,
    tier: a.tier,
    city: a.city,
    buyer_name: a.buyer_name,
    buyer_title: a.buyer_title,
    buyer_email: a.buyer_email,
    buyer_phone: a.buyer_phone,
    status: a.status,
    notes: a.notes,
  };
}

export default function AccountDetailClient({
  account,
  touchpoints,
}: {
  account: Account;
  touchpoints: Touchpoint[];
}) {
  const router = useRouter();
  const [f, setF] = useState<EditState>(toEditState(account));
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "err"; msg: string } | null
  >(null);

  const baseline = JSON.stringify(toEditState(account));
  const dirty = JSON.stringify(f) !== baseline;

  function set<K extends keyof EditState>(key: K, value: EditState[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
    setFeedback(null);
  }

  function save() {
    if (!dirty) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateAccount({ id: account.id, ...f });
      if (res.ok) {
        setFeedback({ kind: "ok", msg: "Saved." });
        router.refresh();
      } else {
        setFeedback({ kind: "err", msg: res.error });
      }
    });
  }

  return (
    <main
      className="detail-main"
      style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 40px 120px" }}
    >
      <Link
        href="/sales/accounts"
        style={{
          fontSize: 11,
          color: COLOR.muted,
          textDecoration: "none",
          ...smallCaps,
        }}
      >
        ← All accounts
      </Link>

      {/* Header */}
      <header
        style={{
          borderTop: `2px solid ${COLOR.ink}`,
          marginTop: 16,
          paddingTop: 20,
          marginBottom: 36,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          rowGap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: "clamp(32px, 5vw, 46px)",
              fontWeight: 400,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              color: COLOR.ink,
              marginBottom: 10,
            }}
          >
            {account.name}
          </h1>
          <p style={{ fontSize: 11, color: COLOR.accent, ...smallCaps }}>
            {account.category} · Tier {account.tier}
            {account.city ? ` · ${account.city}` : ""}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </header>

      {/* Editable account fields */}
      <section style={{ marginBottom: 56 }}>
        <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 18, ...smallCaps }}>
          Account
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <Field label="Company name *">
            <input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Category">
            <select
              value={f.category}
              onChange={(e) => set("category", e.target.value as Category)}
              style={inputStyle()}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tier">
            <select
              value={f.tier}
              onChange={(e) => set("tier", Number(e.target.value) as Tier)}
              style={inputStyle()}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  Tier {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <input
              value={f.city}
              onChange={(e) => set("city", e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Buyer name">
            <input
              value={f.buyer_name}
              onChange={(e) => set("buyer_name", e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Buyer title">
            <input
              value={f.buyer_title}
              onChange={(e) => set("buyer_title", e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Buyer email">
            <input
              value={f.buyer_email}
              onChange={(e) => set("buyer_email", e.target.value)}
              type="email"
              style={inputStyle()}
            />
          </Field>
          <Field label="Buyer phone">
            <input
              value={f.buyer_phone}
              onChange={(e) => set("buyer_phone", e.target.value)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Status">
            <select
              value={f.status}
              onChange={(e) => set("status", e.target.value as Status)}
              style={inputStyle()}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Notes">
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              style={{ ...inputStyle(), resize: "vertical" }}
            />
          </Field>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 22,
            flexWrap: "wrap",
          }}
        >
          <button
            disabled={!dirty || isPending}
            onClick={save}
            style={{
              background: dirty && !isPending ? COLOR.ink : COLOR.rule,
              color: COLOR.paper,
              border: "none",
              padding: "10px 22px",
              fontSize: 11,
              cursor: dirty && !isPending ? "pointer" : "default",
              opacity: dirty ? 1 : 0.5,
              ...smallCaps,
            }}
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          {feedback && (
            <span
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 14,
                color: feedback.kind === "ok" ? COLOR.positive : COLOR.flag,
              }}
            >
              {feedback.msg}
            </span>
          )}
        </div>
      </section>

      {/* Touchpoints */}
      <TouchpointSection accountId={account.id} touchpoints={touchpoints} />

      <style>{`
        @media (max-width: 720px) {
          .detail-main { padding: 32px 18px 80px !important; }
        }
      `}</style>
    </main>
  );
}

function TouchpointSection({
  accountId,
  touchpoints,
}: {
  accountId: string;
  touchpoints: Touchpoint[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [type, setType] = useState<TouchpointType>("Box Sent");
  const [summary, setSummary] = useState("");

  function reset() {
    setDate(today());
    setType("Box Sent");
    setSummary("");
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await addTouchpoint({
        account_id: accountId,
        date,
        type,
        summary,
      });
      if (res.ok) {
        setAdding(false);
        reset();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 18,
          flexWrap: "wrap",
          rowGap: 10,
        }}
      >
        <p style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>
          Touchpoints — {touchpoints.length}
        </p>
        <button
          onClick={() => {
            setAdding((a) => !a);
            setError(null);
          }}
          style={{
            background: adding ? COLOR.rule : COLOR.ink,
            color: adding ? COLOR.ink : COLOR.paper,
            border: "none",
            padding: "8px 18px",
            fontSize: 11,
            cursor: "pointer",
            ...smallCaps,
          }}
        >
          {adding ? "Close" : "Add touchpoint"}
        </button>
      </div>

      {adding && (
        <div
          style={{
            border: `1px solid ${COLOR.ruleBold}`,
            background: COLOR.paperDeep,
            padding: "24px 24px 20px",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 200px",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle()}
              />
            </Field>
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TouchpointType)}
                style={inputStyle()}
              >
                {TOUCHPOINT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Summary">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Box dispatched via Royal Mail Special Delivery, signed-for, expected arrival 14 May."
              style={{ ...inputStyle(), resize: "vertical" }}
            />
          </Field>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 18,
              flexWrap: "wrap",
            }}
          >
            <button
              disabled={isPending}
              onClick={save}
              style={{
                background: isPending ? COLOR.rule : COLOR.ink,
                color: COLOR.paper,
                border: "none",
                padding: "9px 20px",
                fontSize: 11,
                cursor: isPending ? "default" : "pointer",
                ...smallCaps,
              }}
            >
              {isPending ? "Saving…" : "Save touchpoint"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                reset();
              }}
              disabled={isPending}
              style={{
                background: "transparent",
                color: COLOR.muted,
                border: `1px solid ${COLOR.rule}`,
                padding: "9px 20px",
                fontSize: 11,
                cursor: "pointer",
                ...smallCaps,
              }}
            >
              Cancel
            </button>
            {error && (
              <span
                style={{
                  fontFamily: FONT.serif,
                  fontStyle: "italic",
                  fontSize: 14,
                  color: COLOR.flag,
                }}
              >
                {error}
              </span>
            )}
          </div>
        </div>
      )}

      {touchpoints.length === 0 ? (
        <p
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 15,
            color: COLOR.muted,
            borderTop: `1px solid ${COLOR.rule}`,
            paddingTop: 20,
          }}
        >
          No touchpoints logged yet.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr
              style={{
                borderTop: `2px solid ${COLOR.ink}`,
                borderBottom: `1px solid ${COLOR.ruleBold}`,
              }}
            >
              <th style={thStyle("left", 110)}>Date</th>
              <th style={thStyle("left", 130)}>Type</th>
              <th style={thStyle("left")}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {touchpoints.map((t) => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color: COLOR.muted,
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                    ...tabularNums,
                  }}
                >
                  {fmtDate(t.date)}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    color: COLOR.accent,
                    fontSize: 11,
                    verticalAlign: "top",
                    ...smallCaps,
                  }}
                >
                  {t.type}
                </td>
                <td
                  style={{
                    padding: "14px 12px",
                    fontFamily: FONT.serif,
                    fontSize: 15,
                    color: COLOR.ink,
                    lineHeight: 1.5,
                  }}
                >
                  {t.summary}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }}
              />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

function thStyle(align: "left" | "right", width?: number): React.CSSProperties {
  return {
    padding: "12px 12px",
    textAlign: align,
    fontSize: 10,
    color: COLOR.muted,
    fontWeight: 500,
    whiteSpace: "nowrap",
    width,
    ...smallCaps,
  };
}
