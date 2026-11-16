"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { useAuth } from "../hooks/useAuth";
import AdminAuctionsPage from "./AdminAuctionsPage";
import AdminAuctionDetailPage from "./AdminAuctionDetailPage";
import SellerAuctionsPage from "./SellerAuctionsPage";
import SellerAuctionEditorPage from "./SellerAuctionEditorPage";
import { readBackofficeRoles, resolveAuctionWorkspace, sellerAuctionHref } from "./backofficeAccess";

/** Mount only the role's auction feature so seller and management queries stay separate. */
function BackofficeAuctionsPage({ auctionId }: { auctionId?: string }) {
  const auth = useAuth();
  const params = useSearchParams();
  if (auth.status !== "authenticated") return null;
  const roles = readBackofficeRoles(auth.accessToken);
  const workspace = resolveAuctionWorkspace(roles, params.get("view"));
  if (!workspace) return null;
  const mixedRoles = roles.includes("SELLER") && (roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF"));
  return <>
    {mixedRoles && <nav aria-label="Auction workspace" className="flex flex-wrap gap-3"><Link href="/backoffice/auctions" aria-current={workspace === "manage" ? "page" : undefined} className={workspace === "manage" ? sellerPrimary : sellerButton}>Manage auctions</Link><Link href={sellerAuctionHref(roles)} aria-current={workspace === "seller" ? "page" : undefined} className={workspace === "seller" ? sellerPrimary : sellerButton}>My auctions</Link></nav>}
    {workspace === "manage" ? auctionId ? <AdminAuctionDetailPage auctionId={auctionId} /> : <AdminAuctionsPage /> : auctionId ? <SellerAuctionEditorPage auctionId={auctionId} /> : <SellerAuctionsPage />}
  </>;
}

export default BackofficeAuctionsPage;
