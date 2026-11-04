"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient, type MutateOptions, type UseMutationResult } from "@tanstack/react-query";
import { createCanceledError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
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
  const query = useApiQuery<Cart>({
    queryKey,
    service: (signal) => getCart({ context, signal }),
    meta: { requiresAuth: true },
  }, { enabled, staleTime: 30_000 });

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
  const run = async <T,>(operation: CartOperation<T>, write: () => Promise<Cart>) => {
    const key = queryKeys.cart.me(operation.sessionId);
    try {
      if (!isCurrent(operation)) throw createCanceledError();
      controllers.current.add(operation.controller);
      // Stop reads both before and after a write so an older GET cannot replace it.
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!isCurrent(operation)) throw createCanceledError();
      const cart = await write();
      if (!isCurrent(operation)) throw createCanceledError();
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!isCurrent(operation)) throw createCanceledError();
      return cart;
    } catch (error) {
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
    onSuccess: <T,>(cart: Cart, operation: CartOperation<T>) => {
      if (isCurrent(operation)) queryClient.setQueryData(queryKeys.cart.me(operation.sessionId), cart);
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
    })),
  }, options);
  const remove = useApiMutation<Cart, CartOperation<string>>({
    mutationKey: ["cart", sessionId, "remove"],
    isCurrent,
    execute: (operation) => run(operation, async () => {
      const request = { context: operation.context, signal: operation.controller.signal };
      await removeCartItem(operation.input, request);
      if (!isCurrent(operation)) throw createCanceledError();
      return getCart(request);
    }),
  }, options);
  const operation = <T,>(input: T): CartOperation<T> => {
    const controller = new AbortController();
    return { input, sessionId, authenticated: enabled, context, controller };
  };

  return {
    ...query,
    data: enabled ? query.data : undefined,
    count: enabled ? query.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0 : 0,
    addItem: cartCommand(add, operation, sessionId),
    updateItem: cartCommand(update, operation, sessionId),
    removeItem: cartCommand(remove, operation, sessionId),
  };
}
