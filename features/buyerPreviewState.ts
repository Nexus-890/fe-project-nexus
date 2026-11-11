import { getCartQuantity, getCartSubtotal, multiplyCartMoney, sumCartMoney } from "./cartUtils";
import type { CartItem } from "../types/cartResponseType";

export type PreviewAddress = { id: string; label: string; line: string; badge: string };
export type PreviewDelivery = "express" | "standard";
export type PreviewPayment = "bank" | "card";
export type BuyerPreviewState = {
  items: CartItem[];
  saved: string[];
  coupon: string;
  couponApplied: boolean;
  delivery: PreviewDelivery;
  payment: PreviewPayment;
  addresses: PreviewAddress[];
  selectedAddress: string;
};

const imageBase = "https://nzjvjvyqxcisjgvglwvj.supabase.co/storage/v1/object/public/product-images/products/";
const sampleItems: CartItem[] = [
  { id: "preview-phone", productId: "69000000-0000-4000-8000-000000000201", skuId: "preview-phone-sku", quantity: 1, unitPrice: "24990000.00", lineTotal: "24990000.00", productName: "Nexus Phone Pro", sellerId: "preview-tech", sellerName: "Nexus Tech Store", color: "Midnight", size: "256 GB", imageUrl: `${imageBase}69000000-0000-4000-8000-000000000201/69000000-0000-4000-8000-000000000301.jpg` },
  { id: "preview-shirt", productId: "69000000-0000-4000-8000-000000000204", skuId: "preview-shirt-sku", quantity: 1, unitPrice: "299000.00", lineTotal: "299000.00", productName: "Essential Cotton Shirt", sellerId: "preview-style", sellerName: "Sole Collective", color: "Classic White", size: "M", imageUrl: `${imageBase}69000000-0000-4000-8000-000000000204/69000000-0000-4000-8000-000000000304.jpg` },
  { id: "preview-sneaker", productId: "69000000-0000-4000-8000-000000000205", skuId: "preview-sneaker-sku", quantity: 1, unitPrice: "1899000.00", lineTotal: "1899000.00", productName: "Sports Sneakers Off White & Red", sellerId: "preview-style", sellerName: "Sole Collective", color: "Off White / Red", size: "42", imageUrl: `${imageBase}69000000-0000-4000-8000-000000000205/69000000-0000-4000-8000-000000000305.jpg` },
];

export const previewDeliveryOptions = [
  { id: "express", title: "GHN Express", amount: "49000.00", estimate: "Arrives Oct 2–3" },
  { id: "standard", title: "GHN Standard", amount: "32000.00", estimate: "Arrives Oct 3–6" },
] as const;

export const previewPaymentOptions = [
  { id: "card", title: "Credit or debit card", detail: "Visa, Mastercard, JCB · sample payment" },
  { id: "bank", title: "Bank transfer (VietQR)", detail: "Sample bank transfer · no money will be sent" },
] as const;

export const createBuyerPreviewState = (): BuyerPreviewState => ({
  items: sampleItems.map((item) => ({ ...item })), saved: [], coupon: "", couponApplied: false,
  delivery: "express", payment: "bank", selectedAddress: "home",
  addresses: [
    { id: "home", label: "Nguyen Thi Lan · 0912 345 678", line: "127 Nguyen Van Linh, Ward 4, District 7, Ho Chi Minh City", badge: "Default" },
    { id: "office", label: "Nguyen Thi Lan · Office", line: "Saigon Centre, 65 Le Loi, District 1, Ho Chi Minh City", badge: "Office" },
  ],
});

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const shortText = (value: unknown, limit: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= limit;

/** Restore only sample choices. Canonical sample identities, prices and image URLs remain in source. */
export const restoreBuyerPreviewState = (value: unknown): BuyerPreviewState | null => {
  if (!record(value) || !Array.isArray(value.items) || !Array.isArray(value.addresses) || !Array.isArray(value.saved) ||
    value.items.length > sampleItems.length || value.addresses.length < 1 || value.addresses.length > 20 ||
    typeof value.coupon !== "string" || value.coupon.length > 32 || typeof value.couponApplied !== "boolean" ||
    typeof value.delivery !== "string" || !["express", "standard"].includes(value.delivery) ||
    typeof value.payment !== "string" || !["bank", "card"].includes(value.payment) ||
    typeof value.selectedAddress !== "string") return null;
  const items: CartItem[] = [];
  for (const entry of value.items) {
    if (!record(entry) || typeof entry.id !== "string" || !Number.isSafeInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 999) return null;
    const canonical = sampleItems.find(({ id }) => id === entry.id);
    if (!canonical || items.some(({ id }) => id === canonical.id)) return null;
    const quantity = Number(entry.quantity);
    items.push({ ...canonical, quantity, lineTotal: multiplyCartMoney(canonical.unitPrice, quantity) });
  }
  const addresses: PreviewAddress[] = [];
  for (const entry of value.addresses) {
    if (!record(entry) || !shortText(entry.id, 64) || !shortText(entry.label, 100) || !shortText(entry.line, 300) ||
      !shortText(entry.badge, 32) || addresses.some(({ id }) => id === entry.id)) return null;
    addresses.push({ id: entry.id, label: entry.label, line: entry.line, badge: entry.badge });
  }
  if (!addresses.some(({ id }) => id === value.selectedAddress) || !value.saved.every((id) => typeof id === "string" && sampleItems.some((item) => item.id === id))) return null;
  return { items, addresses, saved: [...new Set(value.saved as string[])], selectedAddress: value.selectedAddress,
    coupon: value.coupon, couponApplied: value.couponApplied && value.coupon.trim().toUpperCase() === "NEXUS10",
    delivery: value.delivery as PreviewDelivery, payment: value.payment as PreviewPayment };
};

export const getBuyerPreviewAmounts = (state: BuyerPreviewState) => {
  const subtotal = getCartSubtotal(state.items);
  const shipping = state.items.length ? previewDeliveryOptions.find(({ id }) => id === state.delivery)!.amount : "0.00";
  // Existing cart helpers produce canonical fixed-two-decimal strings. Compute the
  // sample discount/total as integer minor units too, avoiding floating-point money.
  const subtotalCents = BigInt(subtotal.replace(".", ""));
  const discountCents = state.couponApplied ? (subtotalCents < BigInt(6800000) ? subtotalCents : BigInt(6800000)) : BigInt(0);
  const discount = `${discountCents / BigInt(100)}.${String(discountCents % BigInt(100)).padStart(2, "0")}`;
  const beforeDiscount = BigInt(sumCartMoney([subtotal, shipping]).replace(".", ""));
  const totalCents = beforeDiscount - discountCents;
  const total = `${totalCents / BigInt(100)}.${String(totalCents % BigInt(100)).padStart(2, "0")}`;
  return { subtotal, shipping, discount, total, quantity: getCartQuantity(state.items) };
};
