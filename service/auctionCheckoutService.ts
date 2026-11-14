import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { AuctionShippingConfirmation } from "../types/auctionCheckoutType";
import type { CheckoutAddress } from "../types/checkoutType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const isUuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isInstant = (value: unknown): value is string => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));
const parseMoney = (value: unknown): string => {
  const normalized = typeof value === "number" ? normalizeMoney(value) : null;
  if (normalized === null || !/^\d+\.\d{2}$/.test(normalized) ||
    Number(normalized) !== value || BigInt(normalized.replace(".", "")) > BigInt(Number.MAX_SAFE_INTEGER))
    throw createInvalidResponseError("Invalid auction shipping amount");
  return normalized;
};

export const parseAuctionShippingConfirmation = (value: unknown): AuctionShippingConfirmation => {
  if (!isRecord(value) || !isUuid(value.orderGroupId) || !isInstant(value.dueAt))
    throw createInvalidResponseError("Invalid auction shipping confirmation");
  const shippingFee = parseMoney(value.shippingFee);
  const totalAmount = parseMoney(value.totalAmount);
  if (BigInt(shippingFee.replace(".", "")) > BigInt(totalAmount.replace(".", "")))
    throw createInvalidResponseError("Auction shipping exceeds the confirmed total");
  return { orderGroupId: value.orderGroupId, shippingFee, totalAmount, dueAt: value.dueAt };
};

const createShippingBody = (address: CheckoutAddress) => {
  const recipientName = address.recipientName.trim();
  const phoneNumber = address.phoneNumber.trim();
  const addressLine = address.addressLine.trim();
  const provinceCode = address.provinceCode.trim();
  const wardCode = address.wardCode.trim();
  if (!recipientName || recipientName.length > 150 || !addressLine || addressLine.length > 255 ||
    !/^(0[0-9]{9}|\+84[0-9]{9})$/.test(phoneNumber) ||
    !/^[1-9][0-9]{0,8}$/.test(provinceCode) || !/^[1-9][0-9]{0,8}$/.test(wardCode))
    throw createInvalidResponseError("A valid Vietnamese shipping address is required");
  return { recipientName, phoneNumber, addressLine, wardCode, provinceCode, countryCode: "VN" };
};

/** #172 replays an identical address; retries must preserve the submitted address. */
export const confirmAuctionShipping = async (
  orderId: string, address: CheckoutAddress, options: ServiceRequestOptions = {},
): Promise<AuctionShippingConfirmation> => {
  if (!isUuid(orderId)) throw createInvalidResponseError("A valid winning order reference is required");
  const body = createShippingBody(address);
  const { data } = await requestApi<unknown>("POST", `/api/v1/orders/${orderId}/shipping-confirmation`, body, {
    ...options, auth: true, params: undefined,
  });
  return parseAuctionShippingConfirmation(data);
};
