import { formatVND, formatVNDRange } from "./formatPrice";
import Link from "next/link";
import ProductImage from "./ProductImage";
import { sortProductImages } from "./productImageUtils";

import type { ProductSummary } from "@/types/catalogResponseType";

export type ProductCardProps = {
  product: Pick<ProductSummary, "id" | "name" | "slug" | "minPrice" | "maxPrice" | "images">;
};

export function ProductCard({ product }: ProductCardProps) {
  const price =
    product.maxPrice === null
      ? formatVND(product.minPrice)
      : formatVNDRange(product.minPrice, product.maxPrice);
  const firstImage = sortProductImages(product.images)[0];

  return (
    <article
      className="w-full min-w-0 overflow-hidden rounded-sm border border-border bg-card text-card-foreground"
      aria-label={product.name}
    >
      <Link
        href={`/products/${encodeURIComponent(product.slug)}?id=${encodeURIComponent(product.id)}`}
        className="block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <div className="h-[232px] overflow-hidden bg-muted">
          <ProductImage
            key={firstImage?.imageUrl ?? "empty"}
            src={firstImage?.imageUrl}
            alt={product.name}
            productName={product.name}
            loading="lazy"
          />
        </div>
        <div className="flex flex-col gap-1.5 px-3 pt-3 pb-[14px]">
          <h3 className="m-0 text-sm font-normal leading-5 [overflow-wrap:anywhere]">
            {product.name}
          </h3>
          {price !== null && (
            <p className="m-0 text-base font-semibold leading-6 tracking-[-0.02em] text-primary [overflow-wrap:anywhere]">
              {product.maxPrice === null && (
                <span className="text-xs font-normal tracking-normal">from </span>
              )}
              {price}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}

export default ProductCard;
