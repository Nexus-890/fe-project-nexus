import BackofficeAuctionsPage from "../../../../../features/BackofficeAuctionsPage";

async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BackofficeAuctionsPage auctionId={id} />;
}

export default Page;
