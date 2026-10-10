import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import type { ApiClient, ApiRequestConfig } from "../api/type";
import type { ApiError, ApiResult } from "../common/response/type";

export interface ApiServiceRequest<TResponse> {
  queryKey: QueryKey;
  service: (signal: AbortSignal) => Promise<ApiResult<TResponse>>;
}

export type ApiParams = Readonly<Record<string, unknown>>;
export type { ApiRequestConfig } from "../api/type";

export interface ApiQueryRequest<TPathParams extends object = ApiParams, TQueryParams extends object = ApiParams> {
  queryKey: QueryKey;
  url: string;
  pathParams?: TPathParams;
  query?: TQueryParams;
  config?: ApiRequestConfig;
  /** Pass the provider-scoped client for authenticated endpoints. */
  client?: ApiClient;
}

export type ApiQueryOptions<TResponse, TSelected = TResponse> = Omit<
  UseQueryOptions<TResponse, ApiError, TSelected, QueryKey>, "queryFn" | "queryKey"
> & {
  validateResponse?: (value: unknown) => value is TResponse;
};
