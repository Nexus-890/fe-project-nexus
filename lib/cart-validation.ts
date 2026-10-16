import type { Cart } from "../types/cart/response/type";
import { normalizeMoney } from "./catalog-validation";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isCart(value: unknown): value is Cart {
  return record(value)
    && typeof value.id === "string"
    && value.status === "ACTIVE"
    && Array.isArray(value.items)
    && value.items.every((item) => record(item)
      && typeof item.id === "string"
      && typeof item.skuId === "string"
      && typeof item.productId === "string"
      && typeof item.productName === "string"
      && Number.isInteger(item.quantity) && Number(item.quantity) >= 1
      && typeof item.unitPrice === "string" && normalizeMoney(item.unitPrice) !== null
      && typeof item.lineTotal === "string" && normalizeMoney(item.lineTotal) !== null)
    && typeof value.subtotal === "string" && normalizeMoney(value.subtotal) !== null
    && value.currency === "VND"
    && typeof value.updatedAt === "string";
}
