"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminError, AdminPagination } from "../components/AdminPrimitives";
import { formatVND } from "../components/formatPrice";
import { sellerButton } from "../components/SellerUi";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getVoucherEligibility, getVoucherWallet } from "../service/promotionService";
import type { VoucherQuote } from "../types/promotionType";
import { useVoucherSelection } from "./useVoucherSelection";

const reasons = { MIN_ORDER_NOT_MET: "Minimum spend not reached", NOT_CLAIMED: "Claim this voucher first", EXPIRED: "Voucher expired", LIMIT_REACHED: "Voucher limit reached or already reserved", NOT_ELIGIBLE: "Not eligible for these items or dates", STACKING: "Only one platform/event voucher and one shop voucher per seller can apply" };
export function VoucherQuoteResults({ quotes }: { quotes: VoucherQuote[] }) {
  return <ul className="space-y-2 text-xs" aria-label="Voucher eligibility">{quotes.map((quote) => <li key={quote.code} className={quote.applied ? "text-success" : "text-danger"}><span className="font-mono">{quote.code}</span> · {quote.applied ? `Applied −${formatVND(String(quote.discountAmount))}` : quote.reason ? reasons[quote.reason] : "Not applicable"}{quote.missingAmount != null && quote.missingAmount > 0 && ` · Add ${formatVND(String(quote.missingAmount))} more`}</li>)}</ul>;
}
function VoucherPicker({ disabled = false, cartSignature, onChange }: { disabled?: boolean; cartSignature: string; onChange?: () => void }) {
  const auth = useAuth(); const { codes, setCodes } = useVoucherSelection(); const [page, setPage] = useState(0); const [code, setCode] = useState(""); const [validation, setValidation] = useState("");
  const wallet = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "picker-wallet", { page }), meta: { requiresAuth: true }, service: (signal) => getVoucherWallet({ page, status: "CLAIMED" }, { context: auth.requestContext, signal }) }, { retry: false });
  // Keep the selected codes first when checking additional wallet candidates.
  const candidates = [...new Set([...codes, ...(wallet.data?.content.map((entry) => entry.voucher.code) ?? [])])].slice(0, 50);
  const pricing = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "picker-pricing", { cartSignature, selected: codes, candidates }), meta: { requiresAuth: true }, service: (signal) => getVoucherEligibility(codes, candidates, { context: auth.requestContext, signal }) }, { retry: false, enabled: !disabled });
  const change = (next: string[]) => { if (disabled || next.length > 50) return; setCodes(next); onChange?.(); };
  return <section className="space-y-4 [&_button]:min-h-11 [&_button]:min-w-11 rounded-sm border border-border bg-card p-5" aria-label="Voucher picker"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-semibold">Choose vouchers</h2><Link href="/vouchers" className="inline-flex min-h-11 items-center text-xs text-primary underline">My vouchers</Link></div>
    <p className="text-xs text-muted-foreground">One platform/event voucher, plus one shop voucher per seller. Discounts are confirmed by the server.</p>
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const next = code.trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(next) || codes.length >= 50) { setValidation("Enter a valid voucher code (up to 50 selected vouchers)."); return; } setValidation(""); change([...codes, next]); setCode(""); }}><label className="w-full text-xs text-muted-foreground" htmlFor="voucher-code">Voucher code</label><input id="voucher-code" className="min-h-11 min-w-0 flex-1 rounded-sm border border-border px-3 text-sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter claimed voucher code" disabled={disabled} maxLength={50} /><button className={sellerButton} disabled={disabled}>Add code</button></form>
    {validation && <p role="alert" className="text-xs text-danger">{validation}</p>}
    <AdminError error={wallet.error} onRetry={() => void wallet.refetch()} />
    {wallet.isPending && <p role="status" className="text-xs">Loading claimed vouchers…</p>}
    <fieldset disabled={disabled} className="space-y-2">{wallet.data?.content.map((entry) => <label key={entry.id} className="flex min-h-11 items-start gap-3 rounded-sm border border-border p-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={codes.includes(entry.voucher.code)} onChange={(e) => change(e.target.checked ? [...codes, entry.voucher.code] : codes.filter((s) => s !== entry.voucher.code))} /><span className="min-w-0"><span className="break-all font-mono">{entry.voucher.code}</span><span className="mt-1 block text-xs text-muted-foreground">{entry.voucher.name} · {entry.voucher.sourceType}</span></span></label>)}</fieldset>
    {wallet.data?.content.length === 0 && <p className="text-xs text-muted-foreground">No claimed vouchers on this page.</p>}{wallet.data && wallet.data.page.totalPages > 1 && <div className="[&_button]:min-h-11 [&_button]:min-w-11"><AdminPagination page={wallet.data.page} onPageChange={setPage} /></div>}
    {codes.length > 0 && <div className="flex flex-wrap gap-2">{codes.map((s) => <button key={s} className={`${sellerButton} break-all`} disabled={disabled} onClick={() => change(codes.filter((c) => c !== s))}>Remove {s}</button>)}</div>}
    <AdminError error={pricing.error} onRetry={() => void pricing.refetch()} />{pricing.isFetching ? <p role="status" className="text-xs">Checking voucher eligibility…</p> : !pricing.isError && pricing.data && <VoucherQuoteResults quotes={pricing.data} />}
  </section>;
}
export default VoucherPicker;
