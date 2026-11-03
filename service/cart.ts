import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import { readCart, readGuestCart, type CartSnapshot } from "../features/cart/model";
import { getMockCartAfterAdd, USE_CART_MOCK } from "../mocks/product-detail";
import type { ApiClient } from "../types/api/type";
import type { AddCartItemRequest } from "../types/cart/request/type";
import type { ApiResult } from "../types/common/response/type";

export const ADD_CART_ITEM_PATH = "/api/v1/carts/me/items";
export const GUEST_CART_PATH = "/api/v1/carts/guest";

export interface CartServiceOptions {
  client?: ApiClient;
  getAccessToken?: () => string | null;
}

function validateCart(result: ApiResult<unknown>): ApiResult<CartSnapshot> {
  if (!result.ok) return result;
  const cart = readCart(result.data);
  return cart ? { ok: true, data: cart } : {
    ok: false,
    error: createInvalidResponseError("Cart response does not match the expected contract"),
  };
}

export function createCartService(options: CartServiceOptions = {}) {
  let client: ApiClient;
  if (options.client) {
    client = options.client;
  } else {
    client = createApiClient({
      getAccessToken: options.getAccessToken,
    });
  }
  const useCartMock = !options.client && USE_CART_MOCK;

  async function addCartItem(input: AddCartItemRequest, signal?: AbortSignal): Promise<ApiResult<CartSnapshot>> {
    if (!validInput(input)) {
      return { ok: false, error: createInvalidResponseError("skuId and a positive quantity are required") };
    }
    // Existing opt-in product demo fixture; guest/merge integration uses HTTP.
    if (useCartMock) return validateCart({ ok: true, data: getMockCartAfterAdd(input) });
    return validateCart(await client.post<unknown>(ADD_CART_ITEM_PATH, input, { auth: true, signal }));
  }

  async function getCart(signal?: AbortSignal): Promise<ApiResult<CartSnapshot>> {
    return validateCart(await client.get<unknown>("/api/v1/carts/me", { auth: true, signal }));
  }

  // Proposed guest endpoints: see docs/guest-cart.md. The current BE exposes
  // authenticated carts only, so guest creation is disabled by default.
  async function createGuestCart(signal?: AbortSignal) {
    const result = await client.post<unknown>(GUEST_CART_PATH, {}, { auth: false, signal });
    if (!result.ok) return result;
    const guest = readGuestCart(result.data);
    return guest ? { ok: true as const, data: guest } : {
      ok: false as const, error: createInvalidResponseError("Invalid guest cart response"),
    };
  }

  async function getGuestCart(guestToken: string, signal?: AbortSignal) {
    return validateCart(await client.get<unknown>(GUEST_CART_PATH, {
      auth: false, signal, config: { headers: { "X-Guest-Token": guestToken } },
    }));
  }

  async function addGuestCartItem(guestToken: string, input: AddCartItemRequest, signal?: AbortSignal) {
    if (!validInput(input)) return {
      ok: false as const, error: createInvalidResponseError("skuId and a positive quantity are required"),
    };
    return validateCart(await client.post<unknown>(`${GUEST_CART_PATH}/items`, input, {
      auth: false, signal, config: { headers: { "X-Guest-Token": guestToken } },
    }));
  }

  async function mergeGuestCart(guestToken: string, mergeKey: string, signal?: AbortSignal) {
    return validateCart(await client.post<unknown>("/api/v1/carts/me/merge", {}, {
      auth: true, signal, config: { headers: { "X-Guest-Token": guestToken, "Idempotency-Key": mergeKey } },
    }));
  }

  return { addCartItem, getCart, createGuestCart, getGuestCart, addGuestCartItem, mergeGuestCart };
}

function validInput(input: AddCartItemRequest): boolean {
  return Number.isSafeInteger(input.quantity) && input.quantity > 0 && Boolean(input.skuId.trim());
}
