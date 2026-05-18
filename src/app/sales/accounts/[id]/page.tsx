import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { COLOR } from "@/lib/design";
import { getAccount, getTouchpointsForAccount } from "@/lib/sales-data";
import AccountDetailClient from "./AccountDetailClient";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const touchpoints = await getTouchpointsForAccount(id);

  return (
    <div style={{ background: COLOR.paper, color: COLOR.ink, minHeight: "100vh" }}>
      <Nav />
      <AccountDetailClient account={account} touchpoints={touchpoints} />
    </div>
  );
}
