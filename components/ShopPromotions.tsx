"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Truck, Zap } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { sortProductImages } from "@/components/productImageUtils";
import type { ProductSummary } from "@/types/catalogResponseType";

const campaigns = [
  { eyebrow: "MEGA SALE · EVERYDAY FINDS", title: "10:10", text: "Discover your next favourite. Fresh finds, great prices, all in one place." },
  { eyebrow: "THE TECH EDIT", title: "Upgrade time.", text: "Explore phones, audio and everyday essentials from the Nexus community." },
  { eyebrow: "FIND SOMETHING YOU LOVE", title: "Made for you.", text: "From timeless classics to this season’s picks. Your next discovery starts here." },
];
const vouchers = [
  { value: "50K", detail: "Min. spend 500.000 ₫", code: "NEXUS50" },
  { value: "25K", detail: "Min. spend 250.000 ₫", code: "WELCOME25" },
  { value: "15%", detail: "Audio · max 100.000 ₫", code: "AUDIO15" },
  { value: "FREE", detail: "Shipping voucher", code: "FREESHIP" },
];

function ShopPromotions({ products }: { products: ProductSummary[] }) {
  const [slide, setSlide] = useState(0);
  const [claimed, setClaimed] = useState<string[]>([]);
  const campaign = campaigns[slide];
  return (
    <>
      <section aria-label="Featured campaigns" className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]">
        <div id="daily-deals" className="relative isolate min-w-0 overflow-hidden rounded-sm bg-gradient-to-br from-primary-active via-primary to-orange-600 px-6 py-8 text-primary-foreground sm:p-8">
          <div className="relative z-10 grid items-center gap-5 sm:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <p className="text-xs tracking-wider">{campaign.eyebrow}</p>
              <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">{campaign.title}</h1>
              <p className="max-w-sm text-sm leading-6 text-primary-foreground/90">{campaign.text}</p>
              <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-background px-5 text-sm font-semibold text-primary hover:bg-orange-100">Shop the Sale <ArrowRight size={16} /></Link>
            </div>
            <div className="hidden grid-cols-3 items-end gap-2 sm:grid" aria-hidden="true">
              {products.slice(0, 3).map((product, index) => (
                <div key={product.id} className={`overflow-hidden rounded-sm bg-card p-1.5 shadow-raised ${index === 1 ? "-translate-y-4" : ""}`}>
                  <div className="aspect-[3/4] rounded-sm bg-muted"><ProductImage src={sortProductImages(product.images)[0]?.imageUrl} alt="" productName={product.name} /></div>
                  <p className="pt-2 pb-1 text-[10px] font-semibold text-primary [overflow-wrap:anywhere]">{product.name}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10 mt-5 flex items-center justify-center gap-1" aria-label="Campaign navigation">
            <button type="button" aria-label="Previous campaign" onClick={() => setSlide((slide + campaigns.length - 1) % campaigns.length)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-background/10"><ChevronLeft size={18} /></button>
            {campaigns.map((item, index) => <button key={item.eyebrow} type="button" aria-label={`Campaign ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)} className="grid min-h-11 min-w-11 place-items-center"><span className={`h-1.5 rounded-full bg-background ${slide === index ? "w-6" : "w-1.5 opacity-50"}`} /></button>)}
            <button type="button" aria-label="Next campaign" onClick={() => setSlide((slide + 1) % campaigns.length)} className="grid min-h-11 min-w-11 place-items-center rounded-full hover:bg-background/10"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-sm bg-foreground p-5 text-background">
            <Zap size={22} className="mb-2 text-primary" aria-hidden="true" /><h2 className="text-heading-20">Live Auctions</h2>
            <p className="mt-2 text-xs leading-5 text-background/75">Discover one-of-a-kind finds. Watch the clock and follow the latest bids.</p>
            <a href="#live-auctions" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground">Explore auctions <ArrowRight size={15} /></a>
          </div>
          <div className="rounded-sm border border-border bg-muted p-5">
            <Truck size={22} className="mb-2 text-primary" aria-hidden="true" /><h2 className="text-heading-20">More reasons to shop</h2>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Browse electronics, fashion and home favourites, all from one marketplace.</p>
            <a href="#vouchers" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Discover vouchers <ArrowRight size={15} className="ml-2" /></a>
          </div>
        </div>
      </section>
      <section id="vouchers" aria-label="Shop vouchers" className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {vouchers.map((voucher) => {
            const saved = claimed.includes(voucher.code);
            return <div key={voucher.code} className="flex min-w-0 overflow-hidden rounded-sm border border-orange-200">
              <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-orange-100 bg-primary p-3 text-primary-foreground"><strong className="text-xl">{voucher.value}</strong><span className="text-[10px]">{voucher.value === "FREE" ? "SHIP" : "OFF"}</span></div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-1 p-2"><div className="min-w-0 text-[11px] leading-4"><p>{voucher.detail}</p><p className="text-muted-foreground">{voucher.code}</p></div><button type="button" aria-label={`${saved ? "Remove" : "Save"} ${voucher.code} sample voucher`} aria-pressed={saved} onClick={() => setClaimed((current) => saved ? current.filter((code) => code !== voucher.code) : [...current, voucher.code])} className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm px-2 text-xs font-semibold ${saved ? "bg-muted text-primary" : "bg-primary text-primary-foreground hover:bg-primary-hover"}`}>{saved ? <Check size={17} aria-hidden="true" /> : "Claim"}</button></div>
            </div>;
          })}
        </div>
        <p className="text-[11px] text-muted-foreground" role="status">Sample offers · saved for this visit. Voucher discounts are not applied at checkout.</p>
      </section>
    </>
  );
}

export default ShopPromotions;
