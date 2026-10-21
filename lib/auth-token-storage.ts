export const ACCESS_TOKEN_STORAGE_KEY = "nexus.accessToken";

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): TokenStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readAccessToken(storage: TokenStorage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function storeAccessToken(value: string, storage: TokenStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

export function removeAccessToken(storage: TokenStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
