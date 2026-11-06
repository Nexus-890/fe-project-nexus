import type { AddCartItemRequest } from "../types/cartRequestType";
import type { Cart } from "../types/cartResponseType";
import type { ProductDetail } from "../types/catalogResponseType";


export const USE_PRODUCT_DETAIL_MOCK = process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK === "true";
export const USE_CART_MOCK = process.env.NEXT_PUBLIC_CART_MOCK === "true";
export const mockProductDetail: ProductDetail = {
  id: "00000004-1111-4111-8111-111111111111",
  name: "iPad Mini 2021 Starlight — Wi‑Fi, 64GB",
  slug: "ipad-mini-2021-starlight-00000004-1111-4111-8111-111111111111",
  minPrice: null,
  categoryId: "00000010-1111-4111-8111-111111111111",
  sellerId: "00000080-1111-4111-8111-111111111111",
  status: "ACTIVE",
  description: "Compact tablet with a bright display and all-day battery life.",
  auctionEnable: false,
  skus: [
    {
      id: "00000003-1111-4111-8111-111111111111",
      productId: "00000004-1111-4111-8111-111111111111",
      skuCode: "IPAD-MINI-STARLIGHT-64",
      color: "Starlight",
      size: "64GB",
      price: "499.99",
      status: "ACTIVE",
    },
    {
      id: "00000013-1111-4111-8111-111111111111",
      productId: "00000004-1111-4111-8111-111111111111",
      skuCode: "IPAD-MINI-GREY-64",
      color: "Space Grey",
      size: "64GB",
      price: "519.99",
      status: "ACTIVE",
    },
  ],
  images: [
    {
      id: "ipad-mini-front",
      imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=85",
      sortOrder: 0,
    },
    {
      id: "ipad-mini-angle",
      imageUrl: "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?auto=format&fit=crop&w=1200&q=85",
      sortOrder: 1,
    },
    {
      id: "ipad-mini-back",
      imageUrl: "https://images.unsplash.com/photo-1557825835-70d97c4aa567?auto=format&fit=crop&w=1200&q=85",
      sortOrder: 2,
    },
    {
      id: "ipad-mini-table",
      imageUrl: "https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=1200&q=85",
      sortOrder: 3,
    },
    {
      id: "ipad-mini-closeup",
      imageUrl: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=85",
      sortOrder: 4,
    },
  ],
};

export function getMockProductDetail(productId: string): ProductDetail {
  if (productId === mockProductDetail.id) return mockProductDetail;
  return { ...mockProductDetail, id: productId, skus: mockProductDetail.skus.map((sku) => ({ ...sku, productId })) };
}

export function getMockCartAfterAdd(input: AddCartItemRequest): Cart {
  const sku = mockProductDetail.skus.find((entry) => entry.id === input.skuId) ?? mockProductDetail.skus[0];
  const subtotal = multiplyMoney(sku.price, input.quantity);
  return {
    id: "00000001-1111-4111-8111-111111111111",
    userId: "00000080-1111-4111-8111-111111111111",
    status: "ACTIVE",
    subtotal,
    currency: "VND",
    items: [{
      id: "00000002-1111-4111-8111-111111111111",
      skuId: input.skuId,
      productId: sku.productId,
      productName: mockProductDetail.name,
      quantity: input.quantity,
      unitPrice: sku.price,
      lineTotal: subtotal,
    }],
  };
}

export function multiplyMoney(value: string, quantity: number): string {
  const [whole, fraction = ""] = value.split(".");
  const cents = (BigInt(whole) * BigInt("100") + BigInt(fraction.padEnd(2, "0").slice(0, 2))) * BigInt(quantity);
  const text = cents.toString().padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}
