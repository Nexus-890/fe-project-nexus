import type { CartItem } from "../types/cartResponseType";

const toCents = (value: string): bigint => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new RangeError("Cart money must be a nonnegative decimal with up to two decimal places");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
};
const fromCents = (value: bigint): string =>
  `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
const requireQuantity = (quantity: number): bigint => {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new RangeError("Cart quantity must be a nonnegative safe integer");
  return BigInt(quantity);
};

/** Keep the saved decimal price exact, including the full numeric(19,2) range. */
export const multiplyCartMoney = (value: string, quantity: number): string =>
  fromCents(toCents(value) * requireQuantity(quantity));

export const getCartSubtotal = (items: readonly CartItem[]): string =>
  fromCents(
    items.reduce(
      (total, item) => total + toCents(item.unitPrice) * requireQuantity(item.quantity),
      BigInt(0),
    ),
  );

export const getCartQuantity = (items: readonly CartItem[]): number => {
  const quantity = items.reduce(
    (total, item) => total + requireQuantity(item.quantity),
    BigInt(0),
  );
  if (quantity > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError("Cart quantity exceeds the safe integer range");
  return Number(quantity);
};
