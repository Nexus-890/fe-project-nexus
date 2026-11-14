import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { PhoneVerification, VerificationDelivery } from "../types/verificationType";

// Pinned #210 controllers/OpenAPI; opt-in integration, not the develop contract.
export const PHONE_VERIFICATION_PATH = "/api/v1/users/me/phone/verification";
export const EMAIL_RESEND_PATH = "/api/v1/auth/verification-email";
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const parsePhone = (value: unknown): PhoneVerification => {
  if (!object(value) || typeof value.phone !== "string" || !/^\+?\d{7,15}$/.test(value.phone) || typeof value.phoneVerifiedAt !== "string" || !Number.isFinite(Date.parse(value.phoneVerifiedAt)))
    throw createInvalidResponseError("Phone verification response is invalid.");
  return { phone: value.phone, phoneVerifiedAt: value.phoneVerifiedAt };
};
const parseDelivery = (value: unknown): VerificationDelivery => {
  if (!object(value) || typeof value.phone !== "string" || !/^\+?\d{7,15}$/.test(value.phone) || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)))
    throw createInvalidResponseError("Verification delivery response is invalid.");
  return { phone: value.phone, expiresAt: value.expiresAt };
};
export const resendVerificationEmail = async (email: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("POST", EMAIL_RESEND_PATH, { email: email.trim() }, { ...options, auth: false });
};
export const sendPhoneCode = async (options: ServiceRequestOptions = {}): Promise<VerificationDelivery> =>
  parseDelivery((await requestApi<unknown>("POST", PHONE_VERIFICATION_PATH, undefined, { ...options, auth: true })).data);
export const confirmPhoneCode = async (code: string, options: ServiceRequestOptions = {}): Promise<PhoneVerification> =>
  parsePhone((await requestApi<unknown>("POST", `${PHONE_VERIFICATION_PATH}/confirm`, { code }, { ...options, auth: true })).data);
