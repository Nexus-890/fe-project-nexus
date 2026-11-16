"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getAdminPayouts, getPayoutDetail, getSellerPayouts, payoutErrorMessage, retryPayout } from "../service/payoutService";
import { payoutNeedsActionStatuses, payoutStatuses, type PayoutDetail, type PayoutFilters, type PayoutStatus } from "../types/payoutType";
import { formatVND } from "../components/formatPrice";
import { SellerHeading, SellerPanel, SellerStatus, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import { readBackofficeRoles } from "./backofficeAccess";
import { sellerSalesDates } from "./sellerSalesFilters";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const mask = (last4: string | null) => last4 ? `•••• ${last4}` : "No receiving account yet";
const statusLabel = (status: PayoutStatus) => status === "ON_HOLD" ? "On hold" : status.charAt(0) + status.slice(1).toLowerCase();

function PayoutDetailPanel({ id, managed, close, retryKeys }: { id: string; managed: boolean; close: () => void; retryKeys: Map<string, string> }) {
  const auth = useAuth();
  const client = useQueryClient();
  const active = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => () => active.current?.abort(), []);
  const detail = useApiQuery({ queryKey: queryKeys.seller.payoutDetail(auth.sessionId, id), meta: { requiresAuth: true },
    service: (signal) => getPayoutDetail(id, { context: auth.requestContext, signal }) }, { retry: false });
  const retry = useApiMutation<PayoutDetail, { key: string; sessionId: number; controller: AbortController }>({
    mutationKey: ["payout", auth.sessionId, id, "retry"],
    execute: ({ key, controller }) => retryPayout(id, key, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.backoffice.payouts(auth.sessionId), queryKeys.seller.payouts(auth.sessionId)],
  }, { onSuccess: (result) => { client.setQueryData(queryKeys.seller.payoutDetail(auth.sessionId, id), result); retryKeys.delete(id); setMessage("The payout retry was recorded. Check its status and history for the transfer outcome."); },
    onError: async (_error, operation) => {
      if (!auth.isSessionCurrent(operation.sessionId) || operation.controller.signal.aborted) return;
      const reconciled = await detail.refetch();
      // A lost response may follow a committed retry. Once an authoritative read
      // sees it leave the terminal state, a later failure needs a fresh retry key.
      if (auth.isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted && reconciled.isSuccess &&
        !["FAILED", "RETURNED"].includes(reconciled.data.status)) retryKeys.delete(id);
    },
    onSettled: (_result, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });
  const payout = detail.data;
  useEffect(() => {
    if (detail.isSuccess && !detail.isFetching && payout && !["FAILED", "RETURNED"].includes(payout.status)) retryKeys.delete(id);
  }, [detail.isSuccess, detail.isFetching, payout, id, retryKeys]);
  const canRetry = managed && payout && ["FAILED", "RETURNED"].includes(payout.status) && !detail.isError && !detail.isFetching;
  return <SellerPanel title="Payout detail"><div className="flex flex-wrap items-start justify-between gap-3"><p className="break-all font-mono text-xs text-muted-foreground">{id}</p><button type="button" className={sellerButton} disabled={retry.isPending} onClick={close}>Close detail</button></div>
    {detail.isPending ? <p role="status" className="mt-5 text-sm">Loading payout detail…</p> : detail.error ? <div className="mt-5"><p role="alert" className="text-sm text-danger">{payoutErrorMessage(detail.error)}</p><button type="button" className={`${sellerButton} mt-3`} onClick={() => void detail.refetch()}>Retry payout detail</button></div> : payout && <>
      <div className="mt-5 flex flex-wrap items-center gap-2"><SellerStatus>{statusLabel(payout.status)}</SellerStatus>{payout.simulated && <span className="rounded-full bg-info/10 px-2 py-1 text-xs text-info">Simulated</span>}</div>
      {payout.status === "ON_HOLD" && <p role="status" className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">This payout is on hold until the seller has a verified default bank account. It is released automatically after verification.</p>}
      {payout.status === "UNKNOWN" && <p role="status" className="mt-4 rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">The transfer outcome is unknown. Reconciliation checks the original attempt; another transfer must not be sent while it is unresolved.</p>}
      {payout.status === "PROCESSING" && <p className="mt-4 text-sm text-muted-foreground">The provider is processing the transfer. An acknowledgement does not mean the seller has received payment.</p>}
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Order</dt><dd className="mt-1 break-all font-mono text-xs">{payout.orderId}</dd></div><div><dt className="text-xs text-muted-foreground">Seller</dt><dd className="mt-1 break-all font-mono text-xs">{payout.sellerId}</dd></div><div><dt className="text-xs text-muted-foreground">Receiving account</dt><dd className="mt-1 font-mono">{mask(payout.recipientAccountLast4)}</dd></div><div><dt className="text-xs text-muted-foreground">Provider reference</dt><dd className="mt-1 break-words font-mono text-xs">{payout.providerReference || "Not available"}</dd></div><div><dt className="text-xs text-muted-foreground">Attempts</dt><dd className="mt-1 font-mono">{payout.attemptCount}</dd></div><div><dt className="text-xs text-muted-foreground">Created</dt><dd className="mt-1 text-xs"><time dateTime={payout.createdAt}>{date.format(new Date(payout.createdAt))}</time></dd></div></dl>
      <dl aria-label="Payout amount breakdown" className="mt-5 space-y-3 border-y border-border py-5 text-sm">{[["Order amount", payout.orderAmount], ["Shipping fee", payout.shippingFee], ["Platform fee", payout.platformFee], ["Net amount", payout.netAmount]].map(([label, amount]) => <div key={label} className="flex flex-wrap justify-between gap-3"><dt className={label === "Net amount" ? "font-semibold" : "text-muted-foreground"}>{label}</dt><dd className={`font-mono ${label === "Net amount" ? "font-semibold text-primary" : ""}`}>{formatVND(amount)}</dd></div>)}<div className="flex justify-between gap-3 text-xs text-muted-foreground"><dt>Platform fee rate snapshot</dt><dd className="font-mono">{payout.platformFeeRate}</dd></div></dl>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" className={sellerButton} disabled={detail.isFetching || retry.isPending} onClick={() => { setMessage(""); void detail.refetch(); }}>Refresh payout status</button>{canRetry && <button type="button" className={sellerPrimary} disabled={retry.isPending} onClick={() => {
        if (active.current || !canRetry) return;
        const key = retryKeys.get(id) || crypto.randomUUID(); retryKeys.set(id, key);
        const controller = new AbortController(); active.current = controller;
        setMessage(""); retry.mutate({ key, sessionId: auth.sessionId, controller });
      }}>{retry.isPending ? "Requesting retry…" : retry.isError && retryKeys.has(id) ? "Retry same request" : "Retry payout"}</button>}</div>
      {message && <p role="status" className="mt-3 text-sm text-success">{message}</p>}{retry.error && retry.error.kind !== "aborted" && <p role="alert" className="mt-3 text-sm text-danger">{payoutErrorMessage(retry.error)} {canRetry ? "Retrying this request reuses its captured key." : "Check the updated status and history before taking another action."}</p>}
      <section aria-label="Payout step history" className="mt-6"><h3 className="text-sm font-semibold">History · newest first</h3>{payout.history.length ? <ol className="mt-4 space-y-4">{payout.history.map((step) => <li key={step.id} className="rounded-sm border border-border p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><p className="font-medium">{step.event.replaceAll("_", " ")}{step.simulated && <span className="ml-2 rounded-full bg-info/10 px-2 py-1 text-xs text-info">Simulated</span>}</p><time className="text-xs text-muted-foreground" dateTime={step.occurredAt}>{date.format(new Date(step.occurredAt))}</time></div><p className="mt-3 text-xs text-muted-foreground">{step.fromStatus ? `${statusLabel(step.fromStatus)} → ` : ""}{statusLabel(step.toStatus)} · Attempt {step.attemptNo}</p><p className="mt-2 font-mono text-xs">{formatVND(step.amount)} · {mask(step.recipientAccountLast4)}</p>{step.provider && <p className="mt-2 text-xs">Provider: {step.provider}{step.providerStatus ? ` · ${step.providerStatus}` : ""}</p>}{step.providerReference && <p className="mt-2 break-words font-mono text-xs">Reference: {step.providerReference}</p>}{step.errorCode && <p className="mt-2 break-words text-xs text-danger">{step.errorCode}{step.errorMessage ? ` · ${step.errorMessage}` : ""}</p>}{!step.errorCode && step.errorMessage && <p className="mt-2 break-words text-xs text-danger">{step.errorMessage}</p>}<p className="mt-2 break-all text-xs text-muted-foreground">Actor <span className="font-mono">{step.actorId}</span>{step.sellerBankId && <> · Bank <span className="font-mono">{step.sellerBankId}</span></>}</p></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No history steps are available.</p>}</section>
    </>}
  </SellerPanel>;
}

export function PayoutHistory({ managed = false }: { managed?: boolean }) {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState(managed ? "NEEDS_ACTION" : "ALL");
  const [sellerId, setSellerId] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [filterError, setFilterError] = useState("");
  const [applied, setApplied] = useState<PayoutFilters>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [retryKeys] = useState(() => new Map<string, string>());
  const statuses: readonly PayoutStatus[] | undefined = tab === "NEEDS_ACTION" ? payoutNeedsActionStatuses : tab === "ALL" ? undefined : [tab as PayoutStatus];
  const filters: PayoutFilters = { ...applied, status: statuses, page, size: 10 };
  const result = useApiQuery({ queryKey: managed ? queryKeys.backoffice.payouts(auth.sessionId, filters) : queryKeys.seller.payouts(auth.sessionId, page), meta: { requiresAuth: true },
    service: (signal) => managed ? getAdminPayouts(filters, { context: auth.requestContext, signal }) : getSellerPayouts(page, { context: auth.requestContext, signal }) }, { retry: false });
  return <>
    <SellerHeading title={managed ? "Seller payouts" : "Payout history"} description="Payouts are created automatically for funded completed orders without refunds. Net amount excludes shipping and the platform fee.">{!managed && <Link className={sellerButton} href="/backoffice/bank-accounts">Bank accounts</Link>}</SellerHeading>
    {managed && <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const range = sellerSalesDates(from, to); if (!range || sellerId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sellerId)) { setFilterError("Enter a valid seller UUID and date range."); return; } setFilterError(""); setApplied({ ...range, ...(sellerId ? { sellerId } : {}) }); setPage(0); }}>
      <label className="grid gap-2 text-xs">Payout status<select className={sellerInput} value={tab} onChange={(event) => { setTab(event.target.value); setPage(0); }}><option value="NEEDS_ACTION">Needs action</option><option value="ALL">All statuses</option>{payoutStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
      <label className="grid gap-2 text-xs">Seller UUID<input className={sellerInput} value={sellerId} onChange={(event) => setSellerId(event.target.value.trim())} placeholder="All sellers" /></label>
      <label className="grid gap-2 text-xs">From date<input type="date" className={sellerInput} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label className="grid gap-2 text-xs">To date<input type="date" className={sellerInput} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><button type="submit" className={sellerPrimary}>Apply payout filters</button><button type="button" className={sellerButton} onClick={() => { setApplied({}); setSellerId(""); setFrom(""); setTo(""); setTab("NEEDS_ACTION"); setPage(0); setFilterError(""); }}>Reset payout filters</button>{filterError && <p role="alert" className="basis-full text-sm text-danger">{filterError}</p>}
    </form>}
    {managed && tab === "NEEDS_ACTION" && <p className="text-xs text-muted-foreground">Needs action shows exactly On hold, Unknown, Failed and Returned payouts.</p>}
    {result.isPending ? <p role="status">Loading payouts…</p> : result.error ? <SellerPanel title="Payout history unavailable"><p role="alert" className="text-sm text-danger">{payoutErrorMessage(result.error)}</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => void result.refetch()}>Retry payouts</button></SellerPanel> : <>
      {result.data?.content.some((payout) => payout.status === "ON_HOLD") && <p role="status" className="rounded-sm border border-warning/30 bg-warning/10 p-4 text-sm">Some payouts are on hold. A verified default bank account is required; verification releases held payouts automatically.</p>}
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[980px] text-left text-sm"><caption className="sr-only">{managed ? "Seller payouts" : "Your payout history"}</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Order / payout", ...(managed ? ["Seller"] : []), "Created", "Order amount", "Shipping fee", "Platform fee", "Net amount", "Status", "Details"].map((title) => <th key={title} scope="col" className="px-4 py-3 font-normal">{title}</th>)}</tr></thead><tbody>{result.data?.content.map((payout) => <tr key={payout.id} className="border-t border-border"><th scope="row" className="px-4 py-5 font-mono text-xs font-normal"><span title={payout.orderId}>Order {payout.orderId.slice(0, 8)}</span><span title={payout.id} className="mt-2 block text-muted-foreground">Payout {payout.id.slice(0, 8)}</span></th>{managed && <td title={payout.sellerId} className="px-4 py-5 font-mono text-xs">{payout.sellerId.slice(0, 8)}</td>}<td className="px-4 py-5 text-xs text-muted-foreground"><time dateTime={payout.createdAt}>{date.format(new Date(payout.createdAt))}</time></td>{[payout.orderAmount, payout.shippingFee, payout.platformFee, payout.netAmount].map((amount, index) => <td key={index} className={`px-4 py-5 font-mono text-xs ${index === 3 ? "text-primary" : ""}`}>{formatVND(amount)}</td>)}<td className="px-4 py-5"><SellerStatus>{statusLabel(payout.status)}</SellerStatus>{payout.simulated && <p className="mt-2 text-xs text-info">Simulated</p>}<p className="mt-2 whitespace-nowrap font-mono text-xs text-muted-foreground">{mask(payout.recipientAccountLast4)}</p></td><td className="px-4 py-5"><button type="button" className={sellerButton} onClick={() => setSelected(payout.id)} aria-expanded={selected === payout.id}>View payout</button></td></tr>)}</tbody></table>{!result.data?.content.length && <p role="status" className="p-10 text-center text-sm text-muted-foreground">No payouts match this view.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data?.totalElements ?? 0} payouts</p><nav aria-label="Payout pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
    {selected && <PayoutDetailPanel key={`${auth.sessionId}:${selected}`} id={selected} managed={managed} retryKeys={retryKeys} close={() => setSelected(null)} />}
  </>;
}

function SellerPayoutsPage() {
  const auth = useAuth();
  const isSeller = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("SELLER");
  if (!isSeller) return <SellerPanel title="403 · Seller access required"><p className="text-sm text-muted-foreground">Payout history belongs to the signed-in seller.</p></SellerPanel>;
  return <PayoutHistory key={auth.sessionId} />;
}

export default SellerPayoutsPage;
