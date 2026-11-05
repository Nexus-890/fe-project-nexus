"use client";

import { useEffect, useMemo, useRef } from "react";
import { useIsMutating, useQueryClient, type MutateOptions, type UseMutationResult } from "@tanstack/react-query";
import { createCanceledError, createInvalidResponseError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { getCartQuantity, getCartSubtotal, multiplyCartMoney } from "../features/cartUtils";
import { addCartItem, getCart, removeCartItem, updateCartItem } from "../service/cartService";
import type { AddCartItemRequest, UpdateCartItemRequest } from "../types/cartRequestType";
import type { Cart } from "../types/cartResponseType";
import type { ApiError } from "../types/commonResponseType";
import type { ApiContext } from "../types/commonRequestType";
import { useApiMutation, useApiQuery } from "./useApi";
import { useAuth } from "./useAuth";

type CartOperation<T> = {
  input: T;
  sessionId: number;
  authenticated: boolean;
  context: ApiContext;
  controller: AbortController;
  reconcile: boolean;
};

// Keep the public command input small while carrying the originating generation
// through queued writes and callbacks, even after this observer changes account.
const cartCommand = <T,>(
  mutation: UseMutationResult<Cart, ApiError, CartOperation<T>>,
  operation: (input: T) => CartOperation<T>,
  sessionId: number,
) => {
  const callbacks = (options?: MutateOptions<Cart, ApiError, T>): MutateOptions<Cart, ApiError, CartOperation<T>> => ({
    onSuccess: (data, variables, result, context) => options?.onSuccess?.(data, variables.input, result, context),
    onError: (error, variables, result, context) => options?.onError?.(error, variables.input, result, context),
    onSettled: (data, error, variables, result, context) => options?.onSettled?.(data, error, variables.input, result, context),
  });
  return {
    ...mutation,
    isPending: mutation.isPending && mutation.variables?.sessionId === sessionId,
    variables: mutation.variables?.input,
    mutate: (input: T, options?: MutateOptions<Cart, ApiError, T>) => mutation.mutate(operation(input), callbacks(options)),
    mutateAsync: (input: T, options?: MutateOptions<Cart, ApiError, T>) => mutation.mutateAsync(operation(input), callbacks(options)),
  };
};

/** Header, detail and cart page observe one cart per authenticated generation. */
export function useCart() {
  const { user, status, requestContext, sessionId, isSessionCurrent, signOut } = useAuth();
  const queryClient = useQueryClient();
  const controllers = useRef(new Set<AbortController>());
  const enabled = status === "authenticated" && user !== null;
  const context = useMemo<ApiContext>(() => ({
    ...requestContext,
    ...(user ? { mockUser: { id: user.id, email: user.email } } : {}),
  }), [requestContext, user]);
  const queryKey = queryKeys.cart.me(sessionId);
  const pending = useIsMutating({ mutationKey: ["cart", sessionId] }) > 0;
  const query = useApiQuery<Cart>({
    queryKey,
    service: (signal) => getCart({ context, signal }),
    meta: { requiresAuth: true },
  }, { enabled: enabled && !pending, staleTime: 30_000, retryOnMount: false });

  useEffect(() => {
    if (query.error?.status === 401 && isSessionCurrent(sessionId)) signOut();
  }, [query.error, isSessionCurrent, sessionId, signOut]);
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active) controller.abort();
      active.clear();
    };
  }, [sessionId]);

  const isCurrent = <T,>(operation: CartOperation<T>) => operation.authenticated &&
    isSessionCurrent(operation.sessionId) && !operation.controller.signal.aborted;
  const run = async <T,>(
    operation: CartOperation<T>,
    write: (optimistic?: Cart) => Promise<Cart>,
    edit?: { itemId: string; quantity?: number },
  ) => {
    const key = queryKeys.cart.me(operation.sessionId);
    let previous: Cart | undefined;
    let optimistic: Cart | undefined;
    try {
      if (!isCurrent(operation)) throw createCanceledError();
      controllers.current.add(operation.controller);
      // Stop reads both before and after a write so an older GET cannot replace it.
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!isCurrent(operation)) throw createCanceledError();
      // Scope serialization starts before optimism, so queued writes cannot
      // apply a rollback snapshot over another observer's confirmed edit.
      if (edit) {
        previous = queryClient.getQueryData<Cart>(key);
        if (!previous?.items.some((item) => item.id === edit.itemId))
          throw createInvalidResponseError("This cart item is no longer available. Refresh your cart.");
        const items = edit.quantity === undefined
          ? previous.items.filter((item) => item.id !== edit.itemId)
          : previous.items.map((item) => item.id === edit.itemId
            ? { ...item, quantity: edit.quantity!, lineTotal: multiplyCartMoney(item.unitPrice, edit.quantity!) }
            : item);
        optimistic = queryClient.setQueryData<Cart>(key, {
          ...previous, items, subtotal: getCartSubtotal(items),
        });
      }
      const cart = await write(optimistic);
      if (!isCurrent(operation)) throw createCanceledError();
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!isCurrent(operation)) throw createCanceledError();
      return cart;
    } catch (error) {
      if (isSessionCurrent(operation.sessionId) && previous && queryClient.getQueryData(key) === optimistic)
        queryClient.setQueryData(key, previous);
      if (isCurrent(operation) && isApiError(error) && error.status === 401) signOut();
      throw error;
    } finally {
      controllers.current.delete(operation.controller);
    }
  };
  const options = {
    scope: { id: "cart-" + sessionId },
    retry: false as const,
    gcTime: 0,
    meta: { requiresAuth: true },
    onMutate: <T,>(operation: CartOperation<T>) => {
      controllers.current.add(operation.controller);
    },
    onSuccess: <T,>(cart: Cart, operation: CartOperation<T>) => {
      if (isCurrent(operation)) queryClient.setQueryData(queryKeys.cart.me(operation.sessionId), cart);
    },
    onSettled: async <T,>(_cart: Cart | undefined, _error: ApiError | null, operation: CartOperation<T>) => {
      // An unmount aborts its write but the server may already have applied it.
      // Reconcile that same session too; a new account must never be restored.
      if (!operation.reconcile || !isSessionCurrent(operation.sessionId)) return;
      const queryKey = queryKeys.cart.me(operation.sessionId);
      await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" });
      // Observers pause automatic reads during writes. Fetch explicitly so the
      // shared mutation remains pending until authoritative reconciliation ends.
      await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => getCart({ context: operation.context, signal }),
        retry: false,
      }).catch(() => {
        // Query state exposes refresh failure; a confirmed write stays confirmed.
      });
    },
  };
  const add = useApiMutation<Cart, CartOperation<AddCartItemRequest>>({
    mutationKey: ["cart", sessionId, "add"],
    isCurrent,
    execute: (operation) => run(operation, () => addCartItem(operation.input, {
      context: operation.context, signal: operation.controller.signal,
    })),
  }, options);
  const update = useApiMutation<Cart, CartOperation<UpdateCartItemRequest>>({
    mutationKey: ["cart", sessionId, "update"],
    isCurrent,
    execute: (operation) => run(operation, () => updateCartItem(operation.input, {
      context: operation.context, signal: operation.controller.signal,
    }), operation.input),
  }, options);
  const remove = useApiMutation<Cart, CartOperation<string>>({
    mutationKey: ["cart", sessionId, "remove"],
    isCurrent,
    execute: (operation) => run(operation, async (optimistic) => {
      const request = { context: operation.context, signal: operation.controller.signal };
      await removeCartItem(operation.input, request);
      if (!isCurrent(operation)) throw createCanceledError();
      // A successful DELETE is confirmed even if the later refresh fails.
      // Keep its optimistic snapshot and expose refresh failure on the query.
      return optimistic ?? getCart(request);
    }, { itemId: operation.input }),
  }, options);
  const operation = <T,>(input: T, reconcile = false): CartOperation<T> => {
    const controller = new AbortController();
    return { input, sessionId, authenticated: enabled, context, controller, reconcile };
  };

  return {
    ...query,
    data: enabled ? query.data : undefined,
    count: enabled ? getCartQuantity(query.data?.items ?? []) : 0,
    pending,
    addItem: cartCommand(add, operation, sessionId),
    updateItem: cartCommand(update, (input) => operation(input, true), sessionId),
    removeItem: cartCommand(remove, (input) => operation(input, true), sessionId),
  };
}
