import Link from "next/link";
import AuctionTimeBadge from "./AuctionTimeBadge";
import ProductImage from "./ProductImage";
import { formatAuctionMoney } from "../features/auctionRoomUtils";
import type { AuctionRoom } from "../types/auctionRoomType";

function AuctionListingCard({ auction, now }: { auction: AuctionRoom; now: number }) {
  const scheduled = auction.status === "SCHEDULED";
  return (
    <article className="min-w-0 overflow-hidden rounded-sm border border-border bg-card transition hover:border-primary">
      <Link href={`/auctions/${auction.id}`} prefetch={false} className="group block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={auction.title}>
        <div className="relative aspect-square bg-muted p-5">
          <ProductImage src={auction.imageUrl ?? undefined} alt="" productName={auction.title} loading="lazy" />
          <div className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)]"><AuctionTimeBadge startAt={auction.startAt} endAt={auction.endAt} status={auction.status} now={now} /></div>
        </div>
        <div className="flex min-h-36 flex-col p-3">
          <h2 className="mb-4 line-clamp-2 min-h-10 text-sm leading-5 group-hover:text-primary">{auction.title}</h2>
          <p className="mb-1 text-xs text-muted-foreground">{scheduled ? "Starting bid" : "Current bid"}</p>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <p className="text-base font-semibold text-primary [overflow-wrap:anywhere]">{formatAuctionMoney(scheduled ? auction.startingPrice : auction.currentPrice, auction.currency)}</p>
            <p className="text-[11px] text-muted-foreground">{scheduled ? "Bidding opens soon" : `${auction.bidCount} ${auction.bidCount === 1 ? "bid" : "bids"}`}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default AuctionListingCard;
