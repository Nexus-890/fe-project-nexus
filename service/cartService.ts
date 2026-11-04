import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { AddCartItemRequest, UpdateCartItemRequest } from "../types/cartRequestType";
import type { Cart, CartItem } from "../types/cartResponseType";

export const CART_PATH = "/api/v1/carts/me";
export const ADD_CART_ITEM_PATH = CART_PATH + "/items";


// Commerce prices have scale 2. Sum integer cents so fractional prices remain exact.
function cents(value: unknown): bigint | null {
  const decimal = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof decimal !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(decimal)) return null;
  const [whole, fraction = ""] = decimal.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

function money(value: bigint): string {
  const digits = value.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/** Normalize the compact Cart DTO; display metadata is optional, totals are derived. */
export const parseCart = (value: unknown): Cart => {
  if (!isRecord(value)
    || typeof value.id !== "string"
    || typeof value.userId !== "string"
    || value.status !== "ACTIVE"
    || !Array.isArray(value.items)) throw createInvalidResponseError("Cart response does not match the expected contract");

  const items: CartItem[] = [];
  let subtotal = BigInt(0);
  for (const item of value.items) {
    if (!isRecord(item)
      || typeof item.id !== "string"
      || typeof item.skuId !== "string"
      || typeof item.productId !== "string"
      || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) throw createInvalidResponseError("Cart response does not match the expected contract");
    const unitPrice = cents(item.unitPrice);
    if (unitPrice === null) throw createInvalidResponseError("Cart response does not match the expected contract");
    const quantity = item.quantity as number;
    const lineTotal = unitPrice * BigInt(quantity);
    subtotal += lineTotal;
    items.push({
      id: item.id,
      skuId: item.skuId,
      productId: item.productId,
      productName: typeof item.productName === "string" && item.productName.trim()
        ? item.productName : `Product ${item.productId}`,
      quantity,
      unitPrice: money(unitPrice),
      lineTotal: money(lineTotal),
      sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
      sellerName: typeof item.sellerName === "string" ? item.sellerName : undefined,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
      color: typeof item.color === "string" ? item.color : undefined,
      size: typeof item.size === "string" ? item.size : undefined,
    });
  }
  return {
    id: value.id,
    userId: value.userId,
    status: value.status,
    items,
    subtotal: money(subtotal),
    // The shop displays VND; the delivered Cart DTO carries no currency or timestamp.
    currency: "VND",
  };
};

const validQuantity = (quantity: number) => Number.isSafeInteger(quantity) && quantity >= 1;

/** Named services share the one configured origin and validate only envelope data. */
export const getCart = async (options: ServiceRequestOptions = {}): Promise<Cart> => {
  // Strict Mode can cancel an initial observer during the same mount cycle.
  await Promise.resolve();
  options.signal?.throwIfAborted();
  const { data } = await requestApi<unknown>("GET", CART_PATH, undefined, { ...options, auth: true });
  return parseCart(data);
};

export const addCartItem = async (
  input: AddCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (!validQuantity(input.quantity) || !input.skuId.trim())
    throw createInvalidResponseError("skuId and a positive integer quantity are required");
  const { data } = await requestApi<unknown>("POST", ADD_CART_ITEM_PATH,
    { skuId: input.skuId, quantity: input.quantity }, { ...options, auth: true });
  return parseCart(data);
};

export const updateCartItem = async (
  input: UpdateCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (!validQuantity(input.quantity) || !input.itemId.trim())
    throw createInvalidResponseError("itemId and a positive integer quantity are required");
  const { data } = await requestApi<unknown>("PUT", ADD_CART_ITEM_PATH + "/" + encodeURIComponent(input.itemId),
    { quantity: input.quantity }, { ...options, auth: true });
  return parseCart(data);
};

export const removeCartItem = async (
  itemId: string,
  options: ServiceRequestOptions = {},
): Promise<void> => {
  if (!itemId.trim()) throw createInvalidResponseError("itemId is required");
  // DELETE is bodyless 204. The hook reads the current cart after it succeeds.
  await requestApi<void>("DELETE", ADD_CART_ITEM_PATH + "/" + encodeURIComponent(itemId), undefined,
    { ...options, auth: true });
};
