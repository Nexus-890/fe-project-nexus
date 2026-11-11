import OrderDetailPage from "../../../../../features/OrderDetailPage";
import BuyerCheckoutPreviewPage from "../../../../../features/BuyerCheckoutPreviewPage";

export default async function Page({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ state?: string }> }) {
  const { orderId } = await params;
  if (orderId === "preview") {
    const { state } = await searchParams;
    return <BuyerCheckoutPreviewPage stage={state === "unpaid" ? "unpaid" : "paid"} />;
  }
  return <OrderDetailPage orderId={orderId} result />;
}
