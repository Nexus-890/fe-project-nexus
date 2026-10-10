"use client";
import type { CategoryNavigationProps } from "@/types/ui/type";
import { CategoryTree } from "@/ui/components/organisms/CategoryTree";

export function CategoryNavigation({ categories, loading, error, retrying, onRetry }: CategoryNavigationProps) {
  return (
    <section id="categories" aria-label="Categories" className="min-w-0 rounded-md border border-border p-4">
      {loading ? <p role="status">Loading categories…</p>
        : error ? <div role="alert" className="space-y-3">
          <p>Unable to load categories.</p>
          <button type="button" onClick={onRetry} disabled={retrying}
            className="min-h-11 rounded-sm border border-border px-4 disabled:opacity-50">
            {retrying ? "Retrying…" : "Retry categories"}
          </button>
        </div>
        : categories.length ? <CategoryTree categories={categories} variant="tiles" />
        : <p role="status" className="text-muted-foreground">No categories available.</p>}
    </section>
  );
}
