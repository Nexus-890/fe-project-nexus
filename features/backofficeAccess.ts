import { safeReturnTo } from "./oidc";

const roleNames = ["BUYER", "SELLER", "ADMIN", "SUPPORT_STAFF"] as const;
export type BackofficeRole = typeof roleNames[number];
export type BackofficeMenuItem = { label: string; href: string; placeholder?: boolean };

/** UI access uses the flat roles claim. The API remains responsible for JWT validation and authorization. */
export function readBackofficeRoles(accessToken: string | null): BackofficeRole[] {
  if (!accessToken) return [];
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) return [];
    const claims: unknown = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims !== "object" || claims === null || !("roles" in claims) || !Array.isArray(claims.roles)) return [];
    const roles: unknown[] = claims.roles;
    return roleNames.filter((role) => roles.includes(role));
  } catch { return []; }
}

export const hasBackofficeAccess = (roles: readonly BackofficeRole[]) =>
  roles.some((role) => role === "SELLER" || role === "ADMIN" || role === "SUPPORT_STAFF");

/** The shared auction URLs show management reads to staff, including mixed-role accounts. */
export function resolveAuctionWorkspace(roles: readonly BackofficeRole[], view?: string | null): "manage" | "seller" | null {
  if (view === "seller" && roles.includes("SELLER")) return "seller";
  if (roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF")) return "manage";
  return roles.includes("SELLER") ? "seller" : null;
}

export function resolvePromotionWorkspace(roles: readonly BackofficeRole[], view?: string | null): "admin" | "seller" | null {
  if (view === "seller" && roles.includes("SELLER")) return "seller";
  if (roles.includes("ADMIN")) return "admin";
  return roles.includes("SELLER") ? "seller" : null;
}

/** Mixed-role sellers retain their own workflow after navigating through the shared URLs. */
export function sellerAuctionHref(roles: readonly BackofficeRole[], reference?: string): string {
  const path = `/backoffice/auctions${reference ? `/${encodeURIComponent(reference)}` : ""}`;
  return roles.includes("SELLER") && (roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF")) ? `${path}?view=seller` : path;
}

export function backofficeMenu(roles: readonly BackofficeRole[]): BackofficeMenuItem[] {
  const items: BackofficeMenuItem[] = [];
  if (roles.includes("ADMIN")) items.push({ label: "Promotions", href: "/backoffice/promotions" });
  if (roles.includes("ADMIN") || roles.includes("SELLER")) items.push({ label: "Vouchers", href: "/backoffice/vouchers" });
  if (roles.includes("SELLER")) items.push(
    { label: "Products", href: "/backoffice/products" },
    ...(resolveAuctionWorkspace(roles) === "seller" ? [{ label: "Auctions", href: "/backoffice/auctions" }] : []),
    { label: "Sales", href: "/backoffice/sales" },
    { label: "Bank accounts", href: "/backoffice/bank-accounts" },
    ...(!roles.includes("ADMIN") ? [{ label: "Payout history", href: "/backoffice/payouts" }] : []),
  );
  if (roles.includes("ADMIN")) items.push({ label: "Payouts", href: "/backoffice/payouts" });
  if (roles.includes("ADMIN")) items.push({ label: "Categories", href: "/backoffice/categories" }, { label: "Warehouses", href: "/backoffice/warehouses" }, { label: "Stock", href: "/backoffice/stock" });
  if (roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF")) items.push(
    { label: "Users", href: "/backoffice/users" },
    { label: "Orders", href: "/backoffice/orders" },
    { label: "Payments", href: "/backoffice/payments" },
    { label: "Refunds", href: "/backoffice/refunds" },
    { label: "Shipments", href: "/backoffice/shipments" },
    { label: "Auctions", href: "/backoffice/auctions" },
    { label: "Event Logs", href: "/backoffice/event-logs" },
    { label: "System Health", href: "/backoffice/health" },
  );
  if (roles.includes("ADMIN")) items.push(
    { label: "Seller Applications", href: "/backoffice/seller-applications" },
    { label: "Audit Logs", href: "/backoffice/audit-logs" },
  );
  if (roles.includes("ADMIN")) items.push({ label: "Configuration", href: "/backoffice/configuration" });
  return items;
}

const nestedSections = ["/backoffice/products", "/backoffice/auctions", "/backoffice/users"];

export function canAccessBackofficePath(path: string, roles: readonly BackofficeRole[]): boolean {
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(path, "https://nexus.invalid").pathname).replace(/\/+$/, "") || "/"; }
  catch { return false; }
  if (pathname === "/backoffice" || pathname === "/backoffice/forbidden") return hasBackofficeAccess(roles);
  if (pathname === "/backoffice/admin-payouts") return roles.includes("ADMIN");
  if (pathname === "/backoffice/event-log") return roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF");
  // Management reads do not grant seller creation. The static new route mounts the seller form.
  if (pathname === "/backoffice/auctions/new") return roles.includes("SELLER");
  return backofficeMenu(roles).some((item) => pathname === item.href || nestedSections.includes(item.href) && pathname.startsWith(`${item.href}/`));
}

export function resolveRoleLanding(returnTo: string | null | undefined, roles: readonly BackofficeRole[]): string {
  const home = hasBackofficeAccess(roles) ? "/backoffice" : "/";
  if (!returnTo) return home;
  const destination = safeReturnTo(returnTo);
  const pathname = new URL(destination, "https://nexus.invalid").pathname;
  if (/^\/backoffice(?:\/|$)/i.test(decodeURIComponent(pathname))) return canAccessBackofficePath(destination, roles) ? destination : home;
  if (/^\/seller(?:\/|$)/i.test(pathname)) return home;
  if (/^\/(?:cart|checkout|orders|order)(?:\/|$)/i.test(pathname) && !roles.includes("BUYER")) return home;
  return destination;
}
