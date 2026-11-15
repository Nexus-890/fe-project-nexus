import type { components } from "./ratingGeneratedType";

export type CreateRatingRequest = components["schemas"]["CreateRatingRequest"] & { comment: string | null };
export type Rating = components["schemas"]["Rating"];
export type SellerReputation = components["schemas"]["Reputation"];
