"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import ProductCard from "@/components/ProductCard";
import ProductGrid from "@/components/ProductGrid";
import ProductImage from "@/components/ProductImage";
import ShopPromotions from "@/components/ShopPromotions";
import SampleSaleCountdown from "@/components/SampleSaleCountdown";
import { formatVND } from "@/components/formatPrice";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { getCategoryTree, getProducts } from "@/service/catalogService";
import { getActiveAuctions } from "@/service/auctionService";
import { flattenCategories } from "@/features/catalogUtils";
import SellerReputation from "./SellerReputation";
import ClaimableVouchers from "./ClaimableVouchers";
import AuctionCountdown from "../components/AuctionCardCountdown";

const homeFilters = { page: 0, size: 10 };

function HomePage() {
  const [categoryId, setCategoryId] = useState("");
  const tree = useApiQuery({ queryKey: queryKeys.catalog.tree, service: (signal) => getCategoryTree({ signal }) });
  const products = useApiQuery({ queryKey: queryKeys.catalog.products(homeFilters), service: (signal) => getProducts(homeFilters, { signal }) });
  const pickFilters = { ...homeFilters, ...(categoryId ? { categoryId } : {}) };
  const picks = useApiQuery({ queryKey: queryKeys.catalog.products(pickFilters), service: (signal) => getProducts(pickFilters, { signal }) });
  const auctions = useApiQuery({ queryKey: queryKeys.auctions.active, service: (signal) => getActiveAuctions({ signal }) }, { refetchInterval: 30_000 });
  const categories = flattenCategories(tree.data ?? []).filter((category) => category.depth === 0);

  return (
    <div className="mx-auto w-full max-w-[1248px] space-y-8 px-4 py-6 sm:px-6">
      <ShopPromotions products={products.data?.content ?? []} />
      <ClaimableVouchers />
      <CategoryNavigation categories={tree.data ?? []} loading={tree.isPending} error={tree.isError} retrying={tree.isFetching} onRetry={() => void tree.refetch()} />
      <section id="deals" aria-label="Flash Sale" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-4"><h2 className="flex items-center gap-2 text-heading-20 text-primary"><Zap size={23} aria-hidden="true" />FLASH SALE</h2><SampleSaleCountdown /></div><Link href="/search" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary">View all <ArrowRight size={15} /></Link></div>
        <p className="text-xs text-muted-foreground">Current catalog prices · deal, shipping, sales and seller details are sample previews.</p>
        {products.isSuccess && products.data.content.length ? <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">{products.data.content.slice(0, 6).map((product) => <li key={product.id} className="min-w-0"><ProductCard product={product} sampleDetails /></li>)}</ul> : <ProductGrid products={[]} loading={products.isPending} error={products.isError} onRetry={() => void products.refetch()} retrying={products.isFetching} />}
      </section>
      <section id="live-auctions" aria-label="Live auctions ending soon" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="nexus-live" className="flex items-center gap-2 text-heading-20"><span className="size-2 rounded-full bg-success" aria-hidden="true" />Live auctions ending soon</h2><span className="text-xs text-muted-foreground">Updates every 30 seconds</span></div>
        {auctions.isPending ? <p role="status" className="rounded-sm border border-border p-6 text-sm">Loading live auctions…</p> : auctions.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-6 text-sm"><p>Unable to load live auctions.</p><button type="button" disabled={auctions.isFetching} onClick={() => void auctions.refetch()} className="min-h-11 rounded-sm border border-border px-4">Retry auctions</button></div> : auctions.data?.length ? <ul className="grid list-none grid-cols-1 gap-4 p-0 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{auctions.data.map((auction) => <li key={auction.auctionId} className="min-w-0"><article className="overflow-hidden rounded-sm border border-border"><Link href={`/auctions/${encodeURIComponent(auction.auctionId)}`} className="block"><div className="relative aspect-square bg-muted"><ProductImage src={auction.imageUrl} alt={auction.name} productName={auction.name} loading="lazy" /><div className="absolute top-2 left-2"><AuctionCountdown closesAt={auction.closesAt} /></div></div><div className="space-y-2 p-3"><h3 className="line-clamp-2 min-h-10 text-sm leading-5">{auction.name}</h3><p className="text-xs text-muted-foreground">Current bid</p><div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-primary">{auction.currency === "VND" ? formatVND(auction.currentBid) : `${auction.currentBid} ${auction.currency}`}</strong><span className="text-xs text-muted-foreground">{auction.bidCount} bids</span></div><p className="text-xs text-muted-foreground">Enter auction room</p></div></Link><SellerReputation sellerId={auction.sellerId} compact /></article></li>)}</ul> : <p role="status" className="rounded-sm border border-dashed border-border p-6 text-sm text-muted-foreground">There are no live auctions right now. Check back for new finds.</p>}
      </section>
      <section id="today-picks" aria-label="Today's picks" className="space-y-4">
        <h2 className="text-heading-20">Today&apos;s picks</h2>
        <p className="text-xs text-muted-foreground">Current catalog prices · deal, shipping, sales and seller details are sample previews.</p>
        <div role="group" aria-label="Pick a category" className="flex flex-wrap gap-1 border-b border-border"><button type="button" aria-pressed={!categoryId} onClick={() => setCategoryId("")} className={`min-h-11 border-b-2 px-3 text-sm ${!categoryId ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>For you</button>{categories.slice(0, 4).map((category) => <button key={category.id} type="button" aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)} className={`min-h-11 border-b-2 px-3 text-sm ${categoryId === category.id ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}>{category.name}</button>)}</div>
        {picks.isSuccess && picks.data.content.length ? <ul className="grid list-none grid-cols-1 gap-4 p-0 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{picks.data.content.map((product) => <li className="min-w-0" key={product.id}><ProductCard product={product} sampleDetails /></li>)}</ul> : <ProductGrid products={[]} loading={picks.isPending} error={picks.isError} onRetry={() => void picks.refetch()} retrying={picks.isFetching} />}
        <Link href={categoryId ? `/search?category=${encodeURIComponent(categories.find((category) => category.id === categoryId)?.slug ?? "")}` : "/search"} className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border text-sm font-medium hover:bg-muted">See More Picks <ArrowRight size={15} /></Link>
      </section>
    </div>
  );
}

export default HomePage;
