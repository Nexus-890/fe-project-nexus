import AuctionRoomPage from "../../../../features/AuctionRoomPage";

export default async function Page({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = await params;
  return <AuctionRoomPage auctionId={auctionId} />;
}
