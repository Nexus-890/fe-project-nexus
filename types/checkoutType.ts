import type { components } from "./commerceGeneratedType";

/** Checkout form state keeps GHN codes separate from the display names. */
export type CheckoutAddress = {
  recipientName: string;
  phoneNumber: string;
  addressLine: string;
  provinceCode: string;
  wardCode: string;
};

/** Provisional #201 application model; reconcile with its delivered OpenAPI. */
export type ShippingLocality = { code: string; name: string };

export type CheckoutDestination = CheckoutAddress & {
  city: string;
  ward: string;
  countryCode: "VN";
};

export type CheckoutPreviewItem = {
  itemId: string;
  productId: string;
  skuId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export type CheckoutIssue = {
  itemId: string;
  skuId: string;
  code: "OUT_OF_STOCK" | "PRICE_CHANGED" | "PRODUCT_INACTIVE";
};

/**
 * Normalized UI model of the unmerged #188 preview draft. Its money is numeric
 * on the wire; null shippingFee means unavailable, never free shipping.
 */
export type CheckoutPreview = {
  items: CheckoutPreviewItem[];
  subtotal: string;
  shippingFee: string | null;
  taxAmount: string;
  discountAmount: string;
  total: string;
  issues: CheckoutIssue[];
};

/** Delivered order DTOs normalized to decimal strings for UI money. */
export type CheckoutOrderItem = Omit<
  components["schemas"]["OrderItem"], "unitPrice" | "totalPrice"
> & { unitPrice: string; totalPrice: string };

export type CheckoutOrder = Pick<
  components["schemas"]["Order"],
  "orderId" | "orderNumber" | "userId" | "sellerId" | "orderType" | "status" | "createdAt"
> & { totalAmount: string; items: CheckoutOrderItem[] };

export type CheckoutOrderGroup = Omit<
  components["schemas"]["OrderGroup"], "totalAmount" | "orders"
> & { totalAmount: string; orders: CheckoutOrder[] };

export type CheckoutConflict =
  | {
      kind: "price-changed";
      skuId: string;
      oldPrice: string;
      newPrice: string;
      detail?: string;
    }
  | {
      kind: "insufficient-stock";
      skuId?: string;
      productName?: string;
      detail?: string;
    };
