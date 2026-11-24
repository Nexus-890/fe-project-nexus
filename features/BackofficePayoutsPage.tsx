"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import AdminPayoutsPage from "./AdminPayoutsPage";
import SellerPayoutsPage from "./SellerPayoutsPage";
import { readBackofficeRoles } from "./backofficeAccess";

function BackofficePayoutsPage() {
  const auth = useAuth();
  const params = useSearchParams();
  const roles = readBackofficeRoles(auth.accessToken);
  const admin = roles.includes("ADMIN");
  const seller = roles.includes("SELLER");
  const own = seller && (!admin || params.get("view") === "seller");
  if (auth.status !== "authenticated" || !admin && !seller) return null;
  return <>
    {admin && seller && <nav aria-label="Payout workspace" className="flex flex-wrap gap-3"><Link href="/backoffice/payouts" className={own ? sellerButton : sellerPrimary} aria-current={!own ? "page" : undefined}>Manage payouts</Link><Link href="/backoffice/payouts?view=seller" className={own ? sellerPrimary : sellerButton} aria-current={own ? "page" : undefined}>My payouts</Link></nav>}
    {own ? <SellerPayoutsPage /> : <AdminPayoutsPage />}
  </>;
}

export default BackofficePayoutsPage;
