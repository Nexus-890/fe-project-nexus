"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { ArrowLeftRight, Bell, CircleHelp } from "lucide-react";
import Logo from "../components/Logo";
import { useAuth } from "../hooks/useAuth";
import type { SellerAuction, SellerPreviewProduct } from "../types/sellerType";
import { makeSellerPreviewAuctions, makeSellerPreviewProducts } from "./sellerPreviewData";

type SellerContextValue = {
  preview: boolean; base: string; products: SellerPreviewProduct[]; setProducts: Dispatch<SetStateAction<SellerPreviewProduct[]>>;
  auctions: SellerAuction[]; setAuctions: Dispatch<SetStateAction<SellerAuction[]>>;
};
export const SellerContext = createContext<SellerContextValue | null>(null);
export const useSeller = () => {
  const value = useContext(SellerContext); if (!value) throw new Error("Seller layout is required"); return value;
};
const navigation = [["Overview", ""], ["Products", "/products"], ["Inventory", "/inventory"], ["Auctions", "/auctions"], ["Orders", "/orders"]] as const;

function SellerWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const preview = pathname.startsWith("/seller/preview");
  const base = preview ? "/seller/preview" : "/seller";
  const [products, setProducts] = useState(makeSellerPreviewProducts);
  const [auctions, setAuctions] = useState(makeSellerPreviewAuctions);
  return <SellerContext.Provider value={{ preview, base, products, setProducts, auctions, setAuctions }}>
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1248px] px-4 sm:px-6">
          <div className="flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3"><Logo /><span aria-hidden="true" className="text-border">/</span><span className="rounded-full bg-muted px-2 py-1 text-xs" aria-hidden="true">{preview ? "MA" : "N"}</span><span className="max-w-48 truncate text-sm font-semibold">{preview ? "Minh’s Audio Store" : auth.user?.fullName ?? "Seller Portal"}</span><span className="rounded-full border border-border px-2 text-xs">Seller</span></div>
            <div className="flex flex-wrap items-center gap-3 text-sm"><Link href="/" className="inline-flex min-h-11 items-center gap-2 hover:text-primary"><ArrowLeftRight size={16} aria-hidden="true" />Buyer shop</Link><Link href="/notifications" aria-label="Notifications" className="inline-flex min-h-11 min-w-11 items-center justify-center"><Bell size={18} aria-hidden="true" /></Link><Link href="/help" aria-label="Help" className="inline-flex min-h-11 min-w-11 items-center justify-center"><CircleHelp size={18} aria-hidden="true" /></Link></div>
          </div>
          <nav aria-label="Seller navigation" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">{navigation.map(([label, suffix]) => {
            const active = suffix ? pathname.startsWith(`${base}${suffix}`) : pathname === base;
            return <Link key={label} href={`${base}${suffix}`} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center border-b-2 pb-2 ${active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</Link>;
          })}{["Shipments", "Reviews", "Settings"].map((label) => <span key={label} aria-disabled="true" title="Screen/API not delivered" className="inline-flex min-h-11 items-center gap-1 border-b-2 border-transparent pb-2 text-muted-foreground/60">{label}<span className="text-[10px]">Soon</span></span>)}</nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1248px] min-w-0 space-y-6 px-4 py-8 sm:px-6">
        {preview ? <aside aria-label="Sample preview" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/30 bg-warning/5 p-4 text-sm"><p><strong>Sample preview.</strong> Changes stay in this preview. No server writes, stock reservations or carrier bookings occur.</p><Link href="/seller" className="font-medium underline">Open live workspace</Link></aside> : <p className="text-sm text-muted-foreground">Live workspace <span aria-hidden="true">·</span> <Link href="/seller/preview" className="font-medium text-primary underline">Review sample screens</Link></p>}
        {preview || auth.status === "authenticated" && auth.user?.roles.some((role) => role.toUpperCase() === "SELLER") ? children : auth.status === "restoring" || auth.status === "authenticating" ? <p role="status">Loading your account…</p> : auth.status === "error" ? <div><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><button type="button" onClick={() => void auth.retryProfile()} className="mt-4 min-h-11 rounded-sm border border-border px-4">Retry account</button></div> : <section className="rounded-sm border border-border p-6"><h1 className="text-heading-24">{auth.status === "anonymous" ? "Sign in to your seller account" : "A seller account is required"}</h1><p className="mt-3 text-sm text-muted-foreground">The live workspace uses your seller permissions and your own products and orders.</p>{auth.status === "anonymous" && <Link href={`/sign-in?returnTo=${encodeURIComponent(pathname)}`} className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-primary-foreground">Sign in</Link>}<Link href="/seller/preview" className="mt-5 ml-4 inline-flex min-h-11 items-center text-primary underline">Open sample preview</Link></section>}
      </main>
    </div>
  </SellerContext.Provider>;
}
function SellerLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <SellerWorkspace key={auth.sessionId}>{children}</SellerWorkspace>;
}
export default SellerLayout;
