import { z } from "zod";
import type { AddressBookInput } from "../types/addressBookType";
import type { CheckoutAddress, ShippingLocality } from "../types/checkoutType";
import type { ApiError } from "../types/commonResponseType";
import { checkoutSchema, getCheckoutFieldErrors, type CheckoutErrors } from "./checkoutSchema";

/** #210 AddressRequest limits; checkout keeps its separate order contract. */
export const addressBookSchema = checkoutSchema.extend({
  phoneNumber: z.string().trim().transform((phone) => phone.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, "Enter a phone number with 7–15 digits")),
  addressLine: z.string().trim().min(1, "House number and street is required").max(255, "Use 255 characters or fewer"),
  provinceCode: z.string().trim().regex(/^[1-9][0-9]{0,8}$/, "Choose a valid province / city"),
  wardCode: z.string().trim().regex(/^[1-9][0-9]{0,8}$/, "Choose a valid ward"),
});

export const validateAddressBookAddress = (values: CheckoutAddress): CheckoutErrors => {
  const parsed = addressBookSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: CheckoutErrors = {};
  for (const issue of parsed.error.issues) errors[issue.path[0] as keyof CheckoutAddress] ??= issue.message;
  return errors;
};

export const getAddressBookInput = (
  values: CheckoutAddress,
  provinces: readonly ShippingLocality[],
  wards: readonly ShippingLocality[],
  isDefault: boolean,
): AddressBookInput | null => {
  const parsed = addressBookSchema.safeParse(values);
  if (!parsed.success) return null;
  const province = provinces.find((entry) => entry.code === parsed.data.provinceCode);
  const ward = wards.find((entry) => entry.code === parsed.data.wardCode);
  if (!province?.name.trim() || province.name.trim().length > 100 || !ward?.name.trim() || ward.name.trim().length > 100) return null;
  return { ...parsed.data, provinceName: province.name.trim(), wardName: ward.name.trim(), isDefault };
};

export const getAddressBookFieldErrors = (error: ApiError | null): CheckoutErrors => {
  const errors = getCheckoutFieldErrors(error);
  if (error?.code === "VALIDATION_FAILED") {
    const phone = error.errors?.find((entry) => entry.field === "phone");
    if (phone) errors.phoneNumber = phone.detail;
  }
  return errors;
};
