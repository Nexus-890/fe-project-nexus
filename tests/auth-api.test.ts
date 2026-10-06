import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createApiClient } from "../lib/api-client";
import { createAuthApi } from "../features/auth/api";
import { createAuthStub } from "../features/auth/testing/stub";
import type { RegisterRequest } from "../types/api";

const registerInput: RegisterRequest = {
  email: "buyer@example.test",
  phone: "0900000000",
  password: "StrongPass123!",
  fullName: "Nguyen Van Buyer",
  identityNumber: "012345678901",
  gender: "MALE",
  address: "1 Test Street",
  dateOfBirth: "1999-01-01",
};

test("auth stub cannot be enabled in production, including injected transports", () => {
  const result = spawnSync(process.execPath, [
    "-e", `require(${JSON.stringify(require.resolve("../features/auth/testing/stub"))}).createAuthStub()`,
  ], { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /auth stub is disabled in production/);
});

test("transport attaches Bearer token only for protected relative requests", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input), authorization: headers.get("Authorization") });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const client = createApiClient({ getAccessToken: () => "token-123", fetch: fetchStub });

  const protectedResult = await client.get("/api/v1/users/me");
  const publicResult = await client.post("/api/v1/auth/login", { email: "a", password: "b" }, { auth: false });
  const externalResult = await client.get("https://evil.example/api/v1/users/me");

  assert.equal(protectedResult.ok, true);
  assert.equal(publicResult.ok, true);
  assert.equal(externalResult.ok, false);
  assert.equal(seen[0]?.authorization, "Bearer token-123");
  assert.equal(seen[1]?.authorization, null);
  assert.equal(seen.length, 2, "external URL must be rejected before fetch so bearer cannot leak");
});

test("400 field error is returned as typed ApiError object", async () => {
  const client = createApiClient({
    fetch: async () => new Response(JSON.stringify({
      type: "about:blank",
      title: "Validation failed",
      status: 400,
      detail: "Invalid email",
      traceId: "trace-1",
      fieldErrors: { email: ["email is required"] },
    }), { status: 400 }),
  });

  const result = await client.post("/api/v1/auth/register", {}, { auth: false });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.error, "object");
    assert.equal(result.error.kind, "http");
    assert.equal(result.error.status, 400);
    assert.deepEqual(result.error.fieldErrors, { email: ["email is required"] });
  }
});

test("stub register-login-me flow carries Authorization and stores no token in web storage", async () => {
  const storageWrites: string[] = [];
  const storage = {
    get length() { return storageWrites.length; },
    clear() { storageWrites.length = 0; },
    getItem() { return null; },
    key(index: number) { return storageWrites[index] ?? null; },
    removeItem(key: string) { storageWrites.push(`remove:${key}`); },
    setItem(key: string, value: string) { storageWrites.push(`${key}:${value}`); },
  } satisfies Storage;

  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: storage, configurable: true });

  let accessToken: string | null = null;
  let lastAuthorization: string | null = null;
  const stub = createAuthStub();
  const fetchSpy: typeof fetch = async (input, init) => {
    lastAuthorization = new Headers(init?.headers).get("Authorization");
    return stub(input, init);
  };
  const client = createApiClient({ getAccessToken: () => accessToken, fetch: fetchSpy });
  const auth = createAuthApi(client);

  const register = await auth.register(registerInput);
  assert.equal(register.ok, true);

  const login = await auth.login({ email: registerInput.email, password: registerInput.password });
  assert.equal(login.ok, true);
  if (!login.ok) {
    assert.fail("login should succeed");
  }
  const loginToken = login.data.accessToken;

  accessToken = loginToken;
  assert.equal(storageWrites.some((entry) => entry.includes(loginToken)), false);

  const me = await auth.me();
  assert.equal(me.ok, true);
  assert.equal(lastAuthorization, `Bearer ${loginToken}`);

  accessToken = null;
  const afterSignOut = await auth.me();
  assert.equal(afterSignOut.ok, false);
  if (!afterSignOut.ok) {
    assert.equal(afterSignOut.error.status, 401);
  }
});

test("stub aborts delayed requests with AbortError", async () => {
  const controller = new AbortController();
  const stub = createAuthStub({ delayMs: 50 });
  const pending = stub("http://stub.test/api/v1/users/me", { signal: controller.signal });

  controller.abort();

  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("separate stub instances do not accept each other's runtime token", async () => {
  const authA = createAuthApi(createApiClient({ fetch: createAuthStub() }));
  const register = await authA.register(registerInput);
  assert.equal(register.ok, true);
  const login = await authA.login({ email: registerInput.email, password: registerInput.password });
  assert.equal(login.ok, true);
  if (!login.ok) {
    assert.fail("login should succeed");
  }
  const tokenFromA = login.data.accessToken;
  const authB = createAuthApi(createApiClient({ fetch: createAuthStub(), getAccessToken: () => tokenFromA }));
  const meFromB = await authB.me();

  assert.equal(meFromB.ok, false);
  if (!meFromB.ok) {
    assert.equal(meFromB.error.status, 401);
  }
});

test("transport rejects unsafe paths and versioned baseUrl before fetch", async () => {
  assert.throws(() => createApiClient({ baseUrl: "https://api.example.test/api/v1", fetch: async () => new Response("{}") }), /origin only/);

  let called = false;
  const client = createApiClient({
    fetch: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
  });

  const result = await client.get("/\\evil.example/api/v1/users/me");
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test("non-json HTTP errors keep HTTP status", async () => {
  const client = createApiClient({
    fetch: async () => new Response("not-json", { status: 401, statusText: "Unauthorized" }),
  });

  const result = await client.get("/api/v1/users/me");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.kind, "http");
    assert.equal(result.error.status, 401);
    assert.equal(result.error.title, "Unauthorized");
  }
});

test("stub validation and duplicate conflicts return typed HTTP errors", async () => {
  const auth = createAuthApi(createApiClient({ fetch: createAuthStub() }));

  const invalidRegister = await auth.register({ ...registerInput, email: "" });
  assert.equal(invalidRegister.ok, false);
  if (!invalidRegister.ok) {
    assert.equal(invalidRegister.error.status, 400);
    assert.deepEqual(invalidRegister.error.fieldErrors?.email, ["email is required"]);
  }

  const first = await auth.register(registerInput);
  assert.equal(first.ok, true);

  const duplicate = await auth.register(registerInput);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.error.status, 409);
  }

  const invalidLogin = await auth.login({ email: "", password: "" });
  assert.equal(invalidLogin.ok, false);
  if (!invalidLogin.ok) {
    assert.equal(invalidLogin.error.status, 400);
    assert.deepEqual(invalidLogin.error.fieldErrors?.password, ["password is required"]);
  }
});

test("auth API validates malformed login and user success bodies", async () => {
  const badLogin = createAuthApi(createApiClient({
    fetch: async () => new Response(JSON.stringify({ accessToken: "token", expiresIn: 0, tokenType: "Bearer" }), { status: 200 }),
  }));
  const badLoginResult = await badLogin.login({ email: "a@example.test", password: "password" });
  assert.equal(badLoginResult.ok, false);
  if (!badLoginResult.ok) {
    assert.equal(badLoginResult.error.kind, "invalid-response");
  }

  const badMe = createAuthApi(createApiClient({
    getAccessToken: () => "token",
    fetch: async () => new Response(JSON.stringify({
      id: "u1",
      email: "a@example.test",
      phone: "0900000000",
      fullName: "A",
      gender: null,
      address: null,
      dateOfBirth: null,
      roles: "BUYER",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    }), { status: 200 }),
  }));
  const badMeResult = await badMe.me();
  assert.equal(badMeResult.ok, false);
  if (!badMeResult.ok) {
    assert.equal(badMeResult.error.kind, "invalid-response");
  }
});
