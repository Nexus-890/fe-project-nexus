"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Clock3, Gift, ShieldCheck } from "lucide-react";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { queryKeys } from "../configs/queryKeys";
import ProductImage from "../components/ProductImage";
import { getMyAuctionOffers, respondToAuctionOffer } from "../service/auctionOfferService";
import { formatAuctionCountdown, formatAuctionMoney } from "./auctionRoomUtils";
import type { AuctionOffer } from "../types/auctionOfferType";

const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
type OfferResponse = { action: "accept" | "decline"; sessionId: number; signal: AbortSignal };

function OfferCard({ offer, refresh }: { offer: AuctionOffer; refresh: () => Promise<unknown> }) {
  const auth = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<AuctionOffer | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  // A successful response must remain visible while the list catches up.
  const current = offer.status === "OFFERED" && result ? result : offer;
  const expired = current.status === "EXPIRED" || (current.status === "OFFERED" && now >= Date.parse(current.expiresAt));
  const paymentExpired = current.paymentDueAt !== null && now >= Date.parse(current.paymentDueAt);
  const mutation = useApiMutation({
    execute: (variables: OfferResponse) => respondToAuctionOffer(current.auctionId, current.id, variables.action, { context: auth.requestContext, signal: variables.signal }),
    isCurrent: (variables) => auth.isSessionCurrent(variables.sessionId),
  }, {
    onSuccess: (updated) => { setResult(updated); setUncertain(false); void refresh(); },
    onError: (error) => {
      if (error.kind === "aborted") return;
      // #208 must guarantee replay safety. Until then do not repeat an ambiguous write.
      if (error.kind === "network" || error.kind === "invalid-response" || error.status >= 500) setUncertain(true);
      void refresh();
    },
    onSettled: () => { submitting.current = false; },
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); controller.current?.abort(); };
  }, []);
  const respond = (action: OfferResponse["action"]) => {
    if (submitting.current || uncertain || current.status !== "OFFERED" || Date.now() >= Date.parse(current.expiresAt)) return;
    submitting.current = true;
    controller.current = new AbortController();
    mutation.mutate({ action, sessionId: auth.sessionId, signal: controller.current.signal });
  };
  return <article aria-label={`Second chance offer for ${current.title}`} className="rounded-sm border border-border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-medium text-primary"><Gift size={18} aria-hidden="true" />Second chance offer</p><span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-xs tabular-nums"><Clock3 size={13} aria-hidden="true" />{current.status === "ACCEPTED" ? "Accepted" : current.status === "DECLINED" ? "Declined" : expired ? "Expired" : <span role="timer" aria-label="Time to respond to offer">{formatAuctionCountdown((Date.parse(current.expiresAt) - now) / 1000)}</span>}</span></div>
    <div className="mt-5 flex gap-4"><div className="size-20 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage src={current.imageUrl ?? undefined} alt={current.title} productName={current.title} compact /></div><div className="min-w-0"><Link href={`/auctions/${current.auctionId}`} className="text-sm font-medium hover:text-primary">{current.title}</Link><p className="mt-2 text-xs text-muted-foreground">Your offer price</p><p className="mt-1 font-mono text-xl font-semibold text-primary">{formatAuctionMoney(current.amount, current.currency)}</p></div></div>
    {current.status === "OFFERED" && !expired ? <><p className="mt-5 text-sm leading-6 text-muted-foreground">The seller has offered you this item at your own highest bid. Accept within 24 hours to create an order with a new payment deadline.</p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} aria-hidden="true" />Declining or letting this offer expire has no penalty.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={mutation.isPending || uncertain} onClick={() => respond("accept")} className={`${buttonClass} border-primary bg-primary text-primary-foreground hover:bg-primary-hover`}>{mutation.isPending && mutation.variables?.action === "accept" ? "Accepting…" : "Accept offer"}</button><button type="button" disabled={mutation.isPending || uncertain} onClick={() => respond("decline")} className={`${buttonClass} hover:bg-secondary`}>{mutation.isPending && mutation.variables?.action === "decline" ? "Declining…" : "Decline offer"}</button></div></> : null}
    {current.status === "ACCEPTED" ? <div role="status" className="mt-5 space-y-3 text-sm"><p>{paymentExpired ? "The payment deadline has passed. Check your order for its current status." : "Offer accepted. Your order has been created."}</p>{current.paymentDueAt ? <p className="text-muted-foreground">Payment deadline: {new Date(current.paymentDueAt).toLocaleString()}</p> : null}{current.orderId ? <Link href={`/order/${current.orderId}`} className={`${buttonClass} border-primary bg-primary text-primary-foreground`}>View order</Link> : null}</div> : current.status === "DECLINED" || expired ? <p role="status" className="mt-5 text-sm text-muted-foreground">{expired ? "This offer has expired." : "You declined this offer."} There is no penalty.</p> : null}
    {mutation.isError && current.status === "OFFERED" ? <div role="alert" className="mt-4 text-sm text-danger"><p>{uncertain ? "The response was interrupted. Check the offer status before taking another action." : mutation.error.status === 409 || mutation.error.status === 410 ? "This offer is no longer available. Refresh its status." : mutation.error.status === 401 ? "Your session expired. Sign in again to respond." : "Your response could not be saved. Please check the offer status."}</p><button type="button" className="mt-2 min-h-10 underline" onClick={() => void refresh()}>Check offer status</button></div> : null}
  </article>;
}

function OffersContent() {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const offers = useApiQuery({
    queryKey: queryKeys.auctions.offers(auth.sessionId, page), meta: { requiresAuth: true },
    service: (signal) => getMyAuctionOffers(page, { context: auth.requestContext, signal }),
  }, { enabled: auth.status === "authenticated", refetchInterval: 15000, retry: false });
  if (offers.isPending) return <p role="status" className="py-3 text-sm text-muted-foreground">Checking your offers…</p>;
  if (offers.isError) return <section aria-label="Second chance offers" className="mt-6 rounded-sm border border-border p-4 text-sm"><p role="alert">Second chance offers are currently unavailable.</p><button type="button" onClick={() => void offers.refetch()} className="mt-1 min-h-10 text-primary underline">Retry offers</button></section>;
  if (!offers.data?.content.length && page === 0) return null;
  return <section aria-label="Second chance offers" className="mt-6 space-y-4"><div className="grid gap-4 lg:grid-cols-2">{offers.data?.content.map((offer) => <OfferCard key={offer.id} offer={offer} refresh={offers.refetch} />)}</div>{(offers.data?.totalPages ?? 0) > 1 || page > 0 ? <nav aria-label="Offer pages" className="flex items-center justify-end gap-3 text-sm"><button type="button" className={buttonClass} disabled={page === 0 || offers.isFetching} onClick={() => setPage(page - 1)}>Previous offers</button><span>Page {page + 1}</span><button type="button" className={buttonClass} disabled={page + 1 >= (offers.data?.totalPages ?? 0) || offers.isFetching} onClick={() => setPage(page + 1)}>Next offers</button></nav> : null}</section>;
}

function AuctionSecondChanceOffers() {
  const auth = useAuth();
  if (auth.status !== "authenticated") return null;
  return <OffersContent key={auth.sessionId} />;
}

export default AuctionSecondChanceOffers;
