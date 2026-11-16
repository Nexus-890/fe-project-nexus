"use client";

import { useAuth } from "../hooks/useAuth";
import { SellerPanel } from "../components/SellerUi";
import { PayoutHistory } from "./SellerPayoutsPage";
import { readBackofficeRoles } from "./backofficeAccess";
import AdminBankAccountsPanel from "./AdminBankAccountsPanel";

function AdminPayoutsPage() {
  const auth = useAuth();
  const isAdmin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  if (!isAdmin) return <SellerPanel title="403 · Administrator access required"><p className="text-sm text-muted-foreground">Only administrators can inspect all seller payouts.</p></SellerPanel>;
  return <><PayoutHistory key={auth.sessionId} managed /><AdminBankAccountsPanel key={`banks:${auth.sessionId}`} /></>;
}

export default AdminPayoutsPage;
