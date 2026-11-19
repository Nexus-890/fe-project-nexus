import type { CartIssue, CartIssueCode, CartItem } from "../types/cartResponseType";

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

export const sumCartMoney = (values: readonly string[]): string =>
  fromCents(values.reduce((total, value) => total + toCents(value), BigInt(0)));

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

const CART_ISSUE_MESSAGES: Record<CartIssueCode, string> = {
  OUT_OF_STOCK: "is out of stock. Remove it or lower the quantity.",
  PRODUCT_INACTIVE: "is no longer available. Remove it to check out.",
  SELF_PURCHASE: "is sold by your own shop. Remove it to check out.",
  PRICE_CHANGED: "has a new price. Checkout charges the current price.",
  QUANTITY_CAPPED: "was limited to the maximum quantity.",
};
const BLOCKING_CART_ISSUES: ReadonlySet<CartIssueCode> = new Set(["OUT_OF_STOCK", "PRODUCT_INACTIVE", "SELF_PURCHASE"]);

export const cartIssueMessage = (code: CartIssueCode): string => CART_ISSUE_MESSAGES[code];
export const isBlockingCartIssue = (issue: CartIssue): boolean => BLOCKING_CART_ISSUES.has(issue.code);
