import { createApiClient, createInvalidResponseError } from "../lib/api-client";
import { isCart } from "../lib/cart-validation";
import { getMockCartAfterAdd, USE_CART_MOCK } from "../mocks/product-detail";
import type { ApiClient } from "../types/api/type";
import type { AddCartItemRequest } from "../types/cart/request/type";
import type { Cart } from "../types/cart/response/type";
import type { ApiResult } from "../types/common/response/type";

export const ADD_CART_ITEM_PATH = "/api/v1/carts/me/items";
/**
 * Temporary commerce origin. Commerce has no gateway route/controller in this
 * sprint; keep this unfinished endpoint decision local to the service. Once
 * the BE route lands, remove this fallback and use the common API origin.
 */
const TEMP_COMMERCE_API_URL = "http://localhost:4010";
// BE hand-off: replace only this origin when the commerce route is deployed.

export interface CartServiceOptions {
  client?: ApiClient;
  getAccessToken?: () => string | null;
}

function validateCart(result: ApiResult<unknown>): ApiResult<Cart> {
  if (!result.ok) return result;
  return isCart(result.data) ? { ok: true, data: result.data } : {
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
      baseUrl: TEMP_COMMERCE_API_URL,
      getAccessToken: options.getAccessToken,
    });
  }
  const useCartMock = !options.client && USE_CART_MOCK;

  async function addCartItem(input: AddCartItemRequest, signal?: AbortSignal): Promise<ApiResult<Cart>> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || !input.skuId.trim()) {
      return { ok: false, error: createInvalidResponseError("skuId and a positive quantity are required") };
    }
    // MOCK START: comment/remove this branch after the BE cart endpoint lands.
    if (useCartMock) return { ok: true, data: getMockCartAfterAdd(input) };
    // MOCK END: the real request below is the hand-off contract.
    return validateCart(await client.post<unknown>(ADD_CART_ITEM_PATH, input, { auth: true, signal }));
  }

  return { addCartItem };
}
