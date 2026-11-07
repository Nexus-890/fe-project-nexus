"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createCanceledError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getOrderGroup } from "../service/orderService";
import type { PaymentInstructions } from "../types/paymentResponseType";
import type { ApiError } from "../types/commonResponseType";
import { getPaymentOutcome } from "./paymentStatusUtils";

const stopsPolling = (error: ApiError | null) =>
  error?.kind === "invalid-response" || (error?.kind === "http" && error.status >= 400 && error.status < 500);

/** Owns the shared countdown, visibility lifecycle and terminal-state polling. */
export function usePaymentStatus(orderGroupId: string, payment: PaymentInstructions | undefined) {
  const { requestContext, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.orders.group(sessionId, orderGroupId);
  const [visible, setVisible] = useState(() => typeof document !== "undefined" && document.visibilityState !== "hidden");
  const [, tick] = useState(0);
  const remainingMs = () => payment ? Math.max(0, payment.remainingMs - (performance.now() - payment.receivedAt)) : 0;
  const seconds = Math.ceil(remainingMs() / 1000);
  const canPoll = () => Boolean(payment) && document.visibilityState !== "hidden" && remainingMs() > 0;
  const status = useApiQuery({
    queryKey,
    service: async (signal) => {
      // Recheck at dispatch and after completion: timer callbacks and responses
      // can race visibility changes or the deadline before React renders again.
      if (!canPoll()) throw createCanceledError();
      const group = await getOrderGroup(orderGroupId, { context: requestContext, signal });
      if (!canPoll() || signal.aborted) throw createCanceledError();
      return group;
    },
    meta: { requiresAuth: true },
  }, {
    enabled: (query) => visible && canPoll() && getPaymentOutcome(query.state.data) === "pending" && !stopsPolling(query.state.error),
    refetchInterval: (query) => canPoll() && getPaymentOutcome(query.state.data) === "pending" && !stopsPolling(query.state.error) ? 3000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    staleTime: 0,
    // Keep the verified result through navigation so the order list can show
    // confirmation. Provider clears this private cache on a session change.
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    const cancel = () => void queryClient.cancelQueries({ queryKey: queryKeys.orders.group(sessionId, orderGroupId), exact: true });
    const update = () => {
      const showing = document.visibilityState !== "hidden";
      setVisible(showing);
      tick((value) => value + 1);
      if (!showing || !payment || performance.now() - payment.receivedAt >= payment.remainingMs) cancel();
    };
    const timer = window.setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
      cancel();
    };
  }, [payment, orderGroupId, queryClient, sessionId]);

  return { seconds, outcome: getPaymentOutcome(status.data), error: status.error?.kind === "aborted" ? null : status.error };
}
