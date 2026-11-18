import { Bell, TicketPercent, Gavel, LockKeyhole, MapPin, ReceiptText, Star, Store, UserRound, type LucideIcon } from "lucide-react";

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  profile: "/profile",
  addresses: "/addresses",
  becomeSeller: "/become-a-seller",
  cart: "/cart",
  orders: "/orders",
  auctions: "/auctions",
  myBids: "/my-bids",
  reputation: "/profile#reputation",
  security: "/profile#security",
  sellerProducts: "/backoffice/products",
} as const;

export const HEADER_UTILITY_NAVIGATION = [
  { label: "Daily Deals", href: "/#daily-deals", visibility: "sm:inline-flex" },
  { label: "Vouchers", href: "/#vouchers", visibility: "sm:inline-flex" },
  { label: "Live Auctions", href: ROUTES.auctions, visibility: "md:inline-flex" },
  { label: "Help & Contact", href: "/help", visibility: "lg:inline-flex" },
] as const;

export const HEADER_CATEGORY_SHORTCUTS = [
  { label: "Nexus Live", href: "/#nexus-live", active: true },
  { label: "Saved", href: "/saved" },
  { label: "Deals", href: "/#deals" },
  { label: "Refurbished", href: "/search" },
] as const;

export interface AccountNavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

export const ACCOUNT_NAVIGATION: AccountNavigationItem[] = [
  { id: "orders", label: "Orders", icon: ReceiptText, href: ROUTES.orders },
  { id: "vouchers", label: "My vouchers", icon: TicketPercent, href: "/vouchers" },
  { id: "bids", label: "My Bids", icon: Gavel, href: ROUTES.myBids },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "reputation", label: "Reputation", icon: Star, href: ROUTES.reputation },
  { id: "profile", label: "Profile", icon: UserRound, href: ROUTES.profile },
  { id: "addresses", label: "Addresses", icon: MapPin, href: ROUTES.addresses },
  { id: "become-seller", label: "Become a seller", icon: Store, href: ROUTES.becomeSeller },
  { id: "security", label: "Security", icon: LockKeyhole, href: ROUTES.security },
];
