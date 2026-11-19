import type { components } from "./ratingGeneratedType";
import type { PageInfo } from "./commonResponseType";

export type ReputationRestriction = components["schemas"]["ReputationRestriction"];
export type CreateRestrictionRequest = components["schemas"]["CreateRestrictionRequest"];
export type RatingDispute = components["schemas"]["RatingDispute"];
export type CreateDisputeRequest = components["schemas"]["CreateDisputeRequest"];
export type ResolveDisputeRequest = components["schemas"]["ResolveDisputeRequest"];
export type ModerationPage<T> = { items: T[]; page: PageInfo };
