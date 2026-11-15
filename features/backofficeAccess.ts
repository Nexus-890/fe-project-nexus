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

export function backofficeMenu(roles: readonly BackofficeRole[]): BackofficeMenuItem[] {
  const items: BackofficeMenuItem[] = [];
  if (roles.includes("SELLER")) items.push({ label: "Products", href: "/backoffice/products" }, { label: "Sales", href: "/backoffice/sales" });
  if (roles.includes("ADMIN")) items.push({ label: "Stock", href: "/backoffice/stock" }, { label: "Categories", href: "/backoffice/categories", placeholder: true });
  if (roles.includes("ADMIN") || roles.includes("SUPPORT_STAFF")) items.push(
    { label: "Users", href: "/backoffice/users", placeholder: true },
    { label: "Orders", href: "/backoffice/orders", placeholder: true },
    { label: "Auctions", href: "/backoffice/auctions" },
    { label: "Event log", href: "/backoffice/event-log", placeholder: true },
    { label: "Health", href: "/backoffice/health", placeholder: true },
  );
  if (roles.includes("ADMIN")) items.push({ label: "Configuration", href: "/backoffice/configuration", placeholder: true });
  return items;
}

const nestedSections = ["/backoffice/products", "/backoffice/auctions"];

export function canAccessBackofficePath(path: string, roles: readonly BackofficeRole[]): boolean {
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(path, "https://nexus.invalid").pathname).replace(/\/+$/, "") || "/"; }
  catch { return false; }
  if (pathname === "/backoffice" || pathname === "/backoffice/forbidden") return hasBackofficeAccess(roles);
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
