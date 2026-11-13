import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { CreateRatingRequest, Rating, SellerReputation } from "../types/ratingType";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (value: unknown): value is string => typeof value === "string" && uuid.test(value);
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const validScore = (value: unknown, maximum: number, minimum = 0): value is number =>
  Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;

const parseRating = (data: unknown): Rating => {
  if (!isRecord(data) || !isId(data.id) || !isId(data.fromUserId) || !isId(data.toUserId) ||
    !isId(data.orderId) || sameId(data.fromUserId, data.toUserId) || !validScore(data.score, 5, 1) ||
    (data.comment !== null && (typeof data.comment !== "string" || data.comment.length > 1000)) ||
    typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt))) {
    throw createInvalidResponseError("Invalid rating response");
  }
  return {
    id: data.id, fromUserId: data.fromUserId, toUserId: data.toUserId,
    orderId: data.orderId, score: data.score, comment: data.comment as string | null,
    createdAt: data.createdAt,
  };
};

// Catalogue paths and persisted entities define this provisional boundary until #212/#213 publish OpenAPI.
export const createRating = async (
  body: CreateRatingRequest,
  buyerId: string,
  options: ServiceRequestOptions = {},
): Promise<Rating> => {
  if (!isId(body.orderId) || !isId(body.toUserId) || !isId(buyerId) || sameId(buyerId, body.toUserId) || !validScore(body.score, 5, 1) ||
    (body.comment !== null && (typeof body.comment !== "string" || body.comment.length > 1000))) {
    throw createInvalidResponseError("Invalid rating request");
  }
  const { data } = await requestApi<unknown>("POST", "/api/v1/ratings", {
    orderId: body.orderId, toUserId: body.toUserId, score: body.score, comment: body.comment,
  }, { ...options, auth: true, params: undefined });
  const rating = parseRating(data);
  if (!sameId(rating.fromUserId, buyerId) || !sameId(rating.orderId, body.orderId) || !sameId(rating.toUserId, body.toUserId) ||
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
  // The catalogue supplies userId only. Check all seller pages before declaring the order unrated.
  for (let number = 0; ; number++) {
    const { data, page } = await requestApi<unknown>("GET", "/api/v1/ratings", undefined, {
      ...options, auth: true, params: { userId: sellerId, page: number, size: 100 },
    });
    if (!Array.isArray(data) || !page || page.number !== number || data.length > page.size ||
      (number > 0 && data.length === 0 && number < page.totalPages)) {
      throw createInvalidResponseError("Invalid ratings page");
    }
    const ratings = data.map(parseRating);
    if (ratings.some((rating) => !sameId(rating.toUserId, sellerId))) {
      throw createInvalidResponseError("Rating belongs to a different seller");
    }
    const own = ratings.find((rating) => sameId(rating.orderId, orderId) && sameId(rating.fromUserId, buyerId));
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
    Number(data.successfulTransaction) + Number(data.failedTransaction) > Number(data.totalTransaction)) {
    throw createInvalidResponseError("Invalid seller reputation");
  }
  return {
    userId: data.userId, score: data.score,
    trustLevel: data.trustLevel as SellerReputation["trustLevel"],
    totalTransaction: data.totalTransaction as number,
    successfulTransaction: data.successfulTransaction as number,
    failedTransaction: data.failedTransaction as number,
  };
};
