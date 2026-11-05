"use client";

import { createContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { createCanceledError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { getCartQuantity } from "../features/cartUtils";
import { createCartController, identityOwner, type CartControllerService } from "../features/cartController";
import { createGuestStorage, GUEST_CART_STORAGE_KEY } from "../features/guestCartStorage";
import { addCartItem, getCart, createGuestCart, getGuestCart, addGuestCartItem, mergeGuestCart } from "../service/cartService";
import type { ApiResult } from "../types/commonResponseType";
import type { Cart } from "../types/cartResponseType";

type Controller = ReturnType<typeof createCartController>;
interface CartContextValue {
  itemCount: number;
  loading: boolean;
  adding: boolean;
  ready: boolean;
  guestEnabled: boolean;
  error: string | null;
  mergeError: string | null;
  addItem: Controller["addItem"];
  retryMerge: Controller["retryMerge"];
}
export const CartContext = createContext<CartContextValue | undefined>(undefined);

async function withGuestLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(GUEST_CART_STORAGE_KEY, { signal: AbortSignal.timeout(15_000) }, action);
  return action();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { status, user, accessToken, requestContext, sessionId, isSessionCurrent } = useAuth();
  const client = useQueryClient();
  const guestEnabled = process.env.NEXT_PUBLIC_GUEST_CART_ENABLED === "true";
  const [cartSession] = useState(() => {
    let activeId = sessionId;
    // This is a UI/controller result facade. Services keep the shared throwing HTTP boundary.
    const run = async <T,>(action: () => Promise<T>): Promise<ApiResult<T>> => {
      try { return { ok: true, data: await action() }; }
      catch (error) {
        return { ok: false, error: isApiError(error) ? error : {
          kind: "network", status: 0, title: "Unable to synchronize your cart.",
        } };
      }
    };
    const member = async (action: () => Promise<Cart>, write = false): Promise<Cart> => {
      const id = activeId;
      if (!isSessionCurrent(id)) throw createCanceledError();
      const key = queryKeys.cart.me(id);
      if (write && client.isMutating({ mutationKey: ["cart", id, "edit"], exact: true }))
        throw { kind: "network", status: 0, title: "Please wait for your cart update to finish." };
      if (write) await client.cancelQueries({ queryKey: key, exact: true });
      if (!isSessionCurrent(id)) throw createCanceledError();
      const result = await action();
      if (!isSessionCurrent(id)) throw createCanceledError();
      if (write) client.setQueryData(key, result);
      return result;
    };
    const service: CartControllerService = {
      getCart: () => run(() => member(() => client.fetchQuery({
        queryKey: queryKeys.cart.me(activeId),
        queryFn: ({ signal }) => getCart({ context: requestContext, signal }),
        meta: { requiresAuth: true }, staleTime: 30_000,
      }))),
      addCartItem: (input, signal) => run(() => member(() => addCartItem(input, { context: requestContext, signal }), true)),
      mergeGuestCart: (token, mergeKey) => run(() => member(() => mergeGuestCart(token, mergeKey, { context: requestContext }), true)),
      createGuestCart: (signal) => run(() => createGuestCart({ context: requestContext, signal })),
      getGuestCart: (token, signal) => run(() => getGuestCart(token, { context: requestContext, signal })),
      addGuestCartItem: (token, input, signal) => run(() => addGuestCartItem(token, input, { context: requestContext, signal })),
    };
    return {
      controller: createCartController({ guestEnabled, service,
        storage: createGuestStorage(() => window.localStorage), withLock: withGuestLock }),
      setSession: (id: number) => { activeId = id; },
    };
  });
  const { controller } = cartSession;
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const userId = user?.id ?? null;
  const owner = identityOwner({ status, userId, accessToken });
  const ready = owner !== null && state.owner === owner && !state.loading;
  const memberCart = useApiQuery({
    queryKey: queryKeys.cart.me(sessionId),
    service: (signal) => getCart({ context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, { enabled: status === "authenticated" && ready });

  useEffect(() => {
    cartSession.setSession(sessionId);
    controller.setIdentity({ status, userId, accessToken, sessionId });
  }, [cartSession, controller, status, userId, accessToken, sessionId]);

  return <CartContext.Provider value={{
    itemCount: state.owner === owner
      ? status === "authenticated" && memberCart.data ? getCartQuantity(memberCart.data.items) : state.itemCount
      : 0,
    loading: !ready, adding: state.adding, ready, guestEnabled,
    error: state.owner === owner ? state.error : null,
    mergeError: state.owner === owner ? state.mergeError : null,
    addItem: controller.addItem, retryMerge: controller.retryMerge,
  }}>{children}</CartContext.Provider>;
}
