export type FieldErrors = Record<string, string[]>;

/** Normalized validation entry consumed by frontend forms. */
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
  /** Normalized field messages; see BackendProblemDetails for the wire format. */
  errors?: ValidationError[];
}

/** Validation entry emitted by common-web's GlobalExceptionHandler. */
export interface BackendValidationError {
  field: string;
  code: string;
  detail: string;
}

export type BackendProblemDetails = Omit<ProblemDetails, "errors"> & {
  errors?: BackendValidationError[];
};

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
