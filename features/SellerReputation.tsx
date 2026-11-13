"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getSellerReputation } from "../service/ratingService";

const trustLabels = { NEW: "New", BASIC: "Standard", TRUSTED: "Trusted", TOP: "Top Seller" };

function SellerReputation({ sellerId, compact = false }: { sellerId?: string | null; compact?: boolean }) {
  const auth = useAuth();
  const reputation = useApiQuery({
    queryKey: queryKeys.reputation.seller(auth.sessionId, sellerId ?? ""), meta: { requiresAuth: true },
    service: (signal) => getSellerReputation(sellerId ?? "", { context: auth.requestContext, signal }),
  }, { enabled: !!sellerId && auth.status === "authenticated", retry: false });

  const wrapper = compact ? "border-t border-border px-3 py-3 text-xs" : "rounded-sm border border-border p-4 text-sm";
  if (!sellerId) return <p className={`${wrapper} text-muted-foreground`}>Seller reputation unavailable</p>;
  if (auth.status === "anonymous") return <p className={`${wrapper} text-muted-foreground`}><Link href="/sign-in" className="underline">Sign in to see seller reputation</Link></p>;
  if (auth.status === "error") return <p className={`${wrapper} text-muted-foreground`}>Sign in to see seller reputation.</p>;
  if (auth.status !== "authenticated" || reputation.isPending) return <p role="status" className={`${wrapper} text-muted-foreground`}>Loading seller reputation…</p>;
  if (reputation.isError) return <div className={wrapper}><p className="text-muted-foreground">Seller reputation is unavailable.</p><button type="button" disabled={reputation.isFetching} onClick={() => void reputation.refetch()} className="mt-1 min-h-9 text-primary underline">Retry reputation</button></div>;
  const current = reputation.data;
  return <section aria-label="Seller reputation" className={wrapper}>
    {!compact && <h2 className="mb-3 font-semibold">Seller reputation</h2>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1"><ShieldCheck size={14} aria-hidden="true" className="text-info" />{trustLabels[current.trustLevel]}</span><span className="font-medium">{current.score}/100 <span className="font-normal text-muted-foreground">trust score</span></span></div>
    {!compact && <p className="mt-3 text-xs text-muted-foreground">{current.successfulTransaction} successful transactions · {current.totalTransaction} total</p>}
  </section>;
}

export default SellerReputation;
