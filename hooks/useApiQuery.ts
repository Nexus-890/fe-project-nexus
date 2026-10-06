"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueryOptions, type ApiParams, type ApiQueryOptions, type ApiQueryRequest } from "./api-query-options";

/** Thin GET wrapper: TanStack owns loading, errors, selection and cache. */
export function useApiQuery<
  TResponse = unknown, TSelected = TResponse,
  TPathParams extends object = ApiParams, TQueryParams extends object = ApiParams,
>(request: ApiQueryRequest<TPathParams, TQueryParams>, options?: ApiQueryOptions<TResponse, TSelected>) {
  return useQuery(apiQueryOptions<TResponse, TSelected, TPathParams, TQueryParams>(request, options));
}
