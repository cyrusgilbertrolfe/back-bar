import Nav from "@/components/Nav";
import { COLOR } from "@/lib/design";
import {
  getAccounts,
  getTouchpoints,
  lastTouchpointDate,
} from "@/lib/sales-data";
import AccountsClient, { type AccountRow } from "./AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, touchpoints] = await Promise.all([
    getAccounts(),
    getTouchpoints(),
  ]);

  const rows: AccountRow[] = accounts.map((a) => ({
    ...a,
    lastTouchpoint: lastTouchpointDate(a.id, touchpoints),
  }));

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <AccountsClient rows={rows} />
    </div>
  );
}
