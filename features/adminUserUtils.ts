import type { AdminRoleCode } from "../types/adminUserType";

export type AdminUserAction = "create" | "edit" | "delete" | "password" | "roles" | "unlock";
export const adminRoleLabels: Record<AdminRoleCode, string> = {
  ADMIN: "Admin", SUPPORT_STAFF: "Support Staff", BUYER: "Buyer", SELLER: "Seller",
};
export const adminRoleCodes = Object.keys(adminRoleLabels) as AdminRoleCode[];

/** The FE acceptance scope restricts support to search and edit, including mixed buyer accounts. */
export const canManageUser = (roles: readonly string[], action: AdminUserAction): boolean =>
  roles.includes("ADMIN") || action === "edit" && roles.includes("SUPPORT_STAFF");
