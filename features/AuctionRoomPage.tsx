"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Gavel, Home, RefreshCw, ShieldCheck, Tag, Wifi, WifiOff } from "lucide-react";
import AuctionBidHistory from "../components/AuctionBidHistory";
import AuctionCountdown from "../components/AuctionCountdown";
import PriceDisplay from "../components/PriceDisplay";
import ProductGallery from "../components/ProductGallery";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getProduct } from "../service/catalogService";
import { compareAuctionMoney, formatAuctionMoney, getAuctionMinimum } from "./auctionRoomUtils";
import { useAuctionBid } from "./useAuctionBid";
import { useAuctionState } from "./useAuctionState";
import AuctionWinnerCheckout from "./AuctionWinnerCheckout";
import { hasCurrentAuctionResult } from "./auctionStateReconciliation";
import type { AuctionRoom, MyAuctionBid } from "../types/auctionRoomType";
import SellerReputation from "./SellerReputation";
import { MoneyInput } from "../components/moneyInput";

const buttonClass = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

function AuctionRoomPage({ auctionId }: { auctionId: string }) {
  const { sessionId } = useAuth();
  return <AuctionRoomContents key={`${auctionId}:${sessionId}`} auctionId={auctionId} />;
}

function AuctionRoomContents({ auctionId }: { auctionId: string }) {
  const room = useAuctionState(auctionId);
  const { status: authStatus, user } = useAuth();
  const auction = room.detail.data;
  const product = useApiQuery({
    queryKey: queryKeys.catalog.product(auction?.productId ?? ""),
    service: (signal) => getProduct(auction!.productId, { signal }),
  }, { enabled: Boolean(auction?.productId) });

  if (!auction) return <section className="mx-auto max-w-[1248px] px-4 py-10 sm:px-6">
    {room.detail.isPending ? <p role="status" className="py-16 text-muted-foreground">Loading auction…</p> : <div className="rounded-sm border border-border p-8"><h1 className="text-heading-24">{room.detail.error?.status === 404 ? "Auction not found" : "Unable to load this auction"}</h1><p role="alert" className="mt-3 text-sm text-muted-foreground">{room.detail.error?.status === 404 ? "This auction may no longer be available." : "Check your connection and try again."}</p><button type="button" className={`${buttonClass} mt-5`} onClick={() => void room.detail.refetch()}>Retry auction</button><Link href="/" className={`${buttonClass} ml-3 mt-5`}>Home</Link></div>}
  </section>;

  const currentPrice = room.currentPrice ?? auction.currentPrice;
  const bidIncrement = room.bidIncrement ?? auction.bidIncrement;
  const status = room.status ?? auction.status;
  const minimum = getAuctionMinimum(currentPrice, bidIncrement);
  const images = product.data?.images.length ? product.data.images : auction.imageUrl ? [{ id: auction.id, imageUrl: auction.imageUrl, sortOrder: 0 }] : [];
  const active = status === "ACTIVE" && room.seconds > 0;
  const leading = Boolean(room.mine.data?.leading && compareAuctionMoney(room.mine.data.amount, currentPrice) === 0);
  // WON -> SETTLED confirms order creation, not a different winner. Keep the
  // verified identity and address draft while a supporting read catches up.
  const winningLifecycle = ["WON", "SETTLED", "PAYMENT_TIMEOUT"];
  const sameWinningResult = room.mine.data && winningLifecycle.includes(status) && winningLifecycle.includes(room.mine.data.auctionStatus);
  const finalIdentityReady = authStatus === "authenticated" &&
    (room.mine.data ? sameWinningResult || hasCurrentAuctionResult(status, room.mine.data.auctionStatus) : room.mine.isSuccess);
  const won = Boolean(finalIdentityReady && room.mine.data?.won && ["WON", "SETTLED", "PAYMENT_TIMEOUT"].includes(status));
  return <section className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6 lg:py-8" aria-labelledby="auction-title">
    <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link href="/" className="inline-flex min-h-11 min-w-11 items-center gap-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"><Home size={13} aria-hidden="true" />Home</Link><ChevronRight size={12} aria-hidden="true" />
      <span>Auctions</span><ChevronRight size={12} aria-hidden="true" /><span aria-current="page" className="text-foreground">{auction.title}</span>
    </nav>
    <div className="grid min-w-0 gap-7 lg:grid-cols-[1.07fr_1fr] lg:gap-10">
      <div className="contents lg:block">
        <div className="relative min-w-0"><ProductGallery images={images} productName={auction.title} />
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs shadow-sm"><span className={`size-2 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />{active ? "Live" : status === "SCHEDULED" || status === "CREATED" ? "Scheduled" : "Bidding closed"}</span>
        </div>
        <section className="order-2 rounded-sm border border-border p-5 sm:p-6 lg:mt-7" aria-labelledby="auction-item-title">
          <h2 id="auction-item-title" className="mb-4 text-sm font-semibold">Item Details</h2>
          {product.data?.description ? <p className="mb-5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{product.data.description}</p> : null}
          <dl className="space-y-4 text-xs"><div className="flex justify-between gap-5"><dt className="text-muted-foreground">Starting bid</dt><dd>{formatAuctionMoney(auction.startingPrice, auction.currency)}</dd></div><div className="flex justify-between gap-5"><dt className="text-muted-foreground">Bid increment</dt><dd>{formatAuctionMoney(auction.bidIncrement, auction.currency)}</dd></div><div className="flex justify-between gap-5"><dt className="text-muted-foreground">Original end time</dt><dd className="text-right">{new Date(auction.originalEndAt).toLocaleString()}</dd></div><div className="flex justify-between gap-5"><dt className="text-muted-foreground">Returns</dt><dd className="text-right">Not accepted for auction items</dd></div></dl>
          {product.isError ? <p className="mt-5 text-xs text-muted-foreground">Additional item details are unavailable. <button type="button" onClick={() => void product.refetch()} className="min-h-11 min-w-11 underline">Retry item details</button></p> : null}
        </section>
      </div>
      <div className="order-1 min-w-0 space-y-4">
        <div className="pb-1"><h1 id="auction-title" className="text-[28px] font-semibold leading-[1.3] tracking-tight sm:text-[30px]">{auction.title}</h1><p className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />{active ? "Live" : status.replaceAll("_", " ")} · Anti-sniping on · Lot {auction.id.slice(0, 8).toUpperCase()}</p></div>
        <div className="rounded-sm border border-border p-5 sm:p-6">
          <AuctionCountdown seconds={room.seconds} status={status} extensionCount={auction.extensionCount} />
          <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground" role="status">{room.connected ? <Wifi size={13} aria-hidden="true" /> : <WifiOff size={13} aria-hidden="true" />}{room.terminal ? "Final auction result" : room.connected ? "Live updates connected" : "Refreshing every 2 seconds"}</div>
          {room.state.isError ? <p className="mt-2 text-xs text-warning" role="status">Live state is unavailable. Showing the latest auction snapshot.</p> : null}
          {room.detail.isError ? <p role="alert" className="mt-2 text-xs text-danger">Updates are delayed. <button className="min-h-11 min-w-11 underline" type="button" onClick={() => void room.refresh()}>Refresh auction</button></p> : null}
          <div className="mb-5 mt-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="mb-1 text-xs text-muted-foreground">{room.terminal ? "Final bid" : "Current bid"}</h2><PriceDisplay amount={won ? room.mine.data?.finalPrice ?? currentPrice : currentPrice} currency={auction.currency} /></div><div className="pb-1 text-right text-xs"><p>{room.bidCount ?? auction.bidCount} bids</p><p className="mt-1.5 text-muted-foreground">Started at {formatAuctionMoney(auction.startingPrice, auction.currency)} · Increment {formatAuctionMoney(bidIncrement, auction.currency)}</p></div></div>
          {active ? <>
            {leading && authStatus === "authenticated" ? <p className="mb-4 flex items-center gap-2 text-xs"><ShieldCheck size={16} className="text-info" aria-hidden="true" /><span><strong>You’re the highest bidder</strong><span className="text-muted-foreground"> · we’ll update this page if you’re outbid</span></span></p> : room.mine.data && authStatus === "authenticated" ? <p className="mb-4 text-xs text-warning" role="status">You’ve been outbid. Place a higher bid to lead again.</p> : null}
            {authStatus === "authenticated" && user?.id !== auction.sellerId ? <AuctionBidForm key={auctionId} auctionId={auctionId} minimum={minimum} increment={bidIncrement} currency={auction.currency} refresh={room.refresh} stale={room.detail.isError && room.state.isError} />
              : user?.id === auction.sellerId ? <p className="rounded-sm bg-muted p-4 text-sm">You cannot bid on your own auction.</p>
                : authStatus === "restoring" || authStatus === "authenticating" ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading your account…</p>
                  : <div className="space-y-3"><Link href={`/sign-in?returnTo=${encodeURIComponent(`/auctions/${auctionId}`)}`} className={`${buttonClass} w-full border-primary bg-primary text-primary-foreground hover:bg-primary/90`}>Sign in to bid</Link><p className="text-xs text-muted-foreground">Bids are binding — winners pay within 24 hours.</p></div>}
          </> : <AuctionEndState auction={auction} winner={won ? room.mine.data ?? null : null} status={status} won={won} paymentClosed={room.mine.data?.auctionStatus === "PAYMENT_TIMEOUT"} checking={authStatus === "authenticated" && !finalIdentityReady} authenticated={authStatus === "authenticated"} serverNow={room.serverNow} />}
          {room.mine.isError && authStatus === "authenticated" ? <p className="mt-4 text-xs text-muted-foreground">Your bidding status is unavailable. <button type="button" className="min-h-11 min-w-11 underline" onClick={() => void room.mine.refetch()}>Retry your status</button></p> : null}
        </div>
        <AuctionBidHistory bids={room.history.data?.content ?? []} currency={auction.currency} currentPrice={currentPrice} now={room.serverNow} page={room.page} totalPages={room.history.data?.totalPages ?? 0} loading={room.history.isPending} error={room.history.isError} leading={leading} onPage={room.setPage} onRetry={() => void room.history.refetch()} />
        <section className="rounded-sm border border-border p-5 sm:p-6" aria-label="Auction seller"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-secondary"><ShieldCheck size={18} aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-medium">About this item</p><p className="mt-1 text-xs text-muted-foreground">View the seller’s item details</p></div><Link href={`/products/${encodeURIComponent(product.data?.slug ?? auction.productId)}?id=${encodeURIComponent(auction.productId)}`} className={`${buttonClass} ml-auto shrink-0`}>View item</Link></div><div className="mt-4"><SellerReputation sellerId={auction.sellerId} /></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Bids in the final 5 minutes extend the auction by 5 minutes, up to 30 minutes beyond its original end time.</p></section>
      </div>
    </div>
  </section>;
}

function AuctionBidForm({ auctionId, minimum, increment, currency, refresh, stale }: { auctionId: string; minimum: string; increment: string; currency: string; refresh: () => Promise<unknown>; stale: boolean }) {
  const bid = useAuctionBid(auctionId, minimum, refresh);
  const options = [bid.minimum, getAuctionMinimum(bid.minimum, increment), getAuctionMinimum(getAuctionMinimum(bid.minimum, increment), increment)];
  return <form onSubmit={(event) => { event.preventDefault(); if (!stale) bid.submit(); }} className="space-y-4">
    <div className="grid grid-cols-3 gap-2">{options.map((value) => <button type="button" key={value} disabled={bid.pending || bid.uncertain || stale} onClick={() => bid.changeAmount(value)} className={`${buttonClass} min-w-0 px-1 text-xs sm:text-sm`}>{formatAuctionMoney(value, currency)}</button>)}</div>
    <div className="flex flex-wrap gap-2"><div className="relative min-w-0 flex-1"><label htmlFor="auction-bid-amount" className="sr-only">Bid amount</label><Tag size={16} aria-hidden="true" className="absolute left-3 top-3.5 text-muted-foreground" /><MoneyInput id="auction-bid-amount" aria-describedby="auction-bid-help auction-bid-feedback" aria-invalid={Boolean(bid.error)} value={bid.amount} disabled={bid.pending || bid.uncertain || stale} onValueChange={bid.changeAmount} className="h-11 w-full min-w-24 rounded-sm border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50" /></div><button type="submit" disabled={bid.pending || stale} className={`${buttonClass} border-primary bg-primary px-4 text-primary-foreground hover:bg-primary/90`}>{bid.uncertain ? <RefreshCw size={16} aria-hidden="true" /> : <Gavel size={16} aria-hidden="true" />}{bid.pending ? "Placing bid…" : bid.uncertain ? "Retry same bid" : "Place Bid"}</button></div>
    <p id="auction-bid-help" className="text-[11px] leading-5 text-muted-foreground">Enter {formatAuctionMoney(bid.minimum, currency)} or more. Bids are binding — winners pay within 24 hours.</p>
    <div id="auction-bid-feedback">{bid.error ? <p role="alert" className="text-xs leading-5 text-danger">{bid.error}</p> : bid.success ? <p role="status" className="text-xs text-success">Your bid was accepted.</p> : null}</div>
    <p className="flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck size={14} className="text-info" aria-hidden="true" />Your bid is submitted securely to the auction.</p>
  </form>;
}

function AuctionEndState({ auction, winner, status, won, paymentClosed, checking, authenticated, serverNow }: { auction: AuctionRoom; winner: MyAuctionBid | null; status: string; won: boolean; paymentClosed: boolean; checking: boolean; authenticated: boolean; serverNow: number }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const scheduled = status === "CREATED" || status === "SCHEDULED";
  const cancelled = status === "CANCELLED";
  const timeout = status === "PAYMENT_TIMEOUT" || paymentClosed;
  const pending = status === "ENDED" || status === "ACTIVE";
  const lost = authenticated && !checking && !won && ["WON", "SETTLED", "PAYMENT_TIMEOUT"].includes(status);
  const orderId = winner?.orderId;
  const paymentDueAt = winner?.paymentDueAt ?? null;
  return <div className="border-t border-border pt-5">
    <div role="status"><h2 className={`text-xl font-semibold ${won && !timeout ? "text-info" : ""}`}>{scheduled ? "This auction hasn’t started yet" : cancelled ? "Auction cancelled" : status === "FAILED" ? "Auction ended without a winner" : pending || checking ? "Confirming auction result" : timeout && won ? "Payment deadline passed" : won ? "You won this auction" : lost ? "You didn’t win this auction" : "Auction ended"}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{scheduled ? "Come back when bidding opens." : cancelled ? auction.cancelledReason || "This auction was cancelled. No more bids can be placed." : status === "FAILED" ? "No winning bid was confirmed. Bidding is closed." : pending || checking ? "Bidding has closed. We’re waiting for the final result; being the last leading bidder does not confirm a win." : timeout ? "The payment window has closed." : won ? orderId ? "Your winning bid is confirmed. Confirm your address to continue to payment." : "Your winning bid is confirmed. Waiting for your order reference before address confirmation and payment can open." : lost ? "Another bidder won this auction. Thank you for taking part." : "Bidding is closed for this item. Sign in to check your result."}</p></div>
    {won && paymentDueAt && !timeout ? <p className="mt-3 text-sm font-medium">Pay by {new Date(paymentDueAt).toLocaleString()}</p> : null}
    {won && !timeout && orderId ? <><button type="button" onClick={() => setCheckoutOpen(true)} className={`${buttonClass} mt-4 border-primary bg-primary text-primary-foreground hover:bg-primary/90`}>Confirm address and pay</button><Link className={`${buttonClass} mt-3 sm:ml-3`} href={`/order/${orderId}`}>View winning order</Link>{checkoutOpen ? <AuctionWinnerCheckout key={orderId} orderId={orderId} currency={auction.currency} paymentDueAt={paymentDueAt} serverNow={serverNow} /> : null}</> : null}
  </div>;
}

export default AuctionRoomPage;
