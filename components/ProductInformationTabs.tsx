"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ShieldCheck, Star, Truck } from "lucide-react";
import type { ProductDetail } from "@/types/catalogResponseType";

const tabs = ["Description", "Specifications", "Reviews", "Shipping & Returns"] as const;
const sampleReviews = [
  { name: "Tran Quoc Bao", initials: "TQ", stars: 5, text: "Carefully packed and exactly as described. A lovely addition to my everyday essentials.", date: "10 Nov 2026" },
  { name: "Pham Mai Anh", initials: "PM", stars: 4, text: "Great quality and easy to use. The seller answered my questions quickly.", date: "9 Nov 2026" },
  { name: "Le Hoang Nam", initials: "LH", stars: 5, text: "Really happy with this find. Everything arrived in good condition.", date: "8 Nov 2026" },
];

export function RatingStars({ rating = 5 }: { rating?: number }) {
  return <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < rating ? "currentColor" : "none"} aria-hidden="true" />)}</span>;
}

function ProductInformationTabs({ product }: { product: ProductDetail }) {
  const [active, setActive] = useState<(typeof tabs)[number]>("Reviews");
  const [reviewSort, setReviewSort] = useState("recent");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const reviews = reviewSort === "highest" ? [...sampleReviews].sort((a, b) => b.stars - a.stars) : sampleReviews;
  return (
    <section className="mt-10 min-w-0" aria-label="More product information">
      <div role="tablist" aria-label="Product information" className="flex flex-wrap gap-2 border-b border-border sm:gap-5">
        {tabs.map((tab, index) => <button key={tab} ref={(element) => { buttons.current[index] = element; }} id={`product-tab-${index}`} role="tab" aria-selected={active === tab} aria-controls={`product-panel-${index}`} tabIndex={active === tab ? 0 : -1} type="button" onClick={() => setActive(tab)} onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
          else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          else return;
          event.preventDefault(); setActive(tabs[next]); buttons.current[next]?.focus();
        }} className={`min-h-11 border-b-2 px-2 py-3 text-sm ${active === tab ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab}{tab === "Reviews" ? <> <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">126</span></> : null}</button>)}
      </div>
      {tabs.map((tab, index) => <div key={tab} id={`product-panel-${index}`} role="tabpanel" aria-labelledby={`product-tab-${index}`} hidden={active !== tab} tabIndex={0} className="py-6">
        {tab === "Description" ? <div className="max-w-3xl space-y-4 text-sm leading-7"><h2 className="text-heading-20">About this item</h2><p className="whitespace-pre-line [overflow-wrap:anywhere]">{product.description || "The seller has not added a description for this item."}</p></div> : null}
        {tab === "Specifications" ? <div className="max-w-3xl"><h2 className="mb-4 text-heading-20">Product specifications</h2><dl className="divide-y divide-border rounded-sm border border-border text-sm">{[["Product", product.name], ["Available options", String(product.skus.length)], ["Colours", [...new Set(product.skus.map((sku) => sku.color).filter(Boolean))].join(", ") || "Not specified"], ["Sizes", [...new Set(product.skus.map((sku) => sku.size).filter(Boolean))].join(", ") || "Not specified"], ["Listing", product.auctionEnable ? "Auction eligible" : "Buy Now"]].map(([name, value]) => <div key={name} className="grid grid-cols-[minmax(90px,1fr)_2fr] gap-4 px-4 py-3"><dt className="text-muted-foreground">{name}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd></div>)}</dl></div> : null}
        {tab === "Reviews" ? <>
          <p className="mb-5 text-xs text-muted-foreground">Sample reviews · preview content, not customer purchase feedback.</p>
          <div className="grid gap-8 md:grid-cols-[minmax(180px,1fr)_2fr]">
            <div className="space-y-3"><p className="text-5xl font-semibold tracking-tight">4.8</p><RatingStars /><p className="text-xs text-muted-foreground">Based on 126 sample ratings</p><div className="max-w-xs space-y-3">{[82, 12, 4, 1, 1].map((percent, index) => <div key={index} className="flex items-center gap-2 text-xs"><span>{5 - index}</span><Star size={12} className="text-warning" fill="currentColor" aria-hidden="true" /><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div><span className="w-8 text-muted-foreground">{percent}%</span></div>)}</div></div>
            <div><label className="mb-4 flex min-h-11 items-center justify-between gap-2 text-sm font-medium"><span>Sample reviews</span><select value={reviewSort} onChange={(event) => setReviewSort(event.target.value)} className="min-h-11 rounded-sm border border-border bg-card px-3 text-xs" aria-label="Sort sample reviews"><option value="recent">Most recent</option><option value="highest">Highest rated</option></select></label><div className="divide-y divide-border">{reviews.map((review) => <div key={review.name} className="space-y-3 py-4 first:pt-0"><div className="flex flex-wrap items-center gap-2 text-sm"><span className="grid size-8 place-items-center rounded-full bg-muted text-xs text-muted-foreground" aria-hidden="true">{review.initials}</span><strong>{review.name}</strong><RatingStars rating={review.stars} /><span className="ml-auto text-xs text-muted-foreground">{review.date}</span></div><p className="text-sm leading-6">{review.text}</p></div>)}</div></div>
          </div>
        </> : null}
        {tab === "Shipping & Returns" ? <div className="max-w-3xl space-y-5 text-sm leading-6"><h2 className="text-heading-20">Shipping & Returns</h2><div className="flex gap-3"><Truck size={22} className="shrink-0 text-primary" aria-hidden="true" /><div><h3 className="font-semibold">Delivery to your door</h3><p className="text-muted-foreground">Choose your delivery address at checkout to see available shipping options and the final delivery fee.</p></div></div><div className="flex gap-3"><ShieldCheck size={22} className="shrink-0 text-primary" aria-hidden="true" /><div><h3 className="font-semibold">Shop with care</h3><p className="text-muted-foreground">Check the product description and selected options before ordering. Keep your order receipt and packaging.</p></div></div><div className="flex gap-3"><CheckCircle2 size={22} className="shrink-0 text-primary" aria-hidden="true" /><div><h3 className="font-semibold">Need help with an order?</h3><p className="text-muted-foreground">Open your order details to review its current status and available support options.</p></div></div></div> : null}
      </div>)}
    </section>
  );
}

export default ProductInformationTabs;
