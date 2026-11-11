"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useWatchlist } from "@/hooks/useWatchlist";

function SavedPage() {
  const watchlist = useWatchlist();
  return <div className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6">
    <h1 className="text-3xl font-semibold tracking-tight">Saved items</h1>
    <p className="mt-3 text-sm text-muted-foreground">Keep your favorites together while you shop. Items are saved for this visit.</p>
    {watchlist?.products.length ? <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">{watchlist.products.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-8 rounded-md border border-border px-5 py-16 text-center"><Heart size={36} className="mx-auto text-primary" aria-hidden="true" /><h2 className="mt-4 text-xl font-semibold">A little inspiration to start?</h2><p className="mt-2 text-sm text-muted-foreground">Tap the heart on a product to save it here.</p><Link href="/search" className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Explore products</Link></div>}
  </div>;
}

export default SavedPage;
