import assert from "node:assert/strict";
import test from "node:test";
import { ACCESS_TOKEN_STORAGE_KEY, readAccessToken, removeAccessToken, storeAccessToken } from "../lib/auth-token-storage";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("token persistence supports a new session and removes only its own key", () => {
  const storage = memoryStorage();
  storage.setItem("shop.preference", "keep");
  assert.equal(readAccessToken(storage), null);
  assert.equal(storeAccessToken("test-access-token", storage), true);
  assert.equal(readAccessToken(storage), "test-access-token");
  assert.deepEqual([...storage.values.keys()].sort(), [ACCESS_TOKEN_STORAGE_KEY, "shop.preference"].sort());
  assert.equal(removeAccessToken(storage), true);
  assert.equal(readAccessToken(storage), null);
  assert.equal(storage.getItem("shop.preference"), "keep");
});

test("empty saved values do not restore an authenticated session", () => {
  const storage = memoryStorage();
  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, "  ");
  assert.equal(readAccessToken(storage), null);
});

test("storage access failures do not prevent in-memory authentication or sign-out", () => {
  const denied = {
    getItem: () => { throw new DOMException("Storage denied", "SecurityError"); },
    setItem: () => { throw new DOMException("Storage full", "QuotaExceededError"); },
    removeItem: () => { throw new DOMException("Storage denied", "SecurityError"); },
  };
  assert.equal(readAccessToken(denied), null);
  assert.equal(storeAccessToken("test-access-token", denied), false);
  assert.equal(removeAccessToken(denied), false);
});

test("server rendering does not access browser storage", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(readAccessToken(), null);
  assert.equal(storeAccessToken("test-access-token"), false);
  assert.equal(removeAccessToken(), false);
});
