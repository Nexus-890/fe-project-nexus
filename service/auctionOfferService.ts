import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { parseAuctionMoney, parseAuctionPage } from "./auctionService";
import type { AuctionOffer } from "../types/auctionOfferType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";

const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isInstant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export const parseAuctionOffer = (value: unknown): AuctionOffer => {
  if (!isRecord(value) || !isUuid(value.id) || !isUuid(value.auctionId) ||
    typeof value.title !== "string" || !value.title.trim() ||
    (value.imageUrl !== null && typeof value.imageUrl !== "string") ||
    typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency) ||
    typeof value.status !== "string" || !["OFFERED", "ACCEPTED", "DECLINED", "EXPIRED"].includes(value.status) ||
    !isInstant(value.offeredAt) || !isInstant(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.offeredAt) ||
    (value.orderId !== null && !isUuid(value.orderId)) ||
    (value.paymentDueAt !== null && !isInstant(value.paymentDueAt)))
    throw createInvalidResponseError("Invalid second chance offer");
  const amount = parseAuctionMoney(value.amount);
  if (Number(amount) <= 0 || (value.status === "ACCEPTED" && !value.paymentDueAt))
    throw createInvalidResponseError("Invalid accepted offer or amount");
  return {
    id: value.id, auctionId: value.auctionId, title: value.title, imageUrl: value.imageUrl,
    currency: value.currency, amount, status: value.status as AuctionOffer["status"],
    offeredAt: value.offeredAt, expiresAt: value.expiresAt,
    orderId: value.orderId, paymentDueAt: value.paymentDueAt,
  };
};

/** Reviewer-specified #208 route; never derives or creates an offer on a read. */
export const getMyAuctionOffers = async (page = 0, options: ServiceRequestOptions = {}): Promise<Page<AuctionOffer>> => {
  if (!Number.isSafeInteger(page) || page < 0) throw createInvalidResponseError("Invalid offer page");
  const response = await requestApi<unknown>("GET", "/api/v1/auctions/offers/me", undefined, {
    ...options, auth: true, params: { page, size: 10 },
  });
  return parseAuctionPage(response, page, parseAuctionOffer);
};

export const respondToAuctionOffer = async (
  auctionId: string, offerId: string, action: "accept" | "decline", options: ServiceRequestOptions = {},
): Promise<AuctionOffer> => {
  if (!isUuid(auctionId) || !isUuid(offerId) || !["accept", "decline"].includes(action))
    throw createInvalidResponseError("Invalid offer response");
  const { data } = await requestApi<unknown>("POST", `/api/v1/auctions/offers/${offerId}/${action}`, undefined, {
    ...options, auth: true, params: undefined,
  });
  const offer = parseAuctionOffer(data);
  if (offer.id !== offerId || offer.auctionId !== auctionId || offer.status !== (action === "accept" ? "ACCEPTED" : "DECLINED"))
    throw createInvalidResponseError("Offer response does not match");
  return offer;
};
