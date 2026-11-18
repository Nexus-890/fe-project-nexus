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
import type { VoucherQuote, WalletEntry } from "../types/promotionType";
import { useVoucherSelection } from "./useVoucherSelection";

const reasons = { MIN_ORDER_NOT_MET: "Minimum spend not reached", NOT_CLAIMED: "Claim this voucher first", EXPIRED: "Voucher expired", LIMIT_REACHED: "Voucher limit reached or already reserved", NOT_ELIGIBLE: "Not eligible for these items or dates", STACKING: "Only one platform/event voucher and one shop voucher per seller can apply" };
const reasonText = (quote: VoucherQuote) => `${quote.reason ? reasons[quote.reason] : "Not applicable"}${quote.missingAmount != null && quote.missingAmount > 0 ? ` · Add ${formatVND(String(quote.missingAmount))} more` : ""}`;
export function VoucherQuoteResults({ quotes }: { quotes: VoucherQuote[] }) {
  return <ul className="space-y-2 text-xs" aria-label="Voucher eligibility">{quotes.map((quote) => <li key={quote.code} className={quote.applied ? "text-success" : "text-danger"}><span className="font-mono">{quote.code}</span> · {quote.applied ? `Applied −${formatVND(String(quote.discountAmount))}` : reasonText(quote)}</li>)}</ul>;
}
const sourceLabels: Record<string, string> = { PLATFORM: "Nexus", SHOP: "Shop", EVENT: "Event" };
const shortVnd = (value: number) => value >= 1000 && value % 1000 === 0 ? `${(value / 1000).toLocaleString("vi-VN")}K` : formatVND(String(value));
const ticketDate = (value: string) => new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
function VoucherTicket({ entry, selected, quote, onToggle }: { entry: WalletEntry; selected: boolean; quote?: VoucherQuote; onToggle: (checked: boolean) => void }) {
  const v = entry.voucher;
  const status = !quote ? null
    : selected ? { tone: quote.applied ? "text-success" : "text-danger", text: quote.applied ? `Applied · saves ${formatVND(String(quote.discountAmount))}` : reasonText(quote) }
    : { tone: quote.applied ? "text-success" : "text-muted-foreground", text: quote.applied ? `Saves ${formatVND(String(quote.discountAmount))} on this cart` : reasonText(quote) };
  const dimmed = !selected && quote && !quote.applied;
  return <label className={`relative flex cursor-pointer overflow-hidden rounded-md border text-sm transition-colors has-[:disabled]:cursor-not-allowed ${selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/60"} ${dimmed ? "opacity-70" : ""}`}>
    <span className="flex w-16 shrink-0 flex-col items-center justify-center bg-primary px-1.5 py-2 text-center text-primary-foreground">
      <span className="text-[9px] font-semibold uppercase tracking-wider">{sourceLabels[v.sourceType] ?? v.sourceType}</span>
      <strong className="mt-0.5 break-all text-base leading-tight">{v.discountType === "PERCENT" ? `${Number(v.discountValue)}%` : shortVnd(v.discountValue)}</strong>
      <span className="text-[9px] font-semibold uppercase tracking-wider">off</span>
    </span>
    <span aria-hidden="true" className="absolute -top-1.5 left-16 size-3 -translate-x-1/2 rounded-full border border-border bg-card" />
    <span aria-hidden="true" className="absolute -bottom-1.5 left-16 size-3 -translate-x-1/2 rounded-full border border-border bg-card" />
    <span className="flex min-w-0 flex-1 items-start gap-2 border-l border-dashed border-primary/30 px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-5" title={v.name}>{v.name}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">Min order {formatVND(String(v.minOrderAmount ?? 0))}{v.maxDiscountAmount != null && ` · Up to ${formatVND(String(v.maxDiscountAmount))}`}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"><span className="break-all rounded-sm border border-dashed border-primary/50 px-1 font-mono text-primary">{v.code}</span><span className="text-muted-foreground">Use by {ticketDate(entry.expiresAt)}</span></span>
        {status && <span className={`mt-1 block text-xs font-medium ${status.tone}`}>{status.text}</span>}
      </span>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={selected} onChange={(event) => onToggle(event.target.checked)} />
    </span>
  </label>;
}
function VoucherPicker({ disabled = false, cartSignature, onChange }: { disabled?: boolean; cartSignature: string; onChange?: () => void }) {
  const auth = useAuth(); const { codes, setCodes } = useVoucherSelection(); const [page, setPage] = useState(0); const [code, setCode] = useState(""); const [validation, setValidation] = useState("");
  const wallet = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "picker-wallet", { page }), meta: { requiresAuth: true }, service: (signal) => getVoucherWallet({ page, status: "CLAIMED" }, { context: auth.requestContext, signal }) }, { retry: false });
  // Keep the selected codes first when checking additional wallet candidates.
  const candidates = [...new Set([...codes, ...(wallet.data?.content.map((entry) => entry.voucher.code) ?? [])])].slice(0, 50);
  const pricing = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "picker-pricing", { cartSignature, selected: codes, candidates }), meta: { requiresAuth: true }, service: (signal) => getVoucherEligibility(codes, candidates, { context: auth.requestContext, signal }) }, { retry: false, enabled: !disabled });
  const walletCodes = new Set(wallet.data?.content.map((entry) => entry.voucher.code) ?? []);
  const typed = codes.filter((c) => !walletCodes.has(c));
  const typedQuotes = pricing.data?.filter((quote) => typed.includes(quote.code)) ?? [];
  const change = (next: string[]) => { if (disabled || next.length > 50) return; setCodes(next); onChange?.(); };
  return <section className="space-y-4 [&_button]:min-h-11 [&_button]:min-w-11 rounded-sm border border-border bg-card p-5" aria-label="Voucher picker"><div className="flex flex-wrap justify-between gap-2"><h2 className="text-sm font-semibold">Choose vouchers</h2><Link href="/vouchers" className="inline-flex min-h-11 items-center text-xs text-primary underline">My vouchers</Link></div>
    <p className="text-xs text-muted-foreground">One platform/event voucher, plus one shop voucher per seller. Discounts are confirmed by the server.</p>
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const next = code.trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(next) || codes.length >= 50) { setValidation("Enter a valid voucher code (up to 50 selected vouchers)."); return; } setValidation(""); change([...codes, next]); setCode(""); }}><label className="w-full text-xs text-muted-foreground" htmlFor="voucher-code">Voucher code</label><input id="voucher-code" className="min-h-11 min-w-0 flex-1 rounded-sm border border-border px-3 text-sm" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter claimed voucher code" disabled={disabled} maxLength={50} /><button className={sellerButton} disabled={disabled}>Add code</button></form>
    {validation && <p role="alert" className="text-xs text-danger">{validation}</p>}
    <AdminError error={wallet.error} onRetry={() => void wallet.refetch()} />
    {wallet.isPending && <p role="status" className="text-xs">Loading claimed vouchers…</p>}
    <fieldset disabled={disabled} className="@container"><div className="grid gap-2 @xl:grid-cols-2">{wallet.data?.content.map((entry) => <VoucherTicket key={entry.id} entry={entry} selected={codes.includes(entry.voucher.code)} quote={pricing.isFetching ? undefined : pricing.data?.find((quote) => quote.code === entry.voucher.code)} onToggle={(checked) => change(checked ? [...codes, entry.voucher.code] : codes.filter((s) => s !== entry.voucher.code))} />)}</div></fieldset>
    {wallet.data?.content.length === 0 && <p className="text-xs text-muted-foreground">No claimed vouchers on this page.</p>}{wallet.data && wallet.data.page.totalPages > 1 && <div className="[&_button]:min-h-11 [&_button]:min-w-11"><AdminPagination page={wallet.data.page} onPageChange={setPage} /></div>}
    {typed.length > 0 && <div className="flex flex-wrap gap-2">{typed.map((s) => <button key={s} className={`${sellerButton} break-all`} disabled={disabled} onClick={() => change(codes.filter((c) => c !== s))}>Remove {s}</button>)}</div>}
    <AdminError error={pricing.error} onRetry={() => void pricing.refetch()} />{pricing.isFetching ? <p role="status" className="text-xs">Checking voucher eligibility…</p> : !pricing.isError && pricing.data && typedQuotes.length > 0 && <VoucherQuoteResults quotes={typedQuotes} />}
  </section>;
}
export default VoucherPicker;
