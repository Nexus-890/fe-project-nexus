import type { CategoryNode, ProductDetail, ProductSku, ProductSummary } from "../types/catalog/response/type";
import type { Page } from "../types/common/response/type";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function isCategoryTree(value: unknown): value is CategoryNode[] {
  return Array.isArray(value) && value.every((node) => record(node)
    && typeof node.id === "string" && typeof node.name === "string"
    && typeof node.slug === "string" && node.slug.length > 0
    && (node.parentId === null || typeof node.parentId === "string")
    && Number.isInteger(node.level) && isCategoryTree(node.children));
}

export function isProductPage(value: unknown): value is Page<ProductSummary> {
  return record(value) && Number.isInteger(value.page) && Number(value.page) >= 0
    && Number.isInteger(value.size) && Number(value.size) > 0
    && Number.isSafeInteger(value.totalElements) && Number(value.totalElements) >= 0
    && Array.isArray(value.content) && value.content.every((product) => record(product)
      && typeof product.id === "string" && typeof product.name === "string"
      && typeof product.slug === "string"
      && (product.minPrice === null || normalizeMoney(product.minPrice) !== null));
}

export function parseProductPage(value: unknown): Page<ProductSummary> | null {
  if (!isProductPage(value) || !record(value)) return null;
  return {
    page: value.page as number,
    size: value.size as number,
    totalElements: value.totalElements as number,
    content: (value.content as unknown[]).map((product) => {
      const item = product as Record<string, unknown>;
      return {
        id: item.id as string,
        name: item.name as string,
        slug: item.slug as string,
        minPrice: item.minPrice === null ? null : normalizeMoney(item.minPrice)!,
        imageUrl: typeof item.imageUrl === "string" && item.imageUrl.trim() ? item.imageUrl.trim() : null,
        categoryId: typeof item.categoryId === "string" ? item.categoryId : undefined,
        sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
        status: typeof item.status === "string" ? item.status : undefined,
      };
    }),
  };
}

/**
 * Convert Java BigDecimal values (which Jackson may serialize as numbers) to
 * the string representation used by the UI. Keeping this at the wire boundary
 * prevents floating point arithmetic from leaking into price rendering.
 */
export function normalizeMoney(value: unknown): string | null {
  if (typeof value === "string") return /^\d+(?:\.\d+)?$/.test(value) ? value : null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value.toFixed(2);
  return null;
}

function isSku(value: unknown): value is ProductSku {
  return record(value)
    && typeof value.id === "string"
    && typeof value.productId === "string"
    && typeof value.skuCode === "string"
    && (value.color === null || typeof value.color === "string")
    && (value.size === null || typeof value.size === "string")
    && normalizeMoney(value.price) !== null
    && typeof value.status === "string";
}

/** Validate and normalize GET /api/v1/products/{id}. */
export function parseProductDetail(value: unknown): ProductDetail | null {
  if (!record(value)
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.slug !== "string"
    || typeof value.categoryId !== "string"
    || typeof value.sellerId !== "string"
    || typeof value.status !== "string"
    || (value.description !== null && value.description !== undefined && typeof value.description !== "string")
    || typeof value.auctionEnable !== "boolean"
    || !Array.isArray(value.skus)
    || !value.skus.every(isSku)
    || !Array.isArray(value.images)
    || !value.images.every((image) => record(image)
      && typeof image.id === "string"
      && typeof image.imageUrl === "string"
      && Number.isInteger(image.sortOrder))) {
    return null;
  }

  const minPrice = value.minPrice === undefined || value.minPrice === null
    ? null
    : normalizeMoney(value.minPrice);
  if (value.minPrice !== undefined && value.minPrice !== null && minPrice === null) return null;

  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    minPrice,
    categoryId: typeof value.categoryId === "string" ? value.categoryId : undefined,
    status: typeof value.status === "string" ? value.status : undefined,
    description: typeof value.description === "string" ? value.description : null,
    auctionEnable: value.auctionEnable,
    skus: value.skus.map((sku) => ({
      ...sku,
      color: sku.color === undefined ? null : sku.color,
      size: sku.size === undefined ? null : sku.size,
      price: normalizeMoney(sku.price)!,
    })),
    images: value.images.map((image) => ({
      id: image.id as string,
      imageUrl: image.imageUrl as string,
      sortOrder: image.sortOrder as number,
    })),
  };
}

export function isProductDetail(value: unknown): value is ProductDetail {
  return parseProductDetail(value) !== null;
}
