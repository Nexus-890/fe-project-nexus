"use client";

import { createContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { createCanceledError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import { useApiQuery } from "../hooks/useApi";
import { createCartController, identityOwner } from "../features/cartController";
import { cartItemCount } from "../features/cartSnapshotUtils";
import { createGuestStorage, GUEST_CART_STORAGE_KEY } from "../features/guestCartStorage";
import { addCartItem, addGuestCartItem, createGuestCart, getCart, getGuestCart, mergeGuestCart } from "../service/cartService";
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

const cartResult = async <T,>(action: () => Promise<T>): Promise<ApiResult<T>> => {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return { ok: false, error: isApiError(error) ? error
      : error instanceof DOMException && error.name === "AbortError" ? createCanceledError()
        : { kind: "network", status: 0, title: "Unable to load your cart. Please try again." } };
  }
};

function CartProvider({ children }: { children: ReactNode }) {
  const { status, user, accessToken, requestContext, sessionId, isSessionCurrent } = useAuth();
  const queryClient = useQueryClient();
  const currentUser = useRef(user);
  const editing = useIsMutating({ mutationKey: ["cart", sessionId, "edit"], exact: true }) > 0;
  const guestEnabled = process.env.NEXT_PUBLIC_GUEST_CART_ENABLED !== "false";
  const [controller] = useState(() => createCartController({
    guestEnabled,
    storage: createGuestStorage(() => window.localStorage),
    withLock: withGuestLock,
    service: (getIdentity) => {
      const memberResult = async (action: () => Promise<Cart>, adding = false, signal?: AbortSignal) => {
        const id = getIdentity().sessionId;
        return cartResult(async () => {
          const isCurrentBuyer = () => id !== undefined && isSessionCurrent(id) && getIdentity().canUseCart !== false && !signal?.aborted;
          if (id === undefined || !isCurrentBuyer()) throw createCanceledError();
          if (adding) {
            if (queryClient.isMutating({ mutationKey: ["cart", id, "edit"], exact: true }))
              throw { kind: "network", status: 0, title: "Please wait for your cart." };
            await queryClient.cancelQueries({ queryKey: queryKeys.cart.me(id), exact: true });
            if (!isCurrentBuyer()) throw createCanceledError();
          }
          const cart = await action();
          if (!isCurrentBuyer()) throw createCanceledError();
          if (adding) {
            // A route mounted during the POST may have started another read.
            // Cancel its older snapshot before publishing the committed cart.
            await queryClient.cancelQueries({ queryKey: queryKeys.cart.me(id), exact: true });
            if (!isCurrentBuyer()) throw createCanceledError();
          }
          // CartPage, the header, and post-login merges share the same private cache.
          queryClient.setQueryData(queryKeys.cart.me(id), cart);
          return cart;
        });
      };
      const memberContext = () => ({
        ...requestContext,
        ...(currentUser.current ? { mockUser: { id: currentUser.current.id, email: currentUser.current.email } } : {}),
      });
      return {
        getCart: () => memberResult(() => getCart({ context: memberContext() })),
        addCartItem: (input, signal) => memberResult(() => addCartItem(input, { context: memberContext(), signal }), true, signal),
        createGuestCart: (signal) => cartResult(() => createGuestCart({ context: requestContext, signal })),
        getGuestCart: (token, signal) => cartResult(() => getGuestCart(token, { context: requestContext, signal })),
        addGuestCartItem: (token, input, signal) => cartResult(() => addGuestCartItem(token, input, { context: requestContext, signal })),
        mergeGuestCart: (token, mergeKey) => memberResult(() => mergeGuestCart(token, mergeKey, { context: memberContext() })),
      };
    },
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const userId = user?.id ?? null;
  const canUseCart = user?.roles.includes("BUYER") === true;
  const owner = identityOwner({ status, userId, accessToken, sessionId, canUseCart });

  useEffect(() => {
    currentUser.current = user;
    controller.setIdentity({ status, userId, accessToken, sessionId, canUseCart });
  }, [controller, status, userId, user, accessToken, sessionId, canUseCart]);

  // Seller-only sessions have no buyer cart to synchronize. Their callback
  // must finish without reading or consuming a saved guest credential.
  const ready = (status === "authenticated" && !canUseCart) || (owner !== null && state.owner === owner && !state.loading);
  const memberCart = useApiQuery({
    queryKey: queryKeys.cart.me(sessionId),
    service: (signal) => getCart({ context: { ...requestContext, ...(user ? { mockUser: { id: user.id, email: user.email } } : {}) }, signal }),
    meta: { requiresAuth: true },
  }, {
    enabled: status === "authenticated" && canUseCart && ready && !state.mergeError && !state.adding && !editing,
    // The controller seeds this cache during sign-in/add. Reuse that fresh
    // snapshot when the header/page observer becomes enabled.
    staleTime: 30_000,
    retryOnMount: false,
  });
  const itemCount = status === "authenticated" && !canUseCart ? 0 : status === "authenticated" && memberCart.data
    ? cartItemCount(memberCart.data) : state.owner === owner ? state.itemCount : 0;

  return <CartContext.Provider value={{
    itemCount,
    loading: !ready, adding: state.owner === owner && state.adding, ready, guestEnabled,
    error: state.owner === owner ? state.error : null,
    mergeError: state.owner === owner ? state.mergeError : null,
    addItem: controller.addItem, retryMerge: controller.retryMerge,
  }}>{children}</CartContext.Provider>;
}

export default CartProvider;
