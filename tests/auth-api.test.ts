import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import api, { requestApi, isApiError } from "../configs/api";
import { createSession, endSession, getMe, refreshSession, register } from "../service/authService";
import * as authService from "../service/authService";
import { updateProfile } from "../service/accountService";
import { createAuthStub } from "../mocks/authStub";
import type { AuthStubLoginRequest, AuthStubLoginResponse } from "../mocks/authStub";
import type { ApiError, ProblemDetails } from "../types/commonResponseType";
import type { RegisterRequest } from "../types/authRequestType";
import type { UserResponse } from "../types/authResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

// The legacy stub can issue a test token without exposing password login in
// the production authentication service. OIDC owns production sign-in.
const fixtureLogin = async (input: AuthStubLoginRequest, options: ServiceRequestOptions = {}) =>
  (await requestApi<AuthStubLoginResponse>("POST", "/api/v1/auth/login", input, { ...options, auth: false })).data;

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

test("profile PUT persists normalized fields and keeps existing sessions after an email change", async () => {
  let accessToken: string | null = null;
  const options = { context: { fetch: createAuthStub(), getAccessToken: () => accessToken } };
  await register(registerInput, options);
  await assert.rejects(updateProfile({ fullName: "Not allowed" }, options), { kind: "http", status: 401 });

  const firstLogin = await fixtureLogin({ email: registerInput.email, password: registerInput.password }, options);
  const secondLogin = await fixtureLogin({ email: registerInput.email, password: registerInput.password }, options);
  accessToken = firstLogin.accessToken;
  const updated = await updateProfile({
    fullName: "  Updated Buyer  ", email: "  NEW.BUYER@EXAMPLE.TEST  ",
    address: "  New street  ", dateOfBirth: "2000-02-29", gender: "FEMALE",
  }, options);
  assert.equal(updated.fullName, "Updated Buyer");
  assert.equal(updated.email, "new.buyer@example.test");
  assert.equal(updated.address, "New street");
  assert.equal(updated.phone, registerInput.phone);
  assert.deepEqual(await getMe(options), updated);

  const ignored = await requestApi<UserResponse>("PUT", "/api/v1/users/me", {
    fullName: null, email: null, address: null, gender: null, dateOfBirth: null,
    phone: "invalid", identityNumber: "other", password: "changed", roles: ["ADMIN"], status: "LOCKED",
  }, options);
  assert.deepEqual(ignored.data, updated, "null retains values and fields outside UpdateProfileRequest are ignored");
  accessToken = secondLogin.accessToken;
  assert.deepEqual(await getMe(options), updated, "all existing sessions keep the same user identity");
  await assert.rejects(fixtureLogin({ email: registerInput.email, password: registerInput.password }, options), { kind: "http", status: 401 });
  assert.ok((await fixtureLogin({ email: updated.email, password: registerInput.password }, options)).accessToken,
    "the login index moves to the new email while password remains unchanged");
  const cleared = await updateProfile({ address: "  " }, options);
  assert.equal(cleared.address, "");
});

test("profile PUT rejects invalid fields and duplicate email without changing any stored values", async () => {
  let accessToken: string | null = null;
  const options = { context: { fetch: createAuthStub(), getAccessToken: () => accessToken } };
  const original = await register(registerInput, options);
  await register({ ...registerInput, email: "other@example.test", phone: "0900000001", identityNumber: "012345678902" }, options);
  accessToken = (await fixtureLogin({ email: registerInput.email, password: registerInput.password }, options)).accessToken;

  for (const [payload, field] of [
    [{ fullName: " " }, "fullName"],
    [{ email: "invalid" }, "email"],
    [{ dateOfBirth: "2999-01-01" }, "dateOfBirth"],
  ] as const) {
    await assert.rejects(requestApi("PUT", "/api/v1/users/me", { address: "Must not persist", ...payload }, options), errorIs((error) => {
      assert.equal(error.status, 400);
      assert.ok(error.fieldErrors?.[field]?.length);
    }));
    assert.deepEqual(await getMe(options), original);
  }
  for (const payload of [{ gender: "UNKNOWN" }, { dateOfBirth: "2000-02-30" }]) {
    await assert.rejects(requestApi("PUT", "/api/v1/users/me", payload, options), {
      kind: "http", status: 400, type: "urn:problem:invalid-request-body",
    });
  }
  await assert.rejects(requestApi("PUT", "/api/v1/users/me", { email: " OTHER@EXAMPLE.TEST ", fullName: "Must not persist" }, options), {
    kind: "http", status: 409, code: "USER_EMAIL_ALREADY_USED",
  });
  assert.deepEqual(await getMe(options), original);
  const sameEmail = await requestApi<UserResponse>("PUT", "/api/v1/users/me", { email: " BUYER@EXAMPLE.TEST " }, options);
  assert.deepEqual(sameEmail.data, original, "the current user's own email is not a duplicate");
});
const success = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      code: 0,
      message: "response success",
      data,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
const problem = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
const errorIs = (verify: (error: ApiError) => void) => (error: unknown) => {
  assert.ok(isApiError(error));
  verify(error);
  return true;
};

test("auth stub and provider cannot be enabled in production, including injected transports", () => {
  const stubPath = JSON.stringify(require.resolve("../mocks/authStub"));
  const providerPath = JSON.stringify(require.resolve("../providers/Provider"));
  const scripts = [
    "require(" + stubPath + ").createAuthStub()",
    "const React=require('react');const render=require('react-dom/server').renderToString;const Provider=require(" +
      providerPath +
      ").default;render(React.createElement(Provider,{stub:true,fetch:async()=>new Response('{}')},null))",
  ];
  for (const script of scripts) {
    const result = spawnSync(process.execPath, ["-e", script], {
      env: { ...process.env, NODE_ENV: "production" },
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /auth stub is disabled in production/);
  }
});

test("transport attaches the current Bearer only to protected relative requests", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const context = {
    getAccessToken: () => "token-123",
    fetch: (async (input, init) => {
      seen.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return success({ id: "user" });
    }) satisfies typeof fetch,
  };
  assert.deepEqual(
    (await requestApi("GET", "/api/v1/users/me", undefined, { context })).data,
    { id: "user" },
  );
  await requestApi("POST", "/api/v1/auth/login", {}, { context, auth: false });
  await assert.rejects(
    requestApi("GET", "https://evil.example/me", undefined, { context }),
    errorIs((error) => {
      assert.equal(error.kind, "invalid-response");
    }),
  );
  assert.equal(seen[0]?.authorization, "Bearer token-123");
  assert.equal(seen[1]?.authorization, null);
  assert.equal(
    seen.length,
    2,
    "Unsafe URL must never reach fetch or leak a token",
  );
});

test("delivered Problem Details preserve symbolic code, trace and field/code/detail errors", async () => {
  const errors = [
    {
      field: "email",
      code: "VALIDATION_EMAIL",
      detail: "Invalid email address!",
    },
    {
      field: "password",
      code: "VALIDATION_NOT_BLANK",
      detail: "cannot be blank!",
    },
  ];
  const context = {
    fetch: (async () =>
      problem({
        type: "urn:problem:validation-error",
        title: "Validation Failed",
        status: 400,
        code: "VALIDATION_FAILED",
        detail: "The request data is invalid",
        instance: "/register",
        traceId: "trace-1",
        errors,
      })) satisfies typeof fetch,
  };
  await assert.rejects(
    requestApi("POST", "/register", {}, { context, auth: false }),
    errorIs((error) => {
      assert.equal(error.kind, "http");
      assert.equal(error.status, 400);
      assert.equal(error.code, "VALIDATION_FAILED");
      assert.equal(error.type, "urn:problem:validation-error");
      assert.equal(error.detail, "The request data is invalid");
      assert.equal(error.instance, "/register");
      assert.equal(error.traceId, "trace-1");
      assert.deepEqual(error.errors, errors);
      assert.deepEqual(error.fieldErrors, {
        email: ["Invalid email address!"],
        password: ["cannot be blank!"],
      });
    }),
  );
});

test("field normalization ignores malformed entries and groups repeated fields without prototype pollution", async () => {
  const context = {
    fetch: (async () =>
      problem({
        title: "Validation Failed",
        status: 500,
        code: "VALIDATION_FAILED",
        errors: [
          null,
          "invalid",
          {},
          { field: "email", code: 123, detail: "invalid" },
          { field: "email", code: "FIRST", detail: "First message" },
          { field: "email", code: "SECOND", detail: "Second message" },
          { field: "__proto__", code: "FIELD", detail: "A field name is data" },
        ],
      })) satisfies typeof fetch,
  };
  await assert.rejects(
    requestApi("POST", "/validation", {}, { context }),
    errorIs((error) => {
      assert.equal(
        error.status,
        400,
        "HTTP status takes precedence over body status",
      );
      assert.deepEqual(error.fieldErrors?.email, [
        "First message",
        "Second message",
      ]);
      assert.deepEqual(error.fieldErrors?.["__proto__"], [
        "A field name is data",
      ]);
      assert.equal(Object.getPrototypeOf(error.fieldErrors), Object.prototype);
      assert.equal(error.errors?.length, 3);
    }),
  );
});

test("legacy field message records are not silently accepted as the delivered contract", async () => {
  for (const body of [
    { fieldErrors: { email: ["Legacy"] } },
    { errors: { email: ["Legacy"] } },
    { errors: [{ field: "email", message: "Legacy" }] },
  ]) {
    const context = {
      fetch: (async () =>
        problem({
          title: "Bad Request",
          code: "VALIDATION_FAILED",
          ...body,
        })) satisfies typeof fetch,
    };
    await assert.rejects(
      requestApi("GET", "/validation", undefined, { context }),
      errorIs((error) => {
        assert.equal(error.status, 400);
        assert.equal(error.fieldErrors, undefined);
        assert.equal(error.errors, undefined);
      }),
    );
  }
});

test("unknown symbolic errors and malformed field entries remain usable form-level errors", async () => {
  for (const errors of [undefined, [], [null, { field: "email" }], "invalid"]) {
    const context = {
      fetch: (async () =>
        problem({
          type: "urn:problem:domain-error",
          title: "Bad Request",
          code: "FUTURE_UNKNOWN_CODE",
          detail: "Action was rejected",
          errors,
        })) satisfies typeof fetch,
    };
    await assert.rejects(
      requestApi("GET", "/validation", undefined, { context }),
      errorIs((error) => {
        assert.equal(error.kind, "http");
        assert.equal(error.code, "FUTURE_UNKNOWN_CODE");
        assert.equal(error.detail, "Action was rejected");
        assert.equal(error.fieldErrors, undefined);
        assert.equal(error.errors, undefined);
      }),
    );
  }
});

test("success envelope retains sibling page and metadata; bare or malformed success is rejected", async () => {
  const page = { number: 2, size: 12, totalElements: 30, totalPages: 3 };
  const envelope = {
    code: 7,
    message: "Custom success",
    data: [{ id: "1" }],
    page,
  };
  const result = await requestApi("GET", "/list", undefined, {
    context: {
      fetch: async () => new Response(JSON.stringify(envelope)),
    },
  });
  assert.deepEqual(result, envelope);
  for (const body of [
    { id: "bare" },
    [],
    { data: {}, code: "0", message: "wrong" },
    { code: 0, message: "ok", data: [], page: { ...page, size: 0 } },
  ]) {
    await assert.rejects(
      requestApi("GET", "/list", undefined, {
        context: {
          fetch: async () => new Response(JSON.stringify(body)),
        },
      }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
  await assert.rejects(
    requestApi("GET", "/list", undefined, {
      context: {
        fetch: async () => new Response("not-json"),
      },
    }),
    errorIs((error) => assert.equal(error.kind, "invalid-response")),
  );
});

test("stub register-login-me uses current Authorization without writing web storage", async () => {
  const writes: string[] = [];
  const storage = {
    get length() {
      return writes.length;
    },
    clear() {
      writes.length = 0;
    },
    getItem() {
      return null;
    },
    key(index: number) {
      return writes[index] ?? null;
    },
    removeItem(key: string) {
      writes.push("remove:" + key);
    },
    setItem(key: string, value: string) {
      writes.push(key + ":" + value);
    },
  } satisfies Storage;
  const previousLocal = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const previousSession = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: storage,
    configurable: true,
  });
  let token: string | null = null;
  let authorization: string | null = null;
  const stub = createAuthStub();
  const context = {
    getAccessToken: () => token,
    fetch: (async (input, init) => {
      authorization = new Headers(init?.headers).get("Authorization");
      return stub(input, init);
    }) satisfies typeof fetch,
  };
  try {
    const user = await register(registerInput, { context });
    assert.equal(user.email, registerInput.email);
    const logged = await fixtureLogin(
      { email: registerInput.email, password: registerInput.password },
      { context, auth: true },
    );
    assert.equal(
      authorization,
      null,
      "Public service must override a caller auth=true",
    );
    token = logged.accessToken;
    assert.equal((await getMe({ context })).email, user.email);
    assert.equal(authorization, "Bearer " + token);
    assert.deepEqual(writes, []);
    token = null;
    await assert.rejects(
      getMe({ context }),
      errorIs((error) => assert.equal(error.status, 401)),
    );
  } finally {
    for (const [key, descriptor] of [
      ["localStorage", previousLocal],
      ["sessionStorage", previousSession],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("stub aborts delayed requests with AbortError", async () => {
  const controller = new AbortController();
  const pending = createAuthStub({ delayMs: 50 })(
    "http://stub.test/api/v1/users/me",
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
});

test("separate auth stub instances do not accept another instance token", async () => {
  const contextA = { fetch: createAuthStub() };
  await register(registerInput, { context: contextA });
  const logged = await fixtureLogin(
    { email: registerInput.email, password: registerInput.password },
    { context: contextA },
  );
  const contextB = {
    fetch: createAuthStub(),
    getAccessToken: () => logged.accessToken,
  };
  await assert.rejects(
    getMe({ context: contextB }),
    errorIs((error) => assert.equal(error.status, 401)),
  );
});

test("unsafe paths and versioned baseUrl are rejected before any fetch", async () => {
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return success({});
  };
  for (const path of [
    "https://evil.test/me",
    "//evil.test/me",
    "/\\evil.test/me",
    "/users\u0000/me",
  ]) {
    await assert.rejects(
      requestApi("GET", path, undefined, { context: { fetch: transport } }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
  for (const baseUrl of [
    "https://api.test/api/v1",
    "ftp://api.test",
    "https://user:pass@api.test",
    "/api",
  ]) {
    await assert.rejects(
      requestApi("GET", "/me", undefined, {
        context: { baseUrl, fetch: transport },
      }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
  assert.equal(calls, 0);
});

test("non-json HTTP errors retain HTTP status instead of becoming parse errors", async () => {
  await assert.rejects(
    requestApi("GET", "/me", undefined, {
      context: {
        fetch: async () =>
          new Response("not-json", { status: 401, statusText: "Unauthorized" }),
      },
    }),
    errorIs((error) => {
      assert.equal(error.kind, "http");
      assert.equal(error.status, 401);
      assert.equal(error.title, "Unauthorized");
    }),
  );
});

test("stub validation and duplicate responses become typed rejected service promises", async () => {
  const context = { fetch: createAuthStub() };
  await assert.rejects(
    register({ ...registerInput, email: "" }, { context }),
    errorIs((error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, "VALIDATION_FAILED");
      assert.deepEqual(error.fieldErrors?.email, ["cannot be blank!"]);
    }),
  );
  await register(registerInput, { context });
  await assert.rejects(
    register(registerInput, { context }),
    errorIs((error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "USER_EMAIL_ALREADY_USED");
    }),
  );
  await assert.rejects(
    fixtureLogin({ email: "", password: "" }, { context }),
    errorIs((error) => {
      assert.equal(error.status, 400);
      assert.deepEqual(error.fieldErrors?.password, ["cannot be blank!"]);
    }),
  );
});

test("stub emits delivered field/code/detail errors and malformed-body errors", async () => {
  const stub = createAuthStub();
  for (const path of ["/api/v1/auth/register", "/api/v1/auth/login"]) {
    const response = await stub(path, {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    const body: ProblemDetails = await response.json();
    assert.equal(response.status, 400);
    assert.equal(
      response.headers.get("Content-Type"),
      "application/problem+json",
    );
    assert.equal(body.code, "VALIDATION_FAILED");
    assert.equal(body.instance, path);
    assert.equal(Object.hasOwn(body, "fieldErrors"), false);
    assert.ok(body.errors?.length);
    assert.ok(
      body.errors.every(
        (error) =>
          error.code === "VALIDATION_NOT_BLANK" &&
          error.detail === "cannot be blank!",
      ),
    );
    assert.ok(body.errors.every((error) => !Object.hasOwn(error, "message")));
    for (const payload of ["not-json", "null", "[]"]) {
      const invalid = await stub(path, { method: "POST", body: payload });
      const invalidBody: ProblemDetails = await invalid.json();
      assert.equal(invalid.status, 400);
      assert.equal(invalidBody.code, "INVALID_REQUEST_BODY");
      assert.equal(invalidBody.errors, undefined);
    }
  }
});

test("auth services expose no password login and reject malformed nested user data", async () => {
  assert.equal("login" in authService, false);
  const user: UserResponse = {
    id: "68000000-0000-4000-8000-000000000002",
    email: registerInput.email,
    phone: registerInput.phone,
    fullName: registerInput.fullName,
    gender: "MALE",
    address: registerInput.address,
    dateOfBirth: registerInput.dateOfBirth,
    roles: ["BUYER"],
    status: "ACTIVE",
    createdAt: "2026-10-23T00:00:00Z",
  };
  for (const data of [
    null,
    [],
    { id: "u1", email: "a@test.dev", roles: "BUYER" },
    { ...user, roles: "BUYER" },
    { ...user, email: null },
    { code: 0, message: "response success", data: user },
  ]) {
    for (const operation of [
      () => getMe({ context: { fetch: async () => success(data, 200) } }),
      () => register(registerInput, { context: { fetch: async () => success(data, 201) } }),
    ]) {
      await assert.rejects(
        operation(),
        errorIs((error) => assert.equal(error.kind, "invalid-response")),
      );
    }
  }
});

test("auth services accept real HTTP 200 profile and 201 registration envelopes from develop", async () => {
  const { createServer } = await import("node:http");
  const user: UserResponse = {
    id: "68000000-0000-4000-8000-000000000002",
    email: registerInput.email,
    phone: registerInput.phone,
    fullName: registerInput.fullName,
    gender: "MALE",
    address: registerInput.address,
    dateOfBirth: registerInput.dateOfBirth,
    roles: ["BUYER"],
    status: "ACTIVE",
    createdAt: "2026-10-23T00:00:00Z",
  };
  const seen: Array<{
    path: string | undefined;
    method: string | undefined;
    authorization: string | undefined;
    body: string;
    status: number;
  }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const status = request.url === "/api/v1/auth/register" ? 201 : 200;
    seen.push({
      path: request.url,
      method: request.method,
      authorization: request.headers.authorization,
      body: Buffer.concat(chunks).toString(),
      status,
    });
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ code: 0, message: "response success", data: user }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const context = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    getAccessToken: () => "oidc-access-token",
  };
  try {
    assert.deepEqual(await getMe({ context, auth: false }), user);
    assert.deepEqual(await register(registerInput, { context, auth: true }), user);
    assert.deepEqual(seen, [
      {
        path: "/api/v1/users/me", method: "GET", authorization: "Bearer oidc-access-token",
        body: "", status: 200,
      },
      {
        path: "/api/v1/auth/register", method: "POST", authorization: undefined,
        body: JSON.stringify(registerInput), status: 201,
      },
    ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("Axios defaults and caller headers never retain or replace a session token", async () => {
  const { AxiosHeaders } = await import("axios");
  const { default: api } = await import("../configs/api");
  assert.equal(api.defaults.timeout, 15_000);
  assert.equal(api.defaults.headers.Accept, "application/json");
  assert.equal(api.defaults.headers.Authorization, undefined);
  let token: string | null = "first";
  const seen: Array<string | null> = [];
  const headers = new AxiosHeaders({
    Authorization: "caller-value",
    "X-Trace": "test",
  });
  const context = {
    getAccessToken: () => token,
    fetch: (async (_, init) => {
      seen.push(new Headers(init?.headers).get("Authorization"));
      return success({});
    }) satisfies typeof fetch,
  };
  await requestApi("GET", "/me", undefined, { context, config: { headers } });
  token = "second";
  await requestApi("GET", "/me", undefined, { context });
  await requestApi(
    "POST",
    "/login",
    {},
    { context, auth: false, config: { headers } },
  );
  token = null;
  await requestApi("GET", "/me", undefined, { context, config: { headers } });
  assert.deepEqual(seen, ["Bearer first", "Bearer second", null, null]);
  assert.equal(headers.get("Authorization"), "caller-value");
  assert.equal(api.defaults.headers.Authorization, undefined);
});

test("Axios timeout is typed network failure while explicit cancellation stays AbortError", async () => {
  const context = { fetch: createAuthStub({ delayMs: 100 }) };
  await assert.rejects(
    requestApi("GET", "/api/v1/users/me", undefined, {
      context,
      config: { timeout: 10 },
    }),
    errorIs((error) => {
      assert.equal(error.kind, "network");
      assert.equal(error.status, 0);
      assert.match(error.detail ?? "", /timeout/i);
    }),
  );
  const controller = new AbortController();
  const pending = requestApi("GET", "/api/v1/users/me", undefined, {
    context,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof DOMException && error.name === "AbortError",
  );
});

test("untyped caller config cannot override URL/origin/method/auth/signal/adapter/parser", async () => {
  const seen: Array<{
    url: string;
    method: string | undefined;
    authorization: string | null;
  }> = [];
  const controller = new AbortController();
  const context = {
    baseUrl: "https://api.test",
    getAccessToken: () => "private-token",
    fetch: (async (input, init) => {
      seen.push({
        url: String(input),
        method: init?.method,
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return success({});
    }) satisfies typeof fetch,
  };
  const config = {
    baseURL: "https://evil.test",
    url: "https://evil.test",
    method: "DELETE",
    auth: { username: "override", password: "override" },
    headers: { Authorization: "override" },
    signal: AbortSignal.abort(),
    adapter: () => {
      throw new Error("Caller adapter executed");
    },
    transformResponse: [
      () => {
        throw new Error("Caller parser executed");
      },
    ],
  };
  await requestApi("GET", "/me", undefined, {
    context,
    config,
    signal: controller.signal,
  });
  assert.deepEqual(seen, [
    {
      url: "https://api.test/me",
      method: "GET",
      authorization: "Bearer private-token",
    },
  ]);
});

test("native Axios HTTP adapter sends all mutation methods and handles real 201/204/errors", async () => {
  const { createServer } = await import("node:http");
  const server = createServer(async (request, response) => {
    if (request.url === "/validation") {
      response.writeHead(400, { "Content-Type": "application/problem+json" });
      response.end(
        JSON.stringify({
          title: "Validation Failed",
          status: 400,
          code: "VALIDATION_FAILED",
          errors: [
            {
              field: "email",
              code: "VALIDATION_NOT_BLANK",
              detail: "cannot be blank!",
            },
          ],
        }),
      );
      return;
    }
    if (request.method === "DELETE") {
      response.writeHead(204);
      response.end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    response.writeHead(request.method === "POST" ? 201 : 200, {
      "Content-Type": "application/json",
    });
    response.end(
      JSON.stringify({
        code: 0,
        message: "response success",
        data: {
          url: request.url,
          method: request.method,
          authorization: request.headers.authorization ?? null,
          body: Buffer.concat(chunks).toString() || null,
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const context = {
    baseUrl: "http://127.0.0.1:" + address.port,
    getAccessToken: () => "native-token",
  };
  try {
    const result = await requestApi("GET", "/products", undefined, {
      context,
      params: { page: 2 },
    });
    assert.deepEqual(result.data, {
      url: "/products?page=2",
      method: "GET",
      authorization: "Bearer native-token",
      body: null,
    });
    for (const method of ["POST", "PUT", "PATCH"] as const) {
      const result = await requestApi(
        method,
        "/resource",
        { name: "native" },
        { context, auth: false },
      );
      assert.deepEqual(result.data, {
        url: "/resource",
        method,
        authorization: null,
        body: '{"name":"native"}',
      });
    }
    const removed = await requestApi<void>("DELETE", "/resource", undefined, {
      context,
    });
    assert.equal(removed.data, undefined);
    await assert.rejects(
      requestApi("GET", "/validation", undefined, { context }),
      errorIs((error) => {
        assert.equal(error.status, 400);
        assert.deepEqual(error.fieldErrors, { email: ["cannot be blank!"] });
      }),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("native transport rejects caller socket/transport/redirect escape hatches", async () => {
  const { createServer } = await import("node:http");
  let intercepted = false;
  const server = createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/target" });
      response.end();
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        code: 0,
        message: "response success",
        data: { path: request.url },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const config = {
    headers: { "X-Allowed": "yes" },
    socketPath: "invalid-nexus-socket",
    transport: {
      request: () => {
        intercepted = true;
        throw new Error("Override transport executed");
      },
    },
    beforeRedirect: () => {
      intercepted = true;
      throw new Error("Override redirect executed");
    },
    proxy: { host: "invalid-nexus-proxy", port: 1 },
  };
  try {
    const result = await requestApi("GET", "/redirect", undefined, {
      context: { baseUrl: `http://127.0.0.1:${address.port}` },
      config,
    });
    assert.deepEqual(result.data, { path: "/target" });
    assert.equal(intercepted, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("session calls send the app header and the cookie, never a Bearer, and return only short-lived tokens", async () => {
  const seen: Array<{ url: string; method: string | undefined; headers: Headers; body: unknown }> = [];
  const withCredentials: Array<boolean | undefined> = [];
  // The injected fetch has no Request class, so Axios drops `credentials`; read the flag it was asked to apply.
  const interceptor = api.interceptors.request.use((config) => {
    withCredentials.push(config.withCredentials);
    return config;
  });
  const session = { accessToken: "access", idToken: "id", expiresIn: 3600 };
  const context = {
    baseUrl: "http://localhost:8080",
    // Một token đang có trong bộ nhớ cũng không được gửi kèm: các endpoint này xác thực bằng cookie hoặc mã
    getAccessToken: () => "token-in-memory",
    fetch: (async (input, init) => {
      seen.push({
        url: String(input), method: init?.method, headers: new Headers(init?.headers), body: init?.body,
      });
      return String(input).endsWith("/logout") ? new Response(null, { status: 204 }) : success(session);
    }) satisfies typeof fetch,
  };
  const grant = { code: "one-time-code", codeVerifier: "v".repeat(64), redirectUri: "http://localhost:3000/auth/callback" };

  try {
    assert.deepEqual(await createSession(grant, { context }), session);
    assert.deepEqual(await refreshSession({ context }), session);
    await endSession({ context });
  } finally {
    api.interceptors.request.eject(interceptor);
  }

  assert.deepEqual(seen.map((call) => `${call.method} ${new URL(call.url).pathname}`), [
    "POST /api/v1/auth/session", "POST /api/v1/auth/refresh", "POST /api/v1/auth/logout",
  ]);
  assert.deepEqual(withCredentials, [true, true, true], "the browser must send the HttpOnly cookie");
  for (const call of seen) {
    assert.equal(call.headers.get("X-Requested-With"), "nexus-web");
    assert.equal(call.headers.get("Authorization"), null);
  }
  assert.deepEqual(JSON.parse(String(seen[0]?.body)), grant);
  assert.equal(seen[1]?.body, undefined);
});

test("refresh without a session cookie (gateway 204) means no session, not an error", async () => {
  const anonymous = { fetch: (async () => new Response(null, { status: 204 })) satisfies typeof fetch };
  assert.equal(await refreshSession({ context: anonymous }), null);
});

test("a refused session call is a typed 401 and a body without tokens is an invalid response", async () => {
  const refused = { fetch: (async () => problem({ status: 401, title: "Unauthorized", code: "UNAUTHENTICATED" }, 401)) satisfies typeof fetch };
  await assert.rejects(refreshSession({ context: refused }), errorIs((error) => {
    assert.equal(error.kind, "http");
    assert.equal(error.status, 401);
    assert.equal(error.code, "UNAUTHENTICATED");
  }));
  for (const data of [{}, { accessToken: "a", idToken: "", expiresIn: 1 }, { accessToken: "a", idToken: "i", expiresIn: 0 }]) {
    await assert.rejects(
      refreshSession({ context: { fetch: (async () => success(data)) satisfies typeof fetch } }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
});
