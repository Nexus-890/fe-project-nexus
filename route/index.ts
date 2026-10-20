import { Bell, Gavel, LockKeyhole, ReceiptText, Star, UserRound, type LucideIcon } from "lucide-react";

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  profile: "/profile",
  reputation: "/profile#reputation",
  security: "/profile#security",
  sell: "/#sell",
} as const;

export const HEADER_UTILITY_NAVIGATION = [
  { label: "Daily Deals", href: "/#daily-deals", visibility: "sm:inline-flex" },
  { label: "Vouchers", href: "/#vouchers", visibility: "sm:inline-flex" },
  { label: "Live Auctions", href: "/#live-auctions", visibility: "md:inline-flex" },
  { label: "Help & Contact", href: "/#help", visibility: "lg:inline-flex" },
] as const;

export const HEADER_CATEGORY_SHORTCUTS = [
  { label: "Nexus Live", href: "/#nexus-live", active: true },
  { label: "Saved", href: "/#saved" },
  { label: "Deals", href: "/#deals" },
  { label: "Refurbished", href: "/#refurbished" },
] as const;

export interface AccountNavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

export const ACCOUNT_NAVIGATION: AccountNavigationItem[] = [
  { id: "orders", label: "Orders", icon: ReceiptText },
  { id: "bids", label: "My Bids", icon: Gavel },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "reputation", label: "Reputation", icon: Star, href: ROUTES.reputation },
  { id: "profile", label: "Profile", icon: UserRound, href: ROUTES.profile },
  { id: "security", label: "Security", icon: LockKeyhole, href: ROUTES.security },
];
