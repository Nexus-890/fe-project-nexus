"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { AUCTION_CANCEL_REASON_LIMIT, adminCancelAuction, getManagedAuction, getManagedAuctionBids, getManagedAuctionState, updateAuction } from "../service/auctionService";
import { SellerError, SellerHeading, SellerPanel, SellerStatus, sellerButton, sellerDanger, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { AuctionRoom, AuctionUpdateInput } from "../types/auctionRoomType";
import { formatAuctionMoney } from "./auctionRoomUtils";
import { auctionCancelReasonSchema, auctionStatusLabels, auctionUpdateSchema, formatVietnamTime, isAuctionCancellable, isAuctionEditable, toAuctionUpdateValues, type AuctionUpdateFormValues } from "./adminAuctionUtils";
import { readBackofficeRoles } from "./backofficeAccess";

type Feedback = { tone: "success" | "danger"; text: string };
type AuctionFormProps = { auction: AuctionRoom; onFeedback: (feedback: Feedback | null) => void; onConflict: (detail: string) => void };
type AuctionUpdateOperation = { input: AuctionUpdateInput; sessionId: number; controller: AbortController };
type AuctionCancelOperation = { reason: string; sessionId: number; controller: AbortController };

const editFields = [["startingPrice", "Starting price", "text"], ["bidIncrement", "Bid increment", "text"], ["startAt", "Start (Vietnam time)", "datetime-local"], ["endAt", "End (Vietnam time)", "datetime-local"]] as const;

function FieldList({ fields }: { fields: [string, ReactNode][] }) {
  return <dl className="grid gap-4 text-sm sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>;
}

function AuctionEditForm({ auction, onFeedback, onConflict }: AuctionFormProps) {
  const auth = useAuth();
  const client = useQueryClient();
  const [values, setValues] = useState<AuctionUpdateFormValues>(() => toAuctionUpdateValues(auction));
  const [errors, setErrors] = useState<Partial<Record<keyof AuctionUpdateFormValues, string>>>({});
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const mutation = useApiMutation<AuctionRoom, AuctionUpdateOperation>({
    execute: ({ input, controller }) => updateAuction(auction.id, input, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.auctions.manage.state(auth.sessionId, auction.id), queryKeys.auctions.manage.lists(auth.sessionId)],
  }, {
    onSuccess: (result) => { client.setQueryData(queryKeys.auctions.manage.detail(auth.sessionId, auction.id), result); onFeedback({ tone: "success", text: "Auction updated." }); },
    onError: (error) => { if (error.status === 409) onConflict(error.detail || error.title); },
    onSettled: (_data, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });
  return <SellerPanel title="Edit before start">
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      if (active.current) return;
      const parsed = auctionUpdateSchema.safeParse(values);
      if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
      setErrors({}); onFeedback(null);
      const controller = new AbortController(); active.current = controller;
      mutation.mutate({ input: parsed.data, sessionId: auth.sessionId, controller });
    }}>
      <fieldset disabled={mutation.isPending} className="grid gap-5 sm:grid-cols-2">
        {editFields.map(([key, label, type]) => <label key={key} className="block min-w-0 text-sm">{label}<input aria-label={label} type={type} inputMode={type === "text" ? "decimal" : undefined} value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `auction-${key}-error` : undefined} className={`${sellerInput} mt-2`} />{errors[key] && <span id={`auction-${key}-error`} className="mt-2 block text-xs text-danger">{errors[key]}</span>}</label>)}
      </fieldset>
      <p className="text-xs text-muted-foreground">Times are Vietnam time (UTC+7). The auction service refuses changes once the auction has started or has bids.</p>
      <button type="submit" disabled={mutation.isPending} className={sellerPrimary}>{mutation.isPending ? "Saving…" : "Save changes"}</button>
      {mutation.error && mutation.error.kind !== "aborted" && mutation.error.status !== 409 && <p role="alert" className="break-words text-sm text-danger">{mutation.error.detail || mutation.error.title}</p>}
    </form>
  </SellerPanel>;
}

function AuctionCancelForm({ auction, onFeedback, onConflict }: AuctionFormProps) {
  const auth = useAuth();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const mutation = useApiMutation<AuctionRoom, AuctionCancelOperation>({
    execute: ({ reason: text, controller }) => adminCancelAuction(auction.id, text, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [queryKeys.auctions.manage.state(auth.sessionId, auction.id), queryKeys.auctions.manage.lists(auth.sessionId)],
  }, {
    onSuccess: (result) => { dialog.current?.close(); client.setQueryData(queryKeys.auctions.manage.detail(auth.sessionId, auction.id), result); onFeedback({ tone: "success", text: "Auction cancelled. Bidders will be told it was cancelled." }); },
    onError: (failure) => { dialog.current?.close(); if (failure.status === 409) onConflict(failure.detail || failure.title); },
    onSettled: (_data, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });
  const confirm = () => {
    if (active.current) return;
    onFeedback(null);
    const controller = new AbortController(); active.current = controller;
    mutation.mutate({ reason, sessionId: auth.sessionId, controller });
  };
  return <SellerPanel title="Force cancel">
    <form onSubmit={(event) => {
      event.preventDefault();
      const parsed = auctionCancelReasonSchema.safeParse(reason);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      setError(""); mutation.reset();
      dialog.current?.showModal();
    }}>
      <label htmlFor="auction-cancel-reason" className="text-sm font-medium">Cancellation reason</label>
      <textarea id="auction-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={AUCTION_CANCEL_REASON_LIMIT} disabled={mutation.isPending} aria-invalid={Boolean(error)} aria-describedby={`auction-cancel-help${error ? " auction-cancel-error" : ""}`} className="mt-3 min-h-24 w-full rounded-sm border border-input bg-background p-3 text-sm" />
      <p id="auction-cancel-help" className="mt-2 text-xs text-muted-foreground">Required, up to {AUCTION_CANCEL_REASON_LIMIT} characters. Cancelling works even when the auction has bids.</p>
      {error && <p id="auction-cancel-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <button type="submit" disabled={mutation.isPending} className={`${sellerButton} mt-4 text-danger`}>Cancel auction</button>
      {mutation.error && mutation.error.kind !== "aborted" && mutation.error.status !== 409 && <p role="alert" className="mt-4 break-words text-sm text-danger">{mutation.error.detail || mutation.error.title}</p>}
    </form>
    <dialog ref={dialog} aria-labelledby="auction-cancel-title" onCancel={(event) => { if (mutation.isPending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-border bg-background p-5 text-foreground shadow-lg backdrop:bg-black/40 sm:p-6">
      <h3 id="auction-cancel-title" className="text-lg font-semibold">Cancel this auction?</h3>
      <p className="mt-3 break-words text-sm font-medium">{auction.title}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">The auction stops and cannot be reopened. Every bidder will be told that it was cancelled{auction.bidCount ? ` (${auction.bidCount} bids so far)` : ""}.</p>
      <p className="mt-3 whitespace-pre-line break-words border-l-2 border-border pl-3 text-sm">{reason.trim()}</p>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => dialog.current?.close()} disabled={mutation.isPending} className={sellerButton}>Keep auction</button><button type="button" onClick={confirm} disabled={mutation.isPending} className={sellerDanger}>{mutation.isPending ? "Cancelling…" : "Confirm cancellation"}</button></div>
    </dialog>
  </SellerPanel>;
}

function AdminAuctionDetailPage({ auctionId }: { auctionId: string }) {
  const auth = useAuth();
  const isAdmin = auth.status === "authenticated" && readBackofficeRoles(auth.accessToken).includes("ADMIN");
  const [bidPage, setBidPage] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const detail = useApiQuery({ queryKey: queryKeys.auctions.manage.detail(auth.sessionId, auctionId), meta: { requiresAuth: true },
    service: (signal) => getManagedAuction(auctionId, { context: auth.requestContext, signal }) }, { retry: false });
  const live = detail.data?.status === "ACTIVE" ? 5000 : false;
  const state = useApiQuery({ queryKey: queryKeys.auctions.manage.state(auth.sessionId, auctionId), meta: { requiresAuth: true },
    service: (signal) => getManagedAuctionState(auctionId, { context: auth.requestContext, signal }) }, { enabled: detail.isSuccess, retry: false, refetchInterval: live });
  const bids = useApiQuery({ queryKey: queryKeys.auctions.manage.bids(auth.sessionId, auctionId, bidPage), meta: { requiresAuth: true },
    service: (signal) => getManagedAuctionBids(auctionId, bidPage, { context: auth.requestContext, signal }) }, { enabled: detail.isSuccess, retry: false, refetchInterval: live });
  const back = <Link href="/backoffice/auctions" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">Back to auctions</Link>;
  if (!detail.data) return <>{back}{detail.error ? <SellerError error={detail.error} retry={() => void detail.refetch()} /> : <p role="status">Loading auction…</p>}</>;

  const auction = detail.data;
  const money = (amount: string) => <span className="font-mono">{formatAuctionMoney(amount, auction.currency)}</span>;
  const time = (instant: string) => <time dateTime={instant}>{formatVietnamTime(instant)}</time>;
  const count = (value: number) => <span className="font-mono">{value}</span>;
  const reference = (id: string) => <span className="break-all font-mono text-xs">{id}</span>;
  const reloadAfterConflict = (text: string) => { setFeedback({ tone: "danger", text }); void detail.refetch(); void state.refetch(); void bids.refetch(); };
  const formProps = { auction, onFeedback: setFeedback, onConflict: reloadAfterConflict };
  return <>
    {back}
    <SellerHeading title={auction.title} description={`Auction ${auction.id}`}><SellerStatus>{auctionStatusLabels[auction.status]}</SellerStatus></SellerHeading>
    {feedback && <p role={feedback.tone === "danger" ? "alert" : "status"} className={`break-words text-sm ${feedback.tone === "danger" ? "text-danger" : "text-success"}`}>{feedback.text}</p>}
    {!isAdmin && <p className="text-sm text-muted-foreground">Read-only view. Only administrators can edit or cancel auctions.</p>}
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
      <div className="min-w-0 space-y-6">
        <SellerPanel title="Auction details"><FieldList fields={[
          ["Status", auctionStatusLabels[auction.status]], ["Bids", count(auction.bidCount)],
          ["Starting price", money(auction.startingPrice)], ["Bid increment", money(auction.bidIncrement)], ["Current price", money(auction.currentPrice)],
          ["Start", time(auction.startAt)], ["End", time(auction.endAt)], ["Original end", time(auction.originalEndAt)], ["Extensions", count(auction.extensionCount)],
          ["Seller", reference(auction.sellerId)], ["Product", reference(auction.productId)], ["SKU", reference(auction.skuId)],
          ...(auction.status === "CANCELLED" ? [["Cancelled by", auction.cancelledBy === "ADMIN" ? "Administrator" : "Seller"], ["Cancellation reason", auction.cancelledReason || "—"]] satisfies [string, ReactNode][] : []),
        ]} /></SellerPanel>
        <SellerPanel title="Live state">{state.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading live state…</p> : state.error ? <SellerError error={state.error} retry={() => void state.refetch()} /> : <FieldList fields={[
          ["Status", auctionStatusLabels[state.data.status]], ["Current price", money(state.data.currentPrice)], ["Bids", count(state.data.bidCount)],
          ["Leader", state.data.leaderBidderName ?? "No bids yet"], ["Ends", time(state.data.endAt)], ["Server time", time(state.data.serverTime)],
        ]} />}</SellerPanel>
        {isAdmin && isAuctionEditable(auction.status) && <AuctionEditForm {...formProps} />}
        {isAdmin && isAuctionCancellable(auction.status) && <AuctionCancelForm {...formProps} />}
      </div>
      <SellerPanel title="Bid history">
        {bids.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading bids…</p> : bids.error ? <SellerError error={bids.error} retry={() => void bids.refetch()} /> : !bids.data.content.length ? <p role="status" className="text-sm text-muted-foreground">No bids yet.</p> : <ol aria-label="Bids, newest first" className="space-y-3">{bids.data.content.map((bid) => <li key={`${bid.placedAt}:${bid.bidderName}:${bid.amount}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm border border-border px-3 py-3 text-sm"><span className="font-mono">{bid.bidderName}</span>{money(bid.amount)}<span className="w-full text-xs text-muted-foreground">{time(bid.placedAt)}</span></li>)}</ol>}
        {bids.data && bids.data.totalPages > 1 && <nav aria-label="Bid history pages" className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm"><button type="button" className={sellerButton} disabled={bidPage === 0 || bids.isFetching} onClick={() => setBidPage((value) => value - 1)}>Previous</button><span>{bidPage + 1} / {bids.data.totalPages}</span><button type="button" className={sellerButton} disabled={bids.isFetching || bidPage + 1 >= bids.data.totalPages} onClick={() => setBidPage((value) => value + 1)}>Next</button></nav>}
        <p className="mt-4 text-xs text-muted-foreground">Newest first. Bidder names are masked.</p>
      </SellerPanel>
    </div>
  </>;
}

export default AdminAuctionDetailPage;
