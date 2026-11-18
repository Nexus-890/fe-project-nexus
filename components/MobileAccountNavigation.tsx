"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ROUTES } from "@/configs/routes";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/popover";

const accountLinks = [
  { href: ROUTES.profile, label: "My profile" },
  { href: ROUTES.orders, label: "My orders" },
  { href: "/vouchers", label: "My vouchers" },
  { href: "/my-bids", label: "My Bids" },
];

function MobileAccountNavigation({ savedCount = 0 }: { savedCount?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        aria-label="Open account and watchlist navigation"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm px-2 hover:text-primary lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(19rem,calc(100vw-2rem))] gap-0 p-2 lg:hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2 pl-3">
          <PopoverTitle className="text-sm font-semibold">My Nexus and Watchlist</PopoverTitle>
          <button
            type="button"
            aria-label="Close account and watchlist navigation"
            onClick={() => setOpen(false)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm hover:bg-muted"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Account and watchlist destinations" className="py-1">
          {accountLinks.map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-sm px-3 text-sm hover:bg-muted">
              {label}
            </Link>
          ))}
          <h3 className="mt-2 border-t border-border px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">Watchlist</h3>
          <Link href="/saved" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-between gap-3 rounded-sm px-3 text-sm hover:bg-muted">
            <span>Saved items</span>
            {savedCount > 0 ? <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{savedCount}</span> : null}
          </Link>
          <Link href="/auctions" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-sm px-3 text-sm hover:bg-muted">Explore auctions</Link>
          <h3 className="mt-2 border-t border-border px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">Shopping</h3>
          <Link href="/checkout" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-sm px-3 text-sm hover:bg-muted">Ship to HCMC</Link>
          <Link href={ROUTES.sell} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-sm px-3 text-sm hover:bg-muted">Sell</Link>
        </nav>
      </PopoverContent>
    </Popover>
  );
}

export default MobileAccountNavigation;
