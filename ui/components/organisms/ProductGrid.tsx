"use client";

import type { ProductSummary } from "../../../types/api";
import { ProductCard } from "../molecules/ProductCard";

export type ProductGridProps = {
  products: ProductSummary[];
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  variant?: "home" | "category";
};

export function ProductGrid({
  products,
  loading = false,
  empty = false,
  error = false,
  onRetry,
  retrying = false,
  variant = "home",
}: ProductGridProps) {
  const columns = variant === "home"
    ? "gap-5 @min-[1000px]/catalog:grid-cols-4 @min-[1120px]/catalog:grid-cols-5"
    : "gap-6";
  const grid = `m-0 grid list-none grid-cols-1 items-start p-0 @min-[480px]/catalog:grid-cols-2 @min-[760px]/catalog:grid-cols-3 ${columns}`;
  const state = "flex w-full flex-col items-center gap-3 rounded-sm border border-dashed border-black/[0.21] px-6 py-12 text-center";

  if (loading) {
    return (
      <div className="@container/catalog w-full min-w-0" role="status" aria-label="Loading products" aria-busy="true">
        <span className="sr-only">Loading products…</span>
        <div className={grid}>
          {Array.from({ length: variant === "home" ? 5 : 3 }, (_, index) => {
            const visible = [
              "block",
              "hidden @min-[480px]/catalog:block",
              "hidden @min-[760px]/catalog:block",
              "hidden @min-[1000px]/catalog:block",
              "hidden @min-[1120px]/catalog:block",
            ][index];
            return (
              <div className={`${visible} min-w-0 overflow-hidden rounded-sm border border-black/[0.08] bg-card starting:opacity-0 transition-opacity delay-300 duration-0`} key={index} aria-hidden="true">
                <div className="h-[232px] bg-[#f2f2f2]" />
                <div className="flex flex-col gap-2 px-3 pt-3 pb-[14px]">
                  <div className="h-3 w-full rounded bg-[#f2f2f2]" />
                  <div className="h-3 w-[70%] rounded bg-[#f2f2f2]" />
                  <div className="h-[18px] w-[88px] max-w-full rounded bg-[#f2f2f2]" />
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
        <p className="m-0 text-sm leading-5 text-[#4d4d4d]">Please try again.</p>
        <button
          className="min-h-8 rounded-sm border border-black/[0.08] bg-card px-3 py-[5px] text-sm font-medium leading-5 hover:bg-[#f2f2f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-[#f2f2f2] disabled:text-gray-700"
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
        <p className="m-0 max-w-[360px] text-sm leading-5 text-[#4d4d4d]">
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
