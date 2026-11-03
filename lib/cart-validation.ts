import type { Cart, CartItem } from "../types/cart/response/type";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
export function parseCart(value: unknown): Cart | null {
  if (!record(value)
    || typeof value.id !== "string"
    || typeof value.userId !== "string"
    || value.status !== "ACTIVE"
    || !Array.isArray(value.items)) return null;

  const items: CartItem[] = [];
  let subtotal = BigInt(0);
  for (const item of value.items) {
    if (!record(item)
      || typeof item.id !== "string"
      || typeof item.skuId !== "string"
      || typeof item.productId !== "string"
      || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) return null;
    const unitPrice = cents(item.unitPrice);
    if (unitPrice === null) return null;
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
}

/** GET/POST/PUT return ApiResponse<CartResponse>, unlike the legacy draft fixture. */
export function parseCartResponse(value: unknown): Cart | null {
  if (!record(value) || value.code !== 0 || typeof value.message !== "string") return null;
  return parseCart(value.data);
}
