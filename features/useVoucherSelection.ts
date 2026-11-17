"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
const emptyCodes: string[] = [];

/** Shared in-memory purchase selection, isolated and cleared with the auth session. */
export function useVoucherSelection() {
  const auth = useAuth(); const client = useQueryClient(); const queryKey = queryKeys.promotions.selection(auth.sessionId);
  useApiQuery({ queryKey, meta: { requiresAuth: true }, service: async () => emptyCodes }, { initialData: emptyCodes, staleTime: Infinity, gcTime: Infinity, enabled: auth.status === "authenticated" });
  // Cache observer notifications are batched. Controlled checkboxes need a
  // synchronous snapshot during their change event to avoid restoring old state.
  const codes = useSyncExternalStore(
    (changed) => client.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === queryKey[0] && event.query.queryKey[1] === auth.sessionId) changed();
    }),
    () => client.getQueryData<string[]>(queryKey) ?? emptyCodes,
    () => emptyCodes,
  );
  return { codes, setCodes: (next: string[]) => client.setQueryData(queryKey, [...new Set(next)]) };
}
