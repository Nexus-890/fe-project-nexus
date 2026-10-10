export type FieldErrors = Record<string, string[]>;

/** Validation entry emitted by common-web's GlobalExceptionHandler. */

export interface ValidationError {
  field: string;
  message: string;
}

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
  fieldErrors?: FieldErrors;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
}
