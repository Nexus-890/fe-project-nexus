"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { useApiQuery } from "../useApiQuery";
import { queryKeys } from "../../configs/query-keys";
import { canceledSignIn, unwrapApiResult } from "../../lib/api-result";
import { createCartService } from "../../service/cart";
import { USE_CART_MOCK } from "../../mocks/cart";
import type { AddCartItemRequest, UpdateCartItemRequest } from "../../types/cart/request/type";
import type { Cart } from "../../types/cart/response/type";
import type { ApiError, ApiResult } from "../../types/common/response/type";

/** Header, product details and cart page all observe this session's one cart. */
export function useCart() {
  const { api, user, status, sessionId, isCurrentSession, signOut } = useAuth();
  const queryClient = useQueryClient();
  const enabled = status === "authenticated" && user !== null;
  const userId = user?.id;
  const email = user?.email;
  const service = useMemo(() => createCartService({
    client: api.client,
    mock: USE_CART_MOCK,
    mockUser: userId && email ? { id: userId, email } : undefined,
  }), [api.client, userId, email]);
  const queryKey = queryKeys.cart.me(sessionId);
  const query = useApiQuery({ queryKey, service: service.getCart }, {
    enabled,
    staleTime: 30_000,
    meta: { requiresAuth: true },
  });

  useEffect(() => {
    if (query.error?.status === 401 && isCurrentSession(sessionId)) signOut();
  }, [query.error, isCurrentSession, sessionId, signOut]);

  async function mutateCart(operation: () => Promise<ApiResult<Cart>>) {
    if (!enabled || !isCurrentSession(sessionId)) throw canceledSignIn();
    // An older GET must never overwrite a successful write.
    await queryClient.cancelQueries({ queryKey, exact: true });
    if (!isCurrentSession(sessionId)) throw canceledSignIn();
    const result = await operation();
    if (!isCurrentSession(sessionId)) throw canceledSignIn();
    if (!result.ok && result.error.status === 401) signOut();
    const cart = unwrapApiResult(result);
    // Also stop reads started while the write was in flight (e.g. on navigation).
    await queryClient.cancelQueries({ queryKey, exact: true });
    if (!isCurrentSession(sessionId)) throw canceledSignIn();
    return cart;
  }

  const mutationOptions = {
    // Serialize writes from every observer, including separate page components.
    scope: { id: `cart-${sessionId}` },
    retry: false,
    gcTime: 0,
    meta: { requiresAuth: true },
    onSuccess: (cart: Cart) => {
      if (isCurrentSession(sessionId)) queryClient.setQueryData(queryKey, cart);
    },
  };
  const addItem = useMutation<Cart, ApiError, AddCartItemRequest>({
    ...mutationOptions,
    mutationKey: ["cart", sessionId, "add"],
    mutationFn: (input) => mutateCart(() => service.addCartItem(input)),
  });
  const updateItem = useMutation<Cart, ApiError, UpdateCartItemRequest>({
    ...mutationOptions,
    mutationKey: ["cart", sessionId, "update"],
    mutationFn: (input) => mutateCart(() => service.updateCartItem(input)),
  });
  const removeItem = useMutation<Cart, ApiError, string>({
    ...mutationOptions,
    mutationKey: ["cart", sessionId, "remove"],
    mutationFn: (itemId) => mutateCart(async () => {
      const result = await service.removeCartItem(itemId);
      if (!result.ok) return result;
      // Do not issue a follow-up GET if the user signed out during DELETE.
      if (!isCurrentSession(sessionId)) throw canceledSignIn();
      return service.getCart();
    }),
  });

  return {
    ...query,
    data: enabled ? query.data : undefined,
    count: enabled ? query.data?.items.reduce((total, item) => total + item.quantity, 0) ?? 0 : 0,
    addItem,
    updateItem,
    removeItem,
  };
}
