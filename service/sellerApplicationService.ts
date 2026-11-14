import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerApplication, SellerApplicationInput } from "../types/sellerApplicationType";

/** Issue #210 defines this buyer POST. Its controller/response DTO is not delivered yet. */
export const SELLER_APPLICATION_PATH = "/api/v1/sellers/applications";

/** Minimal expected seller-row acknowledgement; no timestamp or buyer GET is invented. */
export function parseSellerApplication(value: unknown, submitted: SellerApplicationInput): SellerApplication {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() ||
    typeof value.status !== "string" || !["PENDING", "ACTIVE", "REJECTED"].includes(value.status) ||
    (value.reason !== undefined && value.reason !== null && typeof value.reason !== "string")) {
    throw createInvalidResponseError("The seller application response is invalid.");
  }
  return {
    ...submitted,
    id: value.id,
    status: value.status as SellerApplication["status"],
    rejectionReason: typeof value.reason === "string" ? value.reason : null,
  };
}

export const submitSellerApplication = async (input: SellerApplicationInput, options: ServiceRequestOptions = {}): Promise<SellerApplication> => {
  const body = {
    companyName: input.companyName.trim(),
    phone: input.phone.trim().replace(/[\s()-]/g, ""),
    note: input.note.trim(),
  };
  const response = await requestApi<unknown>("POST", SELLER_APPLICATION_PATH, body, { ...options, auth: true });
  return parseSellerApplication(response.data, body);
};
