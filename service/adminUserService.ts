import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { isUserResponse } from "./authService";
import type { UserResponse } from "../types/authResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type {
  AdminAssignRolesRequest, AdminCreateUserRequest, AdminPasswordRequest,
  AdminRole, AdminRolePage, AdminUpdateUserRequest, AdminUserFilters, AdminUserPage,
} from "../types/adminUserType";

export const ADMIN_USER_PATH = "/api/v1/users";
const userPath = (id: string) => `${ADMIN_USER_PATH}/${encodeURIComponent(id)}`;
const parseUser = (value: unknown): UserResponse => {
  if (!isUserResponse(value)) throw createInvalidResponseError("User administration must return a valid user.");
  return value;
};
const isNullableString = (value: unknown) => value === undefined || value === null || typeof value === "string";
export const isAdminRole = (value: unknown): value is AdminRole =>
  isRecord(value) && typeof value.id === "string" && typeof value.code === "string" &&
  typeof value.name === "string" && isNullableString(value.description) &&
  Array.isArray(value.privileges) && value.privileges.every((permission) =>
    isRecord(permission) && typeof permission.code === "string" && typeof permission.name === "string" && isNullableString(permission.description));

export const getAdminUsers = async (filters: AdminUserFilters, options: ServiceRequestOptions = {}): Promise<AdminUserPage> => {
  const response = await requestApi<unknown>("GET", ADMIN_USER_PATH, undefined, {
    ...options, auth: true,
    params: { ...filters, q: filters.q.trim() || undefined, role: filters.role || undefined, status: filters.status || undefined },
  });
  if (!Array.isArray(response.data) || !response.data.every(isUserResponse) || !response.page)
    throw createInvalidResponseError("User list must contain valid users and page metadata.");
  return { users: response.data, page: response.page };
};

/** #211 endpoints below require that backend branch; failures remain visible, with no mock fallback. */
export const createAdminUser = async (input: AdminCreateUserRequest, options: ServiceRequestOptions = {}): Promise<UserResponse> => {
  const { fullName, email, phone, password, identityNumber, gender, address, dateOfBirth, roleCodes } = input;
  return parseUser((await requestApi<unknown>("POST", ADMIN_USER_PATH, {
    fullName, email, phone, password, identityNumber, gender, address, dateOfBirth, roleCodes,
  }, { ...options, auth: true })).data);
};
export const updateAdminUser = async (id: string, input: AdminUpdateUserRequest, options: ServiceRequestOptions = {}): Promise<UserResponse> => {
  const { fullName, email, gender, address, dateOfBirth } = input;
  return parseUser((await requestApi<unknown>("PUT", userPath(id), {
    fullName, email, gender, address, dateOfBirth,
  }, { ...options, auth: true })).data);
};
export const deleteAdminUser = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("DELETE", userPath(id), undefined, { ...options, auth: true });
};
export const setAdminUserPassword = async (id: string, input: AdminPasswordRequest, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("PUT", `${userPath(id)}/password`, { newPassword: input.newPassword }, { ...options, auth: true });
};
export const assignAdminUserRoles = async (id: string, input: AdminAssignRolesRequest, options: ServiceRequestOptions = {}): Promise<UserResponse> =>
  parseUser((await requestApi<unknown>("PUT", `${userPath(id)}/roles`, { roleCodes: input.roleCodes }, { ...options, auth: true })).data);
export const unlockAdminUser = async (id: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("POST", `${userPath(id)}/unlock`, undefined, { ...options, auth: true });
};
export const getAdminRoles = async (q: string, options: ServiceRequestOptions = {}): Promise<AdminRolePage> => {
  const response = await requestApi<unknown>("GET", "/api/v1/roles", undefined, {
    ...options, auth: true, params: { q: q.trim() || undefined, sort: "name,asc", page: 0, size: 100 },
  });
  if (!Array.isArray(response.data) || !response.data.every(isAdminRole) || !response.page)
    throw createInvalidResponseError("Role list must contain valid roles, privileges and page metadata.");
  return { roles: response.data, page: response.page };
};
