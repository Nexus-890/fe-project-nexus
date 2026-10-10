"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueryOptions, type ApiServiceRequest, type ApiParams, type ApiQueryOptions, type ApiQueryRequest } from "./api-query-options";

export type { ApiServiceRequest, ApiParams, ApiQueryOptions, ApiQueryRequest } from "../types/query/type";

/** Project-wide query hook. Features supply their service and key; TanStack owns state and cache. */
export function useApiQuery<
  TResponse = unknown, TSelected = TResponse,
  TPathParams extends object = ApiParams, TQueryParams extends object = ApiParams,
>(request: ApiQueryRequest<TPathParams, TQueryParams> | ApiServiceRequest<TResponse>, options?: ApiQueryOptions<TResponse, TSelected>) {
  return useQuery(apiQueryOptions<TResponse, TSelected, TPathParams, TQueryParams>(request, options));
}
