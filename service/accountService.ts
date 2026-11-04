import { createInvalidResponseError, requestApi } from "../configs/api";
import { isUserResponse } from "./authService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { UpdateProfileRequest } from "../types/accountType";
import type { UserResponse } from "../types/authResponseType";

export const PROFILE_PATH = "/api/v1/users/me";

/** Proposed contracts only; disabled account features must not call them. */
export const PENDING_ACCOUNT_ENDPOINTS = {
  avatar: "/api/v1/users/me/avatar",
  password: "/api/v1/users/me/password",
  reputation: "/api/v1/users/me/reputation",
  penalties: "/api/v1/users/me/penalties",
} as const;

export const updateProfile = async (
  input: UpdateProfileRequest,
  options: ServiceRequestOptions = {},
): Promise<UserResponse> => {
  // Allowlist editable fields so phone, identity and access fields never leak.
  const { fullName, email, dateOfBirth, gender, address } = input;
  const response = await requestApi<unknown>("PUT", PROFILE_PATH, {
    fullName, email, dateOfBirth, gender, address,
  }, { ...options, auth: true });
  if (!isUserResponse(response.data))
    throw createInvalidResponseError("Profile update must return a valid user.");
  return response.data;
};
