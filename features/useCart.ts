"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  createCanceledError,
  createInvalidResponseError,
  isApiError,
} from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getCart, removeCartItem, updateCartItem } from "../service/cartService";
import type { Cart } from "../types/cartResponseType";

type CartOperation = {
  itemId: string;
  quantity?: number;
  sessionId: number;
  controller: AbortController;
};
type CartSnapshot = { previous: Cart; optimistic: Cart | undefined };

/** Cart business state composes the generic hooks; the service owns all HTTP. */
export function useCart() {
  const { status, requestContext, sessionId, isSessionCurrent } = useAuth();
  const client = useQueryClient();
  const key = queryKeys.cart.me(sessionId);
  const mutationKey = ["cart", sessionId, "edit"];
  const mutating = useIsMutating({ mutationKey, exact: true });
  const active = useRef<CartOperation | null>(null);
  const mounted = useRef(false);
  const [feedback, setFeedback] = useState<{
    sessionId: number;
    error: boolean;
    text: string;
  } | null>(null);
  const cart = useApiQuery(
    {
      queryKey: key,
      service: (signal) => getCart({ context: requestContext, signal }),
      meta: { requiresAuth: true },
    },
    {
      enabled: status === "authenticated",
      retryOnMount: false,
    },
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [sessionId]);

  const mutation = useApiMutation<Cart | undefined, CartOperation, CartSnapshot>(
    {
      mutationKey,
      isCurrent: (operation) =>
        isSessionCurrent(operation.sessionId) &&
        !operation.controller.signal.aborted,
      execute: async (operation) => {
        const options = {
          context: requestContext,
          signal: operation.controller.signal,
        };
        if (operation.quantity !== undefined) {
          return updateCartItem(
            { itemId: operation.itemId, quantity: operation.quantity },
            options,
          );
        }
        await removeCartItem(operation.itemId, options);
        return undefined;
      },
    },
    {
      gcTime: 0,
      onMutate: async (operation) => {
        const operationKey = queryKeys.cart.me(operation.sessionId);
        await client.cancelQueries({ queryKey: operationKey, exact: true });
        if (
          !isSessionCurrent(operation.sessionId) ||
          operation.controller.signal.aborted
        )
          throw createCanceledError();
        const previous = client.getQueryData<Cart>(operationKey);
        if (!previous?.items.some((item) => item.id === operation.itemId))
          throw createInvalidResponseError(
            "This cart item is no longer available. Refresh your cart.",
          );
        const optimistic = client.setQueryData<Cart>(operationKey, {
          ...previous,
          items:
            operation.quantity === undefined
              ? previous.items.filter((item) => item.id !== operation.itemId)
              : previous.items.map((item) =>
                  item.id === operation.itemId
                    ? { ...item, quantity: operation.quantity! }
                    : item,
                ),
        });
        return { previous, optimistic };
      },
      onSuccess: (result, operation) => {
        if (!isSessionCurrent(operation.sessionId)) return;
        if (result)
          client.setQueryData(queryKeys.cart.me(operation.sessionId), result);
        if (mounted.current)
          setFeedback({
            sessionId: operation.sessionId,
            error: false,
            text:
              operation.quantity === undefined
                ? "Item removed from your cart."
                : "Cart quantity updated.",
          });
      },
      onError: (error, operation, snapshot) => {
        // Restore only this account; logout has already removed its private cache.
        if (!isSessionCurrent(operation.sessionId)) return;
        if (
          snapshot &&
          client.getQueryData(queryKeys.cart.me(operation.sessionId)) ===
            snapshot.optimistic
        )
          client.setQueryData(
            queryKeys.cart.me(operation.sessionId),
            snapshot.previous,
          );
        if (
          mounted.current &&
          !operation.controller.signal.aborted &&
          error.kind !== "aborted"
        ) {
          const reason = isApiError(error)
            ? error.fieldErrors?.quantity?.[0] || error.detail || error.title
            : "Unable to update your cart. Please try again.";
          setFeedback({ sessionId: operation.sessionId, error: true, text: reason });
        }
      },
      onSettled: async (_data, _error, operation) => {
        try {
          if (isSessionCurrent(operation.sessionId)) {
            await client.invalidateQueries({
              queryKey: queryKeys.cart.me(operation.sessionId),
              exact: true,
            });
          }
        } finally {
          if (active.current === operation) active.current = null;
        }
      },
    },
  );

  const changeItem = (itemId: string, quantity?: number) => {
    // Serialize the whole cart: a late full-cart response/rollback cannot overwrite another edit.
    if (
      active.current ||
      client.isMutating({ mutationKey, exact: true }) ||
      !isSessionCurrent(sessionId) ||
      !cart.data
    )
      return;
    if (
      quantity !== undefined &&
      (!Number.isSafeInteger(quantity) || quantity < 1)
    )
      return;
    if (
      quantity !== undefined &&
      cart.data.items.find((item) => item.id === itemId)?.quantity === quantity
    )
      return;
    const operation = {
      itemId,
      quantity,
      sessionId,
      controller: new AbortController(),
    };
    active.current = operation;
    setFeedback(null);
    mutation.mutate(operation);
  };

  return {
    cart,
    pending: mutating > 0,
    feedback: feedback?.sessionId === sessionId ? feedback : null,
    updateQuantity: (itemId: string, quantity: number) => changeItem(itemId, quantity),
    removeItem: (itemId: string) => changeItem(itemId),
  };
}
