"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useSeller } from "./SellerLayout";
import { formatVND } from "../components/formatPrice";
import { SellerHeading, SellerPanel, SellerStatus, SellerTabs, sellerButton, sellerPrimary } from "../components/SellerUi";

function SellerAuctionsPage() {
  const { preview, base, auctions, setAuctions } = useSeller(); const [tab, setTab] = useState("Active");
  const [cancelId, setCancelId] = useState(""); const dialog = useRef<HTMLDialogElement>(null);
  const rows = auctions.filter((row) => tab === "Active" ? row.status === "ACTIVE" : tab === "Scheduled" ? row.status === "SCHEDULED" || row.status === "CREATED" : tab === "Cancelled" ? row.status === "CANCELLED" : ["ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT"].includes(row.status));
  return <>
    <SellerHeading title="Auctions" description={preview ? "4 of 5 active auctions · sample trust score 86" : "Create an auction draft and schedule it with the existing API."}><Link href={`${base}/auctions/new`} className={sellerPrimary}><Plus size={16} aria-hidden="true" />Create Auction</Link></SellerHeading>
    {!preview ? <SellerPanel title="Seller auction list is awaiting an API"><p className="text-sm leading-6 text-muted-foreground">The public auction list has status, page and size filters. It has no seller filter and cannot provide an accurate private seller list or active-auction quota. Edit/cancel, eligibility checks and seller analytics are also unavailable.</p><Link href="/seller/preview/auctions" className={`${sellerButton} mt-5`}>Review sample auction list</Link></SellerPanel> : <>
      <SellerTabs values={["Active", "Scheduled", "Ended", "Cancelled"]} selected={tab} change={setTab} />
      <div className="overflow-x-auto rounded-sm border border-border"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Sample seller auctions</caption><thead className="bg-muted text-xs text-muted-foreground"><tr>{["Product", "Status", "Start price", "Current bid", "Bids", "Schedule", "Actions"].map((label) => <th key={label} className="px-4 py-3 font-normal" scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><th scope="row" className="max-w-64 px-4 py-5 font-normal"><p className="font-medium">{row.title}</p><p className="mt-1 text-xs text-muted-foreground">Sample auction</p></th><td className="px-4 py-5"><SellerStatus>{row.status === "ACTIVE" ? "Live" : row.status}</SellerStatus></td><td className="px-4 py-5 font-mono">{formatVND(row.startingPrice)}</td><td className="px-4 py-5 font-mono">{row.bidCount ? formatVND(row.currentPrice) : "—"}</td><td className="px-4 py-5 font-mono">{row.bidCount}</td><td className="px-4 py-5 font-mono text-xs"><time dateTime={row.endAt}>{new Date(row.endAt).toLocaleString("en-GB", { timeZone: "Asia/Ho_Chi_Minh" })}</time></td><td className="px-4 py-5"><button type="button" disabled={row.status === "CANCELLED"} className={sellerButton} onClick={() => { setCancelId(row.id); dialog.current?.showModal(); }}>Cancel Preview</button></td></tr>)}</tbody></table>{!rows.length && <p role="status" className="p-8 text-center text-muted-foreground">No sample auctions in this status.</p>}</div>
      <p className="text-xs text-muted-foreground">Configuration locks once an auction starts. Cancellation here changes the preview only; no bidder notification is sent.</p>
      <dialog ref={dialog} aria-labelledby="cancel-auction-title" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-md border border-border bg-card p-6 text-foreground backdrop:bg-foreground/40"><h2 id="cancel-auction-title" className="text-heading-24">Cancel sample auction?</h2><p className="mt-3 text-sm text-muted-foreground">This changes the local preview only.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className={sellerButton} onClick={() => dialog.current?.close()}>Keep Auction</button><button type="button" className={sellerPrimary} onClick={() => { setAuctions((current) => current.map((row) => row.id === cancelId ? { ...row, status: "CANCELLED" } : row)); dialog.current?.close(); }}>Cancel Locally</button></div></dialog>
    </>}
  </>;
}
export default SellerAuctionsPage;
