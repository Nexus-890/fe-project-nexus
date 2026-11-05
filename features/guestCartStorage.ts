import { isGuestToken } from "./cartSnapshotUtils";

export const GUEST_CART_STORAGE_KEY = "nexus.cart.guest";

export interface GuestSession {
  token: string;
  mergeKey: string;
}

/** The guest credential must survive a full-page OIDC redirect. No auth tokens go here. */
export function createGuestStorage(getStorage: () => Storage) {
  function read(): GuestSession | null {
    const storage = getStorage();
    const raw = storage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return null;
    try {
      const value: unknown = JSON.parse(raw);
      if (value && typeof value === "object" && "token" in value && "mergeKey" in value
        && isGuestToken(value.token) && typeof value.mergeKey === "string"
        && /^[A-Za-z0-9_-]{16,128}$/.test(value.mergeKey)) {
        return { token: value.token, mergeKey: value.mergeKey };
      }
    } catch { /* Invalid data is not a usable guest session. */ }
    storage.removeItem(GUEST_CART_STORAGE_KEY);
    return null;
  }

  function write(session: GuestSession): void {
    getStorage().setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(session));
  }

  function clear(session: GuestSession): void {
    // A stale response must not remove a newer cart created in another tab.
    const current = read();
    if (current?.token === session.token && current.mergeKey === session.mergeKey) {
      getStorage().removeItem(GUEST_CART_STORAGE_KEY);
    }
  }

  return { read, write, clear };
}

export type GuestStorage = ReturnType<typeof createGuestStorage>;
