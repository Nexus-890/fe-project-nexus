import AdminAuctionDetailPage from "@/features/AdminAuctionDetailPage";

async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <AdminAuctionDetailPage auctionId={id} />; }
export default Page;
