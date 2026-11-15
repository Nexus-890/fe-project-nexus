import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { isValidShippingParcel, normalizeMoney, parseProductDetail, parseProductImages, parseProductPage, parseProductSku, parseShippingParcel } from "./catalogService";
import { parseOrderSummary } from "./orderService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type { ProductDetail, ProductImage, ProductSku, ProductSummary } from "../types/catalogResponseType";
import type { SellerProductInput, SellerProductStatus, SellerProductUpdate, SellerSale, SellerSkuInput, SellerProductListing, SellerBalance } from "../types/sellerType";

const sellerProductStatuses: readonly SellerProductStatus[] = ["DRAFT", "INACTIVE", "ACTIVE"];

export const getSellerProducts = async (page: number, status: SellerProductStatus | undefined, options: ServiceRequestOptions = {}): Promise<Page<ProductSummary>> => {
  if (!Number.isInteger(page) || page < 0 || status !== undefined && !sellerProductStatuses.includes(status)) throw createInvalidResponseError("Invalid seller product filters");
  return parseProductPage(await requestApi("GET", "/api/v1/products/mine", undefined, { ...options, auth: true, params: { page, size: 10, status } }));
};

export const getSellerProduct = async (id: string, options: ServiceRequestOptions = {}): Promise<ProductDetail> => {
  if (!id.trim()) throw createInvalidResponseError("Product id is required");
  const { data } = await requestApi("GET", `/api/v1/products/mine/${encodeURIComponent(id)}`, undefined, { ...options, auth: true });
  const detail = parseProductDetail(data);
  if (detail.id !== id || detail.skus.some((sku) => sku.productId !== id)) throw createInvalidResponseError("Mismatched owner product response");
  return detail;
};

const compareMoney = (left: string, right: string): number => {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const a = leftWhole.replace(/^0+(?=\d)/, ""); const b = rightWhole.replace(/^0+(?=\d)/, "");
  if (a.length !== b.length) return a.length - b.length;
  if (a !== b) return a < b ? -1 : 1;
  const decimals = Math.max(leftFraction.length, rightFraction.length);
  const aFraction = leftFraction.padEnd(decimals, "0"); const bFraction = rightFraction.padEnd(decimals, "0");
  return aFraction === bFraction ? 0 : aFraction < bFraction ? -1 : 1;
};

export const getSellerPriceRange = (skus: readonly ProductSku[]): { minPrice: string | null; maxPrice: string | null } => {
  const prices = skus.filter((sku) => !sku.id.startsWith("new-") && sku.status === "ACTIVE").map((sku) => sku.price).sort(compareMoney);
  return { minPrice: prices[0] ?? null, maxPrice: prices.at(-1) ?? null };
};

export const canPublishSellerProduct = (product: Pick<ProductDetail, "skus" | "images">): boolean => {
  const savedSkus = product.skus.filter((sku) => sku.id.trim() && !sku.id.startsWith("new-"));
  return savedSkus.length > 0 && savedSkus.every((sku) => isValidShippingParcel(sku.shippingParcel)) &&
    product.images.some((image) => image.imageUrl.trim().length > 0);
};

export const getSellerProductListings = async (page: number, status: SellerProductStatus | undefined, options: ServiceRequestOptions = {}): Promise<Page<SellerProductListing>> => {
  const result = await getSellerProducts(page, status, options);
  const details = await Promise.all(result.content.map((product) => getSellerProduct(product.id, options)));
  return { ...result, content: details.map((product) => ({ ...product, ...getSellerPriceRange(product.skus) })) };
};

export const parseSellerBalance = (value: unknown, skuId: string): SellerBalance => {
  if (!isRecord(value) || value.skuId !== skuId || typeof value.warehouseId !== "string" ||
    !["total", "available", "reserved", "unavailable"].every((key) => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0) ||
    value.total !== Number(value.available) + Number(value.reserved) + Number(value.unavailable)) throw createInvalidResponseError("Invalid seller inventory balance");
  return { skuId, warehouseId: value.warehouseId, total: value.total as number, available: value.available as number, reserved: value.reserved as number, unavailable: value.unavailable as number };
};

export const getSellerAvailableTotal = async (skuIds: readonly string[], options: ServiceRequestOptions = {}): Promise<number> => {
  const totals = await Promise.all([...new Set(skuIds)].map(async (skuId) => {
    const seen = new Set<string>(); let total = 0; let number = 0; let totalPages = 1;
    do {
      const response = await requestApi("GET", "/api/v1/inventory/balances", undefined, { ...options, auth: true, params: { skuId, page: number, size: 100 } });
      if (!Array.isArray(response.data) || !response.page || response.page.number !== number) throw createInvalidResponseError("Invalid seller balance page");
      totalPages = response.page.totalPages;
      for (const item of response.data) {
        const balance = parseSellerBalance(item, skuId);
        if (seen.has(balance.warehouseId)) throw createInvalidResponseError("Repeated seller warehouse balance");
        seen.add(balance.warehouseId); total += balance.available;
        if (!Number.isSafeInteger(total)) throw createInvalidResponseError("Inventory total exceeds the supported range");
      }
      number += 1;
    } while (number < totalPages);
    return total;
  }));
  const total = totals.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw createInvalidResponseError("Inventory total exceeds the supported range");
  return total;
};

const parseProductWrite = (data: unknown): ProductSummary =>
  parseProductPage({ code: 0, message: "response success", data: [data], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } }).content[0];

export const createSellerProduct = async (body: SellerProductInput, options: ServiceRequestOptions = {}): Promise<ProductSummary> => {
  const { data } = await requestApi("POST", "/api/v1/products", body, { ...options, auth: true });
  return parseProductWrite(data);
};

export const updateSellerProduct = async (id: string, body: SellerProductUpdate, options: ServiceRequestOptions = {}): Promise<ProductSummary> => {
  if (!id.trim()) throw createInvalidResponseError("Product id is required");
  const { data } = await requestApi("PUT", `/api/v1/products/${encodeURIComponent(id)}`, body, { ...options, auth: true });
  const product = parseProductWrite(data);
  if (product.id !== id) throw createInvalidResponseError("Mismatched updated product");
  return product;
};

export const deleteSellerProduct = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  if (!id.trim()) throw createInvalidResponseError("Product id is required");
  await requestApi("DELETE", `/api/v1/products/${encodeURIComponent(id)}`, undefined, { ...options, auth: true });
};

export const changeSellerProductStatus = async (id: string, status: SellerProductStatus, options: ServiceRequestOptions = {}): Promise<ProductSummary> => {
  const { data } = await requestApi("PATCH", `/api/v1/products/${encodeURIComponent(id)}/status`, { status }, { ...options, auth: true });
  return parseProductWrite(data);
};

const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e17 && Number(value.toFixed(2)) === value;

export const saveSellerSku = async (productId: string, skuId: string | null, body: SellerSkuInput, options: ServiceRequestOptions = {}): Promise<ProductSku> => {
  if (!productId.trim() || (skuId !== null && (!skuId.trim() || skuId.startsWith("new-"))) ||
    typeof body.color !== "string" || !body.color.trim() || body.color.trim().length > 50 ||
    typeof body.size !== "string" || !body.size.trim() || body.size.trim().length > 50 ||
    !isMoney(body.price) || body.price <= 0 || (body.costPrice != null && !isMoney(body.costPrice)))
    throw createInvalidResponseError("Invalid SKU input");
  const shippingParcel = parseShippingParcel(body.shippingParcel);
  const payload: SellerSkuInput = { color: body.color.trim(), size: body.size.trim(), price: body.price,
    ...(body.costPrice == null ? {} : { costPrice: body.costPrice }),
    ...(body.shippingParcel === undefined ? {} : { shippingParcel }) };
  const path = skuId === null ? `/api/v1/products/${encodeURIComponent(productId)}/skus` : `/api/v1/skus/${encodeURIComponent(skuId)}`;
  const { data } = await requestApi(skuId === null ? "POST" : "PUT", path, payload, { ...options, auth: true });
  const sku = parseProductSku(data);
  if (!sku.id.trim() || sku.id.startsWith("new-") || sku.productId !== productId || !sku.skuCode.trim() ||
    !isRecord(data) || typeof data.price !== "number" ||
    (data.costPrice != null && typeof data.costPrice !== "number") || (skuId !== null && sku.id !== skuId))
    throw createInvalidResponseError("Invalid saved SKU");
  return sku;
};

export const createSellerSku = async (productId: string, body: SellerSkuInput, options: ServiceRequestOptions = {}): Promise<ProductSku> =>
  saveSellerSku(productId, null, body, options);

export const updateSellerSku = async (productId: string, skuId: string, body: SellerSkuInput, options: ServiceRequestOptions = {}): Promise<ProductSku> =>
  saveSellerSku(productId, skuId, body, options);

export const getSellerSales = async (pageNumber: number, status: string | undefined, options: ServiceRequestOptions = {}): Promise<Page<SellerSale>> => {
  if (!Number.isInteger(pageNumber) || pageNumber < 0 || pageNumber > 2147483646 ||
    status !== undefined && !["PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "REFUND_REQUESTED", "REFUNDED"].includes(status))
    throw createInvalidResponseError("Invalid seller sales filters");
  const { data, page } = await requestApi("GET", "/api/v1/orders/sales", undefined, { ...options, auth: true, params: { page: pageNumber, size: 10, status } });
  if (!Array.isArray(data) || !page) throw createInvalidResponseError("Invalid seller order page");
  return { content: data.map((row): SellerSale => {
    const summary = parseOrderSummary(row);
    if (!isRecord(row) || typeof row.userId !== "string" || !Array.isArray(row.items) ||
      (row.recipientName != null && typeof row.recipientName !== "string") || (row.phoneNumber != null && typeof row.phoneNumber !== "string"))
      throw createInvalidResponseError("Invalid seller order");
    const items = row.items.map((item) => {
      if (!isRecord(item) || typeof item.orderItemId !== "string" || typeof item.productName !== "string" || !item.productName.trim() || typeof item.skuCode !== "string" || !item.skuCode.trim() || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || typeof item.unitPrice !== "number" || normalizeMoney(item.unitPrice) === null || typeof item.totalPrice !== "number" || normalizeMoney(item.totalPrice) === null)
        throw createInvalidResponseError("Invalid seller order item");
      return { id: item.orderItemId, name: item.productName, skuCode: item.skuCode, quantity: Number(item.quantity) };
    });
    if (new Set(items.map((item) => item.id)).size !== items.length) throw createInvalidResponseError("Repeated seller order item");
    return { ...summary, buyerId: row.userId,
      recipientName: typeof row.recipientName === "string" ? row.recipientName.trim() || null : null,
      phoneNumber: typeof row.phoneNumber === "string" ? row.phoneNumber.trim() || null : null,
      saleItems: items };
  }), page: page.number, size: page.size, totalElements: page.totalElements, totalPages: page.totalPages };
};

export const uploadSellerImage = async (id: string, file: File, options: ServiceRequestOptions = {}): Promise<ProductImage> => {
  const body = new FormData(); body.append("file", file);
  const { data } = await requestApi("POST", `/api/v1/products/${encodeURIComponent(id)}/images`, body, { ...options, auth: true });
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.imageUrl !== "string" || !Number.isInteger(data.sortOrder)) throw createInvalidResponseError("Invalid uploaded image");
  return { id: data.id, imageUrl: data.imageUrl, sortOrder: data.sortOrder as number };
};

export const removeSellerImage = async (productId: string, imageId: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi("DELETE", `/api/v1/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, undefined, { ...options, auth: true });
};

export const reorderSellerImages = async (productId: string, imageIds: readonly string[], options: ServiceRequestOptions = {}): Promise<ProductImage[]> => {
  if (!productId.trim() || imageIds.some((id) => !id.trim()) || new Set(imageIds).size !== imageIds.length) throw createInvalidResponseError("Invalid image order");
  const { data } = await requestApi("PUT", `/api/v1/products/${encodeURIComponent(productId)}/images/order`, { imageIds }, { ...options, auth: true });
  const images = parseProductImages(data);
  if (images.length !== imageIds.length || images.some((image, index) => image.id !== imageIds[index] || image.sortOrder !== index))
    throw createInvalidResponseError("Mismatched image order");
  return images;
};
