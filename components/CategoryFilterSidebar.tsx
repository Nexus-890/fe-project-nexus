"use client";

import Link from "next/link";
import { ChevronDown, SlidersHorizontal, Star } from "lucide-react";
import { formatVND } from "./formatPrice";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CategoryNode } from "@/types/catalogResponseType";
import {
  categoryHref,
  flattenCategories,
  searchHref,
  type SearchState,
} from "@/features/catalogUtils";
import { SEARCH_MAX_PRICE, searchFilterGroups } from "@/features/searchUtils";
import { CategoryTree } from "./CategoryTree";

interface CategoryFilterSidebarProps {
  categories: CategoryNode[];
  selectedSlug?: string;
  basePath: string;
  clearHref: string;
  searchState?: SearchState;
  onSearchChange?: (patch: Partial<SearchState>) => void;
  loading?: boolean;
  error?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}

const defaultSelectedFilters: SearchState = {
  listingType: "all", trust: ["top-seller", "trusted"], condition: [],
  maxPrice: SEARCH_MAX_PRICE, minRating: 0,
};

export function CategoryFilterSidebar({
  categories,
  selectedSlug,
  basePath,
  clearHref,
  searchState,
  onSearchChange,
  loading = false,
  error = false,
  retrying = false,
  onRetry,
}: CategoryFilterSidebarProps) {
  const router = useRouter();
  const options = flattenCategories(categories);
  const [localFilters, setLocalFilters] = useState(defaultSelectedFilters);
  const selectedFilters = searchState ?? localFilters;
  const maxPrice = selectedFilters.maxPrice ?? SEARCH_MAX_PRICE;
  const minRating = selectedFilters.minRating ?? 0;
  const [expanded, setExpanded] = useState(false);

  function updateFilters(patch: Partial<SearchState>) {
    if (searchState) {
      if (onSearchChange) {
        onSearchChange(patch);
        return;
      }
      router.push(searchHref({ ...searchState, ...patch, page: 1 }), { scroll: false });
      return;
    }
    setLocalFilters((current) => ({ ...current, ...patch }));
  }

  function toggleFilter(key: "listingType" | "trust" | "condition", option: string) {
    if (key === "listingType") {
      updateFilters({ listingType: option });
      return;
    }
    const selected = selectedFilters[key] ?? [];
    updateFilters({ [key]: selected.includes(option)
      ? selected.filter((value) => value !== option) : [...selected, option] });
  }

  function changeCategory(slug: string) {
    if (basePath === "/search") {
      updateFilters({ category: slug });
      return;
    }
    if (!slug) {
      router.push(clearHref);
      return;
    }

    router.push(categoryHref(slug));
  }

  return (
    <aside id="catalog-filters" aria-label="Filters" className="min-w-0 scroll-mt-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-h-11 items-center gap-2 text-heading-16">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
        </h2>
        <Link
          href={clearHref}
          onClick={() => setLocalFilters(defaultSelectedFilters)}
          className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
        >
          Clear All
        </Link>
      </div>

      {loading ? (
        <div
          role="status"
          className="rounded-md border border-border p-3 text-sm"
        >
          Loading categories…
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3 text-sm"
        >
          <p>Unable to load categories.</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="min-h-11 rounded-md border border-border px-3 hover:bg-muted disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Retry categories"}
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && !error ? (
        <label
          className="block space-y-2 text-sm font-medium"
          htmlFor="category-filter"
        >
          <span>Category</span>
          <span className="relative block">
            <select
              id="category-filter"
              aria-label="Category filter"
              value={selectedSlug ?? ""}
              onChange={(event) => changeCategory(event.target.value)}
              className="min-h-11 w-full appearance-none rounded-md border border-border bg-card px-3 pr-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              {options.map((category) => (
                <option key={category.id} value={category.slug}>
                  {"— ".repeat(category.depth)}
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            />
          </span>
        </label>
      ) : null}

      <button type="button" aria-expanded={expanded} aria-controls="catalog-extra-filters" onClick={() => setExpanded((current) => !current)} className="flex min-h-11 w-full items-center justify-between rounded-sm border border-border px-3 text-sm lg:hidden">{expanded ? "Hide filters" : "More filters"}<ChevronDown size={16} className={expanded ? "rotate-180" : ""} aria-hidden="true" /></button>
      <div id="catalog-extra-filters" className={`${expanded ? "block" : "hidden"} space-y-5 lg:block`}>
      {searchFilterGroups.map((group) => (
        <fieldset key={group.title} className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
          <div className="space-y-1">
            {group.options.map((option) => {
              const checked = group.key === "listingType"
                ? (selectedFilters.listingType ?? "all") === option.value
                : selectedFilters[group.key]?.includes(option.value) ?? false;
              return (
              <button
                key={option.value}
                type="button"
                role={group.key === "listingType" ? "radio" : "checkbox"}
                aria-checked={checked}
                onClick={() => toggleFilter(group.key, option.value)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded border border-border text-xs ${checked ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {checked ? "✓" : ""}
                </span>
                {option.label}
              </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="space-y-3 border-t border-border pt-4">
        <legend className="text-sm font-semibold">Price range</legend>
        <label className="block text-xs text-muted-foreground" htmlFor="catalog-max-price">Up to {formatVND(String(maxPrice))}</label>
        <input id="catalog-max-price" type="range" min={0} max={SEARCH_MAX_PRICE} step={100000} value={maxPrice} onChange={(event) => updateFilters({ maxPrice: Number(event.target.value) })} className="min-h-11 w-full accent-primary" />
        <div className="flex items-center justify-between text-xs text-muted-foreground"><span>0 ₫</span><span>50.000.000 ₫</span></div>
      </fieldset>
      <fieldset className="border-t border-border pt-4"><legend className="mb-2 text-sm font-semibold">Seller rating</legend>{[4, 3, 2].map((rating) => <button key={rating} type="button" role="radio" aria-label={`${rating} stars and up`} aria-checked={minRating === rating} onClick={() => updateFilters({ minRating: minRating === rating ? 0 : rating })} className="flex min-h-11 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-muted"><span className={`size-4 rounded-full border ${minRating === rating ? "border-4 border-primary" : "border-border"}`} aria-hidden="true" /><span className="flex text-warning" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={12} fill={index < rating ? "currentColor" : "none"} />)}</span>& up</button>)}</fieldset>
      <p className="rounded-sm bg-muted p-3 text-xs leading-5 text-muted-foreground">Category browsing is live. Other filters are a preview and do not change catalog results.</p>
      </div>

      {!loading && !error ? (
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold">Browse categories</h3>
          <CategoryTree categories={categories} activeSlug={selectedSlug} searchState={searchState} />
        </div>
      ) : null}
    </aside>
  );
}
