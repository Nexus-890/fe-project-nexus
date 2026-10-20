import type { ApiClient } from "../lib/api-client";
import { createInvalidResponseError } from "../lib/api-client";
import { isUserResponse } from "./auth";
import type { UpdateProfileRequest } from "../types/account/type";
import type { UserResponse } from "../types/auth/response/type";
import type { ApiResult } from "../types/common/response/type";

export const PROFILE_PATH = "/api/v1/users/me";

/** Proposed endpoints only; keep disabled features from calling them until BE confirms contracts. */
export const PENDING_ACCOUNT_ENDPOINTS = {
  avatar: "/api/v1/users/me/avatar",
  password: "/api/v1/users/me/password",
  reputation: "/api/v1/users/me/reputation",
  penalties: "/api/v1/users/me/penalties",
} as const;

export function createAccountApi(client: ApiClient) {
  return {
    async updateProfile(input: UpdateProfileRequest, signal?: AbortSignal): Promise<ApiResult<UserResponse>> {
      // Allowlist the current DTO: phone/identity/avatar must never be silently ignored by BE.
      const { fullName, email, dateOfBirth, gender, address } = input;
      const result = await client.put<unknown>(PROFILE_PATH, {
        fullName, email, dateOfBirth, gender, address,
      }, { auth: true, signal });
      if (!result.ok) return result;
      if (!isUserResponse(result.data)) {
        return { ok: false, error: createInvalidResponseError("Profile update must return a UserResponse") };
      }
      return { ok: true, data: result.data };
    },
  };
}
