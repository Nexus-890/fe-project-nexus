import { AxiosHeaders } from "axios";
import {
  createInvalidResponseError,
  isApiError,
  isRecord,
  requestApi,
} from "../configs/api";
import { multiplyCartMoney, sumCartMoney } from "../features/cartUtils";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiResponse } from "../types/commonResponseType";
import type { components } from "../types/commerceGeneratedType";
import type {
  CheckoutConflict,
  CheckoutDestination,
  CheckoutIssue,
  CheckoutOrder,
  CheckoutOrderGroup,
  CheckoutOrderItem,
  CheckoutPreview,
  CheckoutPreviewItem,
  ShippingLocality,
} from "../types/checkoutType";

// #201 is not delivered yet. These code/name list contracts are provisional.
export const PROVINCES_PATH = "/api/v1/shipping/provinces";
export const DISTRICTS_PATH = "/api/v1/shipping/districts";
export const WARDS_PATH = "/api/v1/shipping/wards";
// Preview follows the delivered #188 contract; locality codes remain a #201 dependency.
export const CHECKOUT_PREVIEW_PATH = "/api/v1/checkout/preview";
export const PLACE_ORDER_PATH = "/api/v1/orders";

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

const createOrderBody = (
  destination: CheckoutDestination,
): components["schemas"]["CreateOrder"] => {
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
  return {
    // Commerce #138 accepts GHN locality codes; names remain form display data.
    shippingAddress: {
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      addressLine: addressLine.trim(),
      provinceCode: provinceCode.trim(),
      wardCode: wardCode.trim(),
      countryCode,
    },
    paymentMethod: "SEPAY",
  };
};

export const getCheckoutPreview = async (
  destination: CheckoutDestination,
  options: ServiceRequestOptions = {},
): Promise<CheckoutPreview> => {
  const { data } = await requestApi<unknown>(
    "POST",
    CHECKOUT_PREVIEW_PATH,
    createOrderBody(destination),
    { ...options, auth: true, params: undefined },
  );
  return parseCheckoutPreview(data);
};

const isDateTime = (value: unknown): value is string =>
  isNonBlankString(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

const parseOrderItem = (value: unknown): CheckoutOrderItem => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.orderItemId) ||
    !isNonBlankString(value.productId) ||
    !isNonBlankString(value.skuId) ||
    !isNonBlankString(value.productName) ||
    !isNonBlankString(value.skuCode) ||
    (value.imageUrl !== null && typeof value.imageUrl !== "string") ||
    !Number.isSafeInteger(value.quantity) ||
    Number(value.quantity) < 1
  )
    throw createInvalidResponseError("Invalid order item");
  return {
    orderItemId: value.orderItemId,
    productId: value.productId,
    skuId: value.skuId,
    productName: value.productName,
    skuCode: value.skuCode,
    imageUrl: value.imageUrl,
    quantity: value.quantity as number,
    unitPrice: parseMoney(value.unitPrice),
    totalPrice: parseMoney(value.totalPrice),
  };
};

const orderStatuses = new Set<components["schemas"]["OrderStatus"]>([
  "PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED",
  "REFUND_REQUESTED", "REFUNDED",
]);
const isOrderStatus = (value: unknown): value is components["schemas"]["OrderStatus"] =>
  typeof value === "string" && orderStatuses.has(value as components["schemas"]["OrderStatus"]);

const parseOrder = (value: unknown): CheckoutOrder => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.orderId) ||
    !isNonBlankString(value.orderNumber) ||
    !isNonBlankString(value.userId) ||
    !isNonBlankString(value.sellerId) ||
    (value.orderType !== "STANDARD" && value.orderType !== "AUCTION") ||
    !isOrderStatus(value.status) ||
    !isDateTime(value.createdAt) ||
    !Array.isArray(value.items) ||
    value.items.length === 0
  )
    throw createInvalidResponseError("Invalid seller order");
  const items = value.items.map(parseOrderItem);
  if (new Set(items.map((item) => item.orderItemId)).size !== items.length)
    throw createInvalidResponseError("Duplicate order item");
  return {
    orderId: value.orderId,
    orderNumber: value.orderNumber,
    userId: value.userId,
    sellerId: value.sellerId,
    orderType: value.orderType,
    status: value.status,
    createdAt: value.createdAt,
    totalAmount: parseMoney(value.totalAmount),
    items,
  };
};

export const parseCheckoutOrderGroup = (value: unknown): CheckoutOrderGroup => {
  if (
    !isRecord(value) ||
    !isNonBlankString(value.orderGroupId) ||
    !isNonBlankString(value.status) ||
    !isNonBlankString(value.currency) ||
    !isDateTime(value.dueAt) ||
    !Array.isArray(value.orders) ||
    value.orders.length === 0
  )
    throw createInvalidResponseError("Invalid order group");
  const orders = value.orders.map(parseOrder);
  const totalAmount = parseMoney(value.totalAmount);
  if (
    new Set(orders.map((order) => order.orderId)).size !== orders.length ||
    sumCartMoney(orders.map((order) => order.totalAmount)) !== totalAmount
  )
    throw createInvalidResponseError("Invalid order group totals or orders");
  return {
    orderGroupId: value.orderGroupId,
    status: value.status,
    totalAmount,
    currency: value.currency,
    dueAt: value.dueAt,
    orders,
  };
};

/** Only validated conflict properties become actionable checkout feedback. */
export const parseCheckoutConflict = (error: unknown): CheckoutConflict | null => {
  if (!isApiError(error) || error.kind !== "http" || error.status !== 409)
    return null;
  const properties = isRecord(error.extensions) ? error.extensions : {};
  if (error.code === "COMMERCE_PRICE_CHANGED" && isNonBlankString(properties.skuId)) {
    try {
      return {
        kind: "price-changed",
        skuId: properties.skuId,
        oldPrice: parseMoney(properties.oldPrice),
        newPrice: parseMoney(properties.newPrice),
        detail: error.detail,
      };
    } catch {
      return null;
    }
  }
  // #151's stock failure is provisional until real reservations deliver its DTO.
  if (error.code === "COMMERCE_INSUFFICIENT_STOCK")
    return {
      kind: "insufficient-stock",
      skuId: isNonBlankString(properties.skuId) ? properties.skuId : undefined,
      productName: isNonBlankString(properties.productName) ? properties.productName : undefined,
      detail: error.detail,
    };
  return null;
};

export const placeOrder = async (
  destination: CheckoutDestination,
  idempotencyKey: string,
  options: ServiceRequestOptions = {},
): Promise<CheckoutOrderGroup> => {
  if (idempotencyKey.length !== 36 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey))
    throw createInvalidResponseError("Idempotency-Key must be a UUID");
  const headers = new AxiosHeaders(options.config?.headers);
  headers.set("Idempotency-Key", idempotencyKey, true);
  const { data } = await requestApi<unknown>(
    "POST",
    PLACE_ORDER_PATH,
    createOrderBody(destination),
    {
      ...options,
      auth: true,
      params: undefined,
      config: { ...options.config, headers },
    },
  );
  // The backend returns the same group for 201 creation and 200 idempotent replay.
  return parseCheckoutOrderGroup(data);
};
