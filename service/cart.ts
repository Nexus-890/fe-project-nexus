import { API_BASE_URL } from "../configs/api";
import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import { parseCart } from "../lib/cart-validation";
import type { ApiClient } from "../types/api/type";
import type { AddCartItemRequest } from "../types/cart/request/type";
import type { Cart } from "../types/cart/response/type";
import type { ApiResult } from "../types/common/response/type";

export const ADD_CART_ITEM_PATH = "/api/v1/carts/me/items";

export interface CartServiceOptions {
  client?: ApiClient;
  getAccessToken?: () => string | null;
}

function validateCart(result: ApiResult<unknown>): ApiResult<Cart> {
  if (!result.ok) return result;
  const cart = parseCart(result.data);
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
      baseUrl: API_BASE_URL,
      getAccessToken: options.getAccessToken,
    });
  }

  async function addCartItem(input: AddCartItemRequest, signal?: AbortSignal): Promise<ApiResult<Cart>> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || !input.skuId.trim()) {
      return { ok: false, error: createInvalidResponseError("skuId and a positive quantity are required") };
    }
    return validateCart(await client.post<unknown>(ADD_CART_ITEM_PATH, input, { auth: true, signal }));
  }

  return { addCartItem };
}
