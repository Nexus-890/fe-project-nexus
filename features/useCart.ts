"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiError } from "../configs/api";
import { useAuth } from "../hooks/useAuth";
import { useCart as useSharedCart } from "../hooks/useCart";

/** Page feedback composes the same cart query/commands used by the header/detail. */
export function useCart() {
  const { sessionId, isSessionCurrent } = useAuth();
  const client = useQueryClient();
  const cart = useSharedCart();
  const active = useRef(false);
  const mounted = useRef(false);
  const [feedback, setFeedback] = useState<{
    sessionId: number;
    error: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    mounted.current = true;
    active.current = false;
    return () => { mounted.current = false; };
  }, [sessionId]);

  const changeItem = (itemId: string, quantity?: number) => {
    // Check the cache's mutation count synchronously as well as rendered state.
    // This prevents two events or a remount from starting competing page edits.
    if (active.current || client.isMutating({ mutationKey: ["cart", sessionId] }) ||
      !isSessionCurrent(sessionId) || !cart.data) return;
    if (quantity !== undefined && (!Number.isSafeInteger(quantity) || quantity < 1)) return;
    if (quantity !== undefined && cart.data.items.find((item) => item.id === itemId)?.quantity === quantity) return;
    active.current = true;
    setFeedback(null);
    const callbacks = {
      onSuccess: () => {
        if (mounted.current && isSessionCurrent(sessionId))
          setFeedback({
            sessionId, error: false,
            text: quantity === undefined ? "Item removed from your cart." : "Cart quantity updated.",
          });
      },
      onError: (error: unknown) => {
        if (!mounted.current || !isSessionCurrent(sessionId) ||
          (isApiError(error) && error.kind === "aborted")) return;
        const text = isApiError(error)
          ? error.fieldErrors?.quantity?.[0] || error.detail || error.title
          : "Unable to update your cart. Please try again.";
        setFeedback({ sessionId, error: true, text });
      },
      onSettled: () => { active.current = false; },
    };
    if (quantity === undefined) cart.removeItem.mutate(itemId, callbacks);
    else cart.updateItem.mutate({ itemId, quantity }, callbacks);
  };

  return {
    cart,
    pending: cart.pending,
    feedback: feedback?.sessionId === sessionId ? feedback : null,
    updateQuantity: (itemId: string, quantity: number) => changeItem(itemId, quantity),
    removeItem: (itemId: string) => changeItem(itemId),
  };
}
