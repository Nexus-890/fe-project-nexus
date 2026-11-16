"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Clock3, Plus } from "lucide-react";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { cancelSellerAuction, getSellerAuctions, scheduleSellerAuction } from "../service/sellerAuctionService";
import { formatVND } from "../components/formatPrice";
import ProductImage from "../components/ProductImage";
import SellerSecondChanceOffer from "../components/SellerSecondChanceOffer";
import { readBackofficeRoles, sellerAuctionHref } from "./backofficeAccess";
import { SellerError, SellerHeading, SellerStatus, SellerTabs, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import type { SellerAuction, SellerAuctionStatus } from "../types/sellerAuctionType";

const filters: Record<string, SellerAuctionStatus | undefined> = { Active: "ACTIVE", Scheduled: "SCHEDULED", Ended: "ENDED", Cancelled: "CANCELLED", All: undefined, Drafts: "CREATED", Won: "WON", Settled: "SETTLED", Failed: "FAILED", "Payment timeout": "PAYMENT_TIMEOUT" };
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

function AuctionDeadline({ auction }: { auction: SellerAuction }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const scheduled = auction.status === "CREATED" || auction.status === "SCHEDULED";
  const target = scheduled ? auction.startAt : auction.endAt;
  const seconds = now === null ? null : Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  const countdown = seconds === null ? null : seconds >= 86400 ? `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h` : `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <div className="text-xs"><time dateTime={target} className="block text-muted-foreground">{date.format(new Date(target))}</time>{["CREATED", "SCHEDULED", "ACTIVE"].includes(auction.status) && countdown && <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono ${!scheduled && seconds !== null && seconds <= 3600 ? "bg-danger text-danger-foreground" : "bg-secondary text-foreground"}`}><Clock3 size={12} aria-hidden="true" />{seconds === 0 ? auction.status === "CREATED" ? "Planned start reached" : scheduled ? "Starting soon" : "Ending soon" : `${auction.status === "CREATED" ? "Planned in " : scheduled ? "Starts in " : ""}${countdown}`}</span>}</div>;
}

function SellerAuctionsPage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const [tab, setTab] = useState("Active");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<SellerAuction | null>(null);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const status = filters[tab];
  const result = useApiQuery({ queryKey: queryKeys.seller.auctions(auth.sessionId, { page, size: 10, status }), meta: { requiresAuth: true }, service: (signal) => getSellerAuctions({ page, size: 10, status }, { context: auth.requestContext, signal }) }, { retry: false, refetchInterval: 10_000, refetchIntervalInBackground: false });
  const action = useApiMutation({
    execute: ({ auction, kind, reason }: { auction: SellerAuction; kind: "cancel" | "schedule"; reason?: string }) => {
      const controller = new AbortController(); pending.current = controller;
      const options = { context: auth.requestContext, signal: controller.signal };
      return kind === "cancel" ? cancelSellerAuction(auction.id, reason ?? "", options) : scheduleSellerAuction(auction.id, options);
    },
    isCurrent: () => auth.isSessionCurrent(auth.sessionId) && pending.current?.signal.aborted !== true,
    invalidateKey: [queryKeys.seller.auctionRoot(auth.sessionId)],
  }, { onSuccess: (auction) => { dialog.current?.close(); setSelected(null); setNotice(auction.status === "CANCELLED" ? "Auction cancelled." : "Auction scheduled."); } });
  const rows = result.data?.content ?? [];
  return <>
    <SellerHeading title="Auctions" description="Manage your auctions from draft to settlement."><Link href={sellerAuctionHref(roles, "new")} className={sellerPrimary}><Plus size={16} aria-hidden="true" />Create Auction</Link></SellerHeading>
    <SellerTabs values={Object.keys(filters)} selected={tab} change={(value) => { setTab(value); setPage(0); setNotice(""); }} />
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {action.error && !selected && <p role="alert" className="text-sm text-danger">{action.error.detail || action.error.title}</p>}
    {result.isPending ? <p role="status">Loading your auctions…</p> : result.error ? <SellerError error={result.error} retry={() => void result.refetch()} /> : <>
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[900px] text-left text-sm"><caption className="sr-only">Your auctions</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Product", "Status", "Start price", "Current bid", "Bids", "Starts / ends", "Actions"].map((label) => <th scope="col" key={label} className="px-4 py-3 font-normal">{label}</th>)}</tr></thead><tbody>{rows.map((auction) => {
        const editable = ["CREATED", "SCHEDULED"].includes(auction.status) && auction.bidCount === 0 && Date.parse(auction.startAt) > now;
        const cancellable = ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON"].includes(auction.status) && auction.bidCount === 0;
        return <tr key={auction.id} className="border-t border-border"><th scope="row" className="max-w-80 px-4 py-5 font-normal"><div className="flex items-center gap-3"><div className="size-11 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage src={auction.imageUrl ?? undefined} alt={auction.title} productName={auction.title} compact /></div><div className="min-w-0"><Link href={sellerAuctionHref(roles, auction.id)} className="break-words font-medium hover:text-primary">{auction.title}</Link><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{auction.id.slice(0, 8)}</p>{auction.cancelledReason && <p className="mt-2 break-words text-xs text-muted-foreground">{auction.cancelledBy === "SYSTEM" ? "System cancellation" : auction.cancelledBy === "ADMIN" ? "Admin cancellation" : "Cancelled"}: {auction.cancelledReason}</p>}</div></div></th><td className="px-4 py-5"><SellerStatus>{auction.status === "ACTIVE" ? "Live" : auction.status === "CREATED" ? "Draft" : auction.status.replaceAll("_", " ").toLowerCase()}</SellerStatus></td><td className="px-4 py-5 font-mono text-xs">{formatVND(auction.startingPrice)}</td><td className="px-4 py-5 font-mono text-xs">{auction.bidCount ? formatVND(auction.currentPrice) : "—"}</td><td className="px-4 py-5 font-mono">{auction.bidCount}</td><td className="px-4 py-5"><AuctionDeadline auction={auction} /></td><td className="px-4 py-5"><div className="flex flex-wrap gap-2"><Link href={sellerAuctionHref(roles, auction.id)} className={sellerButton}>{editable ? "Edit" : "View"}</Link>{auction.status === "CREATED" && <button type="button" disabled={action.isPending} className={sellerButton} onClick={() => { action.reset(); action.mutate({ auction, kind: "schedule" }); }}>Schedule</button>}{cancellable && <button type="button" disabled={action.isPending} className={sellerButton} onClick={() => { action.reset(); setSelected(auction); setReason(""); dialog.current?.showModal(); }}>Cancel</button>}{["PAYMENT_TIMEOUT", "SETTLED"].includes(auction.status) && <SellerSecondChanceOffer auctionId={auction.id} auctionTitle={auction.title} triggerLabel={auction.status === "SETTLED" ? "Offer history" : "Offer to next bidder"} />}</div></td></tr>;
      })}</tbody></table>{!rows.length && <p role="status" className="p-10 text-center text-muted-foreground">No auctions in this status.</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm"><p className="text-muted-foreground">Page {page + 1} · {result.data?.totalElements ?? 0} auctions</p><nav aria-label="Seller auction pagination" className="flex gap-2"><button type="button" className={sellerButton} disabled={page === 0 || result.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className={sellerButton} disabled={result.isFetching || page + 1 >= (result.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</button></nav></div>
    </>}
    <p className="text-xs leading-5 text-muted-foreground">Settings lock when an auction starts. Auctions with bids cannot be cancelled by the seller.</p>
    <dialog ref={dialog} aria-labelledby="cancel-auction-title" onCancel={(event) => { if (action.isPending) event.preventDefault(); }} onClose={() => { setSelected(null); action.reset(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-border bg-card p-6 text-foreground shadow-lg backdrop:bg-foreground/40"><form onSubmit={(event) => { event.preventDefault(); if (selected) action.mutate({ auction: selected, kind: "cancel", reason }); }}><h2 id="cancel-auction-title" className="text-heading-24">Cancel auction</h2><p className="mt-3 break-words text-sm text-muted-foreground">{selected?.title}</p><label className="mt-5 block text-sm">Reason<textarea required maxLength={255} value={reason} onChange={(event) => setReason(event.target.value)} disabled={action.isPending} className={`${sellerInput} mt-2 min-h-24`} /></label>{action.error && <p role="alert" className="mt-3 text-sm text-danger">{action.error.detail || action.error.title}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={action.isPending} className={sellerButton} onClick={() => dialog.current?.close()}>Keep Auction</button><button type="submit" disabled={action.isPending || !reason.trim()} className={sellerPrimary}>{action.isPending ? "Cancelling…" : "Cancel Auction"}</button></div></form></dialog>
  </>;
}

export default SellerAuctionsPage;
