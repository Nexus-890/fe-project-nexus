import {
  createInvalidResponseError,
  isRecord,
  requestApi,
} from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiResponse, Page } from "../types/commonResponseType";
import type {
  CategoryNode,
  ProductDetail,
  ProductSummary,
} from "../types/catalogResponseType";
import type { ProductFilters } from "../types/catalogRequestType";

export const normalizeMoney = (value: unknown): string | null => {
  if (typeof value === "string")
    return /^\d+(?:\.\d+)?$/.test(value) ? value : null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return value.toFixed(2);
  return null;
};
export const isCategoryTree = (value: unknown): value is CategoryNode[] =>
  Array.isArray(value) &&
  value.every(
    (node) =>
      isRecord(node) &&
      typeof node.id === "string" &&
      typeof node.name === "string" &&
      typeof node.slug === "string" &&
      node.slug.length > 0 &&
      (node.parentId === null || typeof node.parentId === "string") &&
      Number.isInteger(node.level) &&
      isCategoryTree(node.children),
  );

export const parseProductPage = (
  response: ApiResponse<unknown>,
): Page<ProductSummary> => {
  const { data, page } = response;
  if (!page || !Array.isArray(data))
    throw createInvalidResponseError(
      "Expected product data[] with page metadata",
    );
  const content = data.map((item): ProductSummary => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.slug !== "string" ||
      (item.minPrice !== null && normalizeMoney(item.minPrice) === null)
    ) {
      throw createInvalidResponseError("Invalid product summary");
    }
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      minPrice: item.minPrice === null ? null : normalizeMoney(item.minPrice),
      categoryId:
        typeof item.categoryId === "string" ? item.categoryId : undefined,
      sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
    };
  });
  return {
    content,
    page: page.number,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
  };
};
export const parseProductDetail = (value: unknown): ProductDetail => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.slug !== "string" ||
    typeof value.categoryId !== "string" ||
    typeof value.sellerId !== "string" ||
    typeof value.status !== "string" ||
    typeof value.auctionEnable !== "boolean" ||
    (value.description != null && typeof value.description !== "string") ||
    !Array.isArray(value.skus) ||
    !Array.isArray(value.images)
  ) {
    throw createInvalidResponseError("Invalid product detail");
  }
  const skus = value.skus.map((sku) => {
    if (
      !isRecord(sku) ||
      typeof sku.id !== "string" ||
      typeof sku.productId !== "string" ||
      typeof sku.skuCode !== "string" ||
      (sku.color !== null && typeof sku.color !== "string") ||
      (sku.size !== null && typeof sku.size !== "string") ||
      typeof sku.status !== "string"
    ) {
      throw createInvalidResponseError("Invalid product SKU");
    }
    const price = normalizeMoney(sku.price);
    if (price === null) throw createInvalidResponseError("Invalid SKU price");
    return {
      id: sku.id,
      productId: sku.productId,
      skuCode: sku.skuCode,
      color: sku.color,
      size: sku.size,
      status: sku.status,
      price,
    };
  });
  const images = value.images.map((image) => {
    if (
      !isRecord(image) ||
      typeof image.id !== "string" ||
      typeof image.imageUrl !== "string" ||
      !Number.isInteger(image.sortOrder)
    ) {
      throw createInvalidResponseError("Invalid product image");
    }
    return {
      id: image.id,
      imageUrl: image.imageUrl,
      sortOrder: image.sortOrder as number,
    };
  });
  const minPrice =
    value.minPrice == null ? null : normalizeMoney(value.minPrice);
  if (value.minPrice != null && minPrice === null)
    throw createInvalidResponseError("Invalid product price");
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    categoryId: value.categoryId,
    sellerId: value.sellerId,
    status: value.status,
    minPrice,
    description: (value.description as string) ?? null,
    auctionEnable: value.auctionEnable,
    skus,
    images,
  };
};
export const getCategoryTree = async (
  options: ServiceRequestOptions = {},
): Promise<CategoryNode[]> => {
  const { data } = await requestApi<unknown>(
    "GET",
    "/api/v1/categories/tree",
    undefined,
    { ...options, auth: false },
  );
  if (!isCategoryTree(data))
    throw createInvalidResponseError("Invalid category tree");
  return data;
};
export const getProducts = async (
  filters: ProductFilters = {},
  options: ServiceRequestOptions = {},
): Promise<Page<ProductSummary>> =>
  parseProductPage(
    await requestApi<unknown>("GET", "/api/v1/products", undefined, {
      ...options,
      params: { ...filters },
      auth: false,
    }),
  );
export const getProduct = async (
  productId: string,
  options: ServiceRequestOptions = {},
): Promise<ProductDetail> => {
  if (!productId.trim())
    throw createInvalidResponseError("Product id is required");
  const { data } = await requestApi<unknown>(
    "GET",
    `/api/v1/products/${encodeURIComponent(productId)}`,
    undefined,
    { ...options, auth: false },
  );
  return parseProductDetail(data);
};
