"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { ChevronRight, House, X } from "lucide-react";
import { useApiQuery } from "@/hooks/useApi";
import { getCategoryTree, getProducts } from "@/service/catalogService";
import { queryKeys } from "@/configs/queryKeys";
import { ProductGrid } from "@/components/ProductGrid";
import { CategoryFilterSidebar } from "@/components/CategoryFilterSidebar";
import { Pagination } from "@/components/Pagination";
import {
  CATALOG_PAGE_SIZE,
  findCategory,
  searchHref,
  type SearchState,
} from "@/features/catalogUtils";
import { readSearchState, searchFilterChips } from "@/features/searchUtils";

interface SearchPageClientProps {
  query: Record<string, string | string[] | undefined>;
}

function SearchPage({ query: rawQuery }: SearchPageClientProps) {
  const router = useRouter();
  // Merge quick selections while the server-rendered URL state is still transitioning.
  const [searchState, setSearchState] = useOptimistic(
    readSearchState(rawQuery),
    (current, patch: Partial<SearchState>) => ({ ...current, ...patch, page: 1 }),
  );
  const [, startTransition] = useTransition();
  function changeSearch(patch: Partial<SearchState>) {
    startTransition(() => {
      setSearchState(patch);
      router.push(searchHref({ ...searchState, ...patch, page: 1 }), { scroll: false });
    });
  }
  const { q: query = "", category: categorySlug = "", sort = "relevance", page = 1 } = searchState;
  const categoryTree = useApiQuery({
    queryKey: queryKeys.catalog.tree,
    service: (signal) => getCategoryTree({ signal }),
  });
  const selectedCategory =
    categorySlug && categoryTree.data
      ? findCategory(categoryTree.data, categorySlug)
      : undefined;
  const filters = {
    ...(selectedCategory ? { categoryId: selectedCategory.id } : {}),
    ...(query ? { q: query } : {}),
    ...(sort !== "relevance" ? { sort } : {}),
    page: page - 1,
    size: CATALOG_PAGE_SIZE,
  };
  const products = useApiQuery(
    {
      queryKey: queryKeys.catalog.products(filters),
      service: (signal) => getProducts(filters, { signal }),
    },
    {
      enabled: !categorySlug || categoryTree.isSuccess || categoryTree.isError,
    },
  );
  const totalPages = products.data
    ? Math.ceil(products.data.totalElements / products.data.size)
    : 0;
  const hrefForPage = (next: number) =>
    searchHref({
      ...searchState,
      page: next,
    });
  const clearHref = "/search";

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
        <span aria-current="page">Search</span>
      </nav>

      <div className="mt-3 mb-5 space-y-1">
        <h1 className="text-heading-32 [overflow-wrap:anywhere]">
          {query ? `Results for “${query}”` : "Browse products"}
        </h1>
        <p className="min-h-5 text-sm text-gray-900" aria-live="polite">
          {products.isSuccess
            ? `${products.data.totalElements} results`
            : products.isPending
              ? "Loading products…"
              : "Search the catalog to find products."}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <CategoryFilterSidebar
          categories={categoryTree.data ?? []}
          selectedSlug={categorySlug}
          basePath="/search"
          clearHref={clearHref}
          searchState={searchState}
          onSearchChange={changeSearch}
          loading={categoryTree.isPending}
          error={categoryTree.isError}
          retrying={categoryTree.isFetching}
          onRetry={() => void categoryTree.refetch()}
        />

        <section aria-label="Search results" className="min-w-0 space-y-5">
          <div className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {query ? (
                <Link href={searchHref({ ...searchState, q: "", page: 1 })} aria-label={`Remove search ${query}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-primary bg-orange-100 px-3 py-1.5 text-sm text-primary [overflow-wrap:anywhere]">{query}<X size={14} className="shrink-0" aria-hidden="true" /></Link>
              ) : null}
              {selectedCategory ? (
                <Link href={searchHref({ ...searchState, category: "", page: 1 })} aria-label={`Remove category ${selectedCategory.name}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm [overflow-wrap:anywhere]">{selectedCategory.name}<X size={14} className="shrink-0" aria-hidden="true" /></Link>
              ) : null}
              {searchFilterChips(searchState).map((chip) => (
                <Link key={chip.key} href={searchHref({ ...searchState, ...chip.remove, page: 1 })} aria-label={`Remove filter ${chip.label}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm [overflow-wrap:anywhere]">
                  {chip.label}<X size={14} className="shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <span>Sort by</span>
              <select
                aria-label="Sort by"
                value={sort}
                onChange={(event) => changeSearch({ sort: event.target.value })}
                className="min-h-11 min-w-36 rounded-md border border-border bg-card px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="relevance">Relevance</option>
                <option value="createdAt,desc">Newest</option>
                <option value="price,asc">Price: low to high</option>
                <option value="price,desc">Price: high to low</option>
              </select>
            </label>
          </div>

          {query || sort !== "relevance" ? <p className="rounded-sm bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">Text search and sorting are previews. Results currently follow the selected category.</p> : null}

          {products.isSuccess && page > Math.max(1, totalPages) ? (
            <div
              role="status"
              className="space-y-3 rounded-md border border-border p-6"
            >
              <h2 className="text-heading-20">No products on this page</h2>
              <Link
                className="inline-flex min-h-11 min-w-11 items-center text-primary"
                href={searchHref({
                  ...searchState,
                  page: 1,
                })}
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
              {products.isSuccess && products.data.content.length > 0 ? (
                <div className="flex min-w-0 flex-col items-start justify-between gap-4 text-sm sm:flex-row sm:items-center">
                  <p className="text-gray-900">
                    Showing {(page - 1) * products.data.size + 1}–
                    {(page - 1) * products.data.size +
                      products.data.content.length}{" "}
                    of {products.data.totalElements} results
                  </p>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    hrefForPage={hrefForPage}
                  />
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default SearchPage;
