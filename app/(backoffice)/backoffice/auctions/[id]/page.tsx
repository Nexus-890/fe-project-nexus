import SellerAuctionEditorPage from "../../../../../features/SellerAuctionEditorPage";

async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SellerAuctionEditorPage auctionId={id} />;
}

export default Page;
