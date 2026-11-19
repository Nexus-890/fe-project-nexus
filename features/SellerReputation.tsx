"use client";

import Link from "next/link";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getSellerReputation } from "../service/ratingService";
import { TrustScoreGauge } from "../components/TrustScoreGauge";

const trustLabels = { NEW: "New seller", BASIC: "Standard seller", TRUSTED: "Trusted seller", TOP: "Top Seller" };
const trustColors = { NEW: "text-muted-foreground", BASIC: "text-info", TRUSTED: "text-success", TOP: "text-primary" };

function SellerReputation({ sellerId, compact = false, title = "Seller reputation" }: { sellerId?: string | null; compact?: boolean; title?: string }) {
  const auth = useAuth();
  const reputation = useApiQuery({
    queryKey: queryKeys.reputation.seller(auth.sessionId, sellerId ?? ""), meta: { requiresAuth: true },
    service: (signal) => getSellerReputation(sellerId ?? "", { context: auth.requestContext, signal }),
  }, { enabled: !!sellerId && auth.status === "authenticated", retry: false });

  if (compact) {
    if (!sellerId || auth.status !== "authenticated" || !reputation.isSuccess) return null;
    const label = `${trustLabels[reputation.data.trustLevel]} · trust score ${reputation.data.score}/100`;
    return <section aria-label="Seller reputation" title={label} className="inline-flex items-center gap-1">
      <TrustScoreGauge score={reputation.data.score} size="sm" />
      <span aria-hidden="true" className="text-[7px] font-semibold uppercase leading-[1.1] tracking-wide text-foreground">Trust<br />score</span>
      <span className="sr-only">{trustLabels[reputation.data.trustLevel]}</span>
    </section>;
  }
  const wrapper = "rounded-sm border border-border p-4 text-sm";
  if (!sellerId) return <p className={`${wrapper} text-muted-foreground`}>Seller reputation unavailable</p>;
  if (auth.status === "anonymous") return <p className={`${wrapper} text-muted-foreground`}><Link href="/sign-in" className="inline-flex min-h-11 min-w-11 items-center underline">Sign in to see seller reputation</Link></p>;
  if (auth.status === "error") return <p className={`${wrapper} text-muted-foreground`}>Sign in to see seller reputation.</p>;
  if (auth.status !== "authenticated" || reputation.isPending) return <p role="status" className={`${wrapper} text-muted-foreground`}>Loading seller reputation…</p>;
  if (reputation.isError) return <div className={wrapper}><p className="text-muted-foreground">Seller reputation is unavailable.</p><button type="button" disabled={reputation.isFetching} onClick={() => void reputation.refetch()} className="mt-1 min-h-11 min-w-11 text-primary underline">Retry reputation</button></div>;
  const current = reputation.data;
  return <section aria-label={title} className={wrapper}>
    <h2 className="mb-3 font-semibold">{title}</h2>
    <div className="flex items-center gap-4">
      <TrustScoreGauge score={current.score} />
      <div className="min-w-0">
        <p className={`font-semibold ${trustColors[current.trustLevel]}`}>{trustLabels[current.trustLevel]}</p>
        <p className="mt-1 text-xs text-muted-foreground">{current.successfulTransaction} successful transactions · {current.failedTransaction} failed · {current.totalTransaction} total</p>
      </div>
    </div>
  </section>;
}

export default SellerReputation;
