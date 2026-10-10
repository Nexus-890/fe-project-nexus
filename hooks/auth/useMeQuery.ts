"use client";

import { apiQueryOptions, type ApiQueryOptions } from "../api-query-options";
import { useApiQuery } from "../useApiQuery";
import type { UserResponse } from "../../types/auth/response/type";
import { isUserResponse, type AuthApi } from "../../service/auth";
import { queryKeys } from "../../configs/query-keys";

const profileOptions: ApiQueryOptions<UserResponse> = {
  meta: { requiresAuth: true },
  staleTime: 60_000,
  retry: false,
  validateResponse: isUserResponse,
};

function meQueryRequest(api: AuthApi, sessionId: number) {
  return { queryKey: queryKeys.auth.me(sessionId), service: (signal: AbortSignal) => api.me(signal) };
}

export function meQueryOptions(api: AuthApi, sessionId: number) {
  return apiQueryOptions<UserResponse>(meQueryRequest(api, sessionId), profileOptions);
}

// Dependencies are explicit: AuthProvider must not consume its own useAuth hook.
export function useMeQuery(api: AuthApi, sessionId: number, enabled: boolean) {
  return useApiQuery<UserResponse>(meQueryRequest(api, sessionId), {
    ...profileOptions,
    // Preserve an initial fetchQuery failure until an explicit retry.
    enabled: (query) => enabled && (query.state.status !== "error" || query.state.data !== undefined),
  });
}
