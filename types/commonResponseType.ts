export type FieldErrors = Record<string, string[]>;
export type ValidationError = { field: string; code: string; detail: string };
export type ProblemDetails = {
  type?: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: ValidationError[];
};
export type ApiError = ProblemDetails & {
  kind: "http" | "network" | "invalid-response" | "aborted";
  fieldErrors?: FieldErrors;
  /** Service-specific Problem Details properties remain unknown until parsed. */
  extensions?: Record<string, unknown>;
};
/** Only the form/context facade uses a result; services reject failed requests. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };
export type PageInfo = {
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  page?: PageInfo;
};
/** UI page model, distinct from the delivered data[] + page wire envelope. */
export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
