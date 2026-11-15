"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "../components/card";
import { useAuth } from "../hooks/useAuth";
import { backofficeMenu, readBackofficeRoles } from "./backofficeAccess";

function BackofficeHomePage() {
  const auth = useAuth();
  const items = backofficeMenu(readBackofficeRoles(auth.accessToken));
  return <section aria-labelledby="backoffice-title"><h1 id="backoffice-title" className="text-heading-32">Back office</h1><p className="mt-3 text-sm text-muted-foreground">Choose a workspace available to your account.</p><div className="mt-6 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <Card key={item.href} className="h-full"><CardHeader><CardTitle>{item.label}</CardTitle></CardHeader><CardContent className="mt-auto"><p className="mb-4 text-sm leading-6 text-muted-foreground">{item.placeholder ? "This workspace is reserved for a future feature." : item.label === "Stock" ? "Add stock to a product SKU as an administrator." : item.label === "Products" ? "Create and publish your products, SKUs and images." : item.label === "Auctions" ? "Review auctions and their bid history; administrators can edit or cancel them." : "View your customer orders and payment status."}</p><Link href={item.href} className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">Open {item.label}</Link></CardContent></Card>)}</div></section>;
}

export default BackofficeHomePage;
