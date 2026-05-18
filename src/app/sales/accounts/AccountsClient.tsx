"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLOR, FONT, smallCaps, tabularNums } from "@/lib/design";
import {
  CATEGORIES,
  STATUSES,
  TIERS,
  type Account,
  type Category,
  type Status,
  type Tier,
  statusRank,
} from "@/lib/sales-data";
import { createAccount, type NewAccountInput } from "@/app/actions/sales";

export type AccountRow = Account & { lastTouchpoint: string | null };

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

type SortKey =
  | "default"
  | "name"
  | "category"
  | "tier"
  | "city"
  | "buyer_name"
  | "buyer_title"
  | "status"
  | "lastTouchpoint";

const COLUMNS: { key: Exclude<SortKey, "default">; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Name", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "tier", label: "Tier", align: "right" },
  { key: "city", label: "City", align: "left" },
  { key: "buyer_name", label: "Buyer", align: "left" },
  { key: "buyer_title", label: "Title", align: "left" },
  { key: "status", label: "Status", align: "left" },
  { key: "lastTouchpoint", label: "Last touch", align: "right" },
];

export default function AccountsClient({ rows }: { rows: AccountRow[] }) {
  const [catFilter, setCatFilter] = useState<Set<Category>>(new Set());
  const [tierFilter, setTierFilter] = useState<Set<Tier>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<Status>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (catFilter.size && !catFilter.has(r.category)) return false;
      if (tierFilter.size && !tierFilter.has(r.tier)) return false;
      if (statusFilter.size && !statusFilter.has(r.status)) return false;
      return true;
    });
  }, [rows, catFilter, tierFilter, statusFilter]);

  const sorted = useMemo(() => {
    const list = filtered.slice();
    if (sortKey === "default") {
      list.sort(
        (a, b) =>
          a.tier - b.tier ||
          statusRank(a.status) - statusRank(b.status) ||
          a.name.localeCompare(b.name),
      );
      return list;
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "tier":
          cmp = a.tier - b.tier;
          break;
        case "status":
          cmp = statusRank(a.status) - statusRank(b.status);
          break;
        case "lastTouchpoint":
          cmp = (a.lastTouchpoint ?? "").localeCompare(b.lastTouchpoint ?? "");
          break;
        default:
          cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      }
      return cmp * sortDir || a.name.localeCompare(b.name);
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  function clickHeader(key: Exclude<SortKey, "default">) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function toggle<T>(set: Set<T>, setter: (s: Set<T>) => void, value: T) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  return (
    <main
      className="accounts-main"
      style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 40px 120px" }}
    >
      {/* Masthead */}
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: `1px solid ${COLOR.rule}`,
          paddingBottom: 28,
          marginBottom: 28,
          flexWrap: "wrap",
          rowGap: 16,
        }}
      >
        <div>
          <p style={{ fontSize: 10, color: COLOR.accent, marginBottom: 14, ...smallCaps }}>
            Sales · Wholesale outreach
          </p>
          <h1
            style={{
              fontFamily: FONT.serif,
              fontSize: "clamp(36px, 5vw, 52px)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: COLOR.ink,
            }}
          >
            Accounts
          </h1>
          <p
            style={{
              fontFamily: FONT.serif,
              fontStyle: "italic",
              fontSize: 16,
              color: COLOR.muted,
              marginTop: 10,
              maxWidth: 560,
            }}
          >
            Who we are pitching, where they sit, and what has gone out the door.
            {" "}
            {rows.length} account{rows.length === 1 ? "" : "s"}.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{
            background: showForm ? COLOR.rule : COLOR.ink,
            color: showForm ? COLOR.ink : COLOR.paper,
            border: "none",
            padding: "11px 22px",
            fontSize: 11,
            cursor: "pointer",
            ...smallCaps,
          }}
        >
          {showForm ? "Close" : "New account"}
        </button>
      </section>

      {showForm && (
        <NewAccountForm
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Filters */}
      <section style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 14 }}>
        <FilterRow label="Category">
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={catFilter.has(c)}
              onClick={() => toggle(catFilter, setCatFilter, c)}
            >
              {c}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Tier">
          {TIERS.map((t) => (
            <Chip
              key={t}
              active={tierFilter.has(t)}
              onClick={() => toggle(tierFilter, setTierFilter, t)}
            >
              Tier {t}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          {STATUSES.map((s) => (
            <Chip
              key={s}
              active={statusFilter.has(s)}
              onClick={() => toggle(statusFilter, setStatusFilter, s)}
            >
              {s}
            </Chip>
          ))}
        </FilterRow>
      </section>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            minWidth: 900,
          }}
        >
          <thead>
            <tr
              style={{
                borderTop: `2px solid ${COLOR.ink}`,
                borderBottom: `1px solid ${COLOR.ruleBold}`,
              }}
            >
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => clickHeader(col.key)}
                    style={{
                      padding: "12px 12px",
                      textAlign: col.align,
                      fontSize: 10,
                      color: active ? COLOR.accent : COLOR.muted,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      userSelect: "none",
                      ...smallCaps,
                    }}
                  >
                    {col.label}
                    {active ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  style={{
                    padding: "48px 12px",
                    textAlign: "center",
                    fontFamily: FONT.serif,
                    fontStyle: "italic",
                    color: COLOR.muted,
                  }}
                >
                  No accounts match the current filters.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr
                  key={r.id}
                  className="acct-row"
                  style={{ borderBottom: `1px solid ${COLOR.rule}` }}
                >
                  <td style={td()}>
                    <Link
                      href={`/sales/accounts/${r.id}`}
                      style={{
                        fontFamily: FONT.serif,
                        fontSize: 16,
                        color: COLOR.ink,
                        textDecoration: "none",
                      }}
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td style={td(COLOR.inkSoft)}>{r.category}</td>
                  <td
                    style={{
                      ...td(COLOR.muted),
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      ...tabularNums,
                    }}
                  >
                    {r.tier}
                  </td>
                  <td style={td(COLOR.inkSoft)}>{r.city || "—"}</td>
                  <td style={td(COLOR.inkSoft)}>{r.buyer_name || "—"}</td>
                  <td style={td(COLOR.muted)}>{r.buyer_title || "—"}</td>
                  <td style={td()}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td
                    style={{
                      ...td(COLOR.muted),
                      textAlign: "right",
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      ...tabularNums,
                    }}
                  >
                    {fmtDate(r.lastTouchpoint)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={COLUMNS.length}
                style={{ borderTop: `2px solid ${COLOR.ink}`, padding: 0, height: 2 }}
              />
            </tr>
          </tfoot>
        </table>
      </div>

      <style>{`
        .acct-row:hover { background: ${COLOR.paperDeep}; }
        @media (max-width: 720px) {
          .accounts-main { padding: 36px 18px 80px !important; }
        }
      `}</style>
    </main>
  );
}

function td(color: string = COLOR.ink): React.CSSProperties {
  return { padding: "14px 12px", color, verticalAlign: "middle" };
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
      <span
        style={{
          fontSize: 10,
          color: COLOR.muted,
          width: 64,
          flexShrink: 0,
          ...smallCaps,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? COLOR.ink : "transparent",
        color: active ? COLOR.paper : COLOR.inkSoft,
        border: `1px solid ${active ? COLOR.ink : COLOR.rule}`,
        padding: "5px 12px",
        fontSize: 12,
        fontFamily: FONT.sans,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

const STATUS_COLOR: Record<Status, string> = {
  Researching: COLOR.muted,
  "Box Sent": COLOR.accent,
  "Followed Up": COLOR.accentSoft,
  Replied: COLOR.positive,
  Live: COLOR.positive,
  Declined: COLOR.flag,
  "No Response": COLOR.mutedLight,
};

export function StatusBadge({ status }: { status: Status }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 11,
        color: c,
        whiteSpace: "nowrap",
        ...smallCaps,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c,
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

// ─── New account form ────────────────────────────────────────────────────────

function NewAccountForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<NewAccountInput>({
    name: "",
    category: "Other",
    tier: 2,
    city: "",
    buyer_name: "",
    buyer_title: "",
    buyer_email: "",
    buyer_phone: "",
    status: "Researching",
    notes: "",
  });

  function set<K extends keyof NewAccountInput>(key: K, value: NewAccountInput[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createAccount(f);
      if (res.ok) {
        router.push(`/sales/accounts/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section
      style={{
        border: `1px solid ${COLOR.ruleBold}`,
        background: COLOR.paperDeep,
        padding: "28px 28px 24px",
        marginBottom: 32,
      }}
    >
      <p style={{ fontSize: 10, color: COLOR.muted, marginBottom: 18, ...smallCaps }}>
        New account
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
            placeholder="Selfridges"
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
            placeholder="London"
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
            placeholder="Head of Food"
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
          disabled={isPending}
          onClick={save}
          style={{
            background: isPending ? COLOR.rule : COLOR.ink,
            color: COLOR.paper,
            border: "none",
            padding: "10px 22px",
            fontSize: 11,
            cursor: isPending ? "default" : "pointer",
            ...smallCaps,
          }}
        >
          {isPending ? "Saving…" : "Save account"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          style={{
            background: "transparent",
            color: COLOR.muted,
            border: `1px solid ${COLOR.rule}`,
            padding: "10px 22px",
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
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 10, color: COLOR.muted, ...smallCaps }}>{label}</span>
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );
}

export function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
    background: COLOR.paper,
    border: `1px solid ${COLOR.rule}`,
    color: COLOR.ink,
    fontFamily: FONT.sans,
  };
}
