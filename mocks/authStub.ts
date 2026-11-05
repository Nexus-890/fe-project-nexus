import type { FieldErrors, ProblemDetails } from "../types/commonResponseType";
import type { RegisterRequest } from "../types/authRequestType";
import type { UserResponse } from "../types/authResponseType";

/** Legacy password login exists only in this explicit test/development fixture. */
export interface AuthStubLoginRequest {
  email: string;
  password: string;
}

export interface AuthStubLoginResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

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
  // Sessions follow the user identity when their editable email changes.
  const tokens = new Map<string, StoredUser>();
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
      const gender = validation.data.gender;
      if (gender !== "MALE" && gender !== "FEMALE" && gender !== "OTHER") {
        return json(problem(400, "Validation Failed", "The request data is invalid", path, { gender: ["Invalid gender"] }), 400);
      }
      const user: StoredUser = {
        id: `${stubId}-user-${nextUserId}`,
        email,
        phone: validation.data.phone,
        fullName: validation.data.fullName,
        roles: [options.defaultRole ?? "BUYER"],
        gender,
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
      tokens.set(accessToken, user);

      const response: AuthStubLoginResponse = {
        accessToken,
        expiresIn: options.tokenTtlSeconds ?? 900,
        tokenType: "Bearer",
      };

      return json(response);
    }

    if ((method === "GET" || method === "PUT") && path === "/api/v1/users/me") {
      const authorization = request.headers.get("Authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
      const user = tokens.get(token);

      if (!user) {
        return json(problem(401, "Unauthorized", "Missing or invalid access token", path), 401);
      }

      if (method === "PUT") {
        const body = await readRequestBody(request);
        if (!isRecord(body)) {
          return json(problem(400, "Invalid Request Body", "The request body is invalid or malformed", path), 400);
        }
        const validation = validateProfileBody(body);
        if (!validation.ok) {
          return validation.fieldErrors
            ? json(problem(400, "Validation Failed", "The request data is invalid", path, validation.fieldErrors), 400)
            : json(problem(400, "Invalid Request Body", "The request body is invalid or malformed", path), 400);
        }
        const owner = validation.data.email ? users.get(validation.data.email) : undefined;
        if (owner && owner !== user) {
          return json(problem(409, "Conflict", "email is already used", path), 409);
        }
        // Validate everything before changing the stored object, like BE's atomic update.
        users.delete(user.email);
        Object.assign(user, validation.data);
        users.set(user.email, user);
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

  const gender = readStringField(value, "gender");
  if (gender !== "MALE" && gender !== "FEMALE" && gender !== "OTHER") {
    fieldErrors.gender ??= ["Gender must be MALE, FEMALE or OTHER"];
    return { ok: false, fieldErrors };
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
      gender,
      address: readStringField(value, "address"),
      dateOfBirth: readStringField(value, "dateOfBirth"),
    },
  };
}

function validateLoginBody(value: Record<string, unknown>): { ok: true; data: AuthStubLoginRequest } | { ok: false; fieldErrors: FieldErrors } {
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

type ProfileUpdate = Partial<Pick<UserResponse, "fullName" | "email" | "dateOfBirth" | "gender" | "address">>;

function validateProfileBody(value: Record<string, unknown>): { ok: true; data: ProfileUpdate } | { ok: false; fieldErrors?: FieldErrors } {
  const data: ProfileUpdate = {};
  const fieldErrors: FieldErrors = {};
  for (const field of ["fullName", "email", "address"] as const) {
    const supplied = value[field];
    if (supplied === null || supplied === undefined) continue;
    if (typeof supplied !== "string") return { ok: false };
    const normalized = supplied.trim();
    data[field] = field === "email" ? normalized.toLowerCase() : normalized;
  }
  if (data.fullName !== undefined && (data.fullName.length < 1 || data.fullName.length > 150)) {
    fieldErrors.fullName = ["Full name must contain 1 to 150 characters"];
  }
  if (data.email !== undefined) {
    if (data.email.length < 1 || data.email.length > 255) {
      fieldErrors.email = ["Email must contain 1 to 255 characters"];
    } else if (!/^[^\s@]+@[^\s@]+$/.test(data.email)) {
      fieldErrors.email = ["Invalid email address"];
    }
  }
  if (value.gender !== null && value.gender !== undefined) {
    if (value.gender !== "MALE" && value.gender !== "FEMALE" && value.gender !== "OTHER") return { ok: false };
    data.gender = value.gender;
  }
  if (value.dateOfBirth !== null && value.dateOfBirth !== undefined) {
    if (typeof value.dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateOfBirth)) return { ok: false };
    const parsed = new Date(`${value.dateOfBirth}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.dateOfBirth) return { ok: false };
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (value.dateOfBirth > today) fieldErrors.dateOfBirth = ["Date of birth must not be in the future"];
    data.dateOfBirth = value.dateOfBirth;
  }
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, data };
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
  const code = fieldErrors ? "VALIDATION_FAILED"
    : title === "Invalid Request Body" ? "INVALID_REQUEST_BODY"
    : status === 409 ? "USER_EMAIL_ALREADY_USED"
    : title === "Invalid credentials" ? "USER_INVALID_CREDENTIALS"
    : status === 423 ? "USER_ACCOUNT_LOCKED"
    : status === 401 ? "UNAUTHENTICATED" : "NOT_FOUND";
  return {
    type: fieldErrors ? "urn:problem:validation-error"
      : title === "Invalid Request Body" ? "urn:problem:invalid-request-body" : "urn:problem:domain-error",
    title,
    status,
    detail,
    code,
    instance: path,
    traceId: createRuntimeId(),
    errors: fieldErrors ? Object.entries(fieldErrors).map(([field, messages]) => ({
      field,
      code: "VALIDATION_NOT_BLANK",
      detail: messages[0],
    })) : undefined,
  };
}

function json(body: unknown, status = 200): Response {
  const contentType = status >= 400 ? "application/problem+json" : "application/json";

  const responseBody = status < 400 ? { code: 0, message: "response success", data: body } : body;
  return new Response(JSON.stringify(responseBody), {
    status,
    headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
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
