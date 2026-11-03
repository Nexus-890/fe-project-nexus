import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createApiClient } from "../lib/api-client";
import { createAuthApi } from "../service/auth";
import { createAccountApi } from "../service/account";
import { createAuthStub } from "./fixtures/auth-stub";
import type { BackendProblemDetails } from "../types/common/response/type";
import type { RegisterRequest } from "../types/auth/request/type";
import type { UserResponse } from "../types/auth/response/type";

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

test("transport unwraps backend success envelopes and preserves legacy bare payloads", async () => {
  for (const data of [{ id: "user-1" }, ["BUYER"], null]) {
    const client = createApiClient({ fetch: async () => new Response(JSON.stringify({
      code: 0, message: "response success", data,
    }), { status: 200 }) });
    assert.deepEqual(await client.get("/api/v1/users/me"), { ok: true, data });
  }

  for (const data of [{ id: "legacy-user" }, { data: "a domain field" }]) {
    const client = createApiClient({ fetch: async () => new Response(JSON.stringify(data), { status: 200 }) });
    assert.deepEqual(await client.get("/legacy"), { ok: true, data });
  }
});

test("malformed success envelopes are invalid responses", async () => {
  for (const body of [
    { code: 0, message: "response success" },
    { code: "0", message: "response success", data: {} },
    { code: 0, message: null, data: {} },
  ]) {
    const client = createApiClient({ fetch: async () => new Response(JSON.stringify(body), { status: 200 }) });
    const result = await client.get("/api/v1/users/me");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.kind, "invalid-response");
  }
});

test("auth stub cannot be enabled in production, including injected transports", () => {
  const result = spawnSync(process.execPath, [
    "-e", `require(${JSON.stringify(require.resolve("./fixtures/auth-stub"))}).createAuthStub()`,
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

test("common-web validation errors are returned as typed ApiError with form field errors", async () => {
  const client = createApiClient({
    fetch: async () => new Response(JSON.stringify({
      type: "urn:problem:validation-error",
      title: "Validation Failed",
      status: 400,
      detail: "The request data is invalid",
      instance: "/api/v1/auth/register",
      traceId: "trace-1",
      errors: [
        { field: "email", code: "VALIDATION_EMAIL", detail: "Invalid email address!" },
        { field: "password", code: "VALIDATION_NOT_BLANK", detail: "cannot be blank!" },
      ],
    }), { status: 400, headers: { "Content-Type": "application/problem+json" } }),
  });

  const result = await client.post("/api/v1/auth/register", {}, { auth: false });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.error, "object");
    assert.equal(result.error.kind, "http");
    assert.equal(result.error.status, 400);
    assert.equal(result.error.type, "urn:problem:validation-error");
    assert.equal(result.error.title, "Validation Failed");
    assert.equal(result.error.detail, "The request data is invalid");
    assert.equal(result.error.instance, "/api/v1/auth/register");
    assert.equal(result.error.traceId, "trace-1");
    assert.deepEqual(result.error.errors, [
      { field: "email", message: "Invalid email address!" },
      { field: "password", message: "cannot be blank!" },
    ]);
    assert.deepEqual(result.error.fieldErrors, {
      email: ["Invalid email address!"], password: ["cannot be blank!"],
    });
  }
});

test("validation normalization ignores malformed entries and groups repeated fields safely", async () => {
  const client = createApiClient({ fetch: async () => new Response(JSON.stringify({
    title: "Validation Failed", status: 500,
    errors: [
      null, "invalid", {}, { field: "email", message: 123 }, { field: 123, message: "invalid" },
      { field: "email", message: "First message" },
      { field: "email", message: "Second message" },
      { field: "__proto__", message: "A field name is data, not a prototype" },
    ],
  }), { status: 400 }) });
  const result = await client.post("/validation", {}, { auth: false });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.status, 400, "HTTP status takes precedence over body status");
    assert.deepEqual(result.error.fieldErrors?.email, ["First message", "Second message"]);
    assert.deepEqual(result.error.fieldErrors?.["__proto__"], ["A field name is data, not a prototype"]);
    assert.equal(Object.getPrototypeOf(result.error.fieldErrors), Object.prototype);
    assert.equal(result.error.errors?.length, 3);
  }
});

test("common-web errors array takes precedence over legacy field error records", async () => {
  const client = createApiClient({ fetch: async () => new Response(JSON.stringify({
    title: "Bad Request", errors: [{ field: "email", code: "VALIDATION_EMAIL", detail: "Current backend message", message: "Legacy message" }],
    fieldErrors: { email: ["Legacy message"] },
  }), { status: 400 }) });
  const result = await client.get("/validation");
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(result.error.fieldErrors, { email: ["Current backend message"] });
});

test("legacy field error records remain compatible", async () => {
  for (const body of [
    { fieldErrors: { email: ["Invalid email", 123], password: "Required" } },
    { errors: { email: ["Invalid email", 123], password: "Required" } },
  ]) {
    const client = createApiClient({ fetch: async () => new Response(JSON.stringify(body), { status: 400 }) });
    const result = await client.get("/validation");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.error.fieldErrors, { email: ["Invalid email"], password: ["Required"] });
      assert.equal(result.error.errors, undefined);
    }
  }
});

test("common-web errors without valid field entries stay typed form-level errors", async () => {
  for (const errors of [undefined, [], [null, { field: "email" }], "invalid"]) {
    const client = createApiClient({ fetch: async () => new Response(JSON.stringify({
      type: "urn:problem:domain-error", title: "Bad Request", detail: "Email is existed", errors,
    }), { status: 400 }) });
    const result = await client.get("/validation");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, "http");
      assert.equal(result.error.detail, "Email is existed");
      assert.equal(result.error.fieldErrors, undefined);
      assert.equal(result.error.errors, undefined);
    }
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

test("auth fixtures emit the backend envelope for register, login, GET and PUT profile", async () => {
  const stub = createAuthStub();
  const registered = await stub("/api/v1/auth/register", { method: "POST", body: JSON.stringify(registerInput) });
  assert.equal(registered.status, 201);
  const registration = await registered.json();
  assert.equal(registration.code, 0);
  assert.equal(registration.message, "response success");
  assert.equal(registration.data.email, registerInput.email);

  const loggedIn = await stub("/api/v1/auth/login", {
    method: "POST", body: JSON.stringify({ email: registerInput.email, password: registerInput.password }),
  });
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

test("stub aborts delayed requests with AbortError", async () => {
  const controller = new AbortController();
  const stub = createAuthStub({ delayMs: 50 });
  const pending = stub("http://stub.test/api/v1/users/me", { signal: controller.signal });

  controller.abort();

  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("profile PUT persists normalized fields and keeps existing sessions after an email change", async () => {
  let accessToken: string | null = null;
  const client = createApiClient({ fetch: createAuthStub(), getAccessToken: () => accessToken });
  const auth = createAuthApi(client);
  const account = createAccountApi(client);
  const registered = await auth.register(registerInput);
  assert.equal(registered.ok, true);
  const anonymous = await account.updateProfile({ fullName: "Not allowed" });
  assert.equal(anonymous.ok, false);
  if (!anonymous.ok) assert.equal(anonymous.error.status, 401);

  const firstLogin = await auth.login({ email: registerInput.email, password: registerInput.password });
  const secondLogin = await auth.login({ email: registerInput.email, password: registerInput.password });
  assert.ok(firstLogin.ok && secondLogin.ok);
  accessToken = firstLogin.data.accessToken;
  const updated = await account.updateProfile({
    fullName: "  Updated Buyer  ", email: "  NEW.BUYER@EXAMPLE.TEST  ",
    address: "  New street  ", dateOfBirth: "2000-02-29", gender: "FEMALE",
  });
  assert.ok(updated.ok);
  assert.equal(updated.data.fullName, "Updated Buyer");
  assert.equal(updated.data.email, "new.buyer@example.test");
  assert.equal(updated.data.address, "New street");
  assert.equal(updated.data.phone, registerInput.phone);
  assert.deepEqual(await auth.me(), updated);

  const ignored = await client.put<UserResponse>("/api/v1/users/me", {
    fullName: null, email: null, address: null, gender: null, dateOfBirth: null,
    phone: "invalid", identityNumber: "other", password: "changed", roles: ["ADMIN"], status: "LOCKED",
  });
  assert.deepEqual(ignored, updated, "null retains values and fields outside UpdateProfileRequest are ignored");
  accessToken = secondLogin.data.accessToken;
  assert.deepEqual(await auth.me(), updated, "all existing sessions keep the same user identity");
  const oldEmail = await auth.login({ email: registerInput.email, password: registerInput.password });
  assert.equal(oldEmail.ok, false);
  const newEmail = await auth.login({ email: updated.data.email, password: registerInput.password });
  assert.ok(newEmail.ok, "the login index moves to the new email while password remains unchanged");
  const cleared = await account.updateProfile({ address: "  " });
  assert.ok(cleared.ok);
  assert.equal(cleared.data.address, "");
});

test("profile PUT rejects invalid fields and duplicate email without changing any stored values", async () => {
  let accessToken: string | null = null;
  const client = createApiClient({ fetch: createAuthStub(), getAccessToken: () => accessToken });
  const auth = createAuthApi(client);
  const original = await auth.register(registerInput);
  assert.ok(original.ok);
  assert.ok((await auth.register({ ...registerInput, email: "other@example.test", phone: "0900000001", identityNumber: "012345678902" })).ok);
  const login = await auth.login({ email: registerInput.email, password: registerInput.password });
  assert.ok(login.ok);
  accessToken = login.data.accessToken;

  for (const [payload, field] of [
    [{ fullName: " " }, "fullName"],
    [{ email: "invalid" }, "email"],
    [{ dateOfBirth: "2999-01-01" }, "dateOfBirth"],
  ] as const) {
    const invalid = await client.put("/api/v1/users/me", { address: "Must not persist", ...payload });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.error.status, 400);
      assert.ok(invalid.error.fieldErrors?.[field]?.length);
    }
    assert.deepEqual(await auth.me(), original);
  }
  for (const payload of [{ gender: "UNKNOWN" }, { dateOfBirth: "2000-02-30" }]) {
    const malformed = await client.put("/api/v1/users/me", payload);
    assert.equal(malformed.ok, false);
    if (!malformed.ok) {
      assert.equal(malformed.error.status, 400);
      assert.equal(malformed.error.type, "urn:problem:invalid-request-body");
    }
  }
  const conflict = await client.put("/api/v1/users/me", { email: " OTHER@EXAMPLE.TEST ", fullName: "Must not persist" });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.status, 409);
  assert.deepEqual(await auth.me(), original);
  const sameEmail = await client.put<UserResponse>("/api/v1/users/me", { email: " BUYER@EXAMPLE.TEST " });
  assert.deepEqual(sameEmail, original, "the current user's own email is not a duplicate");
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
    assert.deepEqual(invalidRegister.error.fieldErrors?.email, ["cannot be blank!"]);
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
    assert.deepEqual(invalidLogin.error.fieldErrors?.password, ["cannot be blank!"]);
  }
});

test("stub emits common-web validation wire contract, not frontend fieldErrors", async () => {
  const stub = createAuthStub();
  for (const path of ["/api/v1/auth/register", "/api/v1/auth/login"]) {
    const response = await stub(path, {
      method: "POST", body: "{}", headers: { "Content-Type": "application/json" },
    });
    const body: BackendProblemDetails = await response.json();
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Content-Type"), "application/problem+json");
    assert.equal(body.type, "urn:problem:validation-error");
    assert.equal(body.title, "Validation Failed");
    assert.equal(body.detail, "The request data is invalid");
    assert.equal(body.instance, path);
    assert.equal(typeof body.traceId, "string");
    assert.equal(Object.hasOwn(body, "fieldErrors"), false);
    assert.ok(body.errors && body.errors.length > 0);
    assert.equal(new Set(body.errors.map((error) => error.field)).size, body.errors.length);
    assert.ok(body.errors.every((error) => error.detail === "cannot be blank!" && typeof error.code === "string"));
    assert.ok(body.errors.every((error) => !Object.hasOwn(error, "message")));
    assert.ok(body.errors.some((error) => error.field === "email"));
  }
});

test("stub malformed bodies return common-web form-level errors without field errors", async () => {
  const stub = createAuthStub();
  for (const path of ["/api/v1/auth/register", "/api/v1/auth/login"]) {
    for (const payload of ["not-json", "null", "[]"]) {
      const response = await stub(path, { method: "POST", body: payload });
      const body: BackendProblemDetails = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.type, "urn:problem:invalid-request-body");
      assert.equal(body.title, "Invalid Request Body");
      assert.equal(body.instance, path);
      assert.equal(body.errors, undefined);
      assert.equal(Object.hasOwn(body, "fieldErrors"), false);
    }
  }
});

test("auth API validates malformed login and user success bodies", async () => {
  const badLogin = createAuthApi(createApiClient({
    fetch: async () => new Response(JSON.stringify({
      code: 0, message: "response success", data: { accessToken: "token", expiresIn: 0, tokenType: "Bearer" },
    }), { status: 200 }),
  }));
  const badLoginResult = await badLogin.login({ email: "a@example.test", password: "password" });
  assert.equal(badLoginResult.ok, false);
  if (!badLoginResult.ok) {
    assert.equal(badLoginResult.error.kind, "invalid-response");
  }

  const badMe = createAuthApi(createApiClient({
    getAccessToken: () => "token",
    fetch: async () => new Response(JSON.stringify({
      code: 0, message: "response success", data: {
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
      },
    }), { status: 200 }),
  }));
  const badMeResult = await badMe.me();
  assert.equal(badMeResult.ok, false);
  if (!badMeResult.ok) {
    assert.equal(badMeResult.error.kind, "invalid-response");
  }
  const badUpdate = await createAccountApi(badMe.client).updateProfile({ fullName: "Updated" });
  assert.equal(badUpdate.ok, false);
  if (!badUpdate.ok) assert.equal(badUpdate.error.kind, "invalid-response");
});

test("Axios config keeps source defaults and copies caller headers without retaining tokens", async () => {
  const { AxiosHeaders } = await import("axios");
  const { default: anonymous } = await import("../configs/api");
  assert.equal(anonymous.defaults.timeout, 15_000);
  assert.equal(anonymous.defaults.headers.Accept, "application/json");
  assert.equal(anonymous.defaults.headers.Authorization, undefined);

  let token: string | null = "first";
  const authorization: Array<string | null> = [];
  const callerHeaders = new AxiosHeaders({ Authorization: "caller-value", "X-Trace": "test" });
  const client = createApiClient({ getAccessToken: () => token, fetch: async (_, init) => {
    authorization.push(new Headers(init?.headers).get("Authorization"));
    return new Response("{}", { status: 200 });
  } });
  await client.get("/me", { config: { headers: callerHeaders } });
  token = "second";
  await client.get("/me");
  await client.post("/login", {}, { auth: false, config: { headers: callerHeaders } });
  token = null;
  await client.get("/me", { config: { headers: callerHeaders } });
  assert.deepEqual(authorization, ["Bearer first", "Bearer second", null, null]);
  assert.equal(callerHeaders.get("Authorization"), "caller-value");
});

test("Axios timeout becomes a typed network failure; explicit cancellation stays AbortError", async () => {
  const client = createApiClient({ fetch: createAuthStub({ delayMs: 100 }) });
  const timeout = await client.get("/api/v1/users/me", { config: { timeout: 10 } });
  assert.equal(timeout.ok, false);
  if (!timeout.ok) {
    assert.equal(timeout.error.kind, "network");
    assert.equal(timeout.error.status, 0);
    assert.match(timeout.error.detail ?? "", /timeout/i);
  }
  const controller = new AbortController();
  const pending = client.get("/api/v1/users/me", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("request config cannot override URL, origin, method, signal or authentication", async () => {
  const seen: Array<{ url: string; method?: string; authorization: string | null }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test", getAccessToken: () => "private-token",
    fetch: async (input, init) => {
      seen.push({ url: String(input), method: init?.method, authorization: new Headers(init?.headers).get("Authorization") });
      return new Response("{}", { status: 200 });
    },
  });
  // Simulate an untyped JS caller; TypeScript callers cannot supply owned fields.
  const config = {
    baseURL: "https://evil.example", url: "https://evil.example", method: "DELETE",
    auth: { username: "override", password: "override" },
    headers: { Authorization: "override" }, adapter: () => { throw new Error("Must not use caller adapter"); },
  };
  const result = await client.get("/api/v1/users/me", { config });
  assert.equal(result.ok, true);
  assert.deepEqual(seen, [{ url: "https://api.example.test/api/v1/users/me", method: "GET", authorization: "Bearer private-token" }]);
});

test("native Axios HTTP adapter supports real GET/POST without the fixture", async () => {
  const { createServer } = await import("node:http");
  const server = createServer(async (request, response) => {
    if (request.url === "/validation") {
      response.writeHead(400, { "Content-Type": "application/problem+json" });
      response.end(JSON.stringify({
        type: "urn:problem:validation-error", title: "Validation Failed", status: 400,
        detail: "The request data is invalid", instance: "/validation",
        errors: [{ field: "email", code: "VALIDATION_NOT_BLANK", detail: "cannot be blank!" }],
      }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({
      code: 0, message: "response success", data: {
        url: request.url, method: request.method,
        authorization: request.headers.authorization ?? null,
        body: Buffer.concat(chunks).toString() || null,
      },
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const client = createApiClient({ baseUrl: `http://127.0.0.1:${address.port}`, getAccessToken: () => "native-token" });
  try {
    const get = await client.get("/products", { params: { page: 2 }, config: { proxy: false } });
    assert.deepEqual(get, { ok: true, data: { url: "/products?page=2", method: "GET", authorization: "Bearer native-token", body: null } });
    const post = await client.post("/login", { email: "native@example.test" }, { auth: false, config: { proxy: false } });
    assert.deepEqual(post, { ok: true, data: { url: "/login", method: "POST", authorization: null, body: '{"email":"native@example.test"}' } });
    const validation = await client.get("/validation", { config: { proxy: false } });
    assert.equal(validation.ok, false);
    if (!validation.ok) {
      assert.equal(validation.error.status, 400);
      assert.deepEqual(validation.error.errors, [{ field: "email", message: "cannot be blank!" }]);
      assert.deepEqual(validation.error.fieldErrors, { email: ["cannot be blank!"] });
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
