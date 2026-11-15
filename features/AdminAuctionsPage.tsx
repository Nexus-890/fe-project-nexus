"use client";

import Link from "next/link";
import { useState } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getManagedAuctions } from "../service/auctionService";
import { SellerError, SellerHeading, SellerStatus, SellerTabs, sellerButton } from "../components/SellerUi";
import type { AuctionStatus } from "../types/auctionRoomType";
import { formatAuctionMoney } from "./auctionRoomUtils";
import { auctionStatusLabels, auctionStatusTabs, formatVietnamTime } from "./adminAuctionUtils";

function AdminAuctionsPage() {
  const [status, setStatus] = useState<AuctionStatus>("ACTIVE");
  const [page, setPage] = useState(0);
  const auth = useAuth();
  const result = useApiQuery({ queryKey: queryKeys.auctions.manage.list(auth.sessionId, status, page), meta: { requiresAuth: true },
    service: (signal) => getManagedAuctions(status, page, { context: auth.requestContext, signal }) }, { retry: false });
  const rows = result.data?.content ?? [];
  return <>
    <SellerHeading title="Auctions" description="Review every auction by status, then open one for its live state and bid history." />
    <SellerTabs values={auctionStatusTabs.map((value) => auctionStatusLabels[value])} selected={auctionStatusLabels[status]} change={(label) => { setStatus(auctionStatusTabs.find((value) => auctionStatusLabels[value] === label) ?? "ACTIVE"); setPage(0); }} />
    {result.isPending ? <p role="status">Loading auctions…</p> : result.error ? <SellerError error={result.error} retry={() => void result.refetch()} /> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[860px] text-left text-sm"><caption className="sr-only">Auctions</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Auction", "Seller", "Start / end", "Current price", "Bids", "Status"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-normal">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><th scope="row" className="max-w-72 px-4 py-4 font-normal"><Link href={`/backoffice/auctions/${encodeURIComponent(row.id)}`} className="break-words font-medium hover:text-primary">{row.title}</Link><span className="mt-1 block font-mono text-xs text-muted-foreground" title={row.productId}>Product {row.productId.slice(0, 8)}</span></th><td className="px-4 py-4 font-mono text-xs" title={row.sellerId}>{row.sellerId.slice(0, 8)}</td><td className="px-4 py-4 text-xs text-muted-foreground"><time dateTime={row.startAt} className="block">{formatVietnamTime(row.startAt)}</time><time dateTime={row.endAt} className="mt-1 block">{formatVietnamTime(row.endAt)}</time></td><td className="px-4 py-4 font-mono">{formatAuctionMoney(row.currentPrice, row.currency)}</td><td className="px-4 py-4 font-mono">{row.bidCount}</td><td className="px-4 py-4"><SellerStatus>{auctionStatusLabels[row.status]}</SellerStatus></td></tr>)}</tbody></table>{!rows.length && <p role="status" className="p-10 text-center text-muted-foreground">No auctions with this status.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p>Page {page + 1} · {result.data?.totalElements ?? 0} {result.data?.totalElements === 1 ? "auction" : "auctions"}</p><nav aria-label="Auction pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
  </>;
}

export default AdminAuctionsPage;
