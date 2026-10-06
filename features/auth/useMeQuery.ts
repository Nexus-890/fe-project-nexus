"use client";

import type { ApiQueryOptions } from "../../hooks/api-query-options";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { UserResponse } from "../../types/api";
import type { AuthApi } from "./api";

export function meQueryOptions(api: AuthApi, sessionId: number): ApiQueryOptions<UserResponse> {
  return {
    queryKey: ["auth", sessionId, "me"],
    queryFn: (signal) => api.me(signal),
    meta: { requiresAuth: true },
    staleTime: 60_000,
    retry: false,
  };
}

// Dependencies are explicit: AuthProvider must not consume its own useAuth hook.
export function useMeQuery(api: AuthApi, sessionId: number, enabled: boolean) {
  return useApiQuery({
    ...meQueryOptions(api, sessionId),
    // Keep an initial fetchQuery failure visible even if React observes the
    // new session after it settles. Explicit refetch still works when disabled.
    enabled: (query) => enabled && (query.state.status !== "error" || query.state.data !== undefined),
  });
}
