"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { TicketPercent } from "lucide-react";
import { AdminEmptyState, AdminError, AdminPagination } from "../components/AdminPrimitives";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { claimVoucher, getClaimableVouchers } from "../service/promotionService";
import { useAdminAction } from "./useAdminAction";

const sourceLabels: Record<string, string> = { PLATFORM: "Nexus", SHOP: "Shop", EVENT: "Event" };
const shortVnd = (value: number) => value >= 1000 && value % 1000 === 0 ? `${(value / 1000).toLocaleString("vi-VN")}K` : formatVND(String(value));
const ticketDate = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function ClaimableContents({ productId }: { productId?: string }) {
  const auth = useAuth(); const pathname = usePathname(); const [page, setPage] = useState(0); const [claimed, setClaimed] = useState<string[]>([]); const [notice, setNotice] = useState("");
  const filters = { page, size: 4, ...(productId ? { productId } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.public(filters), service: (signal) => getClaimableVouchers(filters, { signal }) }, { retry: false });
  const action = useAdminAction((id: string, options) => claimVoucher(id, options), [queryKeys.promotions.root(auth.sessionId)], (entry) => { setClaimed((current) => [...current, entry.voucher.id]); setNotice(`${entry.voucher.code} added to My vouchers.`); });
  const buyer = auth.user?.roles.includes("BUYER");
  return <section id={productId ? "product-vouchers" : "vouchers"} aria-label="Available vouchers" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-heading-20"><TicketPercent size={20} className="text-primary" aria-hidden="true" />Vouchers for you</h2><Link href="/vouchers" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">My vouchers</Link></div>
    <AdminError error={result.error} onRetry={() => void result.refetch()} /><AdminError error={action.error} />
    {result.isPending && <p role="status" className="text-sm text-muted-foreground">Loading vouchers…</p>}
    <div className="@container"><div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">{result.data?.content.map((voucher) => <article key={voucher.id} className="relative flex min-w-0 overflow-hidden rounded-md border border-border bg-card text-sm">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-primary px-1.5 py-2 text-center text-primary-foreground">
        <span className="text-[9px] font-semibold uppercase tracking-wider">{sourceLabels[voucher.sourceType] ?? voucher.sourceType}</span>
        <strong className="mt-0.5 break-all text-base leading-tight">{voucher.discountType === "PERCENT" ? `${Number(voucher.discountValue)}%` : shortVnd(voucher.discountValue)}</strong>
        <span className="text-[9px] font-semibold uppercase tracking-wider">off</span>
      </div>
      <span aria-hidden="true" className="absolute -top-1.5 left-16 size-3 -translate-x-1/2 rounded-full border border-border bg-background" />
      <span aria-hidden="true" className="absolute -bottom-1.5 left-16 size-3 -translate-x-1/2 rounded-full border border-border bg-background" />
      <div className="flex min-w-0 flex-1 items-center gap-2 border-l border-dashed border-primary/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={voucher.name}>{voucher.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Min {formatVND(String(voucher.minOrderAmount ?? 0))}{voucher.maxDiscountAmount != null && ` · Up to ${formatVND(String(voucher.maxDiscountAmount))}`}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"><span className="break-all rounded-sm border border-dashed border-primary/50 px-1 font-mono text-primary">{voucher.code}</span><span className="text-muted-foreground">Use by {ticketDate(voucher.validUntil)}</span></p>
          {voucher.termsText && <details className="mt-1 text-xs"><summary className="cursor-pointer text-primary">Terms</summary><p className="mt-1 whitespace-pre-wrap">{voucher.termsText}</p></details>}
        </div>
        {buyer ? <button className="inline-flex min-h-8 shrink-0 items-center rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground" disabled={action.isPending || claimed.includes(voucher.id)} onClick={() => action.run(voucher.id)}>{claimed.includes(voucher.id) ? "Claimed" : "Claim"}</button>
          : auth.status === "anonymous" ? <Link href={`/sign-in?returnTo=${encodeURIComponent(pathname)}`} className="shrink-0 text-xs font-medium text-primary">Sign in to claim</Link>
          : <span className="max-w-20 shrink-0 text-right text-[11px] text-muted-foreground">Buyers only</span>}
      </div>
    </article>)}</div></div>
    {result.data?.content.length === 0 && <AdminEmptyState title="No claimable vouchers right now" />}{notice && <p role="status" className="text-sm text-success">{notice}</p>}{result.data && result.data.page.totalPages > 1 && <div className="[&_button]:min-h-11 [&_button]:min-w-11"><AdminPagination page={result.data.page} onPageChange={setPage} /></div>}
  </section>;
}
function ClaimableVouchers({ productId }: { productId?: string }) {
  const auth = useAuth();
  return <ClaimableContents key={`${auth.sessionId}-${productId ?? "home"}`} productId={productId} />;
}
export default ClaimableVouchers;
