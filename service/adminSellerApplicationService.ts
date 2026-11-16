import { createInvalidResponseError, requestApi } from "../configs/api";
import { parseSellerApplication, SELLER_APPLICATION_PATH } from "./sellerApplicationService";
import type { AdminSellerApplicationFilters, AdminSellerApplicationPage, RejectSellerApplicationInput } from "../types/adminSellerApplicationType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerApplication } from "../types/sellerApplicationType";

/** Issue #210 operations with the explicitly proposed complete response DTO. */
export const getAdminSellerApplications = async (
  filters: AdminSellerApplicationFilters = {},
  options: ServiceRequestOptions = {},
): Promise<AdminSellerApplicationPage> => {
  const params = { page: filters.page ?? 0, size: filters.size ?? 10, ...(filters.status ? { status: filters.status } : {}) };
  const response = await requestApi<unknown>("GET", SELLER_APPLICATION_PATH, undefined, { ...options, auth: true, params });
  if (!Array.isArray(response.data) || !response.page)
    throw createInvalidResponseError("Seller application list must include an array and page metadata.");
  const applications = response.data.map(parseSellerApplication);
  if (response.page.number !== params.page || response.page.size !== params.size || applications.length > params.size ||
    applications.some((application) => params.status && application.status !== params.status))
    throw createInvalidResponseError("Seller application list does not match the requested filters.");
  return { applications, page: response.page };
};

const applicationDecisionPath = (id: string, decision: "approve" | "reject") => {
  if (!id.trim()) throw createInvalidResponseError("A seller application id is required.");
  return `${SELLER_APPLICATION_PATH}/${encodeURIComponent(id)}/${decision}`;
};

export const approveSellerApplication = async (id: string, options: ServiceRequestOptions = {}): Promise<SellerApplication> => {
  const response = await requestApi<unknown>("POST", applicationDecisionPath(id, "approve"), undefined, { ...options, auth: true, params: undefined });
  const application = parseSellerApplication(response.data);
  if (application.id !== id || application.status !== "ACTIVE")
    throw createInvalidResponseError("Approval must return the approved seller application.");
  return application;
};

export const rejectSellerApplication = async (id: string, input: RejectSellerApplicationInput, options: ServiceRequestOptions = {}): Promise<SellerApplication> => {
  const reason = input.reason.trim();
  if (!reason || reason.length > 1000) throw createInvalidResponseError("A rejection reason of 1–1,000 characters is required.");
  const response = await requestApi<unknown>("POST", applicationDecisionPath(id, "reject"), { reason }, { ...options, auth: true, params: undefined });
  const application = parseSellerApplication(response.data);
  if (application.id !== id || application.status !== "REJECTED")
    throw createInvalidResponseError("Rejection must return the rejected seller application and its reason.");
  return application;
};
