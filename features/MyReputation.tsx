"use client";

import Link from "next/link";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { getReputationRestrictions } from "../service/ratingModerationService";
import { AdminError, AdminPagination } from "../components/AdminPrimitives";
import ReputationRestrictionList from "../components/ReputationRestrictionList";
import SellerReputation from "./SellerReputation";
import { useState } from "react";

function MyReputation({ restrictionsOnly = false }: { restrictionsOnly?: boolean }) {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const restrictions = useApiQuery({
    queryKey: queryKeys.reputation.restrictions(auth.sessionId, auth.user?.id ?? "", page), meta: { requiresAuth: true },
    service: (signal) => getReputationRestrictions(auth.user?.id ?? "", page, { context: auth.requestContext, signal }),
  }, { enabled: restrictionsOnly && auth.status === "authenticated" && Boolean(auth.user), retry: false });
  if (!restrictionsOnly) return <div id="reputation" className="space-y-3"><SellerReputation sellerId={auth.user?.id} title="Reputation" /><Link href="/ratings" className="inline-flex min-h-11 items-center text-sm text-primary underline">View ratings received and submit a dispute</Link></div>;
  return <section id="penalty-history" aria-label="Penalty History" className="rounded-sm border border-border p-4 sm:p-6">
    <h2 className="text-base font-semibold">Penalty History</h2><p className="mt-1 text-sm text-muted-foreground">Action restrictions and their reasons. An active restriction also applies when your trust score meets the minimum.</p>
    {restrictions.isPending ? <p role="status" className="py-4 text-sm">Loading action restrictions…</p> : restrictions.error ? <AdminError error={restrictions.error} onRetry={() => void restrictions.refetch()} /> : restrictions.data && <><ReputationRestrictionList items={restrictions.data.items} /><AdminPagination page={restrictions.data.page} onPageChange={setPage} /></>}
  </section>;
}

export default MyReputation;
