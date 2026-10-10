"use client";

import { ProductCard } from "../molecules/ProductCard";

import type { ProductGridProps } from "@/types/ui/type";
export type { ProductGridProps } from "@/types/ui/type";

export function ProductGrid({
  products,
  loading = false,
  empty = false,
  error = false,
  onRetry,
  retrying = false,
}: ProductGridProps) {
  const grid = "m-0 grid list-none grid-cols-1 items-start gap-6 p-0 @min-[480px]/catalog:grid-cols-2 @min-[760px]/catalog:grid-cols-3";
  const state = "flex w-full flex-col items-center gap-3 rounded-sm border border-dashed border-border px-6 py-12 text-center";

  if (loading) {
    return (
      <div className="@container/catalog w-full min-w-0" role="status" aria-label="Loading products" aria-busy="true">
        <span className="sr-only">Loading products…</span>
        <div className={grid}>
          {Array.from({ length: 3 }, (_, index) => {
            const visible = [
              "block",
              "hidden @min-[480px]/catalog:block",
              "hidden @min-[760px]/catalog:block",
            ][index];
            return (
              <div className={`${visible} min-w-0 overflow-hidden rounded-sm border border-border bg-card starting:opacity-0 transition-opacity delay-300 duration-0`} key={index} aria-hidden="true">
                <div className="h-[232px] bg-muted" />
                <div className="flex flex-col gap-2 px-3 pt-3 pb-[14px]">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-[70%] rounded bg-muted" />
                  <div className="h-[18px] w-[88px] max-w-full rounded bg-muted" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={state} role="alert">
        <h3 className="m-0 text-base font-semibold leading-6 tracking-[-0.02em]">Unable to load products</h3>
        <p className="m-0 text-sm leading-5 text-gray-900">Please try again.</p>
        <button
          className="min-h-11 min-w-11 rounded-sm border border-border bg-card px-3 py-[5px] text-sm font-medium leading-5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-gray-700"
          type="button"
          onClick={onRetry}
          disabled={retrying || !onRetry}
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }

  if (empty || products.length === 0) {
    return (
      <div className={state} role="status">
        <h3 className="m-0 text-base font-semibold leading-6 tracking-[-0.02em]">No products found</h3>
        <p className="m-0 max-w-[360px] text-sm leading-5 text-gray-900">
          Try another category or change your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="@container/catalog w-full min-w-0">
      <ul className={grid} aria-label="Products">
        {products.map((product) => (
          <li className="min-w-0" key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProductGrid;
