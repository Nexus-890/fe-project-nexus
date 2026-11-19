import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { CreateDisputeRequest, CreateRestrictionRequest, ModerationPage, RatingDispute, ReputationRestriction, ResolveDisputeRequest } from "../types/ratingModerationType";
import type { Rating } from "../types/ratingType";
import { parseRating } from "./ratingService";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && idPattern.test(value);
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const nullableDate = (value: unknown) => value === undefined || value === null || date(value);
const nullableId = (value: unknown) => value === undefined || value === null || isId(value);
const reason = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 1000;
const invalid = () => createInvalidResponseError("Invalid reputation moderation response");
const userPath = (userId: string) => {
  if (!isId(userId)) throw invalid();
  return `/api/v1/reputations/${encodeURIComponent(userId)}/restrictions`;
};

const parseRestriction = (value: unknown): ReputationRestriction => {
  if (!isRecord(value) || !isId(value.id) || !isId(value.userId) || !["BID", "SELL"].includes(String(value.action)) ||
    !reason(value.reason) || !date(value.restrictedUntil) || !date(value.createdAt) || !isId(value.createdBy) ||
    !nullableDate(value.revokedAt) || !nullableId(value.revokedBy) || (value.revocationReason != null && !reason(value.revocationReason)) ||
    typeof value.active !== "boolean") throw invalid();
  return value as unknown as ReputationRestriction;
};

const parseDispute = (value: unknown): RatingDispute => {
  if (!isRecord(value) || !isId(value.id) || !isId(value.ratingId) || !isId(value.userId) || !reason(value.reason) ||
    !["PENDING", "APPROVED", "REJECTED"].includes(String(value.status)) || !date(value.createdAt) ||
    !nullableDate(value.resolvedAt) || !nullableId(value.resolvedBy) || (value.resolutionReason != null && !reason(value.resolutionReason)) ||
    !Number.isInteger(value.ratingScore) || Number(value.ratingScore) < 1 || Number(value.ratingScore) > 5 ||
    (value.ratingComment != null && typeof value.ratingComment !== "string")) throw invalid();
  return value as unknown as RatingDispute;
};

const getPage = async <T>(path: string, params: Record<string, unknown>, parse: (value: unknown) => T, options: ServiceRequestOptions): Promise<ModerationPage<T>> => {
  if (!Number.isInteger(params.page) || Number(params.page) < 0) throw invalid();
  const { data, page } = await requestApi("GET", path, undefined, { ...options, auth: true, params });
  if (!Array.isArray(data) || !page || page.number !== params.page || data.length > page.size) throw invalid();
  return { items: data.map(parse), page };
};

export const getReputationRestrictions = async (userId: string, page = 0, options: ServiceRequestOptions = {}) => {
  const result = await getPage(userPath(userId), { page, size: 20 }, parseRestriction, options);
  if (result.items.some((row) => row.userId.toLowerCase() !== userId.toLowerCase())) throw invalid();
  return result;
};

export const createReputationRestriction = async (userId: string, body: CreateRestrictionRequest, options: ServiceRequestOptions = {}): Promise<ReputationRestriction> => {
  if (!reason(body.reason) || !["BID", "SELL"].includes(body.action) || !date(body.restrictedUntil) || Date.parse(body.restrictedUntil) <= Date.now()) throw invalid();
  const { action, reason: restrictionReason, restrictedUntil } = body;
  const { data } = await requestApi("POST", userPath(userId), { action, reason: restrictionReason, restrictedUntil }, { ...options, auth: true, params: undefined });
  const restriction = parseRestriction(data);
  if (restriction.userId.toLowerCase() !== userId.toLowerCase() || restriction.action !== body.action) throw invalid();
  return restriction;
};

export const revokeReputationRestriction = async (userId: string, id: string, revocationReason: string, options: ServiceRequestOptions = {}): Promise<ReputationRestriction> => {
  if (!isId(id) || !reason(revocationReason)) throw invalid();
  const { data } = await requestApi("DELETE", `${userPath(userId)}/${encodeURIComponent(id)}`, undefined,
    { ...options, auth: true, params: { reason: revocationReason } });
  const restriction = parseRestriction(data);
  if (restriction.id !== id || restriction.userId !== userId || restriction.active) throw invalid();
  return restriction;
};

export const getReceivedRatings = async (userId: string, page = 0, options: ServiceRequestOptions = {}): Promise<ModerationPage<Rating>> => {
  if (!isId(userId)) throw invalid();
  return getPage("/api/v1/ratings", { userId, page, size: 20 }, parseRating, options);
};

export const createRatingDispute = async (ratingId: string, body: CreateDisputeRequest, options: ServiceRequestOptions = {}): Promise<RatingDispute> => {
  if (!isId(ratingId) || !reason(body.reason)) throw invalid();
  const { data } = await requestApi("POST", `/api/v1/ratings/${encodeURIComponent(ratingId)}/disputes`, { reason: body.reason }, { ...options, auth: true, params: undefined });
  const dispute = parseDispute(data);
  if (dispute.ratingId !== ratingId || dispute.status !== "PENDING") throw invalid();
  return dispute;
};

export const getRatingDisputes = async (status: string, page = 0, options: ServiceRequestOptions = {}) => {
  if (status && !["PENDING", "APPROVED", "REJECTED"].includes(status)) throw invalid();
  return getPage("/api/v1/ratings/disputes", { ...(status ? { status } : {}), page, size: 20 }, parseDispute, options);
};

export const resolveRatingDispute = async (id: string, body: ResolveDisputeRequest, options: ServiceRequestOptions = {}): Promise<RatingDispute> => {
  if (!isId(id) || !["APPROVED", "REJECTED"].includes(body.status) || !reason(body.reason)) throw invalid();
  const { data } = await requestApi("PATCH", `/api/v1/ratings/disputes/${encodeURIComponent(id)}`, { status: body.status, reason: body.reason }, { ...options, auth: true, params: undefined });
  const dispute = parseDispute(data);
  if (dispute.id !== id || dispute.status !== body.status) throw invalid();
  return dispute;
};
