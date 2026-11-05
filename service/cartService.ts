import {
  createInvalidResponseError,
  isRecord,
  requestApi,
  resolveApiUrl,
} from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type {
  AddCartItemRequest,
  UpdateCartItemRequest,
} from "../types/cartRequestType";
import type { Cart, CartSnapshot } from "../types/cartResponseType";

/** Fill in the Cart API origin when it is available; paths already include /api/v1. */
export const CART_API_BASE_URL = "";
export const GET_CART_PATH = "/api/v1/carts/me";
export const GUEST_CART_PATH = "/api/v1/carts/guest";
export const ADD_CART_ITEM_PATH = "/api/v1/carts/me/items";
/** #111 source routes; delivered OpenAPI/envelope/auth integration remains pending. */
export const CART_ITEM_PATH = "/api/v1/carts/me/items/:lineId";

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

export const parseCart = (value: unknown): Cart => {
  if (
    !isRecord(value) ||
    !isNonBlankId(value.id) ||
    !isNonBlankId(value.userId) ||
    value.status !== "ACTIVE" ||
    !Array.isArray(value.items)
  )
    throw createInvalidResponseError("Invalid cart");
  const items = value.items.map((item) => {
    if (
      !isRecord(item) ||
      !isNonBlankId(item.id) ||
      !isNonBlankId(item.productId) ||
      !isNonBlankId(item.skuId) ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) < 1
    ) {
      throw createInvalidResponseError("Invalid cart item");
    }
    const unitPrice = normalizeMoney(item.unitPrice);
    if (unitPrice === null || !/^\d+(?:\.\d{1,2})?$/.test(unitPrice))
      throw createInvalidResponseError("Invalid cart item price");
    return {
      id: item.id,
      productId: item.productId,
      skuId: item.skuId,
      quantity: item.quantity as number,
      unitPrice,
    };
  });
  if (!Number.isSafeInteger(items.reduce((total, item) => total + item.quantity, 0)))
    throw createInvalidResponseError("Cart quantity exceeds the safe integer range");
  return { id: value.id, userId: value.userId, status: value.status, items };
};
export const getCart = async (
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  const { data } = await requestApi<unknown>(
    "GET",
    GET_CART_PATH,
    undefined,
    cartRequestOptions(options),
  );
  return parseCart(data);
};
export const addCartItem = async (
  input: AddCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (
    !isPositiveQuantity(input.quantity) ||
    !isNonBlankId(input.skuId)
  ) {
    throw createInvalidResponseError(
      "skuId and a positive quantity are required",
    );
  }
  const { data } = await requestApi<unknown>(
    "POST",
    ADD_CART_ITEM_PATH,
    { skuId: input.skuId, quantity: input.quantity },
    cartRequestOptions(options),
  );
  return parseCart(data);
};

/** Expected contract: absolute quantity with a Cart envelope; #111 currently returns bare Cart. */
export const updateCartItem = async (
  input: UpdateCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (!isNonBlankId(input.itemId) || !isPositiveQuantity(input.quantity))
    throw createInvalidResponseError(
      "itemId and a positive quantity are required",
    );
  const { data } = await requestApi<unknown>(
    "PUT",
    resolveApiUrl(CART_ITEM_PATH, { lineId: input.itemId }),
    { quantity: input.quantity },
    cartRequestOptions(options),
  );
  return parseCart(data);
};

/** #111 DELETE expects bodyless 204; callers update/refetch their cart. */
export const removeCartItem = async (
  itemId: string,
  options: ServiceRequestOptions = {},
): Promise<void> => {
  if (!isNonBlankId(itemId))
    throw createInvalidResponseError("itemId is required");
  await requestApi<void>(
    "DELETE",
    resolveApiUrl(CART_ITEM_PATH, { lineId: itemId }),
    undefined,
    cartRequestOptions(options),
  );
};


/** Proposed guest handoff; feature flag stays off until BE delivers these routes. */
export const isGuestToken = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{16,255}$/.test(value);

export const readCart = (value: unknown): CartSnapshot | null => {
  const cart = isRecord(value) && "data" in value ? value.data : value;
  if (!isRecord(cart) || !isNonBlankId(cart.id) || cart.status !== "ACTIVE" || !Array.isArray(cart.items)) return null;
  let total = 0;
  for (const item of cart.items) {
    if (!isRecord(item) || !isNonBlankId(item.id) || !isNonBlankId(item.skuId)
      || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) return null;
    total += Number(item.quantity);
    if (!Number.isSafeInteger(total)) return null;
  }
  return { id: cart.id, status: "ACTIVE", items: cart.items.map((item) => ({
    id: item.id, skuId: item.skuId, quantity: item.quantity,
  })) };
};
export const readGuestCart = (value: unknown): { guestToken: string; cart: CartSnapshot } | null => {
  if (!isRecord(value) || !isGuestToken(value.guestToken)) return null;
  const cart = readCart(value.cart);
  return cart ? { guestToken: value.guestToken, cart } : null;
};
const requireGuestToken = (token: string) => {
  if (!isGuestToken(token)) throw createInvalidResponseError("Invalid guest cart credential");
};
const guestOptions = (options: ServiceRequestOptions, token?: string): ServiceRequestOptions => ({
  ...cartRequestOptions(options), auth: false,
  config: { ...options.config, headers: token ? { "X-Guest-Token": token } : {} },
});
const parseCartSnapshot = (value: unknown): CartSnapshot => {
  const cart = readCart(value);
  if (!cart) throw createInvalidResponseError("Invalid guest cart response");
  return cart;
};
export const createGuestCart = async (options: ServiceRequestOptions = {}): Promise<{ guestToken: string; cart: CartSnapshot }> => {
  const { data } = await requestApi<unknown>("POST", GUEST_CART_PATH, {}, guestOptions(options));
  const guest = readGuestCart(data);
  if (!guest) throw createInvalidResponseError("Invalid guest cart response");
  return guest;
};
export const getGuestCart = async (token: string, options: ServiceRequestOptions = {}): Promise<CartSnapshot> => {
  requireGuestToken(token);
  const { data } = await requestApi<unknown>("GET", GUEST_CART_PATH, undefined, guestOptions(options, token));
  return parseCartSnapshot(data);
};
export const addGuestCartItem = async (token: string, input: AddCartItemRequest, options: ServiceRequestOptions = {}): Promise<CartSnapshot> => {
  requireGuestToken(token);
  if (!isPositiveQuantity(input.quantity) || !isNonBlankId(input.skuId))
    throw createInvalidResponseError("skuId and a positive quantity are required");
  const { data } = await requestApi<unknown>("POST", GUEST_CART_PATH + "/items",
    { skuId: input.skuId, quantity: input.quantity }, guestOptions(options, token));
  return parseCartSnapshot(data);
};
export const mergeGuestCart = async (token: string, mergeKey: string, options: ServiceRequestOptions = {}): Promise<Cart> => {
  requireGuestToken(token);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(mergeKey)) throw createInvalidResponseError("Invalid cart merge key");
  const { data } = await requestApi<unknown>("POST", "/api/v1/carts/me/merge", {}, {
    ...cartRequestOptions(options),
    config: { ...options.config, headers: { "X-Guest-Token": token, "Idempotency-Key": mergeKey } },
  });
  return parseCart(data);
};
