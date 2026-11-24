"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { useAuth } from "../hooks/useAuth";
import BackofficeDashboard from "./BackofficeDashboard";
import { backofficeMenu, readBackofficeRoles } from "./backofficeAccess";

function BackofficeHomePage() {
  const auth = useAuth();
  const roles = readBackofficeRoles(auth.accessToken);
  const items = backofficeMenu(roles);
  return <section aria-labelledby="backoffice-title"><h1 id="backoffice-title" className="text-heading-32">Back office</h1><p className="mt-3 text-sm text-muted-foreground">Recent figures for your account, then every workspace you can open.</p><div className="mt-8"><BackofficeDashboard roles={roles} /></div><h2 className="mt-12 text-lg font-semibold">Workspaces</h2><p className="mt-1 text-sm text-muted-foreground">Choose a workspace available to your account.</p><div className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Card key={item.href} className="h-full"><CardHeader><CardTitle>{item.label}</CardTitle></CardHeader><CardContent className="mt-auto"><p className="mb-4 text-sm leading-6 text-muted-foreground">{item.placeholder ? "This workspace is reserved for a future feature." : item.label === "Stock" ? "Add stock to a product SKU as an administrator." : item.label === "Products" ? "Create and publish your products, SKUs and images." : item.label === "Auctions" ? "Review auctions and their bid history; administrators can edit or cancel them." : item.label === "Bank accounts" ? "Update your shop details and masked receiving bank accounts." : item.label === "Payouts" || item.label === "Payout history" ? "Track automatic payouts, amount breakdowns and transfer history." : item.label === "Users" ? "Search accounts, update profiles and manage account access." : item.label === "Seller Applications" ? "Review applications and record approval or rejection feedback." : item.label === "Event Logs" ? "Filter captured events and inspect their complete payloads." : item.label === "Audit Logs" ? "Review the immutable record of critical actions." : item.label === "System Health" ? "Monitor each service and message broker every 10 seconds." : "View your customer orders and payment status."}</p><Link href={item.href} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Open {item.label}</Link></CardContent></Card>)}</div></section>;
}

export default BackofficeHomePage;
