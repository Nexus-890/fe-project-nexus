import { notFound } from "next/navigation";
import SellerOverviewPage from "../../../../features/SellerOverviewPage";
import SellerProductsPage from "../../../../features/SellerProductsPage";
import SellerProductEditorPage from "../../../../features/SellerProductEditorPage";
import SellerInventoryPage from "../../../../features/SellerInventoryPage";
import SellerAuctionsPage from "../../../../features/SellerAuctionsPage";
import SellerAuctionEditorPage from "../../../../features/SellerAuctionEditorPage";
import SellerOrdersPage from "../../../../features/SellerOrdersPage";

async function Page({ params }: { params: Promise<{ segments?: string[] }> }) {
  const segments = (await params).segments ?? [];
  if (!segments.length) return <SellerOverviewPage />;
  if (segments.length === 1 && segments[0] === "products") return <SellerProductsPage />;
  if (segments.length === 2 && segments[0] === "products") return <SellerProductEditorPage productId={segments[1]} />;
  if (segments.length === 1 && segments[0] === "inventory") return <SellerInventoryPage />;
  if (segments.length === 1 && segments[0] === "auctions") return <SellerAuctionsPage />;
  if (segments.length === 2 && segments[0] === "auctions" && segments[1] === "new") return <SellerAuctionEditorPage />;
  if (segments.length === 1 && segments[0] === "orders") return <SellerOrdersPage />;
  notFound();
}
export default Page;
