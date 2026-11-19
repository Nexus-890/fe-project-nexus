"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { queryKeys } from "@/configs/queryKeys";
import { useApiQuery } from "@/hooks/useApi";
import { getDiscoveryProducts } from "@/service/catalogService";
import type { DiscoveryType } from "@/types/catalogRequestType";

const DISCOVERY_SIZE = 6;

const sections: Record<DiscoveryType, { id: string; title: string; note: string; empty: string; noun: string; href: string }> = {
  popular: {
    id: "best-sellers",
    title: "Best sellers",
    note: "Ranked by units sold in completed orders.",
    empty: "No best sellers yet. Products show up here after their orders are completed.",
    noun: "best sellers",
    href: "/search",
  },
  new: {
    id: "new-arrivals",
    title: "New arrivals",
    note: "The newest listings you can buy now.",
    empty: "No new arrivals yet. Check back soon.",
    noun: "new arrivals",
    href: "/search?sort=createdAt%2Cdesc",
  },
};

function HomeDiscoverySection({ type }: { type: DiscoveryType }) {
  const section = sections[type];
  const products = useApiQuery({
    queryKey: queryKeys.catalog.discovery(type, DISCOVERY_SIZE),
    service: (signal) => getDiscoveryProducts(type, DISCOVERY_SIZE, { signal }),
  });

  return (
    <section id={section.id} aria-label={section.title} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading-20">{section.title}</h2>
        <Link href={section.href} className="inline-flex min-h-11 items-center gap-1 text-sm text-primary">View all {section.noun} <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      <p className="text-xs text-muted-foreground">{section.note}</p>
      {products.isPending ? (
        <p role="status" className="rounded-sm border border-border p-6 text-sm">Loading {section.noun}…</p>
      ) : products.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-6 text-sm">
          <p>Unable to load {section.noun}.</p>
          <button type="button" disabled={products.isFetching} onClick={() => void products.refetch()} className="min-h-11 rounded-sm border border-border px-4">Retry {section.noun}</button>
        </div>
      ) : products.data.length ? (
        <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">
          {products.data.map((product) => <li key={product.id} className="min-w-0"><ProductCard product={product} /></li>)}
        </ul>
      ) : (
        <p role="status" className="rounded-sm border border-dashed border-border p-6 text-sm text-muted-foreground">{section.empty}</p>
      )}
    </section>
  );
}

export default HomeDiscoverySection;
