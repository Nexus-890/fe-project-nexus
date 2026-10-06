"use client";

import { apiQueryOptions, type ApiQueryOptions } from "../../hooks/api-query-options";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { UserResponse } from "../../types/api";
import { isUserResponse, ME_PATH, type AuthApi } from "./api";

const profileOptions: ApiQueryOptions<UserResponse> = {
  meta: { requiresAuth: true },
  staleTime: 60_000,
  retry: false,
  validateResponse: isUserResponse,
};

function meQueryRequest(api: AuthApi, sessionId: number) {
  return { queryKey: ["auth", sessionId, "me"], url: ME_PATH, client: api.client };
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
