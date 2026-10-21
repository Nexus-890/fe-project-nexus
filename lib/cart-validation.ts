import type { Cart } from "../types/cart/response/type";
import { normalizeMoney } from "./catalog-validation";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Parse the commerce CartResponse and normalize Jackson BigDecimal prices. */
export function parseCart(value: unknown): Cart | null {
  if (!record(value)
    || typeof value.id !== "string"
    || typeof value.userId !== "string"
    || value.status !== "ACTIVE"
    || !Array.isArray(value.items)) return null;

  const items: Cart["items"] = [];
  for (const item of value.items) {
    if (!record(item)
      || typeof item.id !== "string"
      || typeof item.skuId !== "string"
      || typeof item.productId !== "string"
      || !Number.isInteger(item.quantity) || Number(item.quantity) < 1) return null;
    const unitPrice = normalizeMoney(item.unitPrice);
    if (unitPrice === null) return null;
    items.push({
      id: item.id,
      skuId: item.skuId,
      productId: item.productId,
      quantity: item.quantity as number,
      unitPrice,
    });
  }
  return { id: value.id, userId: value.userId, status: "ACTIVE", items };
}
