import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerApplication, SellerApplicationInput } from "../types/sellerApplicationType";

/** Provisional #210 boundary. Replace with its generated DTOs when the owning API is delivered. */
export const SELLER_APPLICATION_PATH = "/api/v1/users/me/seller-application";

export function parseSellerApplication(value: unknown): SellerApplication {
  if (typeof value !== "object" || value === null || !("id" in value) ||
    typeof value.id !== "string" || !value.id.trim() ||
    !("shopName" in value) || typeof value.shopName !== "string" || !value.shopName.trim() ||
    !("description" in value) || typeof value.description !== "string" ||
    !("status" in value) || typeof value.status !== "string" || !["PENDING", "APPROVED", "REJECTED"].includes(value.status) ||
    !("submittedAt" in value) || typeof value.submittedAt !== "string" || !Number.isFinite(Date.parse(value.submittedAt)) ||
    ("rejectionReason" in value && value.rejectionReason !== null && typeof value.rejectionReason !== "string") ||
    (value.status === "REJECTED" && (!("rejectionReason" in value) || typeof value.rejectionReason !== "string" || !value.rejectionReason.trim()))) {
    throw createInvalidResponseError("The seller application response is invalid.");
  }
  return {
    id: value.id,
    shopName: value.shopName,
    description: value.description,
    status: value.status as SellerApplication["status"],
    rejectionReason: "rejectionReason" in value && typeof value.rejectionReason === "string" ? value.rejectionReason : null,
    submittedAt: value.submittedAt,
  };
}

export const getSellerApplication = async (options: ServiceRequestOptions = {}): Promise<SellerApplication | null> => {
  const response = await requestApi<unknown>("GET", SELLER_APPLICATION_PATH, undefined, { ...options, auth: true });
  // A 404 is intentionally an API error: the pending endpoint must not masquerade as a new application.
  return response.data === null ? null : parseSellerApplication(response.data);
};

export const submitSellerApplication = async (input: SellerApplicationInput, options: ServiceRequestOptions = {}): Promise<SellerApplication> => {
  const response = await requestApi<unknown>("POST", SELLER_APPLICATION_PATH, {
    shopName: input.shopName.trim(),
    description: input.description.trim(),
  }, { ...options, auth: true });
  return parseSellerApplication(response.data);
};
