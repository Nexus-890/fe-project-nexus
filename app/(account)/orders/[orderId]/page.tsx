import BuyerOrderDetailPage from "@/features/BuyerOrderDetailPage";

async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <BuyerOrderDetailPage orderId={orderId} />;
}

export default Page;
