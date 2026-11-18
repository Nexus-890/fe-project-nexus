"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { parseCheckoutConflict, placeOrder } from "../service/checkoutService";
import type { ApiError } from "../types/commonResponseType";
import type { CheckoutConflict, CheckoutDestination, CheckoutOrderGroup } from "../types/checkoutType";

type CheckoutAttempt = {
  key: string;
  destination: CheckoutDestination;
  sessionId: number;
};
type CheckoutOperation = CheckoutAttempt & { controller: AbortController };

/** A retry keeps the original purchase intent, including its key and address. */
export function useCheckout(destination: CheckoutDestination | null, ready: boolean, onAttemptStart: () => void) {
  const { requestContext, sessionId, isSessionCurrent } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const attempt = useRef<CheckoutAttempt | null>(null);
  const active = useRef<CheckoutOperation | null>(null);
  const mounted = useRef(false);
  const completed = useRef(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [conflict, setConflict] = useState<CheckoutConflict | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [placed, setPlaced] = useState(false);
  const priceReviewRequired = error?.status === 409 && error.code === "COMMERCE_PRICE_CHANGED";

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [sessionId]);

  const current = (operation: CheckoutOperation) =>
    mounted.current && isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted;
  const mutation = useApiMutation<CheckoutOrderGroup, CheckoutOperation>({
    mutationKey: ["checkout", sessionId, "place-order"],
    isCurrent: current,
    execute: (operation) => placeOrder(operation.destination, operation.key, {
      context: requestContext,
      signal: operation.controller.signal,
    }),
  }, {
    retry: false,
    gcTime: 0,
    onSuccess: (group, operation) => {
      if (!current(operation)) return;
      completed.current = true;
      setPlaced(true);
      client.setQueryData(queryKeys.promotions.selection(operation.sessionId), []);
      void client.invalidateQueries({ queryKey: queryKeys.promotions.root(operation.sessionId), refetchType: "none" });
      client.setQueryDefaults(["checkout", operation.sessionId, "group"], { meta: { requiresAuth: true } });
      client.setQueryData(queryKeys.checkout.group(operation.sessionId, group.orderGroupId), group);
      // The cart is emptied on creation. Defer its refresh until checkout has
      // unmounted, otherwise the empty-cart redirect can race payment navigation.
      void client.invalidateQueries({ queryKey: queryKeys.cart.me(operation.sessionId), refetchType: "none" });
      router.push(`/checkout/payment/${encodeURIComponent(group.orderGroupId)}`);
    },
    onError: async (failure, operation) => {
      if (!current(operation) || failure.kind === "aborted") return;
      const nextConflict = parseCheckoutConflict(failure);
      setError(failure);
      setConflict(nextConflict);
      setUncertain(failure.kind === "network" || failure.kind === "invalid-response" || failure.status >= 500);
      if (nextConflict?.kind === "price-changed") {
        // BE saved the changed cart price and created no order. Refresh the
        // quote for review, but never retry the purchase without confirmation.
        await client.invalidateQueries({ queryKey: queryKeys.cart.me(operation.sessionId), exact: true });
      }
    },
    onSettled: (_data, _error, operation) => {
      if (active.current === operation) active.current = null;
    },
  });

  const submit = (confirmPrice = false) => {
    if (active.current || completed.current || !isSessionCurrent(sessionId)) return;
    // Recovery asks about the already-submitted purchase. Its cart/preview may
    // now be empty because the server committed before the response was lost.
    const recovering = uncertain && attempt.current && !confirmPrice;
    if (!recovering && (!ready || !destination)) return;
    if (conflict?.kind === "insufficient-stock") return;
    // A malformed price problem still requires review; never submit it as an
    // ordinary retry without displaying the prices the buyer must accept.
    if (priceReviewRequired && !conflict) return;
    if (conflict?.kind === "price-changed" && !confirmPrice) return;
    if (confirmPrice && conflict?.kind !== "price-changed") return;
    if (!attempt.current || confirmPrice) {
      if (!destination) return;
      attempt.current = { key: crypto.randomUUID(), destination: { ...destination, ...(destination.voucherCodes ? { voucherCodes: [...destination.voucherCodes] } : {}) }, sessionId };
    }
    const operation = { ...attempt.current, controller: new AbortController() };
    // Set synchronously: a second click can arrive before React renders pending.
    active.current = operation;
    onAttemptStart();
    setError(null);
    setConflict(null);
    mutation.mutate(operation);
  };

  const resetAfterEdit = () => {
    if (active.current || uncertain || conflict || priceReviewRequired || completed.current) return;
    attempt.current = null;
    setError(null);
  };

  return {
    error, conflict, uncertain,
    canRetry: uncertain,
    blocked: Boolean(conflict) || priceReviewRequired,
    pending: mutation.isPending || placed,
    addressLocked: mutation.isPending || placed || uncertain || Boolean(conflict) || priceReviewRequired,
    placeOrder: () => submit(),
    confirmPrice: () => submit(true),
    resetAfterEdit,
  };
}
