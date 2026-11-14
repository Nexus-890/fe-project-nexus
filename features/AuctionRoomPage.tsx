"use client";

import Link from "next/link";
import { ChevronRight, Gavel, RefreshCw } from "lucide-react";
import ProductGallery from "../components/ProductGallery";
import AuctionCountdown from "../components/AuctionCountdown";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { getAuction } from "../service/auctionService";
import { getProduct } from "../service/catalogService";
import SellerReputation from "./SellerReputation";

const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const labels = { CREATED: "Created", SCHEDULED: "Scheduled", ACTIVE: "Live", ENDED: "Ended", WON: "Won", SETTLED: "Settled", FAILED: "Failed", CANCELLED: "Cancelled", PAYMENT_TIMEOUT: "Payment timed out" };

function AuctionRoomPage({ auctionId }: { auctionId: string }) {
  const auction = useApiQuery({ queryKey: queryKeys.auctions.detail(auctionId), service: (signal) => getAuction(auctionId, { signal }) }, {
    refetchInterval: (query) => query.state.data?.status === "ACTIVE" ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
  const productId = auction.data?.productId ?? "";
  const product = useApiQuery({ queryKey: queryKeys.catalog.product(productId), service: (signal) => getProduct(productId, { signal }) }, { enabled: !!productId });
  if (auction.isPending) return <section role="status" className="mx-auto max-w-[1248px] px-4 py-12 sm:px-6">Loading auction…</section>;
  if (auction.isError) return <section className="mx-auto max-w-[1248px] space-y-4 px-4 py-12 sm:px-6"><h1 className="text-heading-24">{auction.error.status === 404 ? "Auction not found" : "Unable to load this auction"}</h1><p role="alert" className="text-sm text-muted-foreground">{auction.error.detail || auction.error.title}</p><button type="button" onClick={() => void auction.refetch()} className="min-h-11 rounded-sm border border-border px-4 hover:bg-muted">Retry auction</button><Link href="/#live-auctions" className="ml-4 text-sm text-primary underline">Explore auctions</Link></section>;
  const current = auction.data;
  const item = product.data?.sellerId?.toLowerCase() === current.sellerId.toLowerCase() ? product.data : null;
  const images = item?.images.length ? item.images : current.imageUrl ? [{ id: current.id, imageUrl: current.imageUrl, sortOrder: 0 }] : [];

  return <section className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6 sm:py-8" aria-labelledby="auction-room-title">
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><Link href="/">Home</Link><ChevronRight size={14} aria-hidden="true" /><Link href="/#live-auctions">Auctions</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page" className="min-w-0 [overflow-wrap:anywhere]">{current.title}</span></nav>
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2 lg:gap-10">
      <div className="min-w-0 space-y-6"><ProductGallery key={current.id} images={images} productName={current.title} /><section aria-label="Item details" className="rounded-sm border border-border p-5 sm:p-6"><h2 className="text-heading-20">Item details</h2>{product.isPending ? <p role="status" className="mt-3 text-sm text-muted-foreground">Loading item details…</p> : product.isError || !item ? <div className="mt-3"><p className="text-sm text-muted-foreground">Item details are unavailable.</p><button type="button" onClick={() => void product.refetch()} className="mt-2 min-h-11 text-sm text-primary underline">Retry item details</button></div> : <><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">{item.description || "No description provided."}</p><Link href={`/products/${encodeURIComponent(item.slug)}?id=${encodeURIComponent(item.id)}`} className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline">View product details</Link></>}</section></div>
      <div className="min-w-0 space-y-6"><div><h1 id="auction-room-title" className="text-heading-32 [overflow-wrap:anywhere]">{current.title}</h1><p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span className={`inline-block size-2 rounded-full ${current.status === "ACTIVE" ? "bg-success" : "bg-muted-foreground"}`} aria-hidden="true" />{labels[current.status]} · Lot <span className="font-mono [overflow-wrap:anywhere]">{current.id.slice(-8).toUpperCase()}</span></p></div>
        <section aria-label="Auction overview" className="space-y-5 rounded-sm border border-border p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-primary px-4 py-3 text-primary-foreground"><span className="inline-flex items-center gap-2 text-sm font-medium"><Gavel size={18} aria-hidden="true" />{labels[current.status]}</span>{current.status === "ACTIVE" && <AuctionCountdown closesAt={current.endAt} />}</div>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Current bid</p><p className="mt-2 text-heading-32 text-primary [overflow-wrap:anywhere]">{formatVND(current.currentPrice)}</p></div><p className="text-sm text-muted-foreground">{current.bidCount} bids</p></div>
          <dl className="space-y-3 border-t border-border pt-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Starting price</dt><dd className="font-mono">{formatVND(current.startingPrice)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Bid increment</dt><dd className="font-mono">{formatVND(current.bidIncrement)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Ends</dt><dd className="text-right"><time dateTime={current.endAt}>{date.format(new Date(current.endAt))}</time></dd></div></dl>
          <button type="button" disabled={auction.isFetching} onClick={() => void auction.refetch()} className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"><RefreshCw size={15} aria-hidden="true" />{auction.isFetching ? "Refreshing…" : "Refresh auction"}</button>
        </section>
        <section aria-label="Seller information" className="min-w-0 rounded-sm border border-border p-5 sm:p-6"><h2 className="text-heading-20">Seller information</h2><div className="mt-4"><SellerReputation sellerId={current.sellerId} /></div></section>
      </div>
    </div>
  </section>;
}

export default AuctionRoomPage;
