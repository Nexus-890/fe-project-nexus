import type { AddCartItemRequest } from "../types/cartRequestType";
import type { ApiResult } from "../types/commonResponseType";
import { cartItemCount } from "./guestCartUtils";
import type { CartSnapshot } from "../types/cartResponseType";
import type { GuestStorage } from "./guestCartStorage";

export interface CartControllerService {
  getCart: () => Promise<ApiResult<CartSnapshot>>;
  addCartItem: (input: AddCartItemRequest, signal?: AbortSignal) => Promise<ApiResult<CartSnapshot>>;
  createGuestCart: (signal?: AbortSignal) => Promise<ApiResult<{ guestToken: string; cart: CartSnapshot }>>;
  getGuestCart: (guestToken: string, signal?: AbortSignal) => Promise<ApiResult<CartSnapshot>>;
  addGuestCartItem: (guestToken: string, input: AddCartItemRequest, signal?: AbortSignal) => Promise<ApiResult<CartSnapshot>>;
  mergeGuestCart: (guestToken: string, mergeKey: string) => Promise<ApiResult<CartSnapshot>>;
}

export type CartIdentity = { status: string; userId: string | null; accessToken: string | null; sessionId?: number };
export interface CartState {
  owner: string | null;
  itemCount: number;
  loading: boolean;
  adding: boolean;
  error: string | null;
  mergeError: string | null;
}

export const identityOwner = (identity: CartIdentity): string | null =>
  identity.status === "authenticated" && identity.userId ? `user:${identity.userId}`
    : identity.status === "anonymous" ? "guest" : null;

const failure = (title: string, status = 0): ApiResult<never> => ({
  ok: false, error: { kind: status ? "http" : "network", status, title },
});

/** Owns sequencing outside React effects, including StrictMode's effect replay. */
export function createCartController(options: {
  storage: GuestStorage;
  guestEnabled: boolean;
  service: CartControllerService;
  randomId?: () => string;
  withLock?: <T>(action: () => Promise<T>) => Promise<T>;
}) {
  let identity: CartIdentity = { status: "initial", userId: null, accessToken: null };
  let generation = 0;
  let state: CartState = { owner: null, itemCount: 0, loading: false, adding: false, error: null, mergeError: null };
  const serverState = state;
  const subscribers = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  const service = options.service;
  const lock = options.withLock ?? (<T>(action: () => Promise<T>) => action());
  const randomId = options.randomId ?? (() => globalThis.crypto.randomUUID());
  const update = (patch: Partial<CartState>) => {
    state = { ...state, ...patch };
    subscribers.forEach((notify) => notify());
  };
  function enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = queue.then(() => lock(action));
    queue = result.catch(() => {});
    return result;
  }
  const current = (id: number) => generation === id;
  const showCart = (cart: CartSnapshot) => update({ itemCount: cartItemCount(cart) });

  async function load(id: number) {
    if (!current(id)) return;
    const owner = identityOwner(identity);
    if (!owner) return;
    update({ loading: true, error: null, mergeError: null });
    try {
      let guest;
      try {
        guest = options.storage.read();
      } catch {
        if (owner === "guest") throw new Error("Guest storage is unavailable");
        // A browser storage restriction must not disable a member's server
        // cart. We cannot inspect saved guest credentials in this case.
        update({ error: "Browser storage is unavailable. Saved guest items could not be checked." });
      }
      if (owner === "guest") {
        if (!options.guestEnabled || !guest) {
          update({ itemCount: 0 });
          return;
        }
        const result = await service.getGuestCart(guest.token);
        if (!current(id)) return;
        if (result.ok) showCart(result.data);
        else if (result.error.status === 404 || result.error.status === 410) {
          options.storage.clear(guest);
          update({ itemCount: 0 });
        } else update({ error: "Unable to load your cart. Please try again." });
        return;
      }

      if (guest) {
        const merged = await service.mergeGuestCart(guest.token, guest.mergeKey);
        if (!current(id)) return;
        if (merged.ok) {
          // Clear only after a valid success. Ambiguous failures retain the same
          // credential and idempotency key for an explicit retry.
          options.storage.clear(guest);
          showCart(merged.data);
          return;
        }
        update({ mergeError: "Your saved items could not be merged. Please try again." });
      }
      const result = await service.getCart();
      if (!current(id)) return;
      if (result.ok) showCart(result.data);
      else update({ error: "Unable to load your cart. Please try again." });
    } catch {
      if (current(id)) update({
        error: "Unable to load your cart. Please try again.",
        ...(owner !== "guest" ? { mergeError: "Your saved items could not be merged. Please try again." } : {}),
      });
    } finally {
      if (current(id)) update({ loading: false });
    }
  }

  function setIdentity(next: CartIdentity): void {
    if (identity.status === next.status && identity.userId === next.userId && identity.accessToken === next.accessToken && identity.sessionId === next.sessionId) return;
    if (identity.status === "authenticated" && next.status === "authenticated" && identity.userId === next.userId && identity.sessionId === next.sessionId) {
      // A renewed token belongs to the same cart. Keep the count and any
      // in-flight operation instead of reloading/merging on every rotation.
      identity = next;
      return;
    }
    identity = next;
    generation += 1;
    const id = generation;
    const owner = identityOwner(identity);
    update({ owner, itemCount: 0, loading: Boolean(owner), adding: false, error: null, mergeError: null });
    if (owner) void enqueue(() => load(id)).catch(() => {
      if (current(id)) update({ loading: false, error: "Unable to load your cart. Please try again.",
        ...(owner.startsWith("user:") ? { mergeError: "Unable to synchronize your saved cart. Please try again." } : {}),
      });
    });
  }

  function addItem(input: AddCartItemRequest, signal?: AbortSignal): Promise<ApiResult<CartSnapshot>> {
    const id = generation;
    const owner = identityOwner(identity);
    if (!owner || (owner === "guest" && !options.guestEnabled)) {
      return Promise.resolve(failure("Please sign in before adding items.", 401));
    }
    if (state.adding || state.loading) return Promise.resolve(failure("Please wait for your cart."));
    update({ adding: true, error: null });
    return enqueue(async () => {
      try {
        if (!current(id) || signal?.aborted) return failure("Your session changed. Please try again.");
        let result: ApiResult<CartSnapshot>;
        if (owner === "guest") {
          let guest = options.storage.read();
          if (!guest) {
            const created = await service.createGuestCart(signal);
            if (!created.ok) return created;
            if (!current(id) || signal?.aborted) return failure("Your session changed. Please try again.");
            guest = { token: created.data.guestToken, mergeKey: randomId() };
            // Fail before adding if persistence is unavailable: otherwise the
            // user's items would be lost when Keycloak navigates away.
            options.storage.write(guest);
          }
          result = await service.addGuestCartItem(guest.token, input, signal);
          if (!current(id) || signal?.aborted) return failure("Your session changed. Please try again.");
          if (!result.ok && (result.error.status === 404 || result.error.status === 410)) {
            options.storage.clear(guest);
            update({ itemCount: 0 });
          }
        } else {
          // Do not modify the member cart during an unresolved merge; a later
          // retry must apply guest quantities to the latest server cart.
          if (state.mergeError) return failure("Please retry merging your saved items first.");
          result = await service.addCartItem(input, signal);
        }
        if (!current(id) || signal?.aborted) return failure("Your session changed. Please try again.");
        if (result.ok) showCart(result.data);
        return result;
      } catch {
        return failure("Unable to save your cart. Check browser storage and try again.");
      } finally {
        if (current(id)) update({ adding: false });
      }
    }).catch(() => {
      if (current(id)) update({ adding: false });
      return failure("Unable to save your cart. Please try again.");
    });
  }

  function retryMerge(): Promise<void> {
    if (identityOwner(identity)?.startsWith("user:") !== true || state.loading || state.adding) return Promise.resolve();
    const id = generation;
    update({ loading: true });
    return enqueue(() => load(id)).catch(() => {
      if (current(id)) update({ loading: false, mergeError: "Your saved items could not be merged. Please try again." });
    });
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => serverState,
    subscribe: (notify: () => void) => { subscribers.add(notify); return () => { subscribers.delete(notify); }; },
    setIdentity, addItem, retryMerge,
  };
}
