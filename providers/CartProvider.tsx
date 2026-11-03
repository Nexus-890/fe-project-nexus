"use client";

import { createContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "../hooks/auth/useAuth";
import { createCartController, identityOwner } from "../features/cart/controller";
import { createGuestStorage, GUEST_CART_STORAGE_KEY } from "../features/cart/guest-storage";
import { createCartService } from "../service/cart";

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
  // Serializes tabs when available; server-side idempotency is still required
  // for response loss, browsers without Web Locks, and other devices.
  if (typeof navigator !== "undefined" && navigator.locks) {
    // A suspended tab must not hold another tab's callback indefinitely.
    return navigator.locks.request(GUEST_CART_STORAGE_KEY, { signal: AbortSignal.timeout(15_000) }, action);
  }
  return action();
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { status, user, accessToken, api } = useAuth();
  const guestEnabled = process.env.NEXT_PUBLIC_GUEST_CART_ENABLED === "true";
  const [controller] = useState(() => createCartController({
    guestEnabled, storage: createGuestStorage(() => window.localStorage), withLock: withGuestLock,
    // All protected operations share the provider's synchronous token getter
    // and renew coordinator. Public guest calls still use auth: false.
    service: createCartService({ client: api.client }),
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  const userId = user?.id ?? null;
  const owner = identityOwner({ status, userId, accessToken });

  useEffect(() => {
    controller.setIdentity({ status, userId, accessToken });
  }, [controller, status, userId, accessToken]);

  const ready = owner !== null && state.owner === owner && !state.loading;
  return <CartContext.Provider value={{
    itemCount: state.owner === owner ? state.itemCount : 0,
    loading: !ready, adding: state.adding, ready, guestEnabled,
    error: state.owner === owner ? state.error : null,
    mergeError: state.owner === owner ? state.mergeError : null,
    addItem: controller.addItem, retryMerge: controller.retryMerge,
  }}>{children}</CartContext.Provider>;
}
