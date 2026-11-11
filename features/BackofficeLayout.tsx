"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Logo from "../components/Logo";
import { Button } from "../components/button";
import { Card, CardContent } from "../components/card";
import { useAuth } from "../hooks/useAuth";
import { backofficeMenu, canAccessBackofficePath, readBackofficeRoles } from "./backofficeAccess";
import { SellerContext } from "./SellerLayout";
import type { SellerAuction, SellerPreviewProduct } from "../types/sellerType";

function BackofficeLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const returnTo = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
  const roles = readBackofficeRoles(auth.accessToken);
  const items = backofficeMenu(roles);
  const [products, setProducts] = useState<SellerPreviewProduct[]>([]);
  const [auctions, setAuctions] = useState<SellerAuction[]>([]);
  const [signOutError, setSignOutError] = useState(false);
  useEffect(() => {
    if (auth.status === "anonymous") router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo + window.location.hash)}`);
  }, [auth.status, returnTo, router]);

  if (auth.status === "restoring" || auth.status === "authenticating" || auth.status === "anonymous") return <main className="mx-auto max-w-4xl px-4 py-12"><p role="status">{auth.status === "anonymous" ? "Opening sign in…" : "Loading your account…"}</p></main>;
  if (auth.status === "error") return <main className="mx-auto max-w-4xl px-4 py-12"><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><Button variant="outline" className="mt-4 min-h-11" onClick={() => void auth.retryProfile()}>Retry account</Button></main>;
  if (!canAccessBackofficePath(pathname, roles)) return <main className="mx-auto max-w-3xl px-4 py-12"><Logo /><Card className="mt-8"><CardContent className="space-y-4 pt-6"><p className="font-mono text-sm text-muted-foreground">403</p><h1 className="text-heading-32">Access denied</h1><p className="text-sm text-muted-foreground">Your account role does not have access to this back-office page.</p><Link href={items.length ? "/backoffice" : "/"} className="inline-flex min-h-11 items-center text-primary underline">{items.length ? "Back to back office" : "Return to shop"}</Link></CardContent></Card></main>;

  return <SellerContext.Provider key={auth.sessionId} value={{ preview: false, base: "/backoffice", products, setProducts, auctions, setAuctions }}>
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center gap-4"><Logo /><span className="border-l border-border pl-4 text-sm font-medium">Back office</span></div><div className="flex flex-wrap items-center gap-4 text-sm"><span className="max-w-64 break-words">{auth.user?.fullName}</span><Link href="/" className="inline-flex min-h-11 items-center text-primary hover:underline">View shop</Link><Button variant="outline" className="min-h-11" onClick={() => { setSignOutError(false); void auth.signOut().then((result) => setSignOutError(!result.ok)); }}>Sign out</Button></div></div></header>
      {signOutError && <p role="alert" className="px-4 py-3 text-sm text-danger">Sign-out could not be completed. Please retry from your account.</p>}
      <div className="mx-auto grid max-w-[1440px] min-w-0 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0"><nav aria-label="Back-office navigation" className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-2 lg:flex-col"><Link href="/backoffice" aria-current={pathname === "/backoffice" ? "page" : undefined} className={`min-h-11 rounded-sm px-3 py-3 text-sm ${pathname === "/backoffice" ? "bg-muted font-medium text-primary" : "hover:bg-muted"}`}>Overview</Link>{items.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined} className={`min-h-11 rounded-sm px-3 py-3 text-sm ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-muted font-medium text-primary" : "hover:bg-muted"}`}>{item.label}</Link>)}</nav></aside>
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  </SellerContext.Provider>;
}

export default BackofficeLayout;
