import { Suspense } from "react";
import OrdersPage from "../../../features/OrdersPage";

async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { payment, groupId } = await searchParams;
  const confirmedGroupId = payment === "confirmed" && typeof groupId === "string" ? groupId : undefined;
  return <Suspense fallback={<p role="status" className="p-8">Loading your orders…</p>}><OrdersPage confirmedGroupId={confirmedGroupId} /></Suspense>;
}

export default Page;
