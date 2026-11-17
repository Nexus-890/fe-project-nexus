import { getMockCartAfterAdd, getMockProductDetail } from "./product-detail";
import type { ProductDetailWireResponse } from "../types/catalogResponseType";
import type { CartWireResponse } from "../types/cartResponseType";

/** Select a development transport before service parsing, never fake service success. */
export const getCatalogMockFetch = (path: string): typeof globalThis.fetch | undefined => {
  const productMock = process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK === "true";
  const cartMock = process.env.NEXT_PUBLIC_CART_MOCK === "true";
  if ((productMock || cartMock) && process.env.NODE_ENV === "production") {
    throw new Error("Catalog and cart mocks are disabled in production.");
  }
  if (!(productMock && path !== "/api/v1/products/search" && /^\/api\/v1\/products\/[^/]+$/.test(path))
    && !(cartMock && path === "/api/v1/carts/me/items")) return undefined;
  return async (input, init) => {
    if (init?.signal?.aborted) throw new DOMException("Request canceled", "AbortError");
    const inputUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(inputUrl, "http://mock.local");
    let data: CartWireResponse | ProductDetailWireResponse;
    if (path === "/api/v1/carts/me/items") {
      const cart = getMockCartAfterAdd(JSON.parse(String(init?.body ?? "{}")));
      data = { ...cart, items: cart.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })) };
    } else {
      const product = getMockProductDetail(decodeURIComponent(url.pathname.split("/").at(-1) ?? ""));
      data = {
        ...product, status: "ACTIVE", categoryId: product.categoryId ?? "", sellerId: product.sellerId ?? "",
        minPrice: product.minPrice === null ? null : Number(product.minPrice),
        maxPrice: product.maxPrice === null ? null : Number(product.maxPrice),
        skus: product.skus.map((sku) => ({ ...sku, price: Number(sku.price), costPrice: undefined })),
      };
    }
    return new Response(JSON.stringify({ code: 0, message: "response success", data }), {
      status: path === "/api/v1/carts/me/items" ? 201 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
};
