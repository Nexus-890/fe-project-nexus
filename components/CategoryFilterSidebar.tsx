"use client";

import Link from "next/link";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CategoryNode } from "@/types/catalogResponseType";
import {
  categoryHref,
  flattenCategories,
  searchHref,
} from "@/features/catalogUtils";
import { CategoryTree } from "./CategoryTree";

interface CategoryFilterSidebarProps {
  categories: CategoryNode[];
  selectedSlug?: string;
  basePath: string;
  clearHref: string;
  searchQuery?: string;
  loading?: boolean;
  error?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}

const filterGroups = [
  { title: "Listing Type", options: ["All listings", "Buy Now", "Auction"] },
  {
    title: "Seller Trust Level",
    options: ["Top Seller", "Trusted", "Standard", "New"],
  },
  {
    title: "Condition",
    options: ["New", "Like New", "Used — Good", "For parts"],
  },
] as const;

const defaultSelectedFilters: Record<string, string[]> = {
  "Listing Type": ["All listings"],
  "Seller Trust Level": ["Top Seller", "Trusted"],
  Condition: [],
};

export function CategoryFilterSidebar({
  categories,
  selectedSlug,
  basePath,
  clearHref,
  searchQuery,
  loading = false,
  error = false,
  retrying = false,
  onRetry,
}: CategoryFilterSidebarProps) {
  const router = useRouter();
  const options = flattenCategories(categories);
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, string[]>
  >(defaultSelectedFilters);

  function toggleFilter(group: string, option: string) {
    setSelectedFilters((current) => {
      const selected = current[group] ?? [];
      const next = selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option];
      return { ...current, [group]: next };
    });
  }

  function changeCategory(slug: string) {
    if (!slug) {
      router.push(clearHref);
      return;
    }

    if (basePath === "/search") {
      router.push(searchHref({ q: searchQuery, category: slug }));
      return;
    }

    router.push(categoryHref(slug));
  }

  return (
    <aside aria-label="Filters" className="min-w-0 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-h-11 items-center gap-2 text-heading-16">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
        </h2>
        <Link
          href={clearHref}
          onClick={() => setSelectedFilters(defaultSelectedFilters)}
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

      {filterGroups.map((group) => (
        <fieldset key={group.title} className="border-t border-border pt-4">
          <legend className="mb-2 text-sm font-semibold">{group.title}</legend>
          <div className="space-y-1">
            {group.options.map((option) => (
              <button
                key={option}
                type="button"
                role="checkbox"
                aria-checked={
                  selectedFilters[group.title]?.includes(option) ?? false
                }
                onClick={() => toggleFilter(group.title, option)}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded border border-border text-xs ${selectedFilters[group.title]?.includes(option) ? "border-primary bg-primary text-primary-foreground" : ""}`}
                >
                  {selectedFilters[group.title]?.includes(option) ? "✓" : ""}
                </span>
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      {!loading && !error ? (
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold">Browse categories</h3>
          <CategoryTree categories={categories} activeSlug={selectedSlug} />
        </div>
      ) : null}
    </aside>
  );
}
