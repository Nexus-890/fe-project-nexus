import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerApplication, SellerApplicationInput } from "../types/sellerApplicationType";

/** Issue POST plus proposed own-read/full DTO; see docs/api/seller-application-210.openapi.json. */
export const SELLER_APPLICATION_PATH = "/api/v1/sellers/applications";
export const OWN_SELLER_APPLICATION_PATH = `${SELLER_APPLICATION_PATH}/me`;

export function parseSellerApplication(value: unknown): SellerApplication {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() ||
    typeof value.companyName !== "string" || !value.companyName.trim() ||
    typeof value.phone !== "string" || !/^\+?[0-9]{7,15}$/.test(value.phone) ||
    typeof value.note !== "string" ||
    typeof value.status !== "string" || !["PENDING", "ACTIVE", "REJECTED"].includes(value.status) ||
    !("reason" in value) ||
    (value.status === "REJECTED" ? typeof value.reason !== "string" || !value.reason.trim() : value.reason !== null)) {
    throw createInvalidResponseError("The seller application response is invalid.");
  }
  return {
    companyName: value.companyName,
    phone: value.phone,
    note: value.note,
    id: value.id,
    status: value.status as SellerApplication["status"],
    rejectionReason: typeof value.reason === "string" ? value.reason : null,
  };
}

export const getSellerApplication = async (options: ServiceRequestOptions = {}): Promise<SellerApplication | null> => {
  const response = await requestApi<unknown>("GET", OWN_SELLER_APPLICATION_PATH, undefined, { ...options, auth: true, params: undefined });
  // Only explicit null is no application. Missing endpoints/404 remain errors.
  return response.data === null ? null : parseSellerApplication(response.data);
};

export const submitSellerApplication = async (input: SellerApplicationInput, options: ServiceRequestOptions = {}): Promise<SellerApplication> => {
  const body = {
    companyName: input.companyName.trim(),
    phone: input.phone.trim().replace(/[\s()-]/g, ""),
    note: input.note.trim(),
  };
  const response = await requestApi<unknown>("POST", SELLER_APPLICATION_PATH, body, { ...options, auth: true });
  return parseSellerApplication(response.data);
};
