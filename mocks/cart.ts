import { buyerCartSeed } from "./cart-seed";
import { mockProductDetail } from "./product-detail";
import type { AddCartItemRequest, UpdateCartItemRequest } from "../types/cartRequestType";
import type { Cart, CartItem } from "../types/cartResponseType";
import type { ApiResult } from "../types/commonResponseType";

/** Explicit Sprint 1 fallback only; production API calls stay in service/cartService.ts. */
export const USE_CART_MOCK = process.env.NEXT_PUBLIC_CART_MOCK === "true";
const carts = new Map<string, Cart>();

function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

function money(value: bigint) {
  const digits = value.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function missing(): ApiResult<Cart> {
  return { ok: false, error: { kind: "http", status: 404, title: "Cart item not found" } };
}

export function createMockCart(user?: { id: string; email: string }) {
  const key = user?.id ?? "mock-user";
  const signedOut = (): ApiResult<Cart> => ({
    ok: false, error: { kind: "http", status: 401, title: "Sign in to view your cart" },
  });
  function current() {
    let cart = carts.get(key);
    if (!cart) {
      cart = user?.email.toLowerCase() === "buyer@nexus.local"
        ? { ...structuredClone(buyerCartSeed), userId: key }
        : { userId: key, id: `mock-cart-${key}`, status: "ACTIVE" as const, items: [], subtotal: "0.00", currency: "VND" as const, updatedAt: new Date().toISOString() };
      carts.set(key, cart);
    }
    return cart;
  }
  function save(items: CartItem[]): ApiResult<Cart> {
    const cart: Cart = {
      ...current(),
      items: items.map((item) => ({ ...item, lineTotal: money(cents(item.unitPrice) * BigInt(item.quantity)) })),
      subtotal: money(items.reduce((total, item) => total + cents(item.unitPrice) * BigInt(item.quantity), BigInt(0))),
      updatedAt: new Date().toISOString(),
    };
    carts.set(key, cart);
    return { ok: true, data: structuredClone(cart) };
  }
  return {
    getCart(): ApiResult<Cart> {
      return user ? { ok: true, data: structuredClone(current()) } : signedOut();
    },
    addCartItem(input: AddCartItemRequest): ApiResult<Cart> {
      if (!user) return signedOut();
      const items = current().items;
      const existing = items.find((item) => item.skuId === input.skuId);
      if (existing) return save(items.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + input.quantity } : item));
      let item = buyerCartSeed.items.find((entry) => entry.skuId === input.skuId);
      if (!item) {
        const sku = mockProductDetail.skus.find((entry) => entry.id === input.skuId);
        if (!sku) return missing();
        item = {
          id: `mock-item-${sku.id}`, skuId: sku.id, productId: sku.productId,
          productName: mockProductDetail.name, quantity: input.quantity, unitPrice: sku.price, lineTotal: "0.00",
          sellerId: mockProductDetail.sellerId, color: sku.color, size: sku.size,
          imageUrl: mockProductDetail.images[0]?.imageUrl,
        };
      }
      return save([...items, { ...item, quantity: input.quantity }]);
    },
    updateCartItem(input: UpdateCartItemRequest): ApiResult<Cart> {
      if (!user) return signedOut();
      const items = current().items;
      if (!items.some((item) => item.id === input.itemId)) return missing();
      return save(items.map((item) => item.id === input.itemId ? { ...item, quantity: input.quantity } : item));
    },
    removeCartItem(itemId: string): ApiResult<Cart> {
      if (!user) return signedOut();
      const items = current().items;
      if (!items.some((item) => item.id === itemId)) return missing();
      return save(items.filter((item) => item.id !== itemId));
    },
  };
}

/** Serve the explicitly selected per-account fixture through the same HTTP boundary. */
export const getCartMockFetch = (path: string, user?: { id: string; email: string }): typeof globalThis.fetch | undefined => {
  if (!USE_CART_MOCK) return undefined;
  if (process.env.NODE_ENV === "production") throw new Error("Catalog and cart mocks are disabled in production.");
  if (!user || !/^\/api\/v1\/carts\/me(?:\/items(?:\/[^/]+)?)?$/.test(path)) return undefined;
  const cart = createMockCart(user);
  return async (_input, init) => {
    if (init?.signal?.aborted) throw new DOMException("Request canceled", "AbortError");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const itemId = decodeURIComponent(path.split("/").at(-1) ?? "");
    const result = method === "GET" ? cart.getCart()
      : method === "POST" ? cart.addCartItem(body)
      : method === "PUT" ? cart.updateCartItem({ itemId, quantity: body.quantity })
      : cart.removeCartItem(itemId);
    if (!result.ok) return new Response(JSON.stringify(result.error), { status: result.error.status, headers: { "Content-Type": "application/problem+json" } });
    if (method === "DELETE") return new Response(null, { status: 204 });
    const data = { ...result.data, items: result.data.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })) };
    return new Response(JSON.stringify({ code: 0, message: "response success", data }), { status: method === "POST" ? 201 : 200, headers: { "Content-Type": "application/json" } });
  };
};
