import Link from "next/link";

import { COLOR, tabularNums } from "@/lib/design";
import { dueDate, lineText, stageLabel, waitingOn, type OrderRow } from "@/lib/erp/orders";

export function shortDate(iso: string | null): string {
  if (!iso) return "None";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

const cell = { padding: "12px 12px 12px 0", verticalAlign: "top" as const };
const head = { ...cell, padding: "8px 12px 8px 0", fontWeight: 400, fontSize: 12, color: COLOR.muted, textAlign: "left" as const };

/** Shared by the home page and the orders page, so both say the same thing. */
export function OrdersTable({ orders, today }: { orders: OrderRow[]; today: string }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 14, lineHeight: 1.4 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLOR.ruleBold}` }}>
            <th style={head}>Order</th>
            <th style={head}>What</th>
            <th style={head}>Stage</th>
            <th style={head}>Date</th>
            <th style={{ ...head, paddingRight: 0 }}>Waiting on</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const waiting = waitingOn(o, today);
            return (
              <tr key={o.id} style={{ borderBottom: `1px solid ${COLOR.rule}` }}>
                <td style={cell}>
                  <Link href={`/sell/orders/${o.id}`} style={{ color: COLOR.ink }}>
                    {o.customerName}
                  </Link>
                  <div style={{ fontSize: 12, color: COLOR.muted, ...tabularNums }}>{o.orderNumber}</div>
                </td>
                <td style={cell}>
                  {o.lines.length === 0 ? (
                    <span style={{ color: COLOR.muted }}>No lines yet</span>
                  ) : (
                    // A line at zero moved to another order and stays only as history.
                    o.lines.filter((l) => Number(l.qty) > 0).map((l) => <div key={l.id}>{lineText(l)}</div>)
                  )}
                </td>
                <td style={cell}>{stageLabel(o.status)}</td>
                <td style={{ ...cell, whiteSpace: "nowrap", color: waiting.overdue ? COLOR.flag : dueDate(o) ? COLOR.ink : COLOR.muted }}>
                  {shortDate(dueDate(o))}
                </td>
                <td style={{ ...cell, paddingRight: 0, color: waiting.overdue ? COLOR.flag : COLOR.ink }}>{waiting.text}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
