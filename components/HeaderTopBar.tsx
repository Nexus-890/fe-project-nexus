"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import type { HeaderProps } from "@/types/uiType";
import { HEADER_UTILITY_NAVIGATION, ROUTES } from "@/configs/routes";
import { useWatchlist } from "@/hooks/useWatchlist";
import MobileAccountNavigation from "@/components/MobileAccountNavigation";
import { useSellHref } from "@/hooks/useSellHref";
import UserAvatar from "@/components/UserAvatar";

function HeaderTopBar({
  user,
  authenticating,
  restoring,
  canAccessBackoffice = false,
  onSignOut,
  cartQuantity,
  notificationBell,
}: HeaderProps) {
  const router = useRouter();
  const watchlist = useWatchlist();
  const sellHref = useSellHref();
  function signOut() {
    onSignOut();
  }

  return (
    <div className="border-b border-border">
      <div className="mx-auto flex min-h-11 lg:min-h-9 max-w-[1248px] items-center justify-between gap-3 px-4 py-1 lg:py-0 text-xs text-gray-900 sm:px-6">
        <nav aria-label="Nexus utility links" className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3">
          {user ? (
            <details name="header-account-navigation" className="relative min-w-0">
              <summary className="inline-flex min-h-11 lg:min-h-9 min-w-0 max-w-[11rem] sm:max-w-[15rem] cursor-pointer list-none items-center gap-1.5 whitespace-normal break-words rounded-sm px-2 text-left font-medium leading-4 hover:text-primary [overflow-wrap:anywhere]">
                <span className="min-w-0">Hi {user.fullName}</span>
                <UserAvatar fullName={user.fullName} avatarUrl={user.avatarUrl} className="order-first size-6" fallbackClassName="text-[10px]" />
                <ChevronDown size={13} className="shrink-0" aria-hidden="true" />
              </summary>
              <div className="absolute left-0 top-full z-30 w-48 rounded-sm border border-border bg-popover p-2 shadow-md">
                <Link href={ROUTES.profile} className="flex min-h-11 items-center rounded-sm px-3 hover:bg-muted">My profile</Link>
                <button type="button" onClick={signOut} className="flex min-h-11 w-full items-center rounded-sm px-3 text-left hover:bg-muted">Sign out</button>
              </div>
            </details>
          ) : authenticating ? (
            <span
              className="inline-flex min-h-11 lg:min-h-9 items-center px-2"
              role="status"
            >
              {restoring ? "Restoring session…" : "Signing in…"}
            </span>
          ) : (
            <>
              <Link
                href={ROUTES.signIn}
                onNavigate={(event) => {
                  event.preventDefault();
                  const returnTo = window.location.pathname + window.location.search + window.location.hash;
                  router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
                }}
                className="inline-flex min-h-11 lg:min-h-9 items-center rounded-sm px-2 font-medium hover:text-primary"
              >
                Sign in
              </Link>
              <Link
                href={ROUTES.signUp}
                className="inline-flex min-h-11 lg:min-h-9 items-center rounded-sm px-2 font-medium hover:text-primary"
              >
                Sign up
              </Link>
            </>
          )}
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          {HEADER_UTILITY_NAVIGATION.map(({ label, href, visibility }) => (
            <Link key={href} href={href} className={`hidden min-h-11 lg:min-h-9 items-center rounded-sm px-2 hover:text-primary ${visibility}`}>{label}</Link>
          ))}
          {canAccessBackoffice && <Link href="/backoffice" className="inline-flex min-h-11 lg:min-h-9 items-center rounded-sm px-2 hover:text-primary">Back office</Link>}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <nav
            aria-label="Account and shopping links"
            className="hidden shrink-0 items-center gap-1 lg:flex lg:gap-2"
          >
            <Link
              href="/checkout"
              className="inline-flex min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 hover:text-primary"
            >
              <MapPin size={14} aria-hidden="true" />
              <span className="hidden md:inline">Ship to HCMC</span>
            </Link>
            <Link
              href={sellHref}
              className="inline-flex min-h-11 lg:min-h-9 items-center rounded-sm px-2 hover:text-primary"
            >
              Sell
            </Link>
            <details name="header-account-navigation" className="relative hidden md:block">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-sm px-2 hover:text-primary lg:min-h-9">Watchlist{watchlist?.products.length ? ` (${watchlist.products.length})` : ""} <ChevronDown size={13} aria-hidden="true" /></summary>
              <div className="absolute right-0 top-full z-30 w-48 rounded-sm border border-border bg-popover p-2 shadow-md"><Link href="/saved" className="flex min-h-11 items-center rounded-sm px-3 hover:bg-muted">Saved items</Link><Link href="/auctions" className="flex min-h-11 items-center rounded-sm px-3 hover:bg-muted">Explore auctions</Link></div>
            </details>
            <details name="header-account-navigation" className="relative hidden lg:block">
              <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-sm px-2 hover:text-primary">My Nexus <ChevronDown size={13} aria-hidden="true" /></summary>
              <div className="absolute right-0 top-full z-30 w-48 rounded-sm border border-border bg-popover p-2 shadow-md">{[{href: ROUTES.profile,label: "My profile"},{href: ROUTES.orders,label: "My orders"},{href: "/vouchers",label: "My vouchers"},{href: "/my-bids",label: "My Bids"},{href: "/saved",label: "Saved items"}].map(({href,label})=><Link key={href} href={href} className="flex min-h-11 items-center rounded-sm px-3 hover:bg-muted">{label}</Link>)}</div>
            </details>
          </nav>
          <MobileAccountNavigation savedCount={watchlist?.products.length} />
          {notificationBell}
          <nav aria-label="Shopping cart" className="flex">
            <Link
              href={ROUTES.cart}
              aria-label={cartQuantity === undefined ? "Shopping cart" : `Shopping cart, ${cartQuantity} ${cartQuantity === 1 ? "item" : "items"}`}
              className="relative inline-flex min-h-11 lg:min-h-9 min-w-11 items-center justify-center rounded-sm hover:text-primary"
            >
              <ShoppingCart size={19} aria-hidden="true" />
              {cartQuantity !== undefined && cartQuantity > 0 && <span aria-live="polite" aria-atomic="true" className="absolute right-0 top-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{cartQuantity > 99 ? "99+" : cartQuantity}</span>}
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default HeaderTopBar;
