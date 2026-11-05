/** Cart fields consumed by this feature, shared by the delivered BE and draft guest adapter. */
export interface CartSnapshot {
  id: string;
  status: "ACTIVE";
  items: Array<{ id: string; skuId: string; quantity: number }>;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function responseData(value: unknown): unknown {
  return record(value) && "data" in value ? value.data : value;
}

export function readCart(value: unknown): CartSnapshot | null {
  const cart = responseData(value);
  if (!record(cart) || typeof cart.id !== "string" || !cart.id || cart.status !== "ACTIVE"
    || !Array.isArray(cart.items)) return null;
  let total = 0;
  for (const item of cart.items) {
    if (!record(item) || typeof item.id !== "string" || !item.id
      || typeof item.skuId !== "string" || !item.skuId
      || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) return null;
    total += Number(item.quantity);
    if (!Number.isSafeInteger(total)) return null;
  }
  // Keep credentials and unrelated response data out of React state.
  return { id: cart.id, status: "ACTIVE", items: cart.items.map((item) => ({
    id: item.id, skuId: item.skuId, quantity: item.quantity,
  })) };
}

export function cartItemCount(cart: CartSnapshot): number {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

export function isGuestToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,255}$/.test(value);
}

export function readGuestCart(value: unknown): { guestToken: string; cart: CartSnapshot } | null {
  const data = responseData(value);
  if (!record(data) || !isGuestToken(data.guestToken)) return null;
  const cart = readCart(data.cart);
  return cart ? { guestToken: data.guestToken, cart } : null;
}
