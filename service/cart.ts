import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import { isCart } from "../lib/cart-validation";
import { createMockCart, USE_CART_MOCK } from "../mocks/cart";
import type { ApiClient } from "../types/api/type";
import type { AddCartItemRequest, UpdateCartItemRequest } from "../types/cart/request/type";
import type { Cart } from "../types/cart/response/type";
import type { ApiResult } from "../types/common/response/type";

export const CART_PATH = "/api/v1/carts/me";
export const ADD_CART_ITEM_PATH = `${CART_PATH}/items`;

export interface CartServiceOptions {
  client?: ApiClient;
  getAccessToken?: () => string | null;
  mock?: boolean;
  mockUser?: { id: string; email: string };
}

function validateCart(result: ApiResult<unknown>): ApiResult<Cart> {
  if (!result.ok) return result;
  return isCart(result.data) ? { ok: true, data: result.data } : {
    ok: false,
    error: createInvalidResponseError("Cart response does not match the expected contract"),
  };
}

const validQuantity = (quantity: number) => Number.isSafeInteger(quantity) && quantity >= 1;

/** Sprint 1 paths/DTOs follow docs/api/commerce-service.yaml until BE lands. */
export function createCartService(options: CartServiceOptions = {}) {
  const client = options.client ?? createApiClient({ getAccessToken: options.getAccessToken });
  const useMock = options.mock ?? (!options.client && USE_CART_MOCK);
  const mock = useMock ? createMockCart(options.mockUser) : null;

  async function getCart(signal?: AbortSignal): Promise<ApiResult<Cart>> {
    // Skip a read canceled during the same mount cycle, including Strict Mode replay.
    await Promise.resolve();
    signal?.throwIfAborted();
    if (mock) return mock.getCart();
    return validateCart(await client.get<unknown>(CART_PATH, { auth: true, signal }));
  }

  async function addCartItem(input: AddCartItemRequest, signal?: AbortSignal): Promise<ApiResult<Cart>> {
    if (!validQuantity(input.quantity) || !input.skuId.trim()) {
      return { ok: false, error: createInvalidResponseError("skuId and a positive integer quantity are required") };
    }
    if (mock) return mock.addCartItem(input);
    return validateCart(await client.post<unknown>(ADD_CART_ITEM_PATH,
      { skuId: input.skuId, quantity: input.quantity }, { auth: true, signal }));
  }

  async function updateCartItem(input: UpdateCartItemRequest, signal?: AbortSignal): Promise<ApiResult<Cart>> {
    if (!validQuantity(input.quantity) || !input.itemId.trim()) {
      return { ok: false, error: createInvalidResponseError("itemId and a positive integer quantity are required") };
    }
    if (mock) return mock.updateCartItem(input);
    return validateCart(await client.put<unknown>(`${ADD_CART_ITEM_PATH}/${encodeURIComponent(input.itemId)}`,
      { quantity: input.quantity }, { auth: true, signal }));
  }

  async function removeCartItem(itemId: string, signal?: AbortSignal): Promise<ApiResult<void>> {
    if (!itemId.trim()) {
      return { ok: false, error: createInvalidResponseError("itemId is required") };
    }
    // DELETE returns 204 with no body. The hook reads the current cart afterwards.
    const result = mock ? mock.removeCartItem(itemId)
      : await client.delete<unknown>(`${ADD_CART_ITEM_PATH}/${encodeURIComponent(itemId)}`, { auth: true, signal });
    return result.ok ? { ok: true, data: undefined } : result;
  }

  return { getCart, addCartItem, updateCartItem, removeCartItem };
}
