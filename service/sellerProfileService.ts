import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { SellerProfile, SellerProfileInput } from "../types/sellerProfileType";

export const parseSellerProfile = (value: unknown): SellerProfile => {
  if (!isRecord(value) || typeof value.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.userId) ||
    typeof value.companyName !== "string" || !value.companyName.trim() || value.companyName.length > 200 ||
    typeof value.contactPhone !== "string" || !value.contactPhone.trim() || value.contactPhone.length > 20 ||
    !["PENDING", "ACTIVE", "REJECTED"].includes(String(value.status))) throw createInvalidResponseError("Invalid seller profile response");
  return { sellerId: value.userId, companyName: value.companyName, contactPhone: value.contactPhone, status: value.status as SellerProfile["status"] };
};

export const getSellerProfile = async (options: ServiceRequestOptions = {}): Promise<SellerProfile> => {
  const { data } = await requestApi("GET", "/api/v1/sellers/me", undefined, { ...options, auth: true, params: undefined });
  return parseSellerProfile(data);
};

export const updateSellerProfile = async (input: SellerProfileInput, options: ServiceRequestOptions = {}): Promise<SellerProfile> => {
  const companyName = input.companyName.trim(), contactPhone = input.contactPhone.trim();
  if (!companyName || companyName.length > 200 || !/^\+?[0-9 ()-]{6,20}$/.test(contactPhone))
    throw createInvalidResponseError("Enter a company name and valid contact phone");
  const { data } = await requestApi("PUT", "/api/v1/sellers/me", { companyName, contactPhone }, { ...options, auth: true, params: undefined });
  return parseSellerProfile(data);
};
