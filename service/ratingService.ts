import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { CreateRatingRequest, Rating, SellerReputation } from "../types/ratingType";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const validScore = (value: unknown, maximum: number, minimum = 0): value is number =>
  Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
const maskedName = /^(?:\*{3}|\p{L}\*{3}\p{L})$/u;

const parseRating = (data: unknown): Rating => {
  if (!isRecord(data) || !isId(data.id) || (data.orderId !== null && !isId(data.orderId)) ||
    (data.auctionId !== null && !isId(data.auctionId)) || !validScore(data.score, 5, 1) ||
    (data.comment !== null && (typeof data.comment !== "string" || data.comment.length > 1000)) ||
    typeof data.raterName !== "string" || !maskedName.test(data.raterName) ||
    typeof data.ratedByMe !== "boolean" || ["fromUserId", "toUserId", "raterId", "email"].some((key) => key in data) ||
    typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt))) {
    throw createInvalidResponseError("Invalid rating response");
  }
  return {
    id: data.id, orderId: data.orderId as string | null, auctionId: data.auctionId as string | null,
    score: data.score, comment: data.comment as string | null, raterName: data.raterName,
    ratedByMe: data.ratedByMe, createdAt: data.createdAt,
  };
};

export const createRating = async (
  body: CreateRatingRequest,
  buyerId: string,
  options: ServiceRequestOptions = {},
): Promise<Rating> => {
  if (!isId(body.orderId) || !isId(buyerId) || !validScore(body.score, 5, 1) ||
    (body.comment !== null && (typeof body.comment !== "string" || body.comment.length > 1000))) {
    throw createInvalidResponseError("Invalid rating request");
  }
  const { data } = await requestApi<unknown>("POST", "/api/v1/ratings", {
    orderId: body.orderId, score: body.score, comment: body.comment,
  }, { ...options, auth: true, params: undefined });
  const rating = parseRating(data);
  if (!rating.ratedByMe || rating.orderId === null || !sameId(rating.orderId, body.orderId) ||
    rating.score !== body.score || rating.comment !== body.comment) {
    throw createInvalidResponseError("Rating response does not match this order");
  }
  return rating;
};

export const getOrderRating = async (
  sellerId: string,
  buyerId: string,
  orderId: string,
  options: ServiceRequestOptions = {},
): Promise<Rating | null> => {
  if (![sellerId, buyerId, orderId].every(isId) || sameId(sellerId, buyerId)) {
    throw createInvalidResponseError("Invalid rating lookup");
  }
  for (let number = 0; ; number++) {
    const { data, page } = await requestApi<unknown>("GET", "/api/v1/ratings", undefined, {
      ...options, auth: true, params: { userId: sellerId, page: number, size: 100 },
    });
    if (!Array.isArray(data) || !page || page.number !== number || data.length > page.size ||
      (number > 0 && data.length === 0 && number < page.totalPages)) {
      throw createInvalidResponseError("Invalid ratings page");
    }
    const ratings = data.map(parseRating);
    const own = ratings.find((rating) => rating.orderId !== null && sameId(rating.orderId, orderId) && rating.ratedByMe);
    if (own) return own;
    if (number + 1 >= page.totalPages) return null;
  }
};

export const getSellerReputation = async (
  userId: string,
  options: ServiceRequestOptions = {},
): Promise<SellerReputation> => {
  if (!isId(userId)) throw createInvalidResponseError("Invalid seller identifier");
  const { data } = await requestApi<unknown>("GET", `/api/v1/reputations/${encodeURIComponent(userId)}`, undefined, {
    ...options, auth: true, params: undefined,
  });
  if (!isRecord(data) || !isId(data.userId) || !sameId(data.userId, userId) || !validScore(data.score, 100) ||
    !["NEW", "BASIC", "TRUSTED", "TOP"].includes(String(data.trustLevel)) ||
    ![data.totalTransaction, data.successfulTransaction, data.failedTransaction].every((value) => validScore(value, Number.MAX_SAFE_INTEGER)) ||
    !validScore(data.ratingCount, Number.MAX_SAFE_INTEGER) || typeof data.policyVersion !== "string" || !data.policyVersion.trim() ||
    Number(data.successfulTransaction) + Number(data.failedTransaction) > Number(data.totalTransaction)) {
    throw createInvalidResponseError("Invalid seller reputation");
  }
  return {
    userId: data.userId, score: data.score,
    trustLevel: data.trustLevel as SellerReputation["trustLevel"],
    totalTransaction: data.totalTransaction as number,
    successfulTransaction: data.successfulTransaction as number,
    failedTransaction: data.failedTransaction as number,
    ratingCount: data.ratingCount,
    policyVersion: data.policyVersion,
  };
};
