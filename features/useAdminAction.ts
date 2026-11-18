"use client";

import { useEffect, useRef } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import type { ServiceRequestOptions } from "../types/commonRequestType";

/** Shared cancellation, duplicate-submit lock and account-generation guard for admin writes. */
export function useAdminAction<TInput, TOutput>(
  execute: (input: TInput, options: ServiceRequestOptions) => Promise<TOutput>,
  invalidateKey: readonly QueryKey[],
  onSuccess: (data: TOutput) => void,
) {
  const auth = useAuth();
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [auth.sessionId]);
  const mutation = useApiMutation<TOutput, { input: TInput; controller: AbortController; sessionId: number }>({
    execute: ({ input, controller }) => execute(input, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey,
  }, {
    onSuccess,
    onSettled: (_data, _error, operation) => { if (active.current === operation.controller) active.current = null; },
  });
  return { ...mutation, run: (input: TInput) => {
    if (active.current || auth.status !== "authenticated") return;
    const controller = new AbortController(); active.current = controller;
    mutation.mutate({ input, controller, sessionId: auth.sessionId });
  } };
}
