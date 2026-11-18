"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination } from "../components/AdminPrimitives";
import { PromotionSelect } from "../components/PromotionFields";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getVoucherWallet } from "../service/promotionService";

function WalletContents() {
  const auth = useAuth(); const [page, setPage] = useState(0); const [status, setStatus] = useState(""); const filters = { page, ...(status ? { status } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "wallet", filters), meta: { requiresAuth: true }, service: (signal) => getVoucherWallet(filters, { context: auth.requestContext, signal }) }, { refetchOnMount: "always" });
  return <div className="space-y-5"><PromotionSelect name="wallet-status" label="Voucher status" value={status} values={["", "CLAIMED", "USED", "EXPIRED"]} onChange={(v) => { setStatus(v); setPage(0); }} /><AdminError error={result.error} onRetry={() => void result.refetch()} />{result.isPending && <p role="status">Loading your vouchers…</p>}
    <div className="grid gap-4 sm:grid-cols-2">{result.data?.content.map((entry) => <article key={entry.id} className="space-y-2 rounded-sm border border-border bg-card p-5"><p className="text-xs text-primary">{entry.voucher.sourceType} · {entry.status}</p><h2 className="text-heading-20">{entry.voucher.name}</h2><p className="break-all font-mono text-sm">{entry.voucher.code}</p><p className="text-sm">{entry.voucher.discountType === "PERCENT" ? `${entry.voucher.discountValue}%` : formatVND(String(entry.voucher.discountValue))} off · Min. {formatVND(String(entry.voucher.minOrderAmount ?? 0))}</p>{entry.voucher.maxDiscountAmount != null && <p className="text-xs">Max. {formatVND(String(entry.voucher.maxDiscountAmount))}</p>}<p className="text-xs text-muted-foreground">Valid {new Date(entry.voucher.validFrom).toLocaleString()} – {new Date(entry.expiresAt).toLocaleString()}</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{entry.voucher.termsText}</p>{entry.status === "CLAIMED" && <Link href="/cart" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Use in cart</Link>}</article>)}</div>
    {result.data?.content.length === 0 && <AdminEmptyState title="No vouchers found" description="Claim vouchers from the home page or a product page." />}{result.data && result.data.page.totalPages > 1 && <div className="[&_button]:min-h-11 [&_button]:min-w-11"><AdminPagination page={result.data.page} onPageChange={setPage} /></div>}
  </div>;
}
function VoucherWalletPage() {
  const auth = useAuth();
  return <section className="mx-auto w-full max-w-[1248px] space-y-6 [&_button]:min-h-11 [&_button]:min-w-11 px-4 py-8 sm:px-6"><AdminPageHeader title="My vouchers" description="Your claimed discounts, ready for your next purchase." />{auth.status === "authenticated" && auth.user?.roles.includes("BUYER") ? <WalletContents key={auth.sessionId} /> : auth.status === "anonymous" ? <Link className="inline-flex min-h-11 items-center text-primary" href="/sign-in?returnTo=%2Fvouchers">Sign in to view your vouchers</Link> : auth.status === "error" ? <AdminError error={auth.error} onRetry={() => void auth.retryProfile()} /> : <p role="status">{auth.status === "authenticated" ? "A buyer account is required." : "Loading your account…"}</p>}</section>;
}
export default VoucherWalletPage;
