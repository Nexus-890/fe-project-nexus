import type { ApiError, ApiResult } from "../types/common/response/type";

/** Convert the transport result to the rejected-Promise contract TanStack expects. */
export function unwrapApiResult<T>(result: ApiResult<T>): T {
  if (!result.ok) throw result.error;
  return result.data;
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value
    && ["http", "network", "invalid-response", "aborted"].includes(String(value.kind))
    && "status" in value && typeof value.status === "number"
    && "title" in value && typeof value.title === "string";
}

export function canceledSignIn(): ApiError {
  return { kind: "aborted", status: 0, title: "Sign-in was canceled or superseded." };
}
