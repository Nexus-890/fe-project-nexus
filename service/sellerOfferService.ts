import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerOffer, SellerOfferCandidate, SellerOfferState, SellerOfferStatus } from "../types/sellerOfferType";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const invalid = () => createInvalidResponseError("Invalid second-chance offer response");

const parseCandidate = (value: unknown): SellerOfferCandidate => {
  if (!isRecord(value) || !validId(value.bidderId) || typeof value.displayName !== "string" || !value.displayName.trim() ||
    typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount >= 1e17 || Number(value.amount.toFixed(2)) !== value.amount) throw invalid();
  const amount = normalizeMoney(value.amount);
  if (amount === null) throw invalid();
  return { bidderId: value.bidderId, displayName: value.displayName.trim(), amount };
};

const parseOffer = (value: unknown): SellerOffer => {
  const candidate = parseCandidate(value);
  if (!isRecord(value) || !validId(value.id) || typeof value.status !== "string" || !["OFFERED", "ACCEPTED", "DECLINED", "EXPIRED"].includes(value.status) ||
    !validDate(value.offeredAt) || !validDate(value.expiresAt) || Date.parse(value.expiresAt) <= Date.parse(value.offeredAt) ||
    !(value.respondedAt === null || validDate(value.respondedAt)) || !(value.orderId === null || validId(value.orderId)) ||
    !(value.paymentDueAt === null || validDate(value.paymentDueAt))) throw invalid();
  const responded = value.respondedAt;
  if ((responded !== null && (Date.parse(responded) < Date.parse(value.offeredAt) || Date.parse(responded) > Date.parse(value.expiresAt))) ||
    (["ACCEPTED", "DECLINED"].includes(String(value.status)) !== (responded !== null)) ||
    (value.status === "ACCEPTED" ? value.paymentDueAt === null || Date.parse(value.paymentDueAt) <= Date.parse(responded as string) : value.orderId !== null || value.paymentDueAt !== null)) throw invalid();
  return { ...candidate, id: value.id, status: value.status as SellerOfferStatus, offeredAt: value.offeredAt, expiresAt: value.expiresAt,
    respondedAt: responded, orderId: value.orderId, paymentDueAt: value.paymentDueAt };
};

export const parseSellerOfferState = (value: unknown, auctionId: string): SellerOfferState => {
  if (!validId(auctionId) || !isRecord(value) || value.auctionId !== auctionId || typeof value.canOffer !== "boolean" ||
    !(value.candidate === null || isRecord(value.candidate)) || !Array.isArray(value.offers)) throw invalid();
  const offers = value.offers.map(parseOffer);
  const candidate = value.candidate === null ? null : parseCandidate(value.candidate);
  const orderIds = offers.flatMap((offer) => offer.orderId === null ? [] : [offer.orderId.toLowerCase()]);
  if (new Set(offers.map((offer) => offer.id.toLowerCase())).size !== offers.length || new Set(offers.map((offer) => offer.bidderId.toLowerCase())).size !== offers.length ||
    new Set(orderIds).size !== orderIds.length ||
    offers.filter((offer) => offer.status === "OFFERED").length > 1 ||
    value.canOffer !== (candidate !== null) || (value.canOffer && offers.some((offer) => offer.status === "OFFERED")) ||
    (candidate && offers.some((offer) => offer.bidderId.toLowerCase() === candidate.bidderId.toLowerCase()))) throw invalid();
  // ACCEPTED describes history. The server can offer again after that order times out;
  // current auction/order eligibility belongs to canOffer, not to a previous response.
  return { auctionId, canOffer: value.canOffer, candidate, offers: offers.sort((a, b) => Date.parse(b.offeredAt) - Date.parse(a.offeredAt)) };
};

/** Delivered #208 endpoint; current candidacy and stock are always decided by the backend. */
export const getSellerOffers = async (auctionId: string, options: ServiceRequestOptions = {}): Promise<SellerOfferState> => {
  if (!validId(auctionId)) throw createInvalidResponseError("A valid auction id is required");
  const { data } = await requestApi("GET", `/api/v1/auctions/${encodeURIComponent(auctionId)}/second-chance-offers`, undefined, { ...options, auth: true });
  return parseSellerOfferState(data, auctionId);
};

export const sendSellerOffer = async (auctionId: string, options: ServiceRequestOptions = {}): Promise<SellerOfferState> => {
  if (!validId(auctionId)) throw createInvalidResponseError("A valid auction id is required");
  // #208 chooses bidder/amount and rechecks eligibility atomically; the seller sends no body.
  const { data } = await requestApi("POST", `/api/v1/auctions/${encodeURIComponent(auctionId)}/second-chance-offers`, undefined,
    { ...options, auth: true });
  const result = parseSellerOfferState(data, auctionId);
  if (result.canOffer || !result.offers.some((offer) => offer.status === "OFFERED")) throw invalid();
  return result;
};
