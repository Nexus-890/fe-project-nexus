import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { unwrapApiResult } from "../lib/api-result";
import type { ApiError, ApiResult } from "../types/api";

export type ApiQueryOptions<T> = Omit<
  UseQueryOptions<T, ApiError, T, QueryKey>,
  "queryFn"
> & {
  /** GET loader owned by the feature's API module. */
  queryFn: (signal: AbortSignal) => Promise<ApiResult<T>>;
};

/** Shared by the hook and imperative fetchQuery, so both use one cache entry. */
export function apiQueryOptions<T>({ queryFn, ...options }: ApiQueryOptions<T>) {
  return {
    retry: (failures: number, error: ApiError) =>
      (error.kind === "network" || error.status >= 500) && failures < 2,
    ...options,
    queryFn: async ({ signal }: { signal: AbortSignal }) =>
      unwrapApiResult(await queryFn(signal)),
  };
}
