import { API_BASE_URL } from "../configs/api";
import { createApiClient, createInvalidResponseError, type ApiClient } from "../lib/api-client";
import type { ApiResult } from "../types/common/response/type";
import type { UserResponse } from "../types/auth/response/type";

export const REGISTER_PATH = "/api/v1/auth/register";
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

  // The delivered common-core ApiResponse wraps successful responses in data.
  // Retain bare-body compatibility with older fixtures during the migration.
  const data = isRecord(result.data) && "data" in result.data ? result.data.data : result.data;
  if (!validator(data)) {
    return {
      ok: false,
      error: createInvalidResponseError(invalidDetail),
    };
  }

  return { ok: true, data };
}

export function isUserResponse(value: unknown): value is UserResponse {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.email === "string"
    && typeof value.phone === "string"
    && typeof value.fullName === "string"
    && isNullableString(value.gender)
    && isNullableString(value.address)
    && isNullableString(value.dateOfBirth)
    && Array.isArray(value.roles)
    && value.roles.every((role) => typeof role === "string")
    && typeof value.status === "string"
    && typeof value.createdAt === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
