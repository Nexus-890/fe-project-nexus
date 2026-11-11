import BuyerCheckoutPreviewPage from "../../../../features/BuyerCheckoutPreviewPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return <BuyerCheckoutPreviewPage stage="detail" outcome={state === "unpaid" ? "unpaid" : "paid"} />;
}
