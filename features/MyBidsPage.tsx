"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gavel, RefreshCw } from "lucide-react";
import AuctionTimeBadge from "../components/AuctionTimeBadge";
import { Pagination } from "../components/Pagination";
import ProductImage from "../components/ProductImage";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getAuction, getMyAuctionBids } from "../service/auctionService";
import type { MyAuctionBid } from "../types/auctionRoomType";
import { formatAuctionMoney } from "./auctionRoomUtils";
import { parsePage, readQueryValue } from "./catalogUtils";
import AuctionSecondChanceOffers from "./AuctionSecondChanceOffers";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";
const tabs = ["All", "Active", "Won", "Lost"] as const;
type BidTab = typeof tabs[number];
const matchesTab = (bid: MyAuctionBid, tab: BidTab) => tab === "All" ||
  (tab === "Active" && bid.auctionStatus === "ACTIVE") ||
  (tab === "Won" && bid.won) ||
  (tab === "Lost" && !bid.won && ["WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT"].includes(bid.auctionStatus));

function MyBidRow({ bid, now }: { bid: MyAuctionBid; now: number }) {
  const detail = useApiQuery({
    queryKey: queryKeys.auctions.detail(bid.auctionId),
    service: (signal) => getAuction(bid.auctionId, { signal }),
  }, { staleTime: 0, refetchInterval: bid.auctionStatus === "ACTIVE" ? 15_000 : false });
  const auction = detail.data;
  const active = bid.auctionStatus === "ACTIVE";
  const checking = Boolean(auction && active && auction.status !== "ACTIVE");
  const closed = Boolean(auction && now && Date.parse(auction.endAt) <= now);
  // amount is the latest personal bid, which may have been cancelled. The
  // private projection's leading flag checks the valid winning bid separately.
  const leading = bid.leading;
  const status = checking ? "Result pending" : bid.auctionStatus === "ENDED" ? "Result pending"
    : bid.auctionStatus === "CANCELLED" ? "Cancelled"
      : bid.auctionStatus === "PAYMENT_TIMEOUT" && bid.won ? "Payment deadline passed"
        : bid.won ? "Won"
          : active ? leading ? "Leading" : "Outbid"
            : ["CREATED", "SCHEDULED"].includes(bid.auctionStatus) ? "Scheduled" : "Lost";
  const statusClass = status === "Leading" || status === "Won" ? "bg-success"
    : status === "Outbid" ? "bg-warning" : status === "Payment deadline passed" ? "bg-danger" : "bg-muted-foreground";
  const amount = auction ? formatAuctionMoney(bid.amount, auction.currency) : bid.amount;
  const canBid = active && !checking && !closed;

  return (
    <tr className="grid min-w-0 grid-cols-2 gap-4 border-t border-border p-4 lg:table-row lg:p-0">
      <td className="col-span-2 min-w-0 lg:w-[41%] lg:px-4 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/auctions/${bid.auctionId}`} prefetch={false} tabIndex={-1} aria-hidden="true" className="size-12 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage src={auction?.imageUrl ?? undefined} alt="" productName={bid.title} compact loading="lazy" /></Link>
          <div className="min-w-0"><Link href={`/auctions/${bid.auctionId}`} prefetch={false} className="block text-sm font-medium leading-5 hover:text-primary lg:truncate" title={bid.title}>{bid.title}</Link><p className="mt-1 text-[11px] text-muted-foreground">{bid.auctionStatus === "ACTIVE" ? "Live auction" : bid.auctionStatus.replaceAll("_", " ").toLowerCase()}</p>{detail.isError ? <p className="mt-1 text-[11px] text-muted-foreground">Auction details unavailable. <button type="button" onClick={() => void detail.refetch()} className="min-h-7 underline">Retry details</button></p> : null}</div>
        </div>
      </td>
      <td className="min-w-0 lg:px-3 lg:py-4"><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Your bid</span><span className="font-mono text-xs tabular-nums [overflow-wrap:anywhere]">{amount}</span>{!auction ? <span className="mt-1 block text-[10px] text-muted-foreground">Currency unavailable</span> : null}</td>
      <td className="min-w-0 lg:px-3 lg:py-4"><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Current bid</span><span className="font-mono text-xs tabular-nums [overflow-wrap:anywhere]">{auction ? formatAuctionMoney(bid.finalPrice ?? auction.currentPrice, auction.currency) : "Unavailable"}</span></td>
      <td className="min-w-0 lg:px-3 lg:py-4"><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Status</span><span className="inline-flex items-center gap-1.5 text-xs"><span className={`size-1.5 shrink-0 rounded-full ${statusClass}`} aria-hidden="true" />{status}</span></td>
      <td className="min-w-0 lg:px-3 lg:py-4"><span className="mb-1 block text-xs text-muted-foreground lg:hidden">Ends in</span>{auction ? <AuctionTimeBadge startAt={auction.startAt} endAt={auction.endAt} status={auction.status} now={now} /> : <span className="text-xs text-muted-foreground">Unavailable</span>}</td>
      <td className="col-span-2 lg:px-4 lg:py-4 lg:text-right"><Link href={`/auctions/${bid.auctionId}`} prefetch={false} className={`${buttonClass} w-full whitespace-nowrap px-3 text-xs lg:min-h-9 lg:w-auto ${canBid && !leading ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}>{canBid ? leading ? "Increase Bid" : "Bid Again" : "View Auction"}</Link></td>
    </tr>
  );
}

function MyBidsPage({ query }: { query: Record<string, string | string[] | undefined> }) {
  const { sessionId } = useAuth();
  return <MyBidsContents key={sessionId} query={query} />;
}

function MyBidsContents({ query }: { query: Record<string, string | string[] | undefined> }) {
  const auth = useAuth();
  const selected = readQueryValue(query.status);
  const tab = tabs.find((value) => value.toLowerCase() === selected.toLowerCase()) ?? "All";
  const page = parsePage(query.page);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const mine = useApiQuery({
    queryKey: [...queryKeys.auctions.own(auth.sessionId, 0), "all"],
    service: async (signal) => {
      // The delivered API has no status filter. Read every page before deriving
      // tabs or totals so a won auction on a later page remains discoverable.
      const results = new Map<string, MyAuctionBid>();
      let index = 0;
      let totalPages = 1;
      do {
        const result = await getMyAuctionBids(index, { signal, context: auth.requestContext });
        for (const bid of result.content) results.set(bid.auctionId, bid);
        totalPages = result.totalPages;
        index += 1;
      } while (index < totalPages);
      return [...results.values()];
    },
    meta: { requiresAuth: true },
  }, { enabled: auth.status === "authenticated", staleTime: 0, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const bids = mine.data ?? [];
  const filtered = bids.filter((bid) => matchesTab(bid, tab));
  const rows = filtered.slice((page - 1) * 10, page * 10);
  const hrefFor = (nextTab: BidTab, nextPage = 1) => {
    const params = new URLSearchParams();
    if (nextTab !== "All") params.set("status", nextTab.toLowerCase());
    if (nextPage > 1) params.set("page", String(nextPage));
    return params.size ? `/my-bids?${params}` : "/my-bids";
  };
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(hrefFor(tab, page))}`;
  const stats = [
    { label: "Active bids", value: bids.filter((bid) => bid.auctionStatus === "ACTIVE").length, note: `${bids.filter((bid) => bid.auctionStatus === "ACTIVE" && bid.leading).length} leading` },
    { label: "Won auctions", value: bids.filter((bid) => bid.won).length },
    // SETTLED records order creation. Payment status is not part of MyBid.
    { label: "Awaiting order", value: bids.filter((bid) => bid.won && !bid.orderId && ["WON", "SETTLED"].includes(bid.auctionStatus)).length },
    { label: "Auctions joined", value: bids.length },
  ];

  return (
    <section aria-labelledby="my-bids-title" className="mx-auto w-full max-w-[1248px] min-w-0 px-4 pb-16 pt-8 sm:px-6 lg:pt-9">
      <div className="flex flex-wrap items-center justify-between gap-4"><h1 id="my-bids-title" className="text-heading-32">My Bids</h1><Link href="/auctions" className={buttonClass}>Explore auctions</Link></div>
      {auth.status === "restoring" || auth.status === "authenticating" ? <p role="status" className="py-16 text-sm text-muted-foreground">Loading your account…</p>
        : auth.status === "error" ? <div className="py-12"><p role="alert" className="text-sm">{auth.error?.detail || "Unable to load your account."}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => void auth.retryProfile()}>Retry account</button></div>
          : auth.status !== "authenticated" ? <div className="py-16 text-center"><Gavel size={36} aria-hidden="true" className="mx-auto mb-4 text-muted-foreground" /><h2 className="text-heading-20">Sign in to view your bids</h2><p className="mt-2 text-sm text-muted-foreground">Track auctions you’re leading, bids you’ve lost and your final results.</p><Link href={signInHref} className={`${buttonClass} mt-6 border-primary bg-primary text-primary-foreground hover:bg-primary/90`}>Sign in</Link></div>
            : <>
              <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-sm border border-border lg:grid-cols-4">{stats.map(({ label, value, note }, index) => <div key={label} className={`min-w-0 p-5 sm:p-6 ${index % 2 ? "border-l border-border" : ""} ${index >= 2 ? "border-t border-border lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}><p className="text-xs text-muted-foreground">{label}</p><div className="mt-3 flex flex-wrap items-baseline gap-2"><span className="text-2xl font-semibold tabular-nums">{mine.data ? value : "—"}</span>{note && mine.data ? <span className="text-xs text-muted-foreground">{note}</span> : null}</div></div>)}</div>
              <AuctionSecondChanceOffers />
              <nav aria-label="My bid status" className="mt-8 flex flex-wrap gap-x-6 border-b border-border">{tabs.map((value) => <Link key={value} href={hrefFor(value)} aria-current={tab === value ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 border-b-2 py-3 text-sm ${tab === value ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{value}{mine.data ? <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] leading-4 text-foreground">{bids.filter((bid) => matchesTab(bid, value)).length}</span> : null}</Link>)}</nav>
              {mine.isError ? <div role="alert" className="mt-6 rounded-sm border border-danger/30 bg-danger/5 p-5"><h2 className="text-sm font-semibold">Unable to load your bids</h2><p className="mt-2 text-sm text-muted-foreground">{mine.data ? "Showing your last available bids. Results may have changed." : mine.error.status === 401 ? "Your session has expired. Sign in again to view your bids." : mine.error.status === 403 ? "Your account does not have permission to view these bids." : "Check your connection and try again."}</p>{mine.error.status === 401 ? <Link href={signInHref} className={`${buttonClass} mt-4`}>Sign in</Link> : <button type="button" className={`${buttonClass} mt-4`} onClick={() => void mine.refetch()}><RefreshCw size={15} aria-hidden="true" />Retry bids</button>}</div> : null}
              {mine.isPending ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">Loading your bids…</p> : mine.data ? <>
                {rows.length ? <table className="mt-6 block w-full overflow-hidden rounded-sm border border-border text-left lg:table lg:table-fixed"><caption className="sr-only">Your auction bids and final results</caption><thead className="hidden bg-muted text-xs text-muted-foreground lg:table-header-group"><tr><th scope="col" className="w-[37%] px-4 py-3 font-normal">Auction</th><th scope="col" className="w-[13%] px-3 py-3 font-normal">Your bid</th><th scope="col" className="w-[13%] px-3 py-3 font-normal">Current bid</th><th scope="col" className="w-[12%] px-3 py-3 font-normal">Status</th><th scope="col" className="w-[13%] px-3 py-3 font-normal">Ends in</th><th scope="col" className="w-[12%] px-4 py-3"><span className="sr-only">Action</span></th></tr></thead><tbody className="block lg:table-row-group">{rows.map((bid) => <MyBidRow key={bid.auctionId} bid={bid} now={now} />)}</tbody></table>
                  : <div role="status" className="mt-6 rounded-sm border border-border py-16 text-center"><h2 className="text-heading-20">{bids.length ? `No ${tab === "All" ? "bids" : `${tab.toLowerCase()} bids`} on this page` : "You haven’t placed a bid yet"}</h2><p className="mt-2 px-4 text-sm text-muted-foreground">{page > 1 ? "Try the first page to see your results." : "Explore auctions to find your next bid."}</p><Link href={page > 1 ? hrefFor(tab) : "/auctions"} className={`${buttonClass} mt-5`}>{page > 1 ? "First page" : "Explore auctions"}</Link></div>}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="text-xs text-muted-foreground">{rows.length ? `Showing ${(page - 1) * 10 + 1}–${(page - 1) * 10 + rows.length} of ${filtered.length} ${tab === "All" ? "auctions" : `${tab.toLowerCase()} auctions`}` : `${filtered.length} ${tab === "All" ? "auctions" : `${tab.toLowerCase()} auctions`}`}</p><Pagination ariaLabel="My bids pagination" page={page} totalPages={Math.ceil(filtered.length / 10)} hrefForPage={(value) => hrefFor(tab, value)} /></div>
              </> : null}
            </>}
    </section>
  );
}

export default MyBidsPage;
