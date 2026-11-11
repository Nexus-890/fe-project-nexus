import { notFound } from "next/navigation";
import SellerProductsPage from "../../../features/SellerProductsPage";
import SellerInventoryPage from "../../../features/SellerInventoryPage";
import SellerAuctionsPage from "../../../features/SellerAuctionsPage";
import SellerOrdersPage from "../../../features/SellerOrdersPage";

async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "products") return <SellerProductsPage />;
  if (section === "inventory") return <SellerInventoryPage />;
  if (section === "auctions") return <SellerAuctionsPage />;
  if (section === "orders") return <SellerOrdersPage />;
  notFound();
}
export default Page;
