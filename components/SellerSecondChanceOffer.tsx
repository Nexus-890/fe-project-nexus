"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getSellerOffers, sendSellerOffer } from "../service/sellerOfferService";
import type { ApiError } from "../types/commonResponseType";
import type { SellerOfferState } from "../types/sellerOfferType";
import { formatVND } from "./formatPrice";
import { sellerButton, sellerPrimary } from "./SellerUi";

const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const errorMessage = (error: ApiError) => error.status === 403 ? "You do not have permission to manage these offers." :
  error.status === 401 ? "Your session has expired. Sign in again to manage offers." :
  [404, 501, 503].includes(error.status) ? "Second-chance offers are unavailable right now. Please try again later." :
  error.detail || error.title || "Unable to manage second-chance offers. Please refresh and try again.";

/** The server controls current eligibility independently of accepted offer history. */
function SellerSecondChanceOffer({ auctionId, auctionTitle, triggerLabel = "Offer to next bidder" }: { auctionId: string; auctionTitle?: string; triggerLabel?: string }) {
  const auth = useAuth();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const titleId = useId();
  const helpId = useId();
  const [open, setOpen] = useState(false);
  const [confirmedCandidate, setConfirmedCandidate] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const key = queryKeys.seller.offers(auth.sessionId, auctionId);
  const state = useApiQuery({ queryKey: key, meta: { requiresAuth: true },
    service: (signal) => getSellerOffers(auctionId, { context: auth.requestContext, signal }),
  }, { enabled: auth.status === "authenticated", retry: false, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: false,
    refetchInterval: open ? 5000 : 15000 });
  const mutation = useApiMutation<SellerOfferState, { sessionId: number; controller: AbortController }>({
    mutationKey: ["seller", auth.sessionId, "send-offer", auctionId],
    isCurrent: (variables) => auth.isSessionCurrent(variables.sessionId) && !variables.controller.signal.aborted,
    execute: (variables) => sendSellerOffer(auctionId, { context: auth.requestContext, signal: variables.controller.signal }),
  }, { onSuccess: async (result) => {
    client.setQueryData(key, result);
    setConfirmedCandidate(null);
    setSent(true);
    await client.invalidateQueries({ queryKey: queryKeys.seller.all(auth.sessionId), refetchType: "active" });
  }, onError: async (_error, variables) => {
    if (!auth.isSessionCurrent(variables.sessionId) || variables.controller.signal.aborted) return;
    setConfirmedCandidate(null);
    await client.invalidateQueries({ queryKey: key, refetchType: "active" });
  }, onSettled: (_data, _error, variables) => { if (pending.current === variables.controller) pending.current = null; } });

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => () => pending.current?.abort(), []);

  const current = state.isError ? undefined : state.data;
  const activeOffer = current?.offers.find((offer) => offer.status === "OFFERED");
  const candidateKey = current?.candidate ? `${current.candidate.bidderId}:${current.candidate.amount}` : null;
  const historyOnly = Boolean(current && !current.candidate);
  const canConfirm = current?.canOffer && current.candidate && !state.isFetching && !mutation.isPending && !activeOffer;
  const close = () => { if (!mutation.isPending) { setOpen(false); setConfirmedCandidate(null); } };

  if (current && !current.canOffer && current.offers.length === 0) return null;

  return <>
    <button type="button" className={sellerButton} onClick={() => { mutation.reset(); setSent(false); setConfirmedCandidate(null); setOpen(true); }} aria-haspopup="dialog">
      <Send size={15} aria-hidden="true" />{historyOnly ? "Offer history" : triggerLabel}
    </button>
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={helpId} onCancel={(event) => { if (mutation.isPending) event.preventDefault(); else close(); }} onClose={() => setOpen(false)}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/40">
      <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6"><div className="min-w-0"><h2 id={titleId} className="text-heading-20">Second-chance offer</h2>{auctionTitle && <p className="mt-2 break-words text-sm text-muted-foreground">{auctionTitle}</p>}</div><button type="button" aria-label="Close second-chance offer" onClick={close} disabled={mutation.isPending} className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-muted disabled:opacity-50"><X size={20} aria-hidden="true" /></button></div>
      <div className="space-y-5 p-5 sm:p-6">
        <p id={helpId} className="text-sm leading-6 text-muted-foreground">{(triggerLabel === "Offer history" || historyOnly) ? "Review this auction’s second-chance offers, response deadlines and resulting orders." : "The original winner did not pay. You can offer the item to the next eligible bidder at their own highest bid. They have 24 hours to respond."}</p>
        {sent && <p role="status" className="rounded-sm border border-success/30 bg-success/5 p-3 text-sm text-success">Offer sent. The bidder has been invited to respond.</p>}
        {state.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading bidder and offer history…</p> : state.isError ? <div><p role="alert" className="text-sm text-danger">{errorMessage(state.error)}</p>{![401, 403].includes(state.error.status) && <button type="button" className={`${sellerButton} mt-3`} disabled={state.isFetching} onClick={() => void state.refetch()}>Retry offers</button>}</div> : current && <>
          {current.candidate ? <section aria-label="Next eligible bidder" className="rounded-sm border border-border bg-muted p-4"><p className="text-xs text-muted-foreground">Next eligible bidder</p><p className="mt-2 break-words text-sm font-medium">{current.candidate.displayName}</p><dl className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm"><dt className="text-muted-foreground">Their highest bid / offer amount</dt><dd className="font-mono font-semibold text-primary">{formatVND(current.candidate.amount)}</dd></dl><p className="mt-3 text-xs leading-5 text-muted-foreground">Sending this offer emails only this bidder. The price is fixed to their bid.</p></section> : <p role="status" className="rounded-sm border border-border bg-muted p-4 text-sm leading-6">{activeOffer ? "An offer is already open. Wait for the bidder to respond or for the offer to expire before offering to another bidder." : "No next bidder is currently eligible. Accepted offers remain in the history below; the server determines when another offer is available."}</p>}
          {current.candidate && <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 shrink-0 accent-primary" checked={confirmedCandidate === candidateKey} disabled={!canConfirm} onChange={(event) => setConfirmedCandidate(event.target.checked ? candidateKey : null)} /><span>I confirm the next bidder and offer amount shown above.</span></label>}
          {mutation.error && mutation.error.kind !== "aborted" && <p role="alert" className="break-words text-sm text-danger">{errorMessage(mutation.error)}</p>}
          {mutation.isPending && <p role="status" className="text-sm text-muted-foreground">Sending offer…</p>}
          <div className="flex flex-wrap gap-3">{current.candidate && <button type="button" className={sellerPrimary} disabled={!canConfirm || confirmedCandidate !== candidateKey} onClick={() => {
            if (!canConfirm || confirmedCandidate !== candidateKey || pending.current) return;
            const controller = new AbortController(); pending.current = controller;
            mutation.mutate({ sessionId: auth.sessionId, controller });
          }}>{mutation.isPending ? "Sending…" : "Confirm and send offer"}</button>}<button type="button" className={sellerButton} disabled={mutation.isPending || state.isFetching} onClick={() => { setConfirmedCandidate(null); mutation.reset(); void state.refetch(); }}>{state.isFetching ? "Refreshing…" : "Refresh offers"}</button></div>
          <section aria-label="Second-chance offer history" className="border-t border-border pt-5"><h3 className="text-sm font-semibold">Offer history</h3>{current.offers.length ? <ol className="mt-4 space-y-4">{current.offers.map((offer) => <li key={offer.id} className="rounded-sm border border-border p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="break-words font-medium">{offer.displayName}</p><span className={offer.status === "ACCEPTED" ? "text-success" : offer.status === "OFFERED" ? "text-primary" : "text-muted-foreground"}>{offer.status === "OFFERED" ? "Awaiting response" : offer.status === "ACCEPTED" ? "Accepted" : offer.status === "DECLINED" ? "Declined" : "Expired"}</span></div><p className="mt-2 font-mono">{formatVND(offer.amount)}</p><p className="mt-2 text-xs text-muted-foreground">Sent <time dateTime={offer.offeredAt}>{date.format(new Date(offer.offeredAt))}</time></p><p className="mt-1 text-xs text-muted-foreground">Response deadline <time dateTime={offer.expiresAt}>{date.format(new Date(offer.expiresAt))}</time></p>{offer.respondedAt && <p className="mt-1 text-xs text-muted-foreground">Responded <time dateTime={offer.respondedAt}>{date.format(new Date(offer.respondedAt))}</time></p>}{offer.orderId && <p className="mt-3 break-all text-xs text-muted-foreground">Order <span className="font-mono">{offer.orderId}</span></p>}{offer.paymentDueAt && <p className="mt-1 text-xs text-muted-foreground">Payment deadline <time dateTime={offer.paymentDueAt}>{date.format(new Date(offer.paymentDueAt))}</time></p>}</li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No offers have been sent.</p>}</section>
        </>}
      </div>
      <div className="flex justify-end border-t border-border p-5 sm:px-6"><button type="button" className={sellerButton} disabled={mutation.isPending} onClick={close}>Close</button></div>
    </dialog>
  </>;
}

export default SellerSecondChanceOffer;
