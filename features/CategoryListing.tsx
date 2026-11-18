"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, House, X } from "lucide-react";
import type { CategoryNode } from "@/types/catalogResponseType";
import { ProductGrid } from "@/components/ProductGrid";
import { Pagination } from "@/components/Pagination";
import { CategoryFilterSidebar } from "@/components/CategoryFilterSidebar";
import { CATALOG_PAGE_SIZE, SEARCH_MAX_PRICE, categoryListingHref, type SearchState } from "@/features/catalogUtils";
import { readSearchState, searchFilterChips } from "@/features/searchUtils";
import { useApiQuery } from "@/hooks/useApi";
import { getProducts } from "@/service/catalogService";
import { queryKeys } from "@/configs/queryKeys";

type CategoryListingProps = {
  category: CategoryNode;
  categories: CategoryNode[];
  page: number;
};

export function CategoryListing({
  category,
  categories,
  page,
}: CategoryListingProps) {
  const query = useSearchParams();
  const router = useRouter();
  const state = readSearchState({ ...Object.fromEntries(query.entries()), category: category.slug, page: String(page) });
  const { sort = "relevance" } = state;
  const changeSearch = (patch: Partial<SearchState>) =>
    router.push(categoryListingHref(category.slug, { ...state, ...patch, page: 1 }), { scroll: false });
  const filters = {
    categoryId: category.id,
    ...(sort !== "relevance" ? { sort } : {}),
    ...(state.listingType !== "all" ? { listingType: state.listingType } : {}),
    ...(state.maxPrice !== undefined && state.maxPrice < SEARCH_MAX_PRICE ? { maxPrice: state.maxPrice } : {}),
    page: page - 1,
    size: CATALOG_PAGE_SIZE,
  };
  const products = useApiQuery({
    queryKey: queryKeys.catalog.products(filters),
    service: (signal) => getProducts(filters, { signal }),
  });
  const totalPages = products.data
    ? Math.ceil(products.data.totalElements / products.data.size)
    : 0;
  const hrefForPage = (next: number) => {
    const params = new URLSearchParams(query.toString());
    params.set("page", String(next));
    return `${categoryListingHref(category.slug, {})}?${params}`;
  };
  const outOfRange = products.isSuccess && page > Math.max(1, totalPages);
  const firstResult =
    products.data && products.data.content.length > 0
      ? (page - 1) * products.data.size + 1
      : 0;
  const lastResult = products.data
    ? firstResult + products.data.content.length - 1
    : 0;

  return (
    <div className="mx-auto w-full max-w-[1248px] px-4 pt-6 pb-12 sm:px-6 lg:pb-16">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-gray-900"
      >
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-11 items-center gap-1.5 hover:text-primary"
        >
          <House size={16} aria-hidden="true" />
          Home
        </Link>
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="shrink-0 text-gray-700"
        />
        <span className="min-w-0 [overflow-wrap:anywhere]" aria-current="page">
          {category.name}
        </span>
      </nav>
      <div className="mt-3 mb-5 space-y-1">
        <h1 className="text-heading-32 [overflow-wrap:anywhere]">
          {category.name}
        </h1>
        <p className="min-h-5 text-sm text-gray-900" aria-live="polite">
          {products.isSuccess
            ? `${products.data.totalElements} results`
            : products.isPending
              ? "Loading products…"
              : "Browse products in this category"}
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <CategoryFilterSidebar
          categories={categories}
          selectedSlug={category.slug}
          basePath={categoryListingHref(category.slug, {})}
          clearHref={categoryListingHref(category.slug, {})}
          searchState={state}
          onSearchChange={changeSearch}
        />
        <section aria-label="Category products" className="min-w-0 space-y-5">
          <div className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex min-h-9 max-w-full items-center rounded-full border border-primary bg-orange-100 px-3 py-1.5 text-primary [overflow-wrap:anywhere]">
                {category.name}
              </span>
              {searchFilterChips(state).map((chip) => (
                <Link key={chip.key} href={categoryListingHref(category.slug, { ...state, ...chip.remove, page: 1 })} aria-label={`Remove filter ${chip.label}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-3 py-1.5 [overflow-wrap:anywhere]">
                  {chip.label}<X size={14} className="shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-2">
              <span>Sort by</span>
              <select
                aria-label="Sort by"
                value={sort}
                onChange={(event) => changeSearch({ sort: readSearchState({ sort: event.target.value }).sort })}
                className="min-h-11 min-w-36 rounded-md border border-border bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="relevance">Relevance</option>
                <option value="createdAt,desc">Newest</option>
                <option value="price,asc">Price: low to high</option>
                <option value="price,desc">Price: high to low</option>
              </select>
            </label>
          </div>
          {outOfRange ? (
            <div
              role="status"
              className="space-y-3 rounded-md border border-border p-6"
            >
              <h2 className="text-heading-20">No products on this page</h2>
              <Link
                className="inline-flex min-h-11 min-w-11 items-center text-primary"
                href={hrefForPage(1)}
              >
                Go to first page
              </Link>
            </div>
          ) : (
            <>
              <ProductGrid
                products={products.data?.content ?? []}
                loading={products.isPending}
                error={products.isError}
                onRetry={() => void products.refetch()}
                retrying={products.isFetching}
              />
              {products.isSuccess && products.data.content.length > 0 && (
                <div className="flex min-w-0 flex-col items-start justify-between gap-4 text-sm sm:flex-row sm:items-center">
                  <p className="text-gray-900">
                    Showing {firstResult}–{lastResult} of{" "}
                    {products.data.totalElements} results
                  </p>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    hrefForPage={hrefForPage}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
