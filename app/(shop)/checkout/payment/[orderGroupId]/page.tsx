import CheckoutPaymentPage from "@/features/CheckoutPaymentPage";

async function Page({ params }: { params: Promise<{ orderGroupId: string }> }) {
  const { orderGroupId } = await params;
  return <CheckoutPaymentPage orderGroupId={orderGroupId} />;
}

export default Page;
