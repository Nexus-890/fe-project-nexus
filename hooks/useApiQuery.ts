"use client";

import { useQuery } from "@tanstack/react-query";
import { apiQueryOptions, type ApiQueryOptions } from "./api-query-options";

/** Thin GET wrapper: TanStack remains the only owner of loading, error and cache. */
export function useApiQuery<T>(options: ApiQueryOptions<T>) {
  return useQuery(apiQueryOptions(options));
}
