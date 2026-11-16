import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { canManageUser } from "../features/adminUserUtils";
import { assignAdminUserRoles, createAdminUser, deleteAdminUser, getAdminRoles, getAdminUsers, setAdminUserPassword, unlockAdminUser, updateAdminUser } from "../service/adminUserService";
import type { AdminCreateUserRequest, AdminUserFilters } from "../types/adminUserType";
import type { ApiContext } from "../types/commonRequestType";

const user = {
  id: "user/1", fullName: "Test User", email: "user@example.test", phone: "0900000000",
  gender: "FEMALE", address: "Test address", dateOfBirth: "2000-01-01", roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-16T00:00:00Z",
};
const page = { number: 0, size: 20, totalElements: 1, totalPages: 1 };
const filters: AdminUserFilters = { q: "  buyer@example.test  ", role: "BUYER", status: "ACTIVE", page: 0, size: 20, sort: "fullName", direction: "desc" };
const envelope = (data: unknown, metadata?: typeof page) => new Response(JSON.stringify({ code: 0, message: "response success", data, ...(metadata ? { page: metadata } : {}) }));

test("admin user listing serializes search/role/status/paging and uses current scoped Bearer", async () => {
  let token = "first-token";
  const context: ApiContext = {
    baseUrl: "https://gateway.example.test", getAccessToken: () => token,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/api/v1/users");
      assert.equal(url.searchParams.get("q"), "buyer@example.test");
      assert.equal(url.searchParams.get("role"), "BUYER");
      assert.equal(url.searchParams.get("status"), "ACTIVE");
      assert.equal(url.searchParams.get("sort"), "fullName");
      assert.equal(url.searchParams.get("direction"), "desc");
      assert.equal(url.searchParams.get("page"), "0");
      assert.equal(url.searchParams.get("size"), "20");
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${token}`);
      return envelope([user], page);
    },
  };
  assert.deepEqual(await getAdminUsers(filters, { context }), { users: [user], page });
  token = "renewed-token";
  assert.deepEqual(await getAdminUsers(filters, { context }), { users: [user], page });
});

test("user mutations use pinned #211 methods, encoded IDs, allowlisted DTOs and bodyless 204", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  const context: ApiContext = { getAccessToken: () => "current-token", fetch: async (input, init) => {
    const path = String(input);
    const method = String(init?.method);
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current-token");
    return method === "DELETE" || path.endsWith("/password") || path.endsWith("/unlock") ? new Response(null, { status: 204 }) : envelope(user);
  } };
  const body: AdminCreateUserRequest = {
    fullName: user.fullName, email: user.email, phone: user.phone, password: "Test-policy-123!",
    identityNumber: "012345678901", gender: "FEMALE", address: "Test address", dateOfBirth: "2000-01-01", roleCodes: ["BUYER"],
  };
  await createAdminUser({ ...body, status: "LOCKED" } as AdminCreateUserRequest, { context });
  await updateAdminUser(user.id, { fullName: "Edited User", phone: "must-not-be-sent", roleCodes: ["ADMIN"] } as never, { context });
  await setAdminUserPassword(user.id, { newPassword: "New-test-policy-123!" }, { context });
  await assignAdminUserRoles(user.id, { roleCodes: ["BUYER", "SELLER"] }, { context });
  await unlockAdminUser(user.id, { context });
  await deleteAdminUser(user.id, { context });
  assert.deepEqual(calls, [
    { path: "/api/v1/users", method: "POST", body },
    { path: "/api/v1/users/user%2F1", method: "PUT", body: { fullName: "Edited User" } },
    { path: "/api/v1/users/user%2F1/password", method: "PUT", body: { newPassword: "New-test-policy-123!" } },
    { path: "/api/v1/users/user%2F1/roles", method: "PUT", body: { roleCodes: ["BUYER", "SELLER"] } },
    { path: "/api/v1/users/user%2F1/unlock", method: "POST", body: undefined },
    { path: "/api/v1/users/user%2F1", method: "DELETE", body: undefined },
  ]);
});

test("malformed users, paging and role privileges are rejected at the service boundary", async () => {
  for (const data of [[{ ...user, roles: [4] }], [user]]) {
    await assert.rejects(getAdminUsers(filters, { context: { fetch: async () => envelope(data) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
  await assert.rejects(getAdminRoles("", { context: { fetch: async () => envelope([{ id: "r1", name: "Buyer", code: "BUYER", privileges: [{ code: 42, name: "Bad" }] }], page) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  await assert.rejects(createAdminUser({} as AdminCreateUserRequest, { context: { fetch: async () => envelope({ ...user, status: "UNKNOWN" }) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("role picker requests the fixed role list and parses privileges", async () => {
  const role = { id: "role-1", code: "BUYER", name: "Buyer", description: null, privileges: [{ code: "ORDER.VIEW", name: "View orders", description: null }] };
  const result = await getAdminRoles(" buyer ", { context: { fetch: async (input) => {
    const url = new URL(String(input), "https://gateway.example.test");
    assert.equal(url.pathname, "/api/v1/roles");
    assert.equal(url.searchParams.get("q"), "buyer");
    assert.equal(url.searchParams.get("sort"), "name,asc");
    assert.equal(url.searchParams.get("size"), "100");
    return envelope([role], page);
  } } });
  assert.deepEqual(result.roles, [role]);
});

test("server 403/409/validation errors remain failures and cancellation propagates", async () => {
  for (const status of [403, 409]) {
    await assert.rejects(unlockAdminUser(user.id, { context: { fetch: async () => new Response(JSON.stringify({ title: "Denied", status, detail: "Not permitted", code: "USER_ACCOUNT_NOT_LOCKED" }), { status }) } }), (error: unknown) => isApiError(error) && error.status === status && error.code === "USER_ACCOUNT_NOT_LOCKED");
  }
  await assert.rejects(setAdminUserPassword(user.id, { newPassword: "short" }, { context: { fetch: async () => new Response(JSON.stringify({ title: "Invalid", status: 400, errors: [{ field: "newPassword", code: "SIZE", detail: "Password policy rejected" }] }), { status: 400 }) } }), (error: unknown) => isApiError(error) && error.fieldErrors?.newPassword?.[0] === "Password policy rejected");
  const controller = new AbortController();
  await assert.rejects(getAdminUsers(filters, { signal: controller.signal, context: { fetch: async (_, init) => {
    assert.equal(init?.signal?.aborted, false);
    controller.abort();
    assert.equal(init?.signal?.aborted, true);
    return envelope([user], page);
  } } }), (error: unknown) => error instanceof Error && error.name === "AbortError");
});

test("support staff can only edit; admin can perform every user action", () => {
  const actions = ["create", "edit", "delete", "password", "roles", "unlock"] as const;
  for (const action of actions) {
    assert.equal(canManageUser(["SUPPORT_STAFF"], action), action === "edit");
    assert.equal(canManageUser(["BUYER", "SUPPORT_STAFF"], action), action === "edit");
    assert.equal(canManageUser(["ADMIN"], action), true);
    assert.equal(canManageUser(["BUYER"], action), false);
    assert.equal(canManageUser(["SELLER"], action), false);
    assert.equal(canManageUser([], action), false);
  }
});
