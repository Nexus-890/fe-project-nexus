import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { PhoneVerification, VerificationDelivery } from "../types/verificationType";

// #210 has no delivered verification operations yet. Keep its proposed boundary
// explicit; never infer verification from registration success or browser state.
export const PHONE_VERIFICATION_PATH = "/api/v1/users/me/phone-verification";
export const EMAIL_RESEND_PATH = "/api/v1/auth/verification-email/resend";
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const parsePhone = (value: unknown): PhoneVerification => {
  if (!object(value) || typeof value.phone !== "string" || !/^\+?\d{7,15}$/.test(value.phone) || typeof value.verified !== "boolean")
    throw createInvalidResponseError("Phone verification response is invalid.");
  return { phone: value.phone, verified: value.verified };
};
const parseDelivery = (value: unknown): VerificationDelivery => {
  if (!object(value) || !Number.isInteger(value.retryAfterSeconds) || (value.retryAfterSeconds as number) < 0 ||
    !Number.isInteger(value.expiresInSeconds) || (value.expiresInSeconds as number) < 1)
    throw createInvalidResponseError("Verification delivery response is invalid.");
  return { retryAfterSeconds: value.retryAfterSeconds as number, expiresInSeconds: value.expiresInSeconds as number };
};
export const resendVerificationEmail = async (email: string, options: ServiceRequestOptions = {}): Promise<VerificationDelivery> =>
  parseDelivery((await requestApi<unknown>("POST", EMAIL_RESEND_PATH, { email: email.trim() }, { ...options, auth: false })).data);
export const getPhoneVerification = async (options: ServiceRequestOptions = {}): Promise<PhoneVerification> =>
  parsePhone((await requestApi<unknown>("GET", PHONE_VERIFICATION_PATH, undefined, { ...options, auth: true })).data);
export const sendPhoneCode = async (phone: string, options: ServiceRequestOptions = {}): Promise<VerificationDelivery> =>
  parseDelivery((await requestApi<unknown>("POST", `${PHONE_VERIFICATION_PATH}/send`, { phone }, { ...options, auth: true })).data);
export const confirmPhoneCode = async (phone: string, code: string, options: ServiceRequestOptions = {}): Promise<PhoneVerification> => {
  const result = parsePhone((await requestApi<unknown>("POST", `${PHONE_VERIFICATION_PATH}/confirm`, { phone, code }, { ...options, auth: true })).data);
  if (result.phone !== phone) throw createInvalidResponseError("Verified phone does not match the requested phone.");
  return result;
};
