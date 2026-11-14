import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerOffer, SellerOfferCandidate, SellerOfferState, SellerOfferStatus } from "../types/sellerOfferType";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const validVersion = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const invalid = () => createInvalidResponseError("Invalid second-chance offer response");

const parseCandidate = (value: unknown): SellerOfferCandidate => {
  if (!isRecord(value) || !validId(value.bidderId) || typeof value.displayName !== "string" || !value.displayName.trim() ||
    typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount >= 1e13 || Number(value.amount.toFixed(2)) !== value.amount) throw invalid();
  const amount = normalizeMoney(value.amount);
  if (amount === null) throw invalid();
  return { bidderId: value.bidderId, displayName: value.displayName.trim(), amount };
};

const parseOffer = (value: unknown): SellerOffer => {
  const candidate = parseCandidate(value);
  if (!isRecord(value) || !validId(value.id) || !["OPEN", "ACCEPTED", "DECLINED", "EXPIRED"].includes(String(value.status)) ||
    !validDate(value.offeredAt) || !validDate(value.expiresAt) || Date.parse(value.expiresAt) - Date.parse(value.offeredAt) !== 86_400_000 ||
    !(value.respondedAt === null || validDate(value.respondedAt)) || !(value.orderId === null || validId(value.orderId)) ||
    !(value.paymentDueAt === null || validDate(value.paymentDueAt))) throw invalid();
  const responded = value.respondedAt;
  if ((responded !== null && (Date.parse(responded) < Date.parse(value.offeredAt) || Date.parse(responded) > Date.parse(value.expiresAt))) ||
    (["ACCEPTED", "DECLINED"].includes(String(value.status)) !== (responded !== null)) ||
    (value.status === "ACCEPTED" ? value.orderId === null || value.paymentDueAt === null || Date.parse(value.paymentDueAt) <= Date.parse(responded as string) : value.orderId !== null || value.paymentDueAt !== null)) throw invalid();
  return { ...candidate, id: value.id, status: value.status as SellerOfferStatus, offeredAt: value.offeredAt, expiresAt: value.expiresAt,
    respondedAt: responded, orderId: value.orderId, paymentDueAt: value.paymentDueAt };
};

export const parseSellerOfferState = (value: unknown, auctionId: string): SellerOfferState => {
  if (!validId(auctionId) || !isRecord(value) || value.auctionId !== auctionId || !validVersion(value.version) || typeof value.canOffer !== "boolean" ||
    !(value.candidate === null || isRecord(value.candidate)) || !Array.isArray(value.offers)) throw invalid();
  const offers = value.offers.map(parseOffer);
  const candidate = value.candidate === null ? null : parseCandidate(value.candidate);
  if (new Set(offers.map((offer) => offer.id)).size !== offers.length || new Set(offers.map((offer) => offer.bidderId)).size !== offers.length ||
    offers.filter((offer) => offer.status === "OPEN").length > 1 || offers.filter((offer) => offer.status === "ACCEPTED").length > 1 ||
    (offers.some((offer) => offer.status === "OPEN") && offers.some((offer) => offer.status === "ACCEPTED")) ||
    value.canOffer !== (candidate !== null) || (value.canOffer && offers.some((offer) => offer.status === "OPEN" || offer.status === "ACCEPTED")) ||
    (candidate && offers.some((offer) => offer.bidderId === candidate.bidderId))) throw invalid();
  return { auctionId, version: value.version, canOffer: value.canOffer, candidate, offers: offers.sort((a, b) => Date.parse(b.offeredAt) - Date.parse(a.offeredAt)) };
};

/** Proposed endpoint: absence/failure remains an API error; there is no production fixture fallback. */
export const getSellerOffers = async (auctionId: string, options: ServiceRequestOptions = {}): Promise<SellerOfferState> => {
  if (!validId(auctionId)) throw createInvalidResponseError("A valid auction id is required");
  const { data } = await requestApi("GET", `/api/v1/auctions/${encodeURIComponent(auctionId)}/second-chance-offers`, undefined, { ...options, auth: true });
  return parseSellerOfferState(data, auctionId);
};

export const sendSellerOffer = async (auctionId: string, version: number, options: ServiceRequestOptions = {}): Promise<SellerOfferState> => {
  if (!validId(auctionId) || !validVersion(version)) throw createInvalidResponseError("A valid auction and offer version are required");
  // The service chooses bidder/amount; If-Match binds confirmation to the candidate that was reviewed.
  const headers = { ...options.config?.headers, "If-Match": `"${version}"` };
  const { data } = await requestApi("POST", `/api/v1/auctions/${encodeURIComponent(auctionId)}/second-chance-offers`, undefined,
    { ...options, auth: true, config: { ...options.config, headers } });
  const result = parseSellerOfferState(data, auctionId);
  if (result.version <= version || result.canOffer || !result.offers.some((offer) => offer.status === "OPEN")) throw invalid();
  return result;
};
