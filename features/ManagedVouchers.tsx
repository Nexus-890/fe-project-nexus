"use client";

import { useState } from "react";
import { AdminEmptyState, AdminError, AdminPageHeader, AdminPagination } from "../components/AdminPrimitives";
import { PromotionPanel, PromotionSelect } from "../components/PromotionFields";
import { sellerButton, sellerPrimary } from "../components/SellerUi";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { changeVoucherStatus, getManagedVouchers, getVoucherUsages, joinEventVoucher, withdrawEventVoucher } from "../service/promotionService";
import type { ManagedVoucher } from "../types/promotionType";
import { useAdminAction } from "./useAdminAction";
import VoucherEditor from "./VoucherEditor";

function VoucherUsages({ id }: { id: string }) {
  const auth = useAuth(); const [page, setPage] = useState(0);
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "usages", { id, page }), meta: { requiresAuth: true }, service: (signal) => getVoucherUsages(id, { page }, { context: auth.requestContext, signal }) });
  return <PromotionPanel title="Voucher usages"><AdminError error={result.error} onRetry={() => void result.refetch()} />{result.isPending && <p role="status">Loading usages…</p>}<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">Voucher usage history</caption><thead className="bg-muted text-xs"><tr>{["Order", "Status", "Discount", "Seller funded", "Platform funded"].map((s) => <th key={s} className="p-3">{s}</th>)}</tr></thead><tbody>{result.data?.content.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-3 font-mono text-xs">{row.orderId}</td><td className="p-3">{row.status}</td><td className="p-3">{formatVND(String(row.discountAmount))}</td><td className="p-3">{formatVND(String(row.sellerFunded))}</td><td className="p-3">{formatVND(String(row.platformFunded))}</td></tr>)}</tbody></table></div>{result.data?.content.length === 0 && <AdminEmptyState title="No usages yet" />}<AdminPagination page={result.data?.page} onPageChange={setPage} /></PromotionPanel>;
}

function EventVoucherTerms({ value }: { value: ManagedVoucher }) {
  const auth = useAuth(); const [accepted, setAccepted] = useState(false); const [notice, setNotice] = useState(""); const v = value.voucher;
  const action = useAdminAction(async (join: boolean, options) => {
    if (!join) { await withdrawEventVoucher(v.id, options); return "Participation withdrawn."; }
    const row = await joinEventVoucher(v.id, v.termsVersion, options);
    return `Joined · terms version ${row.acceptedTermsVersion} · seller funding ${row.sellerFundingPercentSnapshot}%.`;
  }, [queryKeys.promotions.root(auth.sessionId)], setNotice);
  return <PromotionPanel title={`Join ${v.code}`}><p className="text-sm">Event {v.eventId} · Seller funding {v.sellerFundingPercent ?? 0}% · Terms v{v.termsVersion}</p><p className="whitespace-pre-wrap text-sm">{v.termsText || "No additional terms."}</p><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 size-4" />I accept these terms and the seller funding percentage.</label><div className="flex flex-wrap gap-3"><button className={sellerPrimary} disabled={!accepted || action.isPending || v.status !== "ACTIVE"} onClick={() => action.run(true)}>Accept and join voucher</button><button className={sellerButton} disabled={action.isPending} onClick={() => { if (window.confirm("Withdraw from this voucher?")) action.run(false); }}>Withdraw from voucher</button></div><AdminError error={action.error} />{notice && <p role="status" className="text-sm text-success">{notice}</p>}</PromotionPanel>;
}

function ManagedVouchers({ admin = false }: { admin?: boolean }) {
  const auth = useAuth(); const [page, setPage] = useState(0); const [status, setStatus] = useState(""); const [source, setSource] = useState(admin ? "PLATFORM" : "SHOP"); const [eventId, setEventId] = useState("");
  const [editor, setEditor] = useState<ManagedVoucher | "new" | null>(null); const [usageId, setUsageId] = useState<string | null>(null); const [terms, setTerms] = useState<ManagedVoucher | null>(null); const [notice, setNotice] = useState("");
  const filters = { page, sourceType: source, ...(status ? { status } : {}), ...(eventId ? { eventId } : {}) };
  const result = useApiQuery({ queryKey: queryKeys.promotions.list(auth.sessionId, "managed", filters), meta: { requiresAuth: true }, service: (signal) => getManagedVouchers(filters, { context: auth.requestContext, signal }) }, { refetchInterval: 30_000 });
  const change = useAdminAction((input: { id: string; status: "ACTIVE" | "PAUSED" | "CANCELED" }, options) => changeVoucherStatus(input.id, input.status, options), [queryKeys.promotions.root(auth.sessionId), queryKeys.promotions.publicRoot], () => setNotice("Voucher updated."));
  return <div className="space-y-6"><AdminPageHeader title="Vouchers" description={admin ? "Manage platform and event discounts, funding and usage." : "Create shop vouchers and join approved event vouchers."}><button className={sellerPrimary} onClick={() => setEditor("new")}>Create voucher</button></AdminPageHeader>
    <div className="flex flex-wrap items-end gap-4"><PromotionSelect name="source" label="Voucher source" value={source} values={admin ? ["PLATFORM", "EVENT"] : ["SHOP", "EVENT"]} onChange={(v) => { setSource(v); setPage(0); setTerms(null); }} /><PromotionSelect name="voucher-status" label="Voucher status" value={status} values={["", "DRAFT", "ACTIVE", "PAUSED", "EXPIRED", "CANCELED"]} onChange={(v) => { setStatus(v); setPage(0); }} />
      <form onSubmit={(e) => { e.preventDefault(); setEventId(String(new FormData(e.currentTarget).get("eventId") ?? "").trim()); setPage(0); }} className="flex items-end gap-2"><label className="grid gap-2 text-sm">Filter by event ID<input name="eventId" className="min-h-10 rounded-sm border border-border px-3" pattern="[0-9a-fA-F-]{36}" /></label><button className={sellerButton}>Filter</button></form>
    </div><AdminError error={result.error} onRetry={() => void result.refetch()} /><AdminError error={change.error} />{notice && <p role="status" className="text-sm text-success">{notice}</p>}{result.isPending && <p role="status">Loading vouchers…</p>}
    <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Managed vouchers</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Voucher", "Discount", "Validity", "Status / limits", "Actions"].map((s) => <th key={s} className="p-4">{s}</th>)}</tr></thead><tbody>{result.data?.content.map((value) => {
      const v = value.voucher; const owns = admin || source === "SHOP";
      return <tr key={v.id} className="border-t border-border"><td className="max-w-52 p-4"><p className="font-mono font-medium">{v.code}</p><p className="text-xs text-muted-foreground">{v.name}</p>{v.eventId && <p className="mt-1 break-all text-xs text-muted-foreground">Event {v.eventId}</p>}</td><td className="p-4">{v.discountType === "PERCENT" ? `${v.discountValue}%` : formatVND(String(v.discountValue))}<p className="mt-1 text-xs text-muted-foreground">Min {formatVND(String(v.minOrderAmount ?? 0))}</p></td><td className="p-4 text-xs">{new Date(v.validFrom).toLocaleString()}<br />to {new Date(v.validUntil).toLocaleString()}</td><td className="p-4 text-xs"><p>{v.status}</p><p className="mt-1">Claims {v.claimCount}/{v.claimLimit ?? "∞"}</p><p>Uses {v.committedUses}/{v.usageLimit ?? "∞"}</p><p>Budget {formatVND(String(v.committedDiscount))}/{v.discountBudget == null ? "∞" : formatVND(String(v.discountBudget))}</p></td><td className="p-4"><div className="flex flex-wrap gap-2">{owns ? <>
        <button className={sellerButton} onClick={() => setEditor(value)}>{v.status === "DRAFT" ? "Edit / products" : "Details"}</button>
        {["DRAFT", "PAUSED"].includes(v.status) && <button className={sellerPrimary} disabled={change.isPending} onClick={() => change.run({ id: v.id, status: "ACTIVE" })}>Activate</button>}
        {v.status === "ACTIVE" && <button className={sellerButton} disabled={change.isPending} onClick={() => change.run({ id: v.id, status: "PAUSED" })}>Pause</button>}
        {!["CANCELED", "EXPIRED"].includes(v.status) && <button className={sellerButton} disabled={change.isPending} onClick={() => { if (window.confirm(`Cancel ${v.code}?`)) change.run({ id: v.id, status: "CANCELED" }); }}>Cancel voucher</button>}
        <button className={sellerButton} onClick={() => setUsageId(v.id)}>Usages</button>
      </> : <button className={sellerButton} onClick={() => setTerms(value)}>Review terms</button>}</div></td></tr>;
    })}</tbody></table></div>{result.data?.content.length === 0 && <AdminEmptyState title="No vouchers" />}<AdminPagination page={result.data?.page} onPageChange={setPage} />
    {editor && <VoucherEditor key={editor === "new" ? "new" : `${editor.voucher.id}-${editor.voucher.updatedAt}-${editor.productIds.join()}`} value={editor === "new" ? undefined : editor} admin={admin} close={() => setEditor(null)} saved={(value) => { setEditor(value); setNotice("Draft saved. Select products before activating a restricted voucher."); }} />}
    {usageId && <VoucherUsages key={usageId} id={usageId} />}{terms && <EventVoucherTerms key={`${terms.voucher.id}-${terms.voucher.termsVersion}`} value={terms} />}
  </div>;
}
export default ManagedVouchers;
