import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { RegisterRequest, SessionRequest } from "../types/authRequestType";
import type { SessionResponse, UserResponse } from "../types/authResponseType";

export const REGISTER_PATH = "/api/v1/auth/register";
export const ME_PATH = "/api/v1/users/me";
export const SESSION_PATH = "/api/v1/auth/session";
export const REFRESH_PATH = "/api/v1/auth/refresh";
export const LOGOUT_PATH = "/api/v1/auth/logout";

// Gateway session calls carry the HttpOnly refresh cookie, so the browser must send credentials.
// The custom header is the CSRF check: a foreign site cannot add it without passing CORS.
const sessionConfig = (options: ServiceRequestOptions) => ({
  ...options.config,
  withCredentials: true,
  headers: { ...options.config?.headers, "X-Requested-With": "nexus-web" },
});

export const register = async (
  input: RegisterRequest,
  options: ServiceRequestOptions = {},
): Promise<UserResponse> => {
  const response = await requestApi<unknown>("POST", REGISTER_PATH, input, {
    ...options,
    auth: false,
  });
  if (!isUserResponse(response.data))
    throw createInvalidResponseError(
      "Register response must contain a valid user.",
    );
  return response.data;
};

export const getMe = async (
  options: ServiceRequestOptions = {},
): Promise<UserResponse> => {
  const response = await requestApi<unknown>("GET", ME_PATH, undefined, {
    ...options,
    auth: true,
  });
  if (!isUserResponse(response.data))
    throw createInvalidResponseError(
      "Profile response must contain a valid user.",
    );
  return response.data;
};

/** After sign-in: trades the callback code for the access token; the gateway sets the refresh cookie. */
export const createSession = async (
  input: SessionRequest,
  options: ServiceRequestOptions = {},
): Promise<SessionResponse> => {
  const response = await requestApi<unknown>("POST", SESSION_PATH, input, {
    ...options,
    auth: false,
    config: sessionConfig(options),
  });
  return parseSession(response.data);
};

/**
 * Page load or renew: the browser sends the cookie, the gateway answers with a new access token.
 * Null means there is no session (gateway 204, no cookie). A cookie Keycloak refused is a 401 error.
 */
export const refreshSession = async (
  options: ServiceRequestOptions = {},
): Promise<SessionResponse | null> => {
  const response = await requestApi<unknown>("POST", REFRESH_PATH, undefined, {
    ...options,
    auth: false,
    config: sessionConfig(options),
  });
  if (response.data === undefined) return null;
  return parseSession(response.data);
};

/** Ends the Keycloak session and clears the cookie; the gateway answers 204 even when Keycloak is down. */
export const endSession = async (
  options: ServiceRequestOptions = {},
): Promise<void> => {
  await requestApi<void>("POST", LOGOUT_PATH, undefined, {
    ...options,
    auth: false,
    config: sessionConfig(options),
  });
};

const parseSession = (value: unknown): SessionResponse => {
  if (!isSessionResponse(value))
    throw createInvalidResponseError(
      "Session response must contain accessToken, idToken and expiresIn.",
    );
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

export const isUserResponse = (value: unknown): value is UserResponse =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.email === "string" &&
  typeof value.phone === "string" &&
  typeof value.fullName === "string" &&
  (value.gender === null ||
    value.gender === "MALE" ||
    value.gender === "FEMALE" ||
    value.gender === "OTHER") &&
  isNullableString(value.address) &&
  isNullableString(value.dateOfBirth) &&
  Array.isArray(value.roles) &&
  value.roles.every((role) => typeof role === "string") &&
  (value.status === "ACTIVE" ||
    value.status === "LOCKED" ||
    value.status === "DELETED") &&
  typeof value.createdAt === "string" &&
  (value.phoneVerifiedAt === undefined || value.phoneVerifiedAt === null ||
    (typeof value.phoneVerifiedAt === "string" && Number.isFinite(Date.parse(value.phoneVerifiedAt)))) &&
  (value.identityNumberMasked === undefined || isNullableString(value.identityNumberMasked)) &&
  (value.avatarUrl === undefined || isNullableString(value.avatarUrl));

export const isSessionResponse = (value: unknown): value is SessionResponse =>
  isRecord(value) &&
  typeof value.accessToken === "string" &&
  value.accessToken.length > 0 &&
  typeof value.idToken === "string" &&
  value.idToken.length > 0 &&
  typeof value.expiresIn === "number" &&
  Number.isFinite(value.expiresIn) &&
  value.expiresIn > 0;
