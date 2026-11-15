import type { components } from "./sellerApplication210GeneratedType";

/** Proposed #210 contract; keep disabled until the backend implements it. */
export type SellerApplicationInput = components["schemas"]["SellerApplicationInput"];

export type SellerApplication = Omit<components["schemas"]["SellerApplication"], "reason"> & {
  rejectionReason: string | null;
};
