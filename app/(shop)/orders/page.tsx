import OrdersPage from "@/features/OrdersPage";

async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { payment, groupId } = await searchParams;
  return <OrdersPage confirmedGroupId={payment === "confirmed" && typeof groupId === "string" ? groupId : undefined} />;
}

export default Page;
