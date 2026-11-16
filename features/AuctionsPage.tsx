"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gavel, Info, RefreshCw } from "lucide-react";
import AuctionListingCard from "../components/AuctionListingCard";
import { Pagination } from "../components/Pagination";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { getAuctions } from "../service/auctionService";
import { parsePage, readQueryValue } from "./catalogUtils";

const statuses = [
  { value: "ACTIVE", label: "Live Now" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ENDED", label: "Ended" },
] as const;
type ListStatus = typeof statuses[number]["value"];
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";

function AuctionsPage({ query }: { query: Record<string, string | string[] | undefined> }) {
  const statusValue = readQueryValue(query.status);
  const status: ListStatus = statuses.find((item) => item.value === statusValue)?.value ?? "ACTIVE";
  const page = parsePage(query.page);
  const [sort, setSort] = useState("soonest");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const auctions = useApiQuery({
    queryKey: queryKeys.auctions.list(status, page - 1),
    service: (signal) => getAuctions(status, page - 1, { signal }),
  }, { staleTime: 0, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const hrefFor = (nextStatus: ListStatus, nextPage = 1) => {
    const params = new URLSearchParams();
    if (nextStatus !== "ACTIVE") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    return params.size ? `/auctions?${params}` : "/auctions";
  };
  const data = auctions.data;
  const ordered = [...(data?.content ?? [])].sort((a, b) => {
    const time = (item: typeof a) => Date.parse(status === "SCHEDULED" ? item.startAt : item.endAt);
    return (time(a) - time(b)) * (sort === "soonest" ? 1 : -1);
  });

  return (
    <section className="mx-auto w-full max-w-[1248px] min-w-0 px-4 pb-16 pt-8 sm:px-6 lg:pt-9" aria-labelledby="auctions-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 id="auctions-title" className="text-heading-32">Auctions</h1><p className="mt-2 text-sm text-muted-foreground">Bids in the final 5 minutes extend an auction by 5 minutes.</p></div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/my-bids" className={buttonClass}><Gavel size={16} aria-hidden="true" />My Bids</Link>
          <details className="relative text-xs sm:text-right">
            <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 font-medium"><Info size={15} aria-hidden="true" />How Bidding Works</summary>
            <p className="absolute right-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-sm border border-border bg-card p-4 text-left leading-6 text-muted-foreground shadow-sm">Open an auction to see its minimum bid and bid history. Bids are binding. Bids placed in the final 5 minutes extend the auction by 5 minutes, up to 30 minutes beyond the original end time. Winners pay within 24 hours.</p>
          </details>
        </div>
      </div>
      <nav aria-label="Auction status" className="mt-7 flex flex-wrap gap-x-6 border-b border-border">
        {statuses.map((item) => <Link key={item.value} href={hrefFor(item.value)} aria-current={status === item.value ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 border-b-2 py-3 text-sm ${status === item.value ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item.label}{status === item.value && data ? <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] leading-4 text-foreground">{data.totalElements}</span> : null}</Link>)}
      </nav>
      <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{status === "SCHEDULED" ? "Discover upcoming auctions" : status === "ENDED" ? "Bidding has closed for these auctions" : "Find your next winning bid"}</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">Sort this page<select value={sort} onChange={(event) => setSort(event.target.value)} className="min-h-11 max-w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground"><option value="soonest">{status === "SCHEDULED" ? "Starting soonest" : "Ending soonest"}</option><option value="latest">{status === "SCHEDULED" ? "Starting latest" : "Ending latest"}</option></select></label>
      </div>
      {auctions.isError ? <div role="alert" className="mb-6 rounded-sm border border-danger/30 bg-danger/5 p-5"><h2 className="text-sm font-semibold">Unable to load auctions</h2><p className="mt-2 text-sm text-muted-foreground">{data ? "Showing the last available results. Prices may have changed." : "Check your connection and try again."}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => void auctions.refetch()}><RefreshCw size={15} aria-hidden="true" />Retry auctions</button></div> : null}
      {auctions.isPending ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading auctions…</p> : data && ordered.length ? <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{ordered.map((auction) => <AuctionListingCard key={auction.id} auction={auction} now={now} />)}</div> : data ? <div role="status" className="rounded-sm border border-border py-16 text-center"><Gavel size={32} aria-hidden="true" className="mx-auto mb-4 text-muted-foreground" /><h2 className="text-heading-20">No {status === "SCHEDULED" ? "scheduled" : status === "ENDED" ? "ended" : "live"} auctions found</h2><p className="mt-2 px-4 text-sm text-muted-foreground">{page > 1 ? "Try an earlier page to see available auctions." : "Check back soon for more auctions."}</p>{page > 1 ? <Link href={hrefFor(status)} className={`${buttonClass} mt-4`}>First page</Link> : null}</div> : null}
      {data ? <div className="mt-12 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted-foreground">{data.content.length ? `Showing ${data.page * data.size + 1}–${data.page * data.size + data.content.length} of ${data.totalElements} ${status === "ACTIVE" ? "live" : status.toLowerCase()} auctions` : `${data.totalElements} auctions`}</p><Pagination ariaLabel="Auction pagination" page={page} totalPages={data.totalPages} hrefForPage={(value) => hrefFor(status, value)} /></div> : null}
    </section>
  );
}

export default AuctionsPage;
