import type { components } from "./adminUser211GeneratedType";
import type { UserResponse } from "./authResponseType";
import type { PageInfo } from "./commonResponseType";

/** Mutation DTOs are pinned to the unmerged #211 OpenAPI, not delivered develop APIs. */
export type AdminCreateUserRequest = components["schemas"]["AdminCreateUser"];
export type AdminUpdateUserRequest = components["schemas"]["UpdateProfile"];
export type AdminPasswordRequest = components["schemas"]["AdminPassword"];
export type AdminAssignRolesRequest = components["schemas"]["AssignRoles"];
export type AdminRole = components["schemas"]["Role"];
export type AdminRoleCode = AdminAssignRolesRequest["roleCodes"][number];
export type AdminUserFilters = {
  q: string;
  role: string;
  status: string;
  page: number;
  size: number;
  sort: "fullName" | "email" | "createdAt";
  direction: "asc" | "desc";
};
export type AdminUserPage = { users: UserResponse[]; page: PageInfo };
export type AdminRolePage = { roles: AdminRole[]; page: PageInfo };
