import { redirect } from "next/navigation";

async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  redirect(`/orders/${encodeURIComponent(orderId)}`);
}

export default Page;
