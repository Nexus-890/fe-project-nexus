import { createInvalidResponseError, requestApi } from "../configs/api";
import { isUserResponse, ME_PATH } from "./authService";
import { ACCOUNT_EXTENSIONS_ENABLED } from "../configs/account";
import type { UpdateProfileRequest } from "../types/accountType";
import type { UserResponse } from "../types/authResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

export const PROFILE_PATH = ME_PATH;

export const AVATAR_PATH = "/api/v1/users/me/avatar";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const avatarFileError = (file: { size: number; type: string }): string | null => {
  if (file.size <= 0) return "Choose an image file.";
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return "Use a JPEG, PNG or WebP image.";
  if (file.size > AVATAR_MAX_BYTES) return "The image must be 2 MB or smaller.";
  return null;
};

export const uploadAvatar = async (file: File, options: ServiceRequestOptions = {}): Promise<UserResponse> => {
  const problem = avatarFileError(file);
  if (problem) throw createInvalidResponseError(problem);
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await requestApi<unknown>("POST", AVATAR_PATH, form, { ...options, auth: true, params: undefined });
  if (!isUserResponse(response.data) || typeof response.data.avatarUrl !== "string" || !/^https?:\/\//.test(response.data.avatarUrl))
    throw createInvalidResponseError("Avatar upload must return the profile with its new avatar.");
  return response.data;
};

export const removeAvatar = async (options: ServiceRequestOptions = {}): Promise<UserResponse> => {
  const response = await requestApi<unknown>("DELETE", AVATAR_PATH, undefined, { ...options, auth: true });
  if (!isUserResponse(response.data) || (response.data.avatarUrl !== undefined && response.data.avatarUrl !== null))
    throw createInvalidResponseError("Avatar removal must return the profile without an avatar.");
  return response.data;
};

export const updateProfile = async (
  input: UpdateProfileRequest,
  options: ServiceRequestOptions = {},
): Promise<UserResponse> => {
  // Ignore unsupported fields even if a caller passes a wider runtime object.
  const { fullName, email, dateOfBirth, gender, address } = input;
  const response = await requestApi<unknown>(
    "PUT",
    PROFILE_PATH,
    { fullName, email, dateOfBirth, gender, address, ...(ACCOUNT_EXTENSIONS_ENABLED && input.phone !== undefined ? { phone: input.phone } : {}) },
    { ...options, auth: true },
  );
  if (!isUserResponse(response.data))
    throw createInvalidResponseError(
      "Profile update must return a valid user.",
    );
  return response.data;
};
