import type { FieldErrors, ProblemDetails } from "../../types/common/response/type";
import type { LoginRequest, RegisterRequest } from "../../types/auth/request/type";
import type { LoginResponse, UserResponse } from "../../types/auth/response/type";

export interface AuthStubOptions {
  delayMs?: number;
  defaultRole?: string;
  tokenTtlSeconds?: number;
  lockedEmails?: string[];
}

interface StoredUser extends UserResponse {
  password: string;
  identityNumber: string;
}

const REQUIRED_REGISTER_FIELDS: Array<keyof RegisterRequest> = [
  "email",
  "phone",
  "password",
  "fullName",
  "identityNumber",
  "gender",
  "address",
  "dateOfBirth",
];

export function createAuthStub(options: AuthStubOptions = {}): typeof globalThis.fetch {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The auth stub is disabled in production.");
  }
  const users = new Map<string, StoredUser>();
  const tokens = new Map<string, string>();
  const stubId = createRuntimeId();
  const lockedEmails = new Set((options.lockedEmails ?? []).map((email) => email.toLowerCase()));
  let nextUserId = 1;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    await waitForDelay(options.delayMs ?? 0, init?.signal ?? undefined);

    const request = toRequest(input, init);
    const method = request.method.toUpperCase();
    const path = new URL(request.url).pathname;

    if (method === "POST" && path === "/api/v1/auth/register") {
      const body = await readRequestBody(request);
      if (!isRecord(body)) {
        return json(problem(400, "Invalid Request Body", "The request body is invalid or malformed", path), 400);
      }
      const validation = validateRegisterBody(body);

      if (!validation.ok) {
        return json(problem(400, "Validation Failed", "The request data is invalid", path, validation.fieldErrors), 400);
      }

      const email = validation.data.email.toLowerCase();

      if (users.has(email)) {
        return json(problem(409, "Account already exists", "An account with this email already exists", path), 409);
      }

      const now = new Date().toISOString();
      const user: StoredUser = {
        id: `${stubId}-user-${nextUserId}`,
        email,
        phone: validation.data.phone,
        fullName: validation.data.fullName,
        roles: [options.defaultRole ?? "BUYER"],
        gender: validation.data.gender,
        address: validation.data.address,
        dateOfBirth: validation.data.dateOfBirth,
        status: "ACTIVE",
        createdAt: now,
        password: validation.data.password,
        identityNumber: validation.data.identityNumber,
      };

      nextUserId += 1;
      users.set(email, user);

      return json(toUserResponse(user), 201);
    }

    if (method === "POST" && path === "/api/v1/auth/login") {
      const body = await readRequestBody(request);
      if (!isRecord(body)) {
        return json(problem(400, "Invalid Request Body", "The request body is invalid or malformed", path), 400);
      }
      const validation = validateLoginBody(body);

      if (!validation.ok) {
        return json(problem(400, "Validation Failed", "The request data is invalid", path, validation.fieldErrors), 400);
      }

      const email = validation.data.email.toLowerCase();
      const user = users.get(email);

      if (!user || user.password !== validation.data.password) {
        return json(problem(401, "Invalid credentials", "Email or password is incorrect", path), 401);
      }

      if (user.status === "LOCKED" || lockedEmails.has(email)) {
        return json(problem(423, "Account locked", "Account is locked", path), 423);
      }

      const accessToken = `${stubId}.${createRuntimeId()}.${user.id}`;
      tokens.set(accessToken, email);

      const response: LoginResponse = {
        accessToken,
        expiresIn: options.tokenTtlSeconds ?? 900,
        tokenType: "Bearer",
      };

      return json(response);
    }

    if (method === "GET" && path === "/api/v1/users/me") {
      const authorization = request.headers.get("Authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
      const email = tokens.get(token);

      if (!email) {
        return json(problem(401, "Unauthorized", "Missing or invalid access token", path), 401);
      }

      const user = users.get(email);

      if (!user) {
        return json(problem(401, "Unauthorized", "Missing or invalid access token", path), 401);
      }

      return json(toUserResponse(user));
    }

    return json(problem(404, "Not found", `${method} ${path} is not implemented by auth stub`, path), 404);
  };
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) {
    return init ? new Request(input, init) : input;
  }

  return new Request(new URL(String(input), "http://stub.test"), init);
}

async function readRequestBody(request: Request): Promise<unknown> {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

function validateRegisterBody(value: Record<string, unknown>): { ok: true; data: RegisterRequest } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};

  for (const field of REQUIRED_REGISTER_FIELDS) {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      fieldErrors[field] = ["cannot be blank!"];
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      email: readStringField(value, "email"),
      phone: readStringField(value, "phone"),
      password: readStringField(value, "password"),
      fullName: readStringField(value, "fullName"),
      identityNumber: readStringField(value, "identityNumber"),
      gender: readStringField(value, "gender"),
      address: readStringField(value, "address"),
      dateOfBirth: readStringField(value, "dateOfBirth"),
    },
  };
}

function validateLoginBody(value: Record<string, unknown>): { ok: true; data: LoginRequest } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};

  if (typeof value.email !== "string" || value.email.trim() === "") {
    fieldErrors.email = ["cannot be blank!"];
  }

  if (typeof value.password !== "string" || value.password.trim() === "") {
    fieldErrors.password = ["cannot be blank!"];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      email: readStringField(value, "email"),
      password: readStringField(value, "password"),
    },
  };
}

function toUserResponse(user: StoredUser): UserResponse {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    gender: user.gender,
    address: user.address,
    dateOfBirth: user.dateOfBirth,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function problem(status: number, title: string, detail: string, path: string, fieldErrors?: FieldErrors): ProblemDetails {
  return {
    type: fieldErrors ? "urn:problem:validation-error"
      : title === "Invalid Request Body" ? "urn:problem:invalid-request-body" : "urn:problem:domain-error",
    title,
    status,
    detail,
    instance: path,
    traceId: createRuntimeId(),
    errors: fieldErrors ? Object.entries(fieldErrors).map(([field, messages]) => ({ field, message: messages[0] })) : undefined,
  };
}

function json(body: unknown, status = 200): Response {
  const contentType = status >= 400 ? "application/problem+json" : "application/json";

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
  });
}

function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) {
    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(createAbortError());
    }, { once: true });
  });
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

function createRuntimeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function readStringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
