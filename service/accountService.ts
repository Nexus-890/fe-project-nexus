import { createInvalidResponseError, requestApi } from "../configs/api";
import { isUserResponse, ME_PATH } from "./authService";
import type { UpdateProfileRequest } from "../types/accountType";
import type { UserResponse } from "../types/authResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

export const PROFILE_PATH = ME_PATH;

/** These account capabilities remain disabled until their contracts are delivered. */
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
  // Ignore unsupported fields even if a caller passes a wider runtime object.
  const { fullName, email, dateOfBirth, gender, address } = input;
  const response = await requestApi<unknown>(
    "PUT",
    PROFILE_PATH,
    { fullName, email, dateOfBirth, gender, address },
    { ...options, auth: true },
  );
  if (!isUserResponse(response.data))
    throw createInvalidResponseError(
      "Profile update must return a valid user.",
    );
  return response.data;
};
