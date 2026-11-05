import {
  createInvalidResponseError,
  isRecord,
  requestApi,
  resolveApiUrl,
} from "../configs/api";
import { getCartSubtotal, multiplyCartMoney } from "../features/cartUtils";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type {
  AddCartItemRequest,
  UpdateCartItemRequest,
} from "../types/cartRequestType";
import type { Cart, CartItem } from "../types/cartResponseType";

/** Fill in the Cart API origin when it is available; paths already include /api/v1. */
export const CART_API_BASE_URL = "";
export const CART_PATH = "/api/v1/carts/me";
export const GET_CART_PATH = CART_PATH;
export const ADD_CART_ITEM_PATH = CART_PATH + "/items";
export const CART_ITEM_PATH = CART_PATH + "/items/:lineId";

const cartRequestOptions = (
  options: ServiceRequestOptions,
): ServiceRequestOptions => ({
  ...options,
  auth: true,
  context: {
    ...options.context,
    baseUrl: options.context?.baseUrl ?? CART_API_BASE_URL,
  },
});
const isPositiveQuantity = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;
const isNonBlankId = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** Normalize the compact Cart DTO; display metadata is optional, totals are derived. */
export const parseCart = (value: unknown): Cart => {
  if (
    !isRecord(value) ||
    !isNonBlankId(value.id) ||
    !isNonBlankId(value.userId) ||
    value.status !== "ACTIVE" ||
    !Array.isArray(value.items)
  )
    throw createInvalidResponseError("Invalid cart");
  const items: CartItem[] = value.items.map((item) => {
    if (
      !isRecord(item) ||
      !isNonBlankId(item.id) ||
      !isNonBlankId(item.productId) ||
      !isNonBlankId(item.skuId) ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1
    )
      throw createInvalidResponseError("Invalid cart item");
    const rawPrice = typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
      ? String(item.unitPrice) : item.unitPrice;
    if (typeof rawPrice !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(rawPrice))
      throw createInvalidResponseError("Invalid cart item price");
    const unitPrice = multiplyCartMoney(rawPrice, 1);
    const quantity = item.quantity as number;
    return {
      id: item.id,
      productId: item.productId,
      skuId: item.skuId,
      quantity,
      unitPrice,
      lineTotal: multiplyCartMoney(unitPrice, quantity),
      productName: typeof item.productName === "string" && item.productName.trim()
        ? item.productName : `Product ${item.productId}`,
      sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
      sellerName: typeof item.sellerName === "string" ? item.sellerName : undefined,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : undefined,
      color: typeof item.color === "string" ? item.color : undefined,
      size: typeof item.size === "string" ? item.size : undefined,
    };
  });
  return {
    id: value.id,
    userId: value.userId,
    status: value.status,
    items,
    subtotal: getCartSubtotal(items),
    // The shop displays VND; the delivered Cart DTO carries no currency or timestamp.
    currency: "VND",
  };
};

export const getCart = async (
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  // Strict Mode can cancel an initial observer during the same mount cycle.
  await Promise.resolve();
  options.signal?.throwIfAborted();
  const { data } = await requestApi<unknown>(
    "GET", GET_CART_PATH, undefined, cartRequestOptions(options),
  );
  return parseCart(data);
};

export const addCartItem = async (
  input: AddCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (!isPositiveQuantity(input.quantity) || !isNonBlankId(input.skuId))
    throw createInvalidResponseError("skuId and a positive quantity are required");
  const { data } = await requestApi<unknown>(
    "POST", ADD_CART_ITEM_PATH,
    { skuId: input.skuId, quantity: input.quantity }, cartRequestOptions(options),
  );
  return parseCart(data);
};

/** The delivered PUT contract replaces quantity and returns a Cart envelope. */
export const updateCartItem = async (
  input: UpdateCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (!isNonBlankId(input.itemId) || !isPositiveQuantity(input.quantity))
    throw createInvalidResponseError("itemId and a positive quantity are required");
  const { data } = await requestApi<unknown>(
    "PUT", resolveApiUrl(CART_ITEM_PATH, { lineId: input.itemId }),
    { quantity: input.quantity }, cartRequestOptions(options),
  );
  return parseCart(data);
};

/** DELETE returns bodyless 204; callers update/refetch their cart. */
export const removeCartItem = async (
  itemId: string,
  options: ServiceRequestOptions = {},
): Promise<void> => {
  if (!isNonBlankId(itemId)) throw createInvalidResponseError("itemId is required");
  await requestApi<void>(
    "DELETE", resolveApiUrl(CART_ITEM_PATH, { lineId: itemId }),
    undefined, cartRequestOptions(options),
  );
};
