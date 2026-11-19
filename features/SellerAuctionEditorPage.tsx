"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Circle, Gavel } from "lucide-react";
import { createCanceledError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { createSellerAuction, getSellerAuction, scheduleSellerAuction, updateSellerAuction } from "../service/sellerAuctionService";
import { getSellerProduct, getSellerProductListings } from "../service/sellerService";
import { formatVND } from "../components/formatPrice";
import { SellerError, SellerHeading, SellerPanel, SellerStatus, sellerButton, sellerInput, sellerPrimary } from "../components/SellerUi";
import SellerSecondChanceOffer from "../components/SellerSecondChanceOffer";
import type { SellerAuction, SellerAuctionUpdate } from "../types/sellerAuctionType";
import { readBackofficeRoles, sellerAuctionHref } from "./backofficeAccess";
import { MoneyInput, initialVnd } from "../components/moneyInput";
import { reputationRestrictionMessage } from "./reputationRestrictionMessage";

const toLocalInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const dateLabel = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
const moneyInput = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= Number.MAX_SAFE_INTEGER / 100;

function AuctionEditor({ initial }: { initial?: SellerAuction }) {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const router = useRouter();
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [skuId, setSkuId] = useState(initial?.skuId ?? "");
  const [page, setPage] = useState(0);
  const [startingPrice, setStartingPrice] = useState(initialVnd(initial?.startingPrice ?? "100000"));
  const [increment, setIncrement] = useState(initialVnd(initial?.bidIncrement ?? "10000"));
  const [start, setStart] = useState(() => toLocalInput(initial?.startAt ?? new Date(Date.now() + 5 * 60_000).toISOString()));
  const [duration, setDuration] = useState(initial ? String((Date.parse(initial.endAt) - Date.parse(initial.startAt)) / 60_000) : "4320");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<SellerAuction | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const own = useApiQuery({ queryKey: queryKeys.seller.auctionProducts(auth.sessionId, page), meta: { requiresAuth: true }, service: (signal) => getSellerProductListings(page, { status: "ACTIVE", auctionEnable: true }, { context: auth.requestContext, signal }) }, { enabled: !initial, retry: false });
  const product = useApiQuery({ queryKey: queryKeys.seller.auctionProduct(auth.sessionId, productId), meta: { requiresAuth: true }, service: (signal) => getSellerProduct(productId, { context: auth.requestContext, signal }) }, { enabled: Boolean(productId), retry: false });
  const choices = (own.data?.content ?? []).filter((row) => row.status === "ACTIVE" && row.auctionEnable && row.skus.some((sku) => sku.status === "ACTIVE"));
  const selected = product.data;
  const skus = selected?.skus.filter((sku) => sku.status === "ACTIVE") ?? [];
  const editable = !initial || ["CREATED", "SCHEDULED"].includes(initial.status) && initial.bidCount === 0 && Date.parse(initial.startAt) > now;
  const endAt = start && Number.isFinite(Date.parse(start)) && Number(duration) > 0 && Number(duration) <= 10080 ? new Date(Date.parse(start) + Number(duration) * 60_000).toISOString() : "";
  const save = useApiMutation({
    execute: async ({ body, schedule, sessionId }: { body: SellerAuctionUpdate; schedule: boolean; sessionId: number }) => {
      const controller = new AbortController(); pending.current = controller;
      const options = { context: auth.requestContext, signal: controller.signal };
      let auction = initial ? await updateSellerAuction(initial.id, body, options) : created ?? await createSellerAuction({ ...body, productId, skuId }, options);
      // A second request must never pick up another account's token after the first write resolves.
      if (!auth.isSessionCurrent(sessionId) || controller.signal.aborted) throw createCanceledError();
      // Retain a successfully created draft when scheduling fails, so retry never creates another auction.
      if (!initial) setCreated(auction);
      if (schedule && auction.status === "CREATED") auction = await scheduleSellerAuction(auction.id, options);
      return auction;
    },
    isCurrent: ({ sessionId }) => auth.isSessionCurrent(sessionId) && pending.current?.signal.aborted !== true,
    invalidateKey: [queryKeys.seller.auctionRoot(auth.sessionId)],
  }, { onSuccess: (auction) => { setNotice(auction.status === "SCHEDULED" ? "Auction scheduled." : initial ? "Auction changes saved." : "Auction draft saved."); router.push(sellerAuctionHref(roles, auction.id)); } });

  const busy = save.isPending;
  const locked = !editable || busy || Boolean(created);
  const submit = (schedule: boolean) => {
    setValidation("");
    if (!moneyInput(startingPrice) || !moneyInput(increment)) { setValidation("Enter positive prices with at most two decimal places."); return; }
    if (!created && (!endAt || !start || Date.parse(start) < now - 5000)) { setValidation("Choose a start time in the future and a positive duration of at most 7 days."); return; }
    if (!initial && !created && (!selected || selected.sellerId !== auth.user?.id || selected.status !== "ACTIVE" || !selected.auctionEnable || !skus.some((sku) => sku.id === skuId))) { setValidation("Choose one of your active auction-enabled products and an active SKU."); return; }
    save.mutate({ body: { startingPrice: Number(startingPrice), bidIncrement: Number(increment), startAt: new Date(start).toISOString(), endAt }, schedule, sessionId: auth.sessionId });
  };

  const error = save.error && { ...save.error, detail: reputationRestrictionMessage(save.error) ?? save.error.detail };
  return <>
    <Link href={sellerAuctionHref(readBackofficeRoles(auth.accessToken))} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-primary">Auctions / {initial ? "Auction details" : "New Auction"}</Link>
    <SellerHeading title={initial ? editable ? "Edit Auction" : "Auction Details" : "Create Auction"} description="Settings lock when the auction starts.">{initial && <SellerStatus>{initial.status.replaceAll("_", " ")}</SellerStatus>}</SellerHeading>
    {notice && <p role="status" className="text-sm text-success">{notice}</p>}
    {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}
    {error && error.kind !== "aborted" && <p role="alert" className="break-words text-sm text-danger">{error.detail || error.title}</p>}
    {created && error && <p role="status" className="text-sm">Your draft was saved. Retry scheduling or <Link href={sellerAuctionHref(roles, created.id)} className="text-primary underline">open the saved draft</Link>.</p>}
    {!editable && <p role="status" className="text-sm text-muted-foreground">This auction is locked for editing.</p>}
    {initial && ["PAYMENT_TIMEOUT", "WON", "SETTLED"].includes(initial.status) && initial.bidCount > 0 && <div><SellerSecondChanceOffer auctionId={initial.id} auctionTitle={initial.title} triggerLabel={initial.status === "PAYMENT_TIMEOUT" ? "Offer to next bidder" : "Offer history"} /></div>}
    <form onSubmit={(event) => { event.preventDefault(); submit(false); }} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <fieldset disabled={locked} className="min-w-0 space-y-6 disabled:opacity-70">
        <SellerPanel title="Product">{initial ? <><p className="font-medium">{initial.title}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">SKU: {initial.skuId}</p></> : <>
          <label className="block text-sm">Product<select required value={productId} onChange={(event) => { setProductId(event.target.value); setSkuId(""); }} className={`${sellerInput} mt-2`}><option value="">Select a product</option>{choices.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          {own.isPending && <p role="status" className="mt-3 text-sm">Loading your products…</p>}{own.error && <div className="mt-3"><SellerError error={own.error} retry={() => void own.refetch()} /></div>}
          {!own.isPending && !own.error && choices.length === 0 && <p role="status" className="mt-3 text-sm text-muted-foreground">No eligible products on this page. Choose an active product with auction listings enabled and an active SKU.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className={sellerButton} disabled={page === 0 || own.isFetching} onClick={() => setPage((value) => value - 1)}>Previous products</button><button type="button" className={sellerButton} disabled={own.isFetching || page + 1 >= (own.data?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>Next products</button></div>
          <label className="mt-4 block text-sm">SKU<select required value={skuId} onChange={(event) => setSkuId(event.target.value)} className={`${sellerInput} mt-2`}><option value="">Select a SKU</option>{skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.skuCode} · {sku.color} · {sku.size}</option>)}</select></label>
          {product.isPending && productId && <p role="status" className="mt-3 text-sm">Loading SKUs…</p>}{product.error && <div className="mt-3"><SellerError error={product.error} retry={() => void product.refetch()} /></div>}
        </>}<p className="mt-4 text-xs leading-5 text-muted-foreground">Each SKU can have one live auction at a time.</p></SellerPanel>
        <SellerPanel title="Pricing"><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm">Starting Price (VND)<MoneyInput required value={startingPrice} onValueChange={setStartingPrice} className={`${sellerInput} mt-2 font-mono`} /></label><label className="block text-sm">Bid Increment (VND)<MoneyInput required value={increment} onValueChange={setIncrement} className={`${sellerInput} mt-2 font-mono`} /></label></div></SellerPanel>
        <SellerPanel title="Schedule"><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm">Start (local time)<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className={`${sellerInput} mt-2`} /></label><label className="block text-sm">Duration<select value={duration} onChange={(event) => setDuration(event.target.value)} className={`${sellerInput} mt-2`}>{!['3','60','1440','4320','10080'].includes(duration) && <option value={duration}>{duration} minutes</option>}<option value="3">3 minutes · demo</option><option value="60">1 hour</option><option value="1440">1 day</option><option value="4320">3 days</option><option value="10080">7 days</option></select></label></div><p className="mt-3 text-xs text-muted-foreground">Ends {endAt ? dateLabel(endAt) : "—"} (UTC+7)</p><button type="button" className={`${sellerButton} mt-4`} onClick={() => { setStart(toLocalInput(new Date(Date.now() + 90_000).toISOString())); setDuration("3"); }}>Use 3-minute demo</button><p className="mt-3 text-xs leading-5 text-muted-foreground">The selected duration must be allowed by this environment.</p></SellerPanel>
        <SellerPanel title="Rules"><div className="flex items-center gap-3 text-sm"><Gavel size={16} className="text-primary" aria-hidden="true" />{initial ? "Bidding access follows this auction’s policy" : "Public — anyone can bid"}</div><p className="mt-4 text-sm">Anti-sniping follows the auction policy.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Bids close to the end may extend the deadline. The current deadline is shown in your auctions list.</p></SellerPanel>
      </fieldset>
      <aside className="space-y-6"><SellerPanel title="Eligibility Check"><ul className="space-y-4 text-xs">{[["Product status is Active", selected?.status === "ACTIVE"], ["Auction listings enabled", selected?.auctionEnable], ["Active SKU selected", skus.some((sku) => sku.id === skuId)]].map(([label, met]) => <li key={String(label)} className="flex items-center gap-2">{met ? <CheckCircle2 size={15} className="shrink-0 text-info" aria-hidden="true" /> : <Circle size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />}<span>{label}</span></li>)}</ul><p className="mt-5 text-xs leading-5 text-muted-foreground">Auction limits are checked when you save.</p></SellerPanel>
        <SellerPanel title="Summary"><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Starts</dt><dd className="text-right text-xs">{start ? dateLabel(start) : "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Ends</dt><dd className="text-right text-xs">{endAt ? dateLabel(endAt) : "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Starting price</dt><dd className="font-mono text-xs">{formatVND(startingPrice) ?? "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Increment</dt><dd className="font-mono text-xs">{formatVND(increment) ?? "—"}</dd></div></dl>
          {editable && <><button type="button" disabled={busy || Boolean(initial && initial.status !== "CREATED") || !initial && (product.isFetching || !skuId)} className={`${sellerPrimary} mt-6 w-full`} onClick={() => submit(true)}><CalendarDays size={16} aria-hidden="true" />{busy ? "Saving…" : initial?.status === "SCHEDULED" ? "Already Scheduled" : "Schedule Auction"}</button><button type="submit" disabled={busy || Boolean(created)} className={`${sellerButton} mt-3 w-full`}>{save.isPending ? "Saving…" : initial ? "Save Changes" : "Save Draft"}</button></>}
          {initial && <p className="mt-4 break-all font-mono text-xs text-muted-foreground">{initial.id}</p>}
        </SellerPanel>
      </aside>
    </form>
  </>;
}

function SellerAuctionEditorPage({ auctionId }: { auctionId?: string }) {
  const auth = useAuth();
  const detail = useApiQuery({ queryKey: queryKeys.seller.auction(auth.sessionId, auctionId), meta: { requiresAuth: true }, service: (signal) => getSellerAuction(auctionId!, { context: auth.requestContext, signal }) }, { enabled: Boolean(auctionId), retry: false });
  if (!auctionId) return <AuctionEditor key={`${auth.sessionId}:new`} />;
  if (detail.isPending) return <p role="status">Loading auction…</p>;
  if (detail.error) return <><SellerHeading title="Auction unavailable" /><SellerError error={detail.error} retry={() => void detail.refetch()} /><Link href={sellerAuctionHref(readBackofficeRoles(auth.accessToken))} className={sellerButton}>Return to auctions</Link></>;
  if (!detail.data || detail.data.sellerId !== auth.user?.id) return <p role="alert">This auction is not available in your seller workspace.</p>;
  return <AuctionEditor key={`${auth.sessionId}:${detail.data.id}:${detail.data.status}:${detail.data.startAt}`} initial={detail.data} />;
}

export default SellerAuctionEditorPage;
