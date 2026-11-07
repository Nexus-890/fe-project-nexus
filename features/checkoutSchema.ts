import { z } from "zod";
import type { CheckoutAddress, CheckoutDestination, CheckoutPreview, ShippingLocality } from "../types/checkoutType";
import type { CartItem } from "../types/cartResponseType";
import type { ApiError } from "../types/commonResponseType";
import { getCartSubtotal, multiplyCartMoney } from "./cartUtils";

export const checkoutSchema = z.object({
  recipientName: z.string().trim().min(1, "Recipient name is required").max(150, "Use 150 characters or fewer"),
  phoneNumber: z.string().trim().min(1, "Phone number is required")
    .regex(/^[+\d][\d\s()-]{6,19}$/, "Enter a valid phone number")
    .refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 8 && digits.length <= 15; }, "Enter a valid phone number"),
  addressLine: z.string().trim().min(1, "Address line is required").max(500, "Use 500 characters or fewer"),
  provinceCode: z.string().trim().min(1, "Province / City is required"),
  districtCode: z.string().trim().min(1, "District is required"),
  wardCode: z.string().trim().min(1, "Ward is required"),
});

export type CheckoutErrors = Partial<Record<keyof CheckoutAddress, string>>;
export const validateCheckoutAddress = (values: CheckoutAddress): CheckoutErrors => {
  const parsed = checkoutSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: CheckoutErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof CheckoutAddress;
    errors[field] ??= issue.message;
  }
  return errors;
};

/** Names are only preview compatibility fields; the buyer's three GHN codes stay in state. */
export const getCheckoutDestination = (
  values: CheckoutAddress,
  provinces: readonly ShippingLocality[],
  districts: readonly ShippingLocality[],
  wards: readonly ShippingLocality[],
): CheckoutDestination | null => {
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) return null;
  const province = provinces.find((item) => item.code === parsed.data.provinceCode);
  const district = districts.find((item) => item.code === parsed.data.districtCode);
  const ward = wards.find((item) => item.code === parsed.data.wardCode);
  if (!province || !district || !ward) return null;
  return { ...parsed.data, city: province.name, district: district.name, ward: ward.name, countryCode: "VN" };
};

export const getCheckoutFieldErrors = (error: ApiError | null): CheckoutErrors => {
  const result: CheckoutErrors = {};
  if (error?.code !== "VALIDATION_FAILED") return result;
  const aliases: Record<string, keyof CheckoutAddress> = {
    recipientName: "recipientName", phoneNumber: "phoneNumber", addressLine: "addressLine",
    provinceCode: "provinceCode", districtCode: "districtCode", wardCode: "wardCode",
    city: "provinceCode", district: "districtCode", ward: "wardCode",
  };
  for (const entry of error.errors ?? []) {
    const name = entry.field.replace(/^shippingAddress\./, "");
    const field = Object.hasOwn(aliases, name) ? aliases[name] : undefined;
    if (field) result[field] ??= entry.detail;
  }
  return result;
};

/** A quote for a different cart must never appear as this checkout's payable total. */
export const previewMatchesCart = (preview: CheckoutPreview, items: readonly CartItem[]): boolean =>
  preview.items.length === items.length && preview.subtotal === getCartSubtotal(items) &&
  items.every((item) => preview.items.some((line) =>
    line.itemId === item.id && line.productId === item.productId && line.skuId === item.skuId &&
    line.quantity === item.quantity && line.unitPrice === multiplyCartMoney(item.unitPrice, 1) &&
    line.lineTotal === multiplyCartMoney(item.unitPrice, item.quantity),
  ));
