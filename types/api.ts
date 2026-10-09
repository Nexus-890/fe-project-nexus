/**
 * Draft Sprint 1 API contracts for auth and current-user flows.
 * These handwritten shapes mirror the backlog/catalogue until OpenAPI lands.
 * Keep wire values open strings because backend enums are not frozen yet.
 */

export type FieldErrors = Record<string, string[]>;

/** Validation entry emitted by common-web's GlobalExceptionHandler. */
export interface ValidationError {
  field: string;
  message: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  identityNumber: string;
  gender: string;
  address: string;
  dateOfBirth: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface UserResponse {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  gender: string | null;
  address: string | null;
  dateOfBirth: string | null;
  /** Draft catalogue exposes roles as open backend strings. */
  roles: string[];
  status: string;
  createdAt: string;
}

export type RegisterResponse = UserResponse;

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  /** Backend validation extension; common-web emits one message per field. */
  errors?: ValidationError[];
}

export type ApiErrorKind = "http" | "network" | "invalid-response" | "aborted";

export interface ApiError extends ProblemDetails {
  kind: ApiErrorKind;
  /** Frontend lookup derived from errors; not part of the backend wire contract. */
  fieldErrors?: FieldErrors;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiRequestOptions {
  /** Defaults to true. Set false for login/register or other public endpoints. */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface CategoryNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  level: number;
  path: string;
  children: CategoryNode[];
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  minPrice: string | null;
  categoryId?: string;
  status?: string;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}