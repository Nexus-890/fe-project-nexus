import {
  createInvalidResponseError,
  isRecord,
  requestApi,
} from "../configs/api";
import { multiplyCartMoney, sumCartMoney } from "../features/cartUtils";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiResponse } from "../types/commonResponseType";
import type {
  CheckoutDestination,
  CheckoutIssue,
  CheckoutPreview,
  CheckoutPreviewItem,
  ShippingLocality,
} from "../types/checkoutType";

// #201 is not delivered yet. These code/name list contracts are provisional.
export const PROVINCES_PATH = "/api/v1/shipping/provinces";
export const DISTRICTS_PATH = "/api/v1/shipping/districts";
export const WARDS_PATH = "/api/v1/shipping/wards";
// Request/response follow the unmerged #188 DTOs, not a delivered OpenAPI DTO.
export const CHECKOUT_PREVIEW_PATH = "/api/v1/checkout/preview";

const isNonBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const parseShippingLocalities = (
  response: ApiResponse<unknown>,
): ShippingLocality[] => {
  if (!response.page || !Array.isArray(response.data))
    throw createInvalidResponseError("Expected shipping data[] with page metadata");
  const codes = new Set<string>();
  return response.data.map((entry) => {
    if (
      !isRecord(entry) ||
      !isNonBlankString(entry.code) ||
      !isNonBlankString(entry.name) ||
      codes.has(entry.code)
    )
      throw createInvalidResponseError("Invalid shipping locality");
    codes.add(entry.code);
    return { code: entry.code, name: entry.name };
  });
};

export const getProvinces = async (
  options: ServiceRequestOptions = {},
): Promise<ShippingLocality[]> => {
  const response = await requestApi<unknown>("GET", PROVINCES_PATH, undefined, {
    ...options,
    auth: true,
    params: undefined,
  });
  return parseShippingLocalities(response);
};

export const getDistricts = async (
  provinceCode: string,
  options: ServiceRequestOptions = {},
): Promise<ShippingLocality[]> => {
  if (!isNonBlankString(provinceCode))
    throw createInvalidResponseError("provinceCode is required");
  const response = await requestApi<unknown>("GET", DISTRICTS_PATH, undefined, {
    ...options,
    auth: true,
    params: { provinceCode },
  });
  return parseShippingLocalities(response);
};

export const getWards = async (
  districtCode: string,
  options: ServiceRequestOptions = {},
): Promise<ShippingLocality[]> => {
  if (!isNonBlankString(districtCode))
    throw createInvalidResponseError("districtCode is required");
  const response = await requestApi<unknown>("GET", WARDS_PATH, undefined, {
    ...options,
    auth: true,
    params: { districtCode },
  });
  return parseShippingLocalities(response);
};

const parseMoney = (value: unknown): string => {
  const money = typeof value === "number" ? normalizeMoney(value) : null;
  // Reject precision loss rather than silently rounding a draft numeric amount.
  if (
    money === null ||
    !/^\d+\.\d{2}$/.test(money) ||
    Number(money) !== value ||
    BigInt(money.replace(".", "")) > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw createInvalidResponseError("Invalid checkout amount");
  return money;
};

const parsePreviewItem = (value: unknown): CheckoutPreviewItem => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.itemId) ||
    !isNonBlankString(value.productId) ||
    !isNonBlankString(value.skuId) ||
    !Number.isSafeInteger(value.quantity) ||
    Number(value.quantity) < 1
  )
    throw createInvalidResponseError("Invalid checkout item");
  return {
    itemId: value.itemId,
    productId: value.productId,
    skuId: value.skuId,
    quantity: value.quantity as number,
    unitPrice: parseMoney(value.unitPrice),
    lineTotal: parseMoney(value.lineTotal),
  };
};

const parseCheckoutIssue = (value: unknown): CheckoutIssue => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.itemId) ||
    !isNonBlankString(value.skuId) ||
    (value.code !== "OUT_OF_STOCK" &&
      value.code !== "PRICE_CHANGED" &&
      value.code !== "PRODUCT_INACTIVE")
  )
    throw createInvalidResponseError("Invalid checkout issue");
  return { itemId: value.itemId, skuId: value.skuId, code: value.code };
};

export const parseCheckoutPreview = (value: unknown): CheckoutPreview => {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.issues))
    throw createInvalidResponseError("Invalid checkout preview");
  const preview: CheckoutPreview = {
    items: value.items.map(parsePreviewItem),
    subtotal: parseMoney(value.subtotal),
    shippingFee: value.shippingFee === null ? null : parseMoney(value.shippingFee),
    taxAmount: parseMoney(value.taxAmount),
    discountAmount: parseMoney(value.discountAmount),
    total: parseMoney(value.total),
    issues: value.issues.map(parseCheckoutIssue),
  };
  if (
    new Set(preview.items.map((item) => item.itemId)).size !== preview.items.length ||
    preview.items.some((item) =>
      multiplyCartMoney(item.unitPrice, item.quantity) !== item.lineTotal) ||
    sumCartMoney(preview.items.map((item) => item.lineTotal)) !== preview.subtotal ||
    (preview.shippingFee !== null &&
      sumCartMoney([preview.subtotal, preview.shippingFee, preview.taxAmount]) !==
        sumCartMoney([preview.total, preview.discountAmount]))
  )
    throw createInvalidResponseError("Checkout amounts do not reconcile");
  return preview;
};

export const getCheckoutPreview = async (
  destination: CheckoutDestination,
  options: ServiceRequestOptions = {},
): Promise<CheckoutPreview> => {
  const {
    recipientName, phoneNumber, addressLine, provinceCode, districtCode, wardCode,
    city, district, ward, countryCode,
  } = destination;
  if (
    ![recipientName, phoneNumber, addressLine, provinceCode, districtCode, wardCode,
      city, district, ward].every(isNonBlankString) ||
    countryCode !== "VN"
  )
    throw createInvalidResponseError("A complete shipping address is required");
  const { data } = await requestApi<unknown>(
    "POST",
    CHECKOUT_PREVIEW_PATH,
    {
      // #188 currently accepts names, while the form retains GHN codes for #151.
      shippingAddress: {
        recipientName: recipientName.trim(),
        phoneNumber: phoneNumber.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        district: district.trim(),
        ward: ward.trim(),
        countryCode,
      },
      paymentMethod: "SEPAY",
    },
    { ...options, auth: true, params: undefined },
  );
  return parseCheckoutPreview(data);
};
