"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, MapPin, ShoppingCart } from "lucide-react";
import type { HeaderProps } from "@/types/uiType";
import { HEADER_UTILITY_NAVIGATION, ROUTES } from "@/configs/routes";

function HeaderTopBar({ user, authenticating, onSignOut, cartQuantity }: HeaderProps) {
  const router = useRouter();
  function signOut() {
    onSignOut();
  }

  return (
    <div className="border-b border-border">
      <div className="mx-auto flex min-h-11 lg:min-h-9 max-w-[1248px] items-center justify-between gap-3 px-4 py-1 lg:py-0 text-xs text-gray-900 sm:px-6">
        <nav aria-label="Nexus utility links" className="flex min-w-0 items-center gap-1 sm:gap-3">
          {user ? (
            <Link href={ROUTES.profile} className="inline-flex min-h-11 lg:min-h-9 max-w-[13rem] items-center gap-1 whitespace-normal break-words rounded-sm px-2 text-left font-medium leading-4 hover:text-primary [overflow-wrap:anywhere]">
              Hi {user.fullName}
              <ChevronDown size={13} className="shrink-0" aria-hidden="true" />
            </Link>
          ) : authenticating ? (
            <span className="inline-flex min-h-11 lg:min-h-9 items-center px-2" role="status">Signing in…</span>
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
          {user && (
            <button type="button" onClick={signOut} className="inline-flex min-h-11 lg:min-h-9 items-center rounded-sm px-2 hover:text-primary">
              Sign out
            </button>
          )}
        </nav>

        <nav aria-label="Account and shopping links" className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button type="button" className="hidden min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 hover:text-primary sm:inline-flex">
            <MapPin size={14} aria-hidden="true" />
            <span className="hidden md:inline">Ship to HCMC</span>
          </button>
          <Link href={ROUTES.sell} className="hidden min-h-11 lg:min-h-9 items-center rounded-sm px-2 hover:text-primary sm:inline-flex">Sell</Link>
          <button type="button" className="hidden min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 hover:text-primary md:inline-flex">
            Watchlist <ChevronDown size={13} aria-hidden="true" />
          </button>
          <Link href={ROUTES.profile} className="hidden min-h-11 lg:min-h-9 items-center gap-1 rounded-sm px-2 hover:text-primary lg:inline-flex">
            My Nexus <ChevronDown size={13} aria-hidden="true" />
          </Link>
          <button type="button" aria-label="Notifications" className="relative hidden min-h-11 lg:min-h-9 min-w-11 items-center justify-center rounded-sm hover:text-primary sm:inline-flex">
            <Bell size={17} aria-hidden="true" />
          </button>
          <Link href={ROUTES.cart} aria-label={cartQuantity !== undefined ? `Shopping cart, ${cartQuantity} items` : "Shopping cart"} className="relative inline-flex min-h-11 lg:min-h-9 min-w-11 items-center justify-center rounded-sm hover:text-primary">
            <ShoppingCart size={19} aria-hidden="true" />
            {cartQuantity !== undefined && cartQuantity > 0 ? (
              <span aria-live="polite" aria-atomic="true" className="absolute top-0 right-0 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                {cartQuantity > 99 ? "99+" : cartQuantity}
              </span>
            ) : null}
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default HeaderTopBar;
