import {
  createInvalidResponseError,
  isRecord,
  requestApi,
} from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { AddCartItemRequest } from "../types/cartRequestType";
import type { Cart } from "../types/cartResponseType";

export const ADD_CART_ITEM_PATH = "/api/v1/carts/me/items";
export const parseCart = (value: unknown): Cart => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.userId !== "string" ||
    value.status !== "ACTIVE" ||
    !Array.isArray(value.items)
  )
    throw createInvalidResponseError("Invalid cart");
  const items = value.items.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.productId !== "string" ||
      typeof item.skuId !== "string" ||
      !Number.isInteger(item.quantity) ||
      Number(item.quantity) < 1
    ) {
      throw createInvalidResponseError("Invalid cart item");
    }
    const unitPrice = normalizeMoney(item.unitPrice);
    if (unitPrice === null)
      throw createInvalidResponseError("Invalid cart item price");
    return {
      id: item.id,
      productId: item.productId,
      skuId: item.skuId,
      quantity: item.quantity as number,
      unitPrice,
    };
  });
  return { id: value.id, userId: value.userId, status: value.status, items };
};
export const addCartItem = async (
  input: AddCartItemRequest,
  options: ServiceRequestOptions = {},
): Promise<Cart> => {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    !input.skuId.trim()
  ) {
    throw createInvalidResponseError(
      "skuId and a positive quantity are required",
    );
  }
  const { data } = await requestApi<unknown>(
    "POST",
    ADD_CART_ITEM_PATH,
    input,
    { ...options, auth: true },
  );
  return parseCart(data);
};
