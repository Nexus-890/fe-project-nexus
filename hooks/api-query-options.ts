import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { createApiClient, createInvalidResponseError, type ApiClient, type ApiRequestConfig } from "../lib/api-client";
import { unwrapApiResult } from "../lib/api-result";
import type { ApiError } from "../types/api";

export type ApiParams = Readonly<Record<string, unknown>>;
export type { ApiRequestConfig } from "../lib/api-client";

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

const anonymousClient = createApiClient();

export function resolveApiUrl(url: string, pathParams?: object): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = pathParams && Object.hasOwn(pathParams, key)
      ? (pathParams as Record<string, unknown>)[key] : undefined;
    if (value === undefined || value === null) {
      throw createInvalidResponseError(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

/** Shared by the hook and fetchQuery, so both use one GET cache entry. */
export function apiQueryOptions<
  TResponse = unknown, TSelected = TResponse,
  TPathParams extends object = ApiParams, TQueryParams extends object = ApiParams,
>(request: ApiQueryRequest<TPathParams, TQueryParams>, options: ApiQueryOptions<TResponse, TSelected> = {}) {
  const { validateResponse, ...queryOptions } = options;
  return {
    // One retry for transient failures; never repeat rejected 4xx requests.
    retry: (failures: number, error: ApiError) =>
      (error.kind === "network" || error.status >= 500) && failures < 1,
    ...queryOptions,
    queryKey: request.queryKey,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<TResponse> => {
      const data = unwrapApiResult(await (request.client ?? anonymousClient).get<TResponse>(
        resolveApiUrl(request.url, request.pathParams),
        { params: request.query as ApiParams | undefined, config: request.config, signal },
      ));
      if (validateResponse && !validateResponse(data)) {
        throw createInvalidResponseError("GET response does not match the expected contract");
      }
      return data;
    },
  };
}
