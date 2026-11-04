import { createInvalidResponseError, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { RegisterRequest } from "../types/authRequestType";
import type { UserResponse } from "../types/authResponseType";

export const REGISTER_PATH = "/api/v1/auth/register";
export const ME_PATH = "/api/v1/users/me";

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
  typeof value.createdAt === "string";
