import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney, parseProductDetail, parseProductPage } from "./catalogService";
import { parseOrderSummary } from "./orderService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type { ProductDetail, ProductImage, ProductSku, ProductSummary } from "../types/catalogResponseType";
import type { SellerAuction, SellerAuctionInput, SellerProductInput, SellerProductStatus, SellerSale, SellerSkuInput, SellerStock, SellerProductListing, SellerBalance } from "../types/sellerType";

export const getSellerProducts = async (page: number, options: ServiceRequestOptions = {}): Promise<Page<ProductSummary>> =>
  parseProductPage(await requestApi("GET", "/api/v1/products/mine", undefined, { ...options, auth: true, params: { page, size: 10 } }));

/** Separate owner read keeps unpublished fields out of public catalog responses. */
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

export const canPublishSellerProduct = (product: Pick<ProductDetail, "skus" | "images">): boolean =>
  product.skus.some((sku) => !sku.id.startsWith("new-")) && product.images.some((image) => image.imageUrl.trim().length > 0);

export const getSellerProductListings = async (page: number, options: ServiceRequestOptions = {}): Promise<Page<SellerProductListing>> => {
  const result = await getSellerProducts(page, options);
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

export const saveSellerProduct = async (id: string | null, body: SellerProductInput, options: ServiceRequestOptions = {}): Promise<ProductSummary> => {
  const { data } = await requestApi(id ? "PUT" : "POST", id ? `/api/v1/products/${encodeURIComponent(id)}` : "/api/v1/products", body, { ...options, auth: true });
  return parseProductWrite(data);
};
export const changeSellerProductStatus = async (id: string, status: SellerProductStatus, options: ServiceRequestOptions = {}): Promise<ProductSummary> => {
  const { data } = await requestApi("PATCH", `/api/v1/products/${encodeURIComponent(id)}/status`, { status }, { ...options, auth: true });
  return parseProductWrite(data);
};
export const deleteSellerProduct = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi("DELETE", `/api/v1/products/${encodeURIComponent(id)}`, undefined, { ...options, auth: true });
};
export const saveSellerSku = async (productId: string, id: string | null, body: SellerSkuInput, options: ServiceRequestOptions = {}): Promise<ProductSku> => {
  // The backend generates an immutable code; never forward legacy client fields.
  const payload: SellerSkuInput = { color: body.color, size: body.size, price: body.price };
  const { data } = await requestApi(id ? "PUT" : "POST", id ? `/api/v1/skus/${encodeURIComponent(id)}` : `/api/v1/products/${encodeURIComponent(productId)}/skus`, payload, { ...options, auth: true });
  if (!isRecord(data) || typeof data.id !== "string" || data.productId !== productId || typeof data.skuCode !== "string" || typeof data.price !== "number" || normalizeMoney(data.price) === null || (data.color !== null && typeof data.color !== "string") || (data.size !== null && typeof data.size !== "string") || typeof data.status !== "string")
    throw createInvalidResponseError("Invalid saved SKU");
  return { id: data.id, productId: data.productId as string, skuCode: data.skuCode, color: data.color as string | null, size: data.size as string | null, price: normalizeMoney(data.price)!, status: data.status };
};
export const parseSellerStock = (data: unknown, ids: readonly string[]): SellerStock[] => {
  if (!Array.isArray(data) || data.length !== ids.length) throw createInvalidResponseError("Invalid inventory response");
  const seen = new Set<string>();
  return data.map((row) => {
    if (!isRecord(row) || typeof row.skuId !== "string" || !ids.includes(row.skuId) || seen.has(row.skuId) || !Number.isSafeInteger(row.available) || (row.available as number) < 0)
      throw createInvalidResponseError("Invalid inventory balance");
    seen.add(row.skuId);
    return { skuId: row.skuId, available: row.available as number };
  });
};
export const getSellerStock = async (ids: readonly string[], options: ServiceRequestOptions = {}): Promise<SellerStock[]> => {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];
  // The limit applies to each HTTP request, not to the seller's product page.
  const batches = Array.from({ length: Math.ceil(uniqueIds.length / 100) }, (_, index) => uniqueIds.slice(index * 100, (index + 1) * 100));
  const responses = await Promise.all(batches.map(async (batch) => {
    const { data } = await requestApi("GET", "/api/v1/inventory", undefined, { ...options, auth: false, params: { skuIds: batch.join(",") } });
    return parseSellerStock(data, batch);
  }));
  const byId = new Map(responses.flat().map((stock) => [stock.skuId, stock]));
  return uniqueIds.map((id) => byId.get(id)!);
};
export const parseSellerAuction = (value: unknown): SellerAuction => {
  if (!isRecord(value) || !["id", "productId", "skuId", "sellerId", "title", "currency"].every((key) => typeof value[key] === "string") ||
    !["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"].includes(String(value.status)) ||
    !["startAt", "endAt", "originalEndAt"].every((key) => typeof value[key] === "string" && Number.isFinite(Date.parse(value[key] as string))) ||
    !Number.isInteger(value.bidCount) || (value.bidCount as number) < 0 || !Number.isInteger(value.extensionCount) ||
    (value.imageUrl != null && typeof value.imageUrl !== "string") ||
    !["startingPrice", "currentPrice", "bidIncrement"].every((key) => typeof value[key] === "number" && normalizeMoney(value[key]) !== null))
    throw createInvalidResponseError("Invalid auction response");
  return { ...value, startingPrice: normalizeMoney(value.startingPrice)!, currentPrice: normalizeMoney(value.currentPrice)!, bidIncrement: normalizeMoney(value.bidIncrement)! } as SellerAuction;
};
export const createSellerAuction = async (body: SellerAuctionInput, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  const { data } = await requestApi("POST", "/api/v1/auctions", body, { ...options, auth: true });
  return parseSellerAuction(data);
};
export const scheduleSellerAuction = async (id: string, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  const { data } = await requestApi("POST", `/api/v1/auctions/${encodeURIComponent(id)}/schedule`, undefined, { ...options, auth: true });
  return parseSellerAuction(data);
};
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
    const items = (summary.items ?? []).map((item) => ({ id: item.orderItemId, name: item.productName, skuCode: item.skuCode, quantity: item.quantity }));
    return { ...summary, buyerId: row.userId,
      recipientName: typeof row.recipientName === "string" ? row.recipientName.trim() || null : null,
      phoneNumber: typeof row.phoneNumber === "string" ? row.phoneNumber.trim() || null : null,
      saleItems: items, itemNames: items.map((item) => item.name), itemCount: items.reduce((sum, item) => sum + item.quantity, 0) };
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
