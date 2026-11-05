import assert from "node:assert/strict";
import test from "node:test";
import { isApiError, requestApi } from "../configs/api";
import { getMe, register } from "../service/authService";
import { updateProfile } from "../service/accountService";
import { createAuthStub, type AuthStubLoginResponse } from "../mocks/authStub";
import type { ApiContext } from "../types/commonRequestType";
import type { RegisterRequest } from "../types/authRequestType";

const registerInput: RegisterRequest = {
  email: "buyer@example.test", phone: "0900000000", password: "StrongPass123!",
  fullName: "Nguyen Van Buyer", identityNumber: "012345678901", gender: "MALE",
  address: "1 Test Street", dateOfBirth: "1999-01-01",
};
const fixtureLogin = async (context: ApiContext, email = registerInput.email) =>
  (await requestApi<AuthStubLoginResponse>("POST", "/api/v1/auth/login", {
    email, password: registerInput.password,
  }, { context, auth: false })).data;
const hasStatus = (status: number) => (error: unknown) =>
  isApiError(error) && error.status === status;

test("profile PUT normalizes fields and keeps existing sessions tied to identity after email changes", async () => {
  let accessToken: string | null = null;
  const context: ApiContext = { fetch: createAuthStub(), getAccessToken: () => accessToken };
  await register(registerInput, { context });
  await assert.rejects(updateProfile({ fullName: "Not allowed" }, { context }), hasStatus(401));
  const first = await fixtureLogin(context);
  const second = await fixtureLogin(context);
  accessToken = first.accessToken;
  const updated = await updateProfile({
    fullName: "  Updated Buyer  ", email: "  NEW.BUYER@EXAMPLE.TEST  ",
    address: "  New street  ", dateOfBirth: "2000-02-29", gender: "FEMALE",
  }, { context });
  assert.equal(updated.fullName, "Updated Buyer");
  assert.equal(updated.email, "new.buyer@example.test");
  assert.equal(updated.address, "New street");
  assert.equal(updated.phone, registerInput.phone);
  assert.deepEqual(await getMe({ context }), updated);

  const ignored = await requestApi("PUT", "/api/v1/users/me", {
    fullName: null, email: null, address: null, gender: null, dateOfBirth: null,
    phone: "invalid", identityNumber: "other", password: "changed", roles: ["ADMIN"], status: "LOCKED",
  }, { context });
  assert.deepEqual(ignored.data, updated);
  accessToken = second.accessToken;
  assert.deepEqual(await getMe({ context }), updated, "all issued sessions retain the same user identity");
  await assert.rejects(fixtureLogin(context), hasStatus(401));
  assert.ok((await fixtureLogin(context, updated.email)).accessToken);
  assert.equal((await updateProfile({ address: "  " }, { context })).address, "");
});

test("profile PUT validates atomically and rejects another user's normalized email", async () => {
  let accessToken: string | null = null;
  const context: ApiContext = { fetch: createAuthStub(), getAccessToken: () => accessToken };
  const original = await register(registerInput, { context });
  await register({ ...registerInput, email: "other@example.test", phone: "0900000001", identityNumber: "012345678902" }, { context });
  accessToken = (await fixtureLogin(context)).accessToken;

  for (const [payload, field] of [
    [{ fullName: " " }, "fullName"],
    [{ email: "invalid" }, "email"],
    [{ dateOfBirth: "2999-01-01" }, "dateOfBirth"],
  ] as const) {
    await assert.rejects(updateProfile({ address: "Must not persist", ...payload }, { context }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.status, 400);
      assert.ok(error.fieldErrors?.[field]?.length);
      return true;
    });
    assert.deepEqual(await getMe({ context }), original);
  }
  for (const payload of [{ gender: "UNKNOWN" }, { dateOfBirth: "2000-02-30" }]) {
    await assert.rejects(requestApi("PUT", "/api/v1/users/me", payload, { context }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.status, 400);
      assert.equal(error.type, "urn:problem:invalid-request-body");
      return true;
    });
    assert.deepEqual(await getMe({ context }), original);
  }
  await assert.rejects(updateProfile({ email: " OTHER@EXAMPLE.TEST ", fullName: "Must not persist" }, { context }), hasStatus(409));
  assert.deepEqual(await getMe({ context }), original);
  assert.deepEqual(await updateProfile({ email: " BUYER@EXAMPLE.TEST " }, { context }), original);
});

test("profile service allowlists wire fields, reads current Bearer and forwards cancellation", async () => {
  const controller = new AbortController();
  const user = { ...registerInput, id: "user-id", roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-05T00:00:00Z" };
  const context: ApiContext = {
    getAccessToken: () => "current-session-token",
    fetch: async (input, init) => {
      assert.equal(String(input), "/api/v1/users/me");
      assert.equal(init?.method, "PUT");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current-session-token");
      assert.deepEqual(JSON.parse(String(init?.body)), { fullName: "Updated" });
      assert.equal(init?.signal?.aborted, false);
      controller.abort();
      assert.equal(init?.signal?.aborted, true);
      return new Response(JSON.stringify({ code: 0, message: "response success", data: user }));
    },
  };
  await assert.rejects(updateProfile({ fullName: "Updated", ...{ phone: "ignored", roles: ["ADMIN"] } }, { context, signal: controller.signal }), { name: "AbortError" });
});

test("profile service rejects malformed nested user responses and missing envelopes", async () => {
  for (const body of [
    { id: "incomplete" },
    { code: 0, message: "response success", data: { ...registerInput, id: "u1", roles: "BUYER", status: "ACTIVE", createdAt: "2026-11-05T00:00:00Z" } },
  ]) {
    await assert.rejects(updateProfile({ fullName: "Updated" }, {
      context: { fetch: async () => new Response(JSON.stringify(body)) },
    }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
});

test("auth fixture emits backend envelopes for registration, test login, GET and PUT profile", async () => {
  const stub = createAuthStub();
  const registered = await stub("/api/v1/auth/register", { method: "POST", body: JSON.stringify(registerInput) });
  assert.equal(registered.status, 201);
  const registration = await registered.json();
  assert.equal(registration.code, 0);
  assert.equal(registration.message, "response success");
  assert.equal(registration.data.email, registerInput.email);
  const loggedIn = await stub("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email: registerInput.email, password: registerInput.password }) });
  const login = await loggedIn.json();
  assert.equal(login.code, 0);
  assert.equal(login.message, "response success");
  assert.equal(typeof login.data.accessToken, "string");
  for (const method of ["GET", "PUT"]) {
    const response = await stub("/api/v1/users/me", {
      method, headers: { Authorization: `Bearer ${login.data.accessToken}` },
      ...(method === "PUT" ? { body: JSON.stringify({ fullName: "Updated Buyer" }) } : {}),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.code, 0);
    assert.equal(body.message, "response success");
    assert.equal(body.data.fullName, method === "PUT" ? "Updated Buyer" : registerInput.fullName);
  }
});
