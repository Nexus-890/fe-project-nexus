import { notFound } from "next/navigation";
import CheckoutPaymentPage from "@/features/CheckoutPaymentPage";

async function Page({ params }: { params: Promise<{ orderGroupId: string }> }) {
  const { orderGroupId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderGroupId)) notFound();
  return <CheckoutPaymentPage orderGroupId={orderGroupId} />;
}

export default Page;
