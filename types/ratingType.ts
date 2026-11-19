import type { components } from "./ratingGeneratedType";

export type CreateRatingRequest = components["schemas"]["CreateRatingRequest"] & { comment: string | null };
export type Rating = components["schemas"]["Rating"];
export type SellerReputation = components["schemas"]["Reputation"];
export type TrustLevel = components["schemas"]["TrustLevel"];
export type MyReputation = components["schemas"]["MyReputation"];
export type Penalty = components["schemas"]["Penalty"];
