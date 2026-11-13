import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { AuctionListing } from "../types/auctionListingType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

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
