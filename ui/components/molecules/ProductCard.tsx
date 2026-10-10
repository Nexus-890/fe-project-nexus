import { formatVND } from "../../../features/catalog/api";
import type { ProductSummary } from "../../../types/api";

export type ProductCardProps = {
  product: Pick<ProductSummary, "id" | "name" | "minPrice">;
};

export function ProductCard({ product }: ProductCardProps) {
  const price = formatVND(product.minPrice);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-sm border border-border bg-card text-card-foreground" aria-label={product.name}>
      <div className="h-[232px] bg-muted" role="img" aria-label="Product image placeholder" />
      <div className="flex flex-col gap-1.5 px-3 pt-3 pb-[14px]">
        <h3 className="m-0 line-clamp-2 text-sm font-normal leading-5 [overflow-wrap:anywhere]">
          {product.name}
        </h3>
        {price !== null && (
          <p className="m-0 text-base font-semibold leading-6 tracking-[-0.02em] text-orange-800 [overflow-wrap:anywhere]">
            <span className="text-xs font-normal tracking-normal">from </span>{price}
          </p>
        )}
      </div>
    </article>
  );
}

export default ProductCard;
