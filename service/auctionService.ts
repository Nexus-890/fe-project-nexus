import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { AuctionDetail, AuctionListing } from "../types/auctionListingType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const isInstant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const statuses = ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON", "SETTLED", "FAILED", "CANCELLED", "PAYMENT_TIMEOUT"];

export const getAuction = async (id: string, options: ServiceRequestOptions = {}): Promise<AuctionDetail> => {
  if (!isId(id)) throw createInvalidResponseError("A valid auction identifier is required");
  const { data } = await requestApi<unknown>("GET", `/api/v1/auctions/${encodeURIComponent(id)}`, undefined, {
    ...options, auth: false, params: undefined,
  });
  if (!isRecord(data) || !isId(data.id) || data.id.toLowerCase() !== id.toLowerCase() ||
    !isId(data.productId) || !isId(data.skuId) || !isId(data.sellerId) ||
    typeof data.title !== "string" || !data.title.trim() ||
    (data.imageUrl != null && typeof data.imageUrl !== "string") ||
    !isInstant(data.startAt) || !isInstant(data.endAt) || !isInstant(data.originalEndAt) ||
    !Number.isSafeInteger(data.bidCount) || Number(data.bidCount) < 0 ||
    !Number.isSafeInteger(data.extensionCount) || Number(data.extensionCount) < 0 ||
    !statuses.includes(String(data.status)) || data.currency !== "VND") {
    throw createInvalidResponseError("Invalid auction details");
  }
  const startingPrice = normalizeMoney(data.startingPrice);
  const bidIncrement = normalizeMoney(data.bidIncrement);
  const currentPrice = normalizeMoney(data.currentPrice);
  if (startingPrice === null || bidIncrement === null || currentPrice === null || Number(bidIncrement) <= 0)
    throw createInvalidResponseError("Invalid auction prices");
  return {
    id: data.id, productId: data.productId, skuId: data.skuId, sellerId: data.sellerId,
    title: data.title, imageUrl: data.imageUrl as string | null | undefined,
    startAt: data.startAt, endAt: data.endAt, originalEndAt: data.originalEndAt,
    status: data.status as AuctionDetail["status"], currency: "VND", startingPrice, bidIncrement, currentPrice,
    bidCount: Number(data.bidCount), extensionCount: Number(data.extensionCount),
  };
};

export const getActiveAuctions = async (
  options: ServiceRequestOptions = {},
): Promise<AuctionListing[]> => {
  const { data, page } = await requestApi<unknown>("GET", "/api/v1/auctions", undefined, {
    ...options,
    auth: false,
    params: { status: "ACTIVE", page: 0, size: 5 },
  });
  if (!Array.isArray(data) || !page) throw createInvalidResponseError("Invalid auction list");
  return data.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.productId !== "string" ||
      typeof item.title !== "string" || typeof item.currency !== "string" ||
      typeof item.endAt !== "string" || !Number.isFinite(Date.parse(item.endAt)) ||
      !Number.isInteger(item.bidCount) || (item.bidCount as number) < 0 ||
      (item.imageUrl !== null && typeof item.imageUrl !== "string")) {
      throw createInvalidResponseError("Invalid auction");
    }
    const currentBid = normalizeMoney(item.currentPrice);
    if (currentBid === null) throw createInvalidResponseError("Invalid auction price");
    return {
      auctionId: item.id, productId: item.productId, name: item.title,
      sellerId: typeof item.sellerId === "string" ? item.sellerId : undefined,
      imageUrl: item.imageUrl ?? undefined, currentBid,
      bidCount: item.bidCount as number, currency: item.currency, closesAt: item.endAt,
    };
  }).sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt));
};
