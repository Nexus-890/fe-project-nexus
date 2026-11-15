import { AxiosHeaders } from "axios";
import { createInvalidResponseError, isApiError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { AuctionListing } from "../types/auctionListingType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiResponse, Page } from "../types/commonResponseType";
import type {
  AuctionBid, AuctionBidInput, AuctionRoom, AuctionState, AuctionStatus,
  MyAuctionBid, PlacedAuctionBid,
} from "../types/auctionRoomType";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" && INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);
const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const isStatus = (value: unknown): value is AuctionStatus =>
  typeof value === "string" && ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"].includes(value);
const requireAuctionId = (id: string) => {
  if (!isUuid(id)) throw createInvalidResponseError("A valid auction reference is required");
};
export const parseAuctionMoney = (value: unknown): string => {
  const normalized = typeof value === "number" ? normalizeMoney(value) : null;
  if (normalized === null || !/^\d+\.\d{2}$/.test(normalized) ||
    Number(normalized) !== value || BigInt(normalized.replace(".", "")) > BigInt(Number.MAX_SAFE_INTEGER))
    throw createInvalidResponseError("Invalid auction amount");
  return normalized;
};

export const parseAuctionRoom = (value: unknown): AuctionRoom => {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.productId) ||
    !isUuid(value.skuId) || !isUuid(value.sellerId) || typeof value.title !== "string" ||
    !value.title.trim() || typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency) ||
    (value.imageUrl != null && typeof value.imageUrl !== "string") ||
    !isInstant(value.startAt) || !isInstant(value.endAt) || !isInstant(value.originalEndAt) ||
    !isCount(value.bidCount) || !isCount(value.extensionCount) || !isStatus(value.status) ||
    (value.cancelledBy != null && value.cancelledBy !== "SELLER" && value.cancelledBy !== "ADMIN") ||
    (value.cancelledReason != null && typeof value.cancelledReason !== "string"))
    throw createInvalidResponseError("Invalid auction detail");
  const bidIncrement = parseAuctionMoney(value.bidIncrement);
  if (Number(bidIncrement) <= 0) throw createInvalidResponseError("Invalid auction increment");
  return {
    id: value.id, productId: value.productId, skuId: value.skuId, sellerId: value.sellerId,
    title: value.title, imageUrl: value.imageUrl ?? null, currency: value.currency,
    startingPrice: parseAuctionMoney(value.startingPrice), bidIncrement,
    currentPrice: parseAuctionMoney(value.currentPrice), bidCount: value.bidCount,
    startAt: value.startAt, endAt: value.endAt, originalEndAt: value.originalEndAt,
    extensionCount: value.extensionCount, status: value.status,
    cancelledBy: value.cancelledBy ?? null, cancelledReason: value.cancelledReason ?? null,
  };
};

export const getAuction = async (id: string, options: ServiceRequestOptions = {}): Promise<AuctionRoom> => {
  requireAuctionId(id);
  const { data } = await requestApi<unknown>("GET", `/api/v1/auctions/${id}`, undefined, {
    ...options, auth: false, params: undefined,
  });
  const auction = parseAuctionRoom(data);
  if (auction.id !== id) throw createInvalidResponseError("Auction reference does not match");
  return auction;
};

/** Delivered state contract; also validates state snapshots received over SSE. */
export const parseAuctionState = (
  value: unknown, startedAt = performance.now(), receivedAt = performance.now(),
): AuctionState => {
  if (!isRecord(value) || !isUuid(value.auctionId) || !isCount(value.bidCount) ||
    !isStatus(value.status) || !isInstant(value.endAt) || !isInstant(value.serverTime) ||
    (value.leaderBidderName !== null && typeof value.leaderBidderName !== "string") ||
    !Number.isFinite(startedAt) || !Number.isFinite(receivedAt) || receivedAt < startedAt)
    throw createInvalidResponseError("Invalid auction state or server time");
  const bidIncrement = parseAuctionMoney(value.bidIncrement);
  if (Number(bidIncrement) <= 0) throw createInvalidResponseError("Invalid auction increment");
  return {
    auctionId: value.auctionId, currentPrice: parseAuctionMoney(value.currentPrice),
    bidIncrement, bidCount: value.bidCount, leaderBidderName: value.leaderBidderName,
    endAt: value.endAt, status: value.status, serverTime: value.serverTime, receivedAt,
    // The full request duration is a conservative allowance for network delay.
    remainingMs: Math.max(0, Date.parse(value.endAt) - Date.parse(value.serverTime) - (receivedAt - startedAt)),
  };
};

export const getAuctionState = async (id: string, options: ServiceRequestOptions = {}): Promise<AuctionState> => {
  requireAuctionId(id);
  const startedAt = performance.now();
  const { data } = await requestApi<unknown>("GET", `/api/v1/auctions/${id}/state`, undefined, {
    ...options, auth: false, params: undefined,
  });
  const state = parseAuctionState(data, startedAt, performance.now());
  if (state.auctionId !== id) throw createInvalidResponseError("Auction state reference does not match");
  return state;
};

export const parseAuctionPage = <T>(response: ApiResponse<unknown>, page: number, parse: (value: unknown) => T): Page<T> => {
  if (!Array.isArray(response.data) || !response.page || response.page.number !== page)
    throw createInvalidResponseError("Invalid auction page");
  const metadata = response.page;
  if (response.data.length > metadata.size || response.data.length > metadata.totalElements)
    throw createInvalidResponseError("Invalid auction page totals");
  return { content: response.data.map(parse), page: metadata.number, size: metadata.size,
    totalElements: metadata.totalElements, totalPages: metadata.totalPages };
};

const requirePage = (page: number) => {
  if (!isCount(page)) throw createInvalidResponseError("Invalid auction page number");
};

export const getAuctionBids = async (
  id: string, page = 0, options: ServiceRequestOptions = {},
): Promise<Page<AuctionBid>> => {
  requireAuctionId(id);
  requirePage(page);
  const response = await requestApi<unknown>("GET", `/api/v1/auctions/${id}/bids`, undefined, {
    ...options, auth: false, params: { page, size: 10 },
  });
  return parseAuctionPage(response, page, (value) => {
    if (!isRecord(value) || typeof value.bidderName !== "string" || !value.bidderName.trim() || !isInstant(value.placedAt))
      throw createInvalidResponseError("Invalid auction bid history");
    return { amount: parseAuctionMoney(value.amount), bidderName: value.bidderName, placedAt: value.placedAt };
  });
};

const parseMyAuctionBid = (value: unknown): MyAuctionBid => {
  if (!isRecord(value) || !isUuid(value.auctionId) || typeof value.title !== "string" ||
    !isInstant(value.placedAt) || !isStatus(value.auctionStatus) ||
    typeof value.leading !== "boolean" || typeof value.won !== "boolean" ||
    (value.won && !["WON", "SETTLED", "PAYMENT_TIMEOUT"].includes(value.auctionStatus)) ||
    (value.won && value.orderId != null && !isUuid(value.orderId)) ||
    (value.won && value.paymentDueAt != null && !isInstant(value.paymentDueAt)))
    throw createInvalidResponseError("Invalid personal auction bid");
  return { auctionId: value.auctionId, title: value.title, amount: parseAuctionMoney(value.amount),
    placedAt: value.placedAt, auctionStatus: value.auctionStatus, leading: value.leading, won: value.won,
    // Older responses remain readable; a loser can never authorize a checkout
    // even if an incompatible response accidentally includes private fields.
    orderId: value.won && isUuid(value.orderId) ? value.orderId : null,
    paymentDueAt: value.won && isInstant(value.paymentDueAt) ? value.paymentDueAt : null,
    finalPrice: value.won && value.finalPrice != null ? parseAuctionMoney(value.finalPrice) : null,
  };
};

export const getAuctions = async (
  status: "ACTIVE" | "SCHEDULED" | "ENDED", page = 0, options: ServiceRequestOptions = {},
): Promise<Page<AuctionRoom>> => {
  requirePage(page);
  if (!["ACTIVE", "SCHEDULED", "ENDED"].includes(status))
    throw createInvalidResponseError("Invalid auction list status");
  const response = await requestApi<unknown>("GET", "/api/v1/auctions", undefined, {
    ...options, auth: false, params: { status, page, size: 8 },
  });
  return parseAuctionPage(response, page, (value) => {
    const auction = parseAuctionRoom(value);
    if (auction.status !== status) throw createInvalidResponseError("Auction list status does not match");
    return auction;
  });
};

export const getMyAuctionBids = async (
  page = 0, options: ServiceRequestOptions = {},
): Promise<Page<MyAuctionBid>> => {
  requirePage(page);
  const response = await requestApi<unknown>("GET", "/api/v1/bids/mine", undefined, {
    ...options, auth: true, params: { page, size: 10 },
  });
  return parseAuctionPage(response, page, parseMyAuctionBid);
};

export const getMyAuctionBid = async (
  id: string, options: ServiceRequestOptions = {},
): Promise<MyAuctionBid | null> => {
  requireAuctionId(id);
  let page = 0;
  let totalPages = 1;
  // The delivered API has no auction filter. Never assume an absent first-page row means a lost auction.
  do {
    const response = await requestApi<unknown>("GET", "/api/v1/bids/mine", undefined, {
      ...options, auth: true, params: { page, size: 100 },
    });
    const result = parseAuctionPage(response, page, parseMyAuctionBid);
    const ownBid = result.content.find((bid) => bid.auctionId === id);
    if (ownBid) return ownBid;
    totalPages = result.totalPages;
    page += 1;
  } while (page < totalPages);
  return null;
};

export const placeAuctionBid = async (
  id: string, input: AuctionBidInput, options: ServiceRequestOptions = {},
): Promise<PlacedAuctionBid> => {
  requireAuctionId(id);
  if (!isUuid(input.idempotencyKey) || !/^\d+(?:\.\d{1,2})?$/.test(input.amount))
    throw createInvalidResponseError("A valid bid amount and Idempotency-Key are required");
  const amount = Number(input.amount);
  const normalized = parseAuctionMoney(amount);
  if (amount <= 0 || BigInt(normalized.replace(".", "")) !== BigInt(input.amount.split(".")[0]) * BigInt(100) + BigInt((input.amount.split(".")[1] ?? "").padEnd(2, "0")))
    throw createInvalidResponseError("Invalid bid amount or precision");
  const headers = new AxiosHeaders(options.config?.headers);
  headers.set("Idempotency-Key", input.idempotencyKey, true);
  const { data } = await requestApi<unknown>("POST", `/api/v1/auctions/${id}/bids`, { amount }, {
    ...options, auth: true, params: undefined, config: { ...options.config, headers },
  });
  if (!isRecord(data) || !isUuid(data.bidId) || !isUuid(data.leaderBidderId))
    throw createInvalidResponseError("Invalid placed bid");
  return { bidId: data.bidId, currentPrice: parseAuctionMoney(data.currentPrice), leaderBidderId: data.leaderBidderId };
};

/** Only the named low-bid problem can change the form's actionable minimum. */
export const parseAuctionBidMinimum = (error: unknown): string | null => {
  if (!isApiError(error) || error.kind !== "http" || error.status !== 400 || error.code !== "AUCTION_BID_TOO_LOW")
    return null;
  try {
    return parseAuctionMoney(error.extensions?.minimum);
  } catch {
    return null;
  }
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
