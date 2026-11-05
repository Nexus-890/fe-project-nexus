"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { createCanceledError, createInvalidResponseError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { useGuestCart } from "../hooks/useGuestCart";
import { getCart, removeCartItem, updateCartItem } from "../service/cartService";
import { getCartSubtotal, multiplyCartMoney } from "./cartUtils";
import type { Cart } from "../types/cartResponseType";
import type { ApiContext } from "../types/commonRequestType";

type CartOperation = {
  itemId: string;
  quantity?: number;
  sessionId: number;
  context: ApiContext;
  controller: AbortController;
};

/** Member edits share the provider's cache and wait for guest synchronization. */
export function useCart() {
  const { status, user, requestContext, sessionId, isSessionCurrent } = useAuth();
  const { ready, mergeError, adding } = useGuestCart();
  const client = useQueryClient();
  const key = queryKeys.cart.me(sessionId);
  const mutationKey = ["cart", sessionId, "edit"];
  const mutating = useIsMutating({ mutationKey, exact: true });
  const active = useRef<CartOperation | null>(null);
  const mounted = useRef(false);
  const context = useMemo<ApiContext>(() => ({
    ...requestContext,
    ...(user ? { mockUser: { id: user.id, email: user.email } } : {}),
  }), [requestContext, user]);
  const [feedback, setFeedback] = useState<{
    sessionId: number;
    error: boolean;
    text: string;
  } | null>(null);
  const cart = useApiQuery({
    queryKey: key,
    service: (signal) => getCart({ context, signal }),
    meta: { requiresAuth: true },
  }, {
    enabled: status === "authenticated" && ready && !mergeError && !adding && !mutating,
    staleTime: 30_000,
    retryOnMount: false,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.controller.abort();
      active.current = null;
    };
  }, [sessionId]);

  const mutation = useApiMutation<Cart, CartOperation>({
    mutationKey,
    isCurrent: (operation) => isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted,
    execute: async (operation) => {
      const operationKey = queryKeys.cart.me(operation.sessionId);
      let previous: Cart | undefined;
      let optimistic: Cart | undefined;
      try {
        await client.cancelQueries({ queryKey: operationKey, exact: true });
        if (!isSessionCurrent(operation.sessionId) || operation.controller.signal.aborted)
          throw createCanceledError();
        previous = client.getQueryData<Cart>(operationKey);
        if (!previous?.items.some((item) => item.id === operation.itemId))
          throw createInvalidResponseError("This cart item is no longer available. Refresh your cart.");
        const items = operation.quantity === undefined
          ? previous.items.filter((item) => item.id !== operation.itemId)
          : previous.items.map((item) => item.id === operation.itemId
            ? { ...item, quantity: operation.quantity!, lineTotal: multiplyCartMoney(item.unitPrice, operation.quantity!) }
            : item);
        optimistic = client.setQueryData<Cart>(operationKey, {
          ...previous, items, subtotal: getCartSubtotal(items),
        });
        const options = { context: operation.context, signal: operation.controller.signal };
        let result: Cart;
        if (operation.quantity !== undefined)
          result = await updateCartItem({ itemId: operation.itemId, quantity: operation.quantity }, options);
        else {
          await removeCartItem(operation.itemId, options);
          // DELETE confirms the removal; a failed later read must not undo it.
          result = optimistic!;
        }
        if (!isSessionCurrent(operation.sessionId) || operation.controller.signal.aborted)
          throw createCanceledError();
        // A route mounted or manual retry during the write can start an older GET.
        await client.cancelQueries({ queryKey: operationKey, exact: true });
        if (!isSessionCurrent(operation.sessionId) || operation.controller.signal.aborted)
          throw createCanceledError();
        return result;
      } catch (error) {
        // A same-session unmount may abort an applied write. Restore only our
        // own snapshot, then reconcile; never restore another account's cache.
        if (isSessionCurrent(operation.sessionId) && previous &&
          client.getQueryData(operationKey) === optimistic)
          client.setQueryData(operationKey, previous);
        throw error;
      }
    },
  }, {
    scope: { id: "cart-" + sessionId },
    gcTime: 0,
    meta: { requiresAuth: true },
    onSuccess: (result, operation) => {
      if (!isSessionCurrent(operation.sessionId)) return;
      client.setQueryData(queryKeys.cart.me(operation.sessionId), result);
      if (mounted.current) setFeedback({
        sessionId: operation.sessionId, error: false,
        text: operation.quantity === undefined ? "Item removed from your cart." : "Cart quantity updated.",
      });
    },
    onError: (error, operation) => {
      if (!mounted.current || !isSessionCurrent(operation.sessionId) ||
        operation.controller.signal.aborted || error.kind === "aborted") return;
      const text = isApiError(error)
        ? error.fieldErrors?.quantity?.[0] || error.detail || error.title
        : "Unable to update your cart. Please try again.";
      setFeedback({ sessionId: operation.sessionId, error: true, text });
    },
    onSettled: async (_data, _error, operation) => {
      try {
        if (!isSessionCurrent(operation.sessionId)) return;
        const queryKey = queryKeys.cart.me(operation.sessionId);
        await client.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
        // Queries pause automatic reads during edits. Explicitly fetch to hold
        // the shared edit lock until authoritative reconciliation settles.
        await client.fetchQuery({
          queryKey,
          queryFn: ({ signal }) => getCart({ context: operation.context, signal }),
          retry: false,
        }).catch(() => {
          // Query state displays refresh failure; a confirmed write stays saved.
        });
      } finally {
        if (active.current === operation) active.current = null;
      }
    },
  });

  const changeItem = (itemId: string, quantity?: number) => {
    if (active.current || !ready || mergeError || adding ||
      client.isMutating({ mutationKey, exact: true }) || !isSessionCurrent(sessionId) || !cart.data) return;
    if (quantity !== undefined && (!Number.isSafeInteger(quantity) || quantity < 1)) return;
    if (quantity !== undefined && cart.data.items.find((item) => item.id === itemId)?.quantity === quantity) return;
    const operation = { itemId, quantity, sessionId, context, controller: new AbortController() };
    active.current = operation;
    setFeedback(null);
    mutation.mutate(operation);
  };

  return {
    cart,
    pending: mutating > 0 || !ready || Boolean(mergeError) || adding,
    feedback: feedback?.sessionId === sessionId ? feedback : null,
    updateQuantity: (itemId: string, quantity: number) => changeItem(itemId, quantity),
    removeItem: (itemId: string) => changeItem(itemId),
  };
}
