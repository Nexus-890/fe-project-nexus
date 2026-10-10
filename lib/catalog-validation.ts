import type { CategoryNode, ProductSummary } from "../types/catalog/response/type";
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
      && (product.minPrice === null || typeof product.minPrice === "string"));
}
