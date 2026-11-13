import type { AuctionBid } from "../types/auctionRoomType";
import { compareAuctionMoney, formatAuctionMoney, formatBidAge } from "../features/auctionRoomUtils";

function AuctionBidHistory({ bids, currency, currentPrice, now, page, totalPages, loading, error, leading, onPage, onRetry }: {
  bids: AuctionBid[]; currency: string; currentPrice: string; now: number; page: number; totalPages: number;
  loading: boolean; error: boolean; leading: boolean; onPage: (page: number) => void; onRetry: () => void;
}) {
  return <section aria-labelledby="auction-history-title" className="rounded-sm border border-border p-5 sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-2"><h2 id="auction-history-title" className="text-sm font-semibold">Bid History</h2><span className="text-xs text-muted-foreground">Names masked · live</span></div>
    {error ? <div role="alert" className="text-sm text-muted-foreground"><p>Bid history is temporarily unavailable.</p><button type="button" onClick={onRetry} className="mt-2 min-h-11 text-foreground underline">Retry history</button></div>
      : loading ? <p role="status" className="py-4 text-sm text-muted-foreground">Loading bids…</p>
        : bids.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No bids yet. Be the first to bid.</p>
          : <ol className="space-y-3">{bids.map((bid, index) => <li key={`${bid.placedAt}:${bid.bidderName}:${bid.amount}`} className={`flex flex-wrap items-center gap-2 rounded-sm border px-3 py-3 text-xs ${page === 0 && index === 0 ? "border-primary" : "border-transparent"}`}>
            <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary font-medium uppercase">{bid.bidderName.charAt(0)}</span>
            <span className="font-mono">{bid.bidderName}</span>
            {page === 0 && index === 0 && compareAuctionMoney(bid.amount, currentPrice) === 0 ? <span className="rounded-full bg-success px-2 py-0.5 text-[10px] text-white">{leading ? "You · Leading" : "Leading"}</span> : null}
            <span className="ml-auto font-semibold">{formatAuctionMoney(bid.amount, currency)}</span>
            <time dateTime={bid.placedAt} title={new Date(bid.placedAt).toLocaleString()} className="min-w-12 text-right text-[10px] text-muted-foreground">{formatBidAge(bid.placedAt, now)}</time>
          </li>)}</ol>}
    {totalPages > 1 ? <nav aria-label="Bid history pages" className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="min-h-11 px-2 disabled:opacity-40">Previous</button><span>{page + 1} / {totalPages}</span><button type="button" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="min-h-11 px-2 disabled:opacity-40">Next</button></nav> : null}
  </section>;
}

export default AuctionBidHistory;
