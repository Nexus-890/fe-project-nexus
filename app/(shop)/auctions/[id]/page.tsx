import AuctionRoomPage from "@/features/AuctionRoomPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuctionRoomPage auctionId={id} />;
}
