import { API_BASE_URL } from "../configs/api";
import { createApiClient, createInvalidResponseError, type ApiClient } from "../lib/api-client";
import type { ApiResult } from "../types/common/response/type";
import type { LoginResponse, UserResponse } from "../types/auth/response/type";

/** Backend auth endpoints; the common origin/proxy comes from configs/api.ts. */
export const REGISTER_PATH = "/api/v1/auth/register";
export const LOGIN_PATH = "/api/v1/auth/login";
export const ME_PATH = "/api/v1/users/me";

import type { AuthApi } from "../types/auth/type";
export type { AuthApi } from "../types/auth/type";

export function createAuthApi(client: ApiClient = createApiClient({ baseUrl: API_BASE_URL })): AuthApi {
  return {
    client,
    async register(input, signal) {
      const result = await client.post<unknown>(REGISTER_PATH, input, { auth: false, signal });
      return validateResult(result, isUserResponse, "register response must be a UserResponse");
    },

    async login(input, signal) {
      const result = await client.post<unknown>(LOGIN_PATH, input, { auth: false, signal });
      return validateResult(result, isLoginResponse, "login response must include Bearer accessToken and expiresIn");
    },

    async me(signal) {
      const result = await client.get<unknown>(ME_PATH, { auth: true, signal });
      return validateResult(result, isUserResponse, "me response must be a UserResponse");
    },
  };
}

function validateResult<T>(
  result: ApiResult<unknown>,
  validator: (value: unknown) => value is T,
  invalidDetail: string,
): ApiResult<T> {
  if (!result.ok) {
    return result;
  }

  if (!validator(result.data)) {
    return {
      ok: false,
      error: createInvalidResponseError(invalidDetail),
    };
  }

  return { ok: true, data: result.data };
}

function isLoginResponse(value: unknown): value is LoginResponse {
  return isRecord(value)
    && typeof value.accessToken === "string"
    && value.accessToken.length > 0
    && typeof value.expiresIn === "number"
    && Number.isFinite(value.expiresIn)
    && value.expiresIn > 0
    && value.tokenType === "Bearer";
}

export function isUserResponse(value: unknown): value is UserResponse {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.email === "string"
    && typeof value.phone === "string"
    && typeof value.fullName === "string"
    && (value.gender === null || value.gender === "MALE" || value.gender === "FEMALE" || value.gender === "OTHER")
    && isNullableString(value.address)
    && isNullableString(value.dateOfBirth)
    && Array.isArray(value.roles)
    && value.roles.every((role) => typeof role === "string")
    && (value.status === "ACTIVE" || value.status === "LOCKED" || value.status === "DELETED")
    && typeof value.createdAt === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
