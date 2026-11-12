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
  ProductImage,
  ProductSku,
  ProductSummary,
  ShippingParcel,
} from "../types/catalogResponseType";
import type { ProductFilters } from "../types/catalogRequestType";

export const normalizeMoney = (value: unknown): string | null => {
  if (typeof value === "string")
    return /^\d+(?:\.\d+)?$/.test(value) ? value : null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return value.toFixed(2);
  return null;
};

export const isValidShippingParcel = (value: unknown): value is ShippingParcel =>
  isRecord(value) && Number.isInteger(value.weightGrams) &&
  Number(value.weightGrams) >= 1 && Number(value.weightGrams) <= 50000 &&
  [value.lengthCm, value.widthCm, value.heightCm].every((dimension) =>
    Number.isInteger(dimension) && Number(dimension) >= 1 && Number(dimension) <= 200);

export const parseShippingParcel = (value: unknown): ShippingParcel | null => {
  if (value == null) return null;
  if (!isValidShippingParcel(value))
    throw createInvalidResponseError("Invalid SKU shipping measurements");
  return {
    weightGrams: value.weightGrams, lengthCm: value.lengthCm,
    widthCm: value.widthCm, heightCm: value.heightCm,
  };
};

export const parseProductSku = (value: unknown): ProductSku => {
  if (!isRecord(value) || typeof value.id !== "string" ||
    typeof value.productId !== "string" || typeof value.skuCode !== "string" ||
    (value.color !== null && typeof value.color !== "string") ||
    (value.size !== null && typeof value.size !== "string") || typeof value.status !== "string")
    throw createInvalidResponseError("Invalid product SKU");
  const price = normalizeMoney(value.price);
  if (price === null) throw createInvalidResponseError("Invalid SKU price");
  const costPrice = value.costPrice == null ? null : normalizeMoney(value.costPrice);
  if (value.costPrice != null && costPrice === null) throw createInvalidResponseError("Invalid SKU cost price");
  const shippingParcel = parseShippingParcel(value.shippingParcel);
  return {
    id: value.id, productId: value.productId, skuCode: value.skuCode,
    color: value.color, size: value.size, status: value.status, price,
    ...(costPrice === null ? {} : { costPrice }),
    ...(value.shippingParcel === undefined ? {} : { shippingParcel }),
  };
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

const parseProductImages = (value: unknown): ProductImage[] => {
  if (!Array.isArray(value))
    throw createInvalidResponseError("Invalid product images");
  return value.map((image) => {
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
};

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
      (item.minPrice !== null && normalizeMoney(item.minPrice) === null) ||
      (item.maxPrice != null && normalizeMoney(item.maxPrice) === null)
    ) {
      throw createInvalidResponseError("Invalid product summary");
    }
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      minPrice: item.minPrice === null ? null : normalizeMoney(item.minPrice),
      maxPrice: item.maxPrice == null ? null : normalizeMoney(item.maxPrice),
      categoryId:
        typeof item.categoryId === "string" ? item.categoryId : undefined,
      sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
      status: typeof item.status === "string" ? item.status : undefined,
      // Older list responses may omit the optional media supplied by #122.
      images: item.images == null ? [] : parseProductImages(item.images),
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
  const skus = value.skus.map(parseProductSku);
  const images = parseProductImages(value.images);
  const minPrice =
    value.minPrice == null ? null : normalizeMoney(value.minPrice);
  const maxPrice =
    value.maxPrice == null ? null : normalizeMoney(value.maxPrice);
  if (
    (value.minPrice != null && minPrice === null) ||
    (value.maxPrice != null && maxPrice === null)
  )
    throw createInvalidResponseError("Invalid product price");
  return {
    id: value.id,
    name: value.name,
    slug: value.slug,
    categoryId: value.categoryId,
    sellerId: value.sellerId,
    status: value.status,
    minPrice,
    maxPrice,
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
