"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { TicketPercent } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPagination } from "../components/AdminPrimitives";
import { formatVND } from "../components/formatPrice";
import { sellerPrimary } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { claimVoucher, getClaimableVouchers } from "../service/promotionService";
import { useAdminAction } from "./useAdminAction";

function ClaimableContents({ productId }: { productId?: string }) {
  const auth = useAuth(); const pathname = usePathname(); const [page, setPage] = useState(0); const [claimed, setClaimed] = useState<string[]>([]); const [notice, setNotice] = useState("");
  const filters = { page, size: 4, ...(productId ? { productId } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.public(filters), service: (signal) => getClaimableVouchers(filters, { signal }) }, { retry: false });
  const action = useAdminAction((id: string, options) => claimVoucher(id, options), [queryKeys.promotions.root(auth.sessionId)], (entry) => { setClaimed((current) => [...current, entry.voucher.id]); setNotice(`${entry.voucher.code} added to My vouchers.`); });
  const buyer = auth.user?.roles.includes("BUYER");
  return <section id={productId ? "product-vouchers" : "vouchers"} aria-label="Available vouchers" className="space-y-4 [&_button]:min-h-11 [&_button]:min-w-11">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-heading-20"><TicketPercent size={20} className="text-primary" aria-hidden="true" />Vouchers for you</h2><Link href="/vouchers" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">My vouchers</Link></div>
    <AdminError error={result.error} onRetry={() => void result.refetch()} /><AdminError error={action.error} />
    {result.isPending && <p role="status" className="text-sm text-muted-foreground">Loading vouchers…</p>}
    <div className="grid gap-3 sm:grid-cols-2">{result.data?.content.map((voucher) => <article key={voucher.id} className="flex min-w-0 overflow-hidden rounded-sm border border-primary/25 bg-card"><div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-dashed border-primary/25 bg-primary/5 p-3 text-primary"><strong className="break-all text-center text-lg">{voucher.discountType === "PERCENT" ? `${voucher.discountValue}%` : formatVND(String(voucher.discountValue))}</strong><span className="mt-1 text-[10px]">{voucher.sourceType}</span></div><div className="min-w-0 flex-1 p-3"><h3 className="break-words text-sm font-medium">{voucher.name}</h3><p className="mt-1 break-all font-mono text-xs">{voucher.code}</p><p className="mt-1 text-xs text-muted-foreground">Min. {formatVND(String(voucher.minOrderAmount ?? 0))}{voucher.maxDiscountAmount != null && ` · Max. ${formatVND(String(voucher.maxDiscountAmount))}`}</p><p className="mt-1 text-xs text-muted-foreground">Valid until {new Date(voucher.validUntil).toLocaleDateString()}</p>{voucher.termsText && <details className="mt-2 text-xs"><summary className="cursor-pointer text-primary">Terms</summary><p className="mt-2 whitespace-pre-wrap">{voucher.termsText}</p></details>}
      {buyer ? <button className={`${sellerPrimary} mt-3`} disabled={action.isPending || claimed.includes(voucher.id)} onClick={() => action.run(voucher.id)}>{claimed.includes(voucher.id) ? "Claimed" : "Claim"}</button> : auth.status === "anonymous" ? <Link href={`/sign-in?returnTo=${encodeURIComponent(pathname)}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-primary">Sign in to claim</Link> : <p className="mt-2 text-xs text-muted-foreground">Buyer account required to claim.</p>}
    </div></article>)}</div>
    {result.data?.content.length === 0 && <AdminEmptyState title="No claimable vouchers right now" />}{notice && <p role="status" className="text-sm text-success">{notice}</p>}{result.data && result.data.page.totalPages > 1 && <div className="[&_button]:min-h-11 [&_button]:min-w-11"><AdminPagination page={result.data.page} onPageChange={setPage} /></div>}
  </section>;
}
function ClaimableVouchers({ productId }: { productId?: string }) {
  const auth = useAuth();
  return <ClaimableContents key={`${auth.sessionId}-${productId ?? "home"}`} productId={productId} />;
}
export default ClaimableVouchers;
