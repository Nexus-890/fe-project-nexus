import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerAuction, SellerAuctionFilters, SellerAuctionInput, SellerAuctionStatus, SellerAuctionUpdate } from "../types/sellerAuctionType";

export const SELLER_AUCTION_STATUSES = ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"] as const satisfies readonly SellerAuctionStatus[];
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const instant = (value: unknown): value is string => typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER / 100 && Number(value.toFixed(2)) === value;
export const isSellerAuctionStatus = (value: unknown): value is SellerAuctionStatus => SELLER_AUCTION_STATUSES.some((status) => status === value);

export const parseSellerAuction = (value: unknown): SellerAuction => {
  if (!isRecord(value) || ![value.id, value.productId, value.skuId, value.sellerId].every(uuid) ||
    typeof value.title !== "string" || !value.title.trim() || (value.imageUrl != null && typeof value.imageUrl !== "string") ||
    ![value.startingPrice, value.currentPrice, value.bidIncrement].every(validMoney) ||
    !Number.isSafeInteger(value.bidCount) || Number(value.bidCount) < 0 || !Number.isSafeInteger(value.extensionCount) || Number(value.extensionCount) < 0 ||
    value.currency !== "VND" || !isSellerAuctionStatus(value.status) || ![value.startAt, value.endAt, value.originalEndAt].every(instant) ||
    Date.parse(String(value.endAt)) <= Date.parse(String(value.startAt)) ||
    (value.cancelledBy != null && value.cancelledBy !== "SELLER" && value.cancelledBy !== "ADMIN") ||
    (value.cancelledReason != null && typeof value.cancelledReason !== "string") ||
    (value.cancelledActorId != null && !uuid(value.cancelledActorId)) || (value.cancelledAt != null && !instant(value.cancelledAt)))
    throw createInvalidResponseError("Invalid seller auction");
  const startingPrice = normalizeMoney(value.startingPrice);
  const currentPrice = normalizeMoney(value.currentPrice);
  const bidIncrement = normalizeMoney(value.bidIncrement);
  if (startingPrice === null || currentPrice === null || bidIncrement === null) throw createInvalidResponseError("Invalid seller auction price");
  return {
    id: String(value.id), productId: String(value.productId), skuId: String(value.skuId), sellerId: String(value.sellerId), title: value.title,
    imageUrl: value.imageUrl == null ? null : value.imageUrl as string,
    startingPrice, currentPrice, bidIncrement,
    bidCount: Number(value.bidCount), currency: "VND", startAt: String(value.startAt), endAt: String(value.endAt), originalEndAt: String(value.originalEndAt),
    extensionCount: Number(value.extensionCount), status: value.status,
    cancelledBy: value.cancelledBy == null ? null : value.cancelledBy as "SELLER" | "ADMIN",
    cancelledReason: value.cancelledReason == null ? null : value.cancelledReason as string,
    cancelledActorId: value.cancelledActorId == null ? null : value.cancelledActorId as string,
    cancelledAt: value.cancelledAt == null ? null : value.cancelledAt as string,
  };
};

export const getSellerAuctions = async (filters: SellerAuctionFilters = {}, options: ServiceRequestOptions = {}): Promise<Page<SellerAuction>> => {
  const { page: number = 0, size = 10, status } = filters;
  if (!Number.isInteger(number) || number < 0 || number > 2147483646 || !Number.isInteger(size) || size < 1 || size > 100 || status !== undefined && !isSellerAuctionStatus(status))
    throw createInvalidResponseError("Invalid seller auction filters");
  const { data, page } = await requestApi("GET", "/api/v1/auctions/mine", undefined, { ...options, auth: true, params: { page: number, size, status } });
  if (!Array.isArray(data) || !page || page.number !== number || page.size !== size) throw createInvalidResponseError("Invalid seller auction page");
  const content = data.map(parseSellerAuction);
  if (new Set(content.map((row) => row.id)).size !== content.length || content.some((row) => status !== undefined && row.status !== status))
    throw createInvalidResponseError("Mismatched seller auction page");
  return { content, page: page.number, size: page.size, totalElements: page.totalElements, totalPages: page.totalPages };
};

export const getSellerAuction = async (id: string, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  if (!uuid(id)) throw createInvalidResponseError("Invalid auction reference");
  // The private list includes drafts/restricted rows; the public detail endpoint does not.
  let number = 0;
  let pages = 1;
  do {
    const result = await getSellerAuctions({ page: number, size: 100 }, options);
    const match = result.content.find((row) => row.id.toLowerCase() === id.toLowerCase());
    if (match) return match;
    pages = result.totalPages;
    number++;
  } while (number < pages);
  throw { kind: "http", status: 404, title: "Auction not found", detail: "This auction is not available in your seller workspace.", code: "AUCTION_NOT_FOUND" };
};

const validateWindow = (body: SellerAuctionUpdate) => {
  if (!validMoney(body.startingPrice) || !validMoney(body.bidIncrement) || !instant(body.startAt) || !instant(body.endAt) || Date.parse(body.endAt) <= Date.parse(body.startAt))
    throw createInvalidResponseError("Enter positive prices with at most two decimals and an end time after the start time.");
};

export const createSellerAuction = async (body: SellerAuctionInput, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  if (!uuid(body.productId) || !uuid(body.skuId)) throw createInvalidResponseError("Choose a valid product and SKU.");
  if (body.bidIncrement == null) {
    if (!validMoney(body.startingPrice) || !instant(body.startAt) || !instant(body.endAt) || Date.parse(body.endAt) <= Date.parse(body.startAt))
      throw createInvalidResponseError("Invalid auction pricing or schedule.");
  } else validateWindow({ ...body, bidIncrement: body.bidIncrement });
  const payload: SellerAuctionInput = { productId: body.productId, skuId: body.skuId, startingPrice: body.startingPrice, bidIncrement: body.bidIncrement, startAt: body.startAt, endAt: body.endAt };
  const { data } = await requestApi("POST", "/api/v1/auctions", payload, { ...options, auth: true });
  const auction = parseSellerAuction(data);
  if (auction.productId !== body.productId || auction.skuId !== body.skuId || auction.status !== "CREATED") throw createInvalidResponseError("Mismatched created auction");
  return auction;
};

export const updateSellerAuction = async (id: string, body: SellerAuctionUpdate, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  if (!uuid(id)) throw createInvalidResponseError("Invalid auction reference");
  validateWindow(body);
  const { data } = await requestApi("PUT", `/api/v1/auctions/${encodeURIComponent(id)}`, { startingPrice: body.startingPrice, bidIncrement: body.bidIncrement, startAt: body.startAt, endAt: body.endAt }, { ...options, auth: true });
  const auction = parseSellerAuction(data);
  if (auction.id !== id) throw createInvalidResponseError("Mismatched updated auction");
  return auction;
};

export const scheduleSellerAuction = async (id: string, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  if (!uuid(id)) throw createInvalidResponseError("Invalid auction reference");
  const { data } = await requestApi("POST", `/api/v1/auctions/${encodeURIComponent(id)}/schedule`, undefined, { ...options, auth: true });
  const auction = parseSellerAuction(data);
  if (auction.id !== id || auction.status !== "SCHEDULED") throw createInvalidResponseError("Mismatched scheduled auction");
  return auction;
};

export const cancelSellerAuction = async (id: string, reason: string, options: ServiceRequestOptions = {}): Promise<SellerAuction> => {
  if (!uuid(id) || !reason.trim() || Array.from(reason.trim()).length > 255) throw createInvalidResponseError("Enter a cancellation reason of 1–255 characters.");
  const { data } = await requestApi("POST", `/api/v1/auctions/${encodeURIComponent(id)}/cancel`, { reason: reason.trim() }, { ...options, auth: true });
  const auction = parseSellerAuction(data);
  if (auction.id !== id || auction.status !== "CANCELLED") throw createInvalidResponseError("Mismatched cancelled auction");
  return auction;
};
