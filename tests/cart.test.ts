import { test } from "node:test";
import assert from "node:assert/strict";
import { isApiError } from "../configs/api";
import { addCartItem, addGuestCartItem, createGuestCart, getCart, getGuestCart, mergeGuestCart } from "../service/cartService";
import { createCartController, type CartIdentity, type CartControllerService } from "../features/cartController";
import { cartItemCount, readCart, readGuestCart, type CartSnapshot } from "../features/cartSnapshotUtils";
import { createGuestStorage, GUEST_CART_STORAGE_KEY, type GuestSession } from "../features/guestCartStorage";
import type { ApiResult } from "../types/commonResponseType";

const guestSession: GuestSession = {
  token: "guest_cart_credential_1234567890",
  mergeKey: "26d81980-257e-4860-98f8-c0ebc97c0474",
};
const anonymous: CartIdentity = { status: "anonymous", userId: null, accessToken: null };
const member: CartIdentity = { status: "authenticated", userId: "buyer-1", accessToken: "memory-access-token" };
const initial: CartIdentity = { status: "initial", userId: null, accessToken: null };

function cart(quantity = 0, id = "cart-1"): CartSnapshot {
  return { id, status: "ACTIVE", items: quantity ? [{ id: "item-1", skuId: "sku-1", quantity }] : [] };
}

function ok<T>(data: T): ApiResult<T> { return { ok: true, data }; }
function failure(status: number): ApiResult<never> {
  return { ok: false, error: { kind: "http", status, title: "Request failed" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
  };
}

const fullCart = (quantity = 2) => ({
  ...cart(quantity), userId: "buyer-1", items: cart(quantity).items.map((item) => ({ ...item, productId: "product-1", unitPrice: 150000.5 })),
});
const asResult = async <T,>(action: () => Promise<T>): Promise<ApiResult<T>> => {
  try { return ok(await action()); }
  catch (error) { if (isApiError(error)) return { ok: false, error }; throw error; }
};

function httpFixture(respond: (path: string, method: string) => unknown = () => ({ code: 0, message: "success", data: fullCart() })) {
  const calls: Array<{ path: string; method: string; headers: Headers; body: unknown }> = [];
  const context = {
    baseUrl: "https://api.nexus.test",
    getAccessToken: () => member.accessToken,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      calls.push({
        path: url.pathname, method, headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify(respond(url.pathname, method)), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    },
  };
  const service: CartControllerService = {
    getCart: () => asResult(async () => readCart(await getCart({ context }))!),
    addCartItem: (input) => asResult(async () => readCart(await addCartItem(input, { context }))!),
    createGuestCart: () => asResult(() => createGuestCart({ context })),
    getGuestCart: (token) => asResult(() => getGuestCart(token, { context })),
    addGuestCartItem: (token, input) => asResult(() => addGuestCartItem(token, input, { context })),
    mergeGuestCart: (token, mergeKey) => asResult(async () => readCart(await mergeGuestCart(token, mergeKey, { context }))!),
  };
  return { calls, service };
}

function controllerFixture(options: {
  stored?: GuestSession;
  enabled?: boolean;
  service?: Partial<CartControllerService>;
  storage?: Storage;
} = {}) {
  const raw = options.storage ?? memoryStorage();
  const storage = createGuestStorage(() => raw);
  if (options.stored) storage.write(options.stored);
  const calls = { creates: 0, guestReads: 0, memberReads: 0, guestAdds: 0, memberAdds: 0, merges: [] as GuestSession[] };
  let guestQuantity = 0;
  const service: CartControllerService = {
    createGuestCart: async () => {
      calls.creates++;
      return ok({ guestToken: guestSession.token, cart: cart() });
    },
    getGuestCart: async () => { calls.guestReads++; return ok(cart(guestQuantity)); },
    getCart: async () => { calls.memberReads++; return ok(cart(4, "member-cart")); },
    addGuestCartItem: async (_token, input) => {
      calls.guestAdds++;
      guestQuantity += input.quantity;
      return ok(cart(guestQuantity));
    },
    addCartItem: async () => { calls.memberAdds++; return ok(cart(5, "member-cart")); },
    mergeGuestCart: async (token, mergeKey) => {
      calls.merges.push({ token, mergeKey });
      return ok(cart(7, "merged-cart"));
    },
    ...options.service,
  };
  const controller = createCartController({
    storage, service, guestEnabled: options.enabled ?? true, randomId: () => guestSession.mergeKey,
  });
  return { controller, storage, raw, calls };
}

test("guest requests carry only the guest credential while merge includes bearer and a stable idempotency key", async () => {
  const fixture = httpFixture((path, method) => path === "/api/v1/carts/guest" && method === "POST"
    ? { code: 0, message: "success", data: { guestToken: guestSession.token, cart: cart() } }
    : { code: 0, message: "success", data: fullCart(3) });

  const created = await fixture.service.createGuestCart();
  assert.equal(created.ok, true);
  await fixture.service.getGuestCart(guestSession.token);
  await fixture.service.addGuestCartItem(guestSession.token, { skuId: "sku-1", quantity: 3 });
  const merged = await fixture.service.mergeGuestCart(guestSession.token, guestSession.mergeKey);

  assert.deepEqual(fixture.calls.map(({ method, path, body }) => ({ method, path, body })), [
    { method: "POST", path: "/api/v1/carts/guest", body: {} },
    { method: "GET", path: "/api/v1/carts/guest", body: undefined },
    { method: "POST", path: "/api/v1/carts/guest/items", body: { skuId: "sku-1", quantity: 3 } },
    { method: "POST", path: "/api/v1/carts/me/merge", body: {} },
  ]);
  for (const call of fixture.calls.slice(0, 3)) assert.equal(call.headers.has("Authorization"), false);
  assert.equal(fixture.calls[0].headers.has("X-Guest-Token"), false);
  for (const call of fixture.calls.slice(1)) assert.equal(call.headers.get("X-Guest-Token"), guestSession.token);
  assert.equal(fixture.calls[3].headers.get("Authorization"), `Bearer ${member.accessToken}`);
  assert.equal(fixture.calls[3].headers.get("Idempotency-Key"), guestSession.mergeKey);
  assert.equal(merged.ok && cartItemCount(merged.data), 3);
});

test("cart counts accept the delivered BE envelope and older draft fields without retaining unrelated response data", async () => {
  const delivered = { code: 0, message: "response success", data: {
    id: "cart-1", userId: "buyer-1", status: "ACTIVE", guestToken: guestSession.token,
    items: [{ id: "item-1", productId: "product-1", skuId: "sku-1", quantity: 2, unitPrice: 150000.5 }],
  } };
  const draft = {
    ...delivered.data, subtotal: "300001.00", currency: "VND", updatedAt: "2026-11-03T08:00:00Z",
    items: [{ ...delivered.data.items[0], productName: "Example", unitPrice: "150000.50", lineTotal: "300001.00" }],
  };
  assert.deepEqual(readCart(delivered), cart(2));
  assert.deepEqual(readCart(draft), cart(2));
  const fixture = httpFixture(() => delivered);
  assert.deepEqual(await fixture.service.getCart(), ok(cart(2)));
  assert.equal(fixture.calls[0].headers.get("Authorization"), `Bearer ${member.accessToken}`);
});

test("malformed quantities and overflowing header totals are rejected", () => {
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "2", null, NaN]) {
    assert.equal(readCart({ ...cart(1), items: [{ ...cart(1).items[0], quantity }] }), null);
  }
  assert.equal(readCart({ ...cart(), items: [
    { id: "one", skuId: "sku-1", quantity: Number.MAX_SAFE_INTEGER },
    { id: "two", skuId: "sku-2", quantity: 1 },
  ] }), null);
  assert.equal(readCart({ ...cart(1), items: [{ id: "item-1", quantity: 1 }] }), null);
  assert.equal(readCart({ ...cart(), id: " " }), null);
  assert.equal(readCart({ ...cart(1), items: [{ ...cart(1).items[0], id: " " }] }), null);
  assert.equal(readCart({ ...cart(1), items: [{ ...cart(1).items[0], skuId: " " }] }), null);
  assert.equal(readCart({ ...cart(), status: "MERGED" }), null);
  assert.equal(readGuestCart({ guestToken: "short", cart: cart() }), null);
});

test("invalid add inputs never reach the transport and malformed success responses cannot set a count", async () => {
  const fixture = httpFixture(() => ({ data: { ...cart(1), items: [{ id: "item-1", skuId: "sku-1", quantity: "1" }] } }));
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await fixture.service.addGuestCartItem(guestSession.token, { skuId: "sku-1", quantity })).ok, false);
  }
  assert.equal((await fixture.service.addCartItem({ skuId: " ", quantity: 1 })).ok, false);
  assert.equal(fixture.calls.length, 0);
  const result = await fixture.service.getGuestCart(guestSession.token);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.kind, "invalid-response");
});

test("guest credentials survive a new storage instance and stale cleanup preserves a newer guest cart", () => {
  const raw = memoryStorage();
  createGuestStorage(() => raw).write(guestSession);
  const afterRedirect = createGuestStorage(() => raw);
  assert.deepEqual(afterRedirect.read(), guestSession);
  assert.deepEqual(JSON.parse(raw.getItem(GUEST_CART_STORAGE_KEY)!), guestSession);
  const newer = { token: "new_guest_credential_1234567890", mergeKey: "new_merge_key_1234567890" };
  afterRedirect.write(newer);
  afterRedirect.clear(guestSession);
  assert.deepEqual(afterRedirect.read(), newer);
  afterRedirect.clear(newer);
  assert.equal(afterRedirect.read(), null);
});

test("malformed persisted data is discarded instead of sent as a guest credential", () => {
  const raw = memoryStorage();
  const storage = createGuestStorage(() => raw);
  for (const value of ["{broken", "null", JSON.stringify({ token: "short", mergeKey: guestSession.mergeKey }),
    JSON.stringify({ token: guestSession.token, mergeKey: "bad\r\nheader" })]) {
    raw.setItem(GUEST_CART_STORAGE_KEY, value);
    assert.equal(storage.read(), null);
    assert.equal(raw.getItem(GUEST_CART_STORAGE_KEY), null);
  }
});

test("anonymous browsing creates no cart; repeated adds reuse one persisted guest cart and sum quantities", async () => {
  const { controller, storage, calls } = controllerFixture();
  controller.setIdentity(anonymous);
  controller.setIdentity({ ...anonymous });
  await flush();
  assert.equal(controller.getSnapshot().itemCount, 0);
  assert.equal(controller.getSnapshot().loading, false);
  assert.equal(calls.creates + calls.guestReads + calls.memberReads, 0);

  assert.equal((await controller.addItem({ skuId: "sku-1", quantity: 2 })).ok, true);
  assert.equal(controller.getSnapshot().itemCount, 2);
  assert.deepEqual(storage.read(), guestSession);
  assert.equal((await controller.addItem({ skuId: "sku-1", quantity: 3 })).ok, true);
  assert.equal(controller.getSnapshot().itemCount, 5);
  assert.equal(calls.creates, 1);
  assert.equal(calls.guestAdds, 2);
});

test("a returning anonymous browser loads the persisted cart without creating a replacement", async () => {
  let tokenSeen: string | undefined;
  const { controller, calls } = controllerFixture({ stored: guestSession, service: {
    getGuestCart: async (token) => { tokenSeen = token; return ok(cart(6)); },
  } });
  controller.setIdentity(anonymous);
  await flush();
  assert.equal(tokenSeen, guestSession.token);
  assert.equal(controller.getSnapshot().itemCount, 6);
  assert.equal(calls.creates, 0);
});

test("callback identity replay merges once, publishes the merged total and clears the guest credential", async () => {
  const { controller, storage, calls } = controllerFixture({ stored: guestSession });
  controller.setIdentity(member);
  controller.setIdentity({ ...member });
  await flush();
  assert.deepEqual(calls.merges, [guestSession]);
  assert.equal(calls.memberReads, 0);
  assert.equal(controller.getSnapshot().itemCount, 7);
  assert.equal(controller.getSnapshot().owner, "user:buyer-1");
  assert.equal(controller.getSnapshot().mergeError, null);
  assert.equal(storage.read(), null);
  controller.setIdentity({ ...member });
  await flush();
  assert.equal(calls.merges.length, 1);
});

test("reauthenticating the same account resets cart readiness and ignores the previous session merge", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  let merges = 0;
  const { controller, storage } = controllerFixture({ stored: guestSession, service: {
    mergeGuestCart: async () => ++merges === 1 ? pending.promise : ok(cart(8)),
  } });
  controller.setIdentity({ ...member, sessionId: 1 });
  await flush();
  controller.setIdentity({ ...member, sessionId: 2 });
  assert.equal(controller.getSnapshot().owner, "user:buyer-1:2");
  assert.equal(controller.getSnapshot().loading, true);
  assert.equal(controller.getSnapshot().itemCount, 0);
  pending.resolve(ok(cart(99)));
  await flush();
  assert.equal(merges, 2);
  assert.equal(controller.getSnapshot().itemCount, 8);
  assert.equal(storage.read(), null);
});

test("ambiguous merge failure retains the credential and key; explicit retry uses that key and clears only on success", async () => {
  const merges: GuestSession[] = [];
  const { controller, storage, calls } = controllerFixture({ stored: guestSession, service: {
    mergeGuestCart: async (token, mergeKey) => {
      merges.push({ token, mergeKey });
      return merges.length === 1 ? failure(503) : ok(cart(9, "merged-cart"));
    },
  } });
  controller.setIdentity(member);
  await flush();
  assert.deepEqual(storage.read(), guestSession);
  assert.equal(controller.getSnapshot().itemCount, 4);
  assert.ok(controller.getSnapshot().mergeError);
  assert.equal((await controller.addItem({ skuId: "sku-1", quantity: 1 })).ok, false);
  assert.equal(calls.memberAdds, 0);
  controller.setIdentity({ ...member });
  await flush();
  assert.equal(merges.length, 1);

  await Promise.all([controller.retryMerge(), controller.retryMerge()]);
  assert.deepEqual(merges, [guestSession, guestSession]);
  assert.equal(controller.getSnapshot().itemCount, 9);
  assert.equal(controller.getSnapshot().mergeError, null);
  assert.equal(storage.read(), null);
});

test("a late member merge after sign-out cannot publish the member total or delete the guest credential", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const { controller, storage } = controllerFixture({ stored: guestSession, service: {
    mergeGuestCart: async () => pending.promise,
    getGuestCart: async () => ok(cart(2)),
  } });
  const observations: ReturnType<typeof controller.getSnapshot>[] = [];
  controller.subscribe(() => { observations.push(controller.getSnapshot()); });
  controller.setIdentity(member);
  await flush();
  controller.setIdentity(anonymous);
  pending.resolve(ok(cart(99, "member-cart")));
  await flush();
  assert.equal(controller.getSnapshot().owner, "guest");
  assert.equal(controller.getSnapshot().itemCount, 2);
  assert.deepEqual(storage.read(), guestSession);
  assert.equal(observations.some((state) => state.owner === "guest" && state.itemCount === 99), false);
});

test("an obsolete guest read cannot remove persisted items or restore a count after identity changes", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const { controller, storage } = controllerFixture({ stored: guestSession, service: {
    getGuestCart: async () => pending.promise,
  } });
  controller.setIdentity(anonymous);
  await flush();
  controller.setIdentity(initial);
  pending.resolve(failure(404));
  await flush();
  assert.deepEqual(storage.read(), guestSession);
  assert.equal(controller.getSnapshot().owner, null);
  assert.equal(controller.getSnapshot().itemCount, 0);
});

test("an obsolete guest add failure cannot clear the credential after the active session changes", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const { controller, storage } = controllerFixture({ stored: guestSession, service: {
    addGuestCartItem: async () => pending.promise,
  } });
  controller.setIdentity(anonymous);
  await flush();
  const adding = controller.addItem({ skuId: "sku-1", quantity: 2 });
  await flush();
  controller.setIdentity(initial);
  pending.resolve(failure(404));
  assert.equal((await adding).ok, false);
  assert.deepEqual(storage.read(), guestSession);
  assert.equal(controller.getSnapshot().itemCount, 0);
});

test("an obsolete guest creation cannot persist credentials or add items after identity changes", async () => {
  const pending = deferred<ApiResult<{ guestToken: string; cart: CartSnapshot }>>();
  let creates = 0;
  const { controller, storage, calls } = controllerFixture({ service: {
    createGuestCart: async () => { creates++; return pending.promise; },
  } });
  controller.setIdentity(anonymous);
  await flush();
  const adding = controller.addItem({ skuId: "sku-1", quantity: 2 });
  await flush();
  assert.equal(creates, 1);
  controller.setIdentity(initial);
  pending.resolve(ok({ guestToken: guestSession.token, cart: cart() }));
  assert.equal((await adding).ok, false);
  assert.equal(storage.read(), null);
  assert.equal(calls.guestAdds, 0);
  assert.equal(controller.getSnapshot().itemCount, 0);
});

test("an expired guest cart on add clears both the saved credential and the old header count", async () => {
  for (const status of [404, 410]) {
    const { controller, storage } = controllerFixture({ stored: guestSession, service: {
      getGuestCart: async () => ok(cart(6)),
      addGuestCartItem: async () => failure(status),
    } });
    controller.setIdentity(anonymous);
    await flush();
    assert.equal(controller.getSnapshot().itemCount, 6);
    assert.equal((await controller.addItem({ skuId: "sku-1", quantity: 2 })).ok, false);
    assert.equal(storage.read(), null);
    assert.equal(controller.getSnapshot().itemCount, 0);
    assert.equal(controller.getSnapshot().adding, false);
  }
});

test("blocked browser storage warns a member but still loads and updates their server cart", async () => {
  const unavailable = memoryStorage();
  unavailable.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  const { controller, calls } = controllerFixture({ storage: unavailable });
  controller.setIdentity(member);
  await flush();
  assert.equal(calls.memberReads, 1);
  assert.equal(calls.merges.length, 0);
  assert.equal(controller.getSnapshot().itemCount, 4);
  assert.equal(controller.getSnapshot().loading, false);
  assert.ok(controller.getSnapshot().error);
  assert.equal(controller.getSnapshot().mergeError, null);

  assert.equal((await controller.addItem({ skuId: "sku-1", quantity: 1 })).ok, true);
  assert.equal(calls.memberAdds, 1);
  assert.equal(controller.getSnapshot().itemCount, 5);
});

test("disabled guest carts request sign-in and perform no creation or anonymous cart writes", async () => {
  const { controller, storage, calls } = controllerFixture({ enabled: false });
  controller.setIdentity(anonymous);
  await flush();
  const result = await controller.addItem({ skuId: "sku-1", quantity: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.status, 401);
  assert.equal(calls.creates + calls.guestAdds + calls.guestReads, 0);
  assert.equal(storage.read(), null);
  assert.equal(controller.getSnapshot().itemCount, 0);
});

test("disabling new guest carts still allows an existing saved cart to merge after sign-in", async () => {
  const { controller, storage, calls } = controllerFixture({ stored: guestSession, enabled: false });
  controller.setIdentity(member);
  await flush();
  assert.deepEqual(calls.merges, [guestSession]);
  assert.equal(controller.getSnapshot().itemCount, 7);
  assert.equal(storage.read(), null);
});

test("blocked browser storage prevents adding items that could be lost during the Keycloak redirect", async () => {
  const unavailable = memoryStorage();
  unavailable.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  const blocked = controllerFixture({ storage: unavailable });
  blocked.controller.setIdentity(anonymous);
  await flush();
  assert.equal(blocked.controller.getSnapshot().loading, false);
  assert.ok(blocked.controller.getSnapshot().error);
  assert.equal((await blocked.controller.addItem({ skuId: "sku-1", quantity: 2 })).ok, false);
  assert.equal(blocked.calls.creates + blocked.calls.guestAdds, 0);

  const full = memoryStorage();
  full.setItem = () => { throw new DOMException("Storage full", "QuotaExceededError"); };
  const noPersistence = controllerFixture({ storage: full });
  noPersistence.controller.setIdentity(anonymous);
  await flush();
  assert.equal((await noPersistence.controller.addItem({ skuId: "sku-1", quantity: 2 })).ok, false);
  assert.equal(noPersistence.calls.creates, 1);
  assert.equal(noPersistence.calls.guestAdds, 0);
  assert.equal(noPersistence.controller.getSnapshot().itemCount, 0);
  assert.equal(noPersistence.controller.getSnapshot().adding, false);
});

test("merge success does not remove a newer guest session written by another tab", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const { controller, storage } = controllerFixture({ stored: guestSession, service: {
    mergeGuestCart: async () => pending.promise,
  } });
  controller.setIdentity(member);
  await flush();
  const newer = { token: "new_guest_credential_1234567890", mergeKey: "new_merge_key_1234567890" };
  storage.write(newer);
  pending.resolve(ok(cart(7)));
  await flush();
  assert.deepEqual(storage.read(), newer);
  assert.equal(controller.getSnapshot().itemCount, 7);
});

test("same-user token renewal preserves the merged cart without resetting the badge or merging again", async () => {
  const { controller, storage, calls } = controllerFixture({ stored: guestSession });
  const identity = { ...member, sessionId: 1 };
  controller.setIdentity(identity);
  await flush();
  assert.equal(controller.getSnapshot().itemCount, 7);
  assert.equal(storage.read(), null);
  const changes: ReturnType<typeof controller.getSnapshot>[] = [];
  const unsubscribe = controller.subscribe(() => { changes.push(controller.getSnapshot()); });
  controller.setIdentity({ ...identity, accessToken: "renewed-memory-token" });
  await flush();
  unsubscribe();
  assert.equal(controller.getSnapshot().itemCount, 7);
  assert.equal(controller.getSnapshot().loading, false);
  assert.equal(controller.getSnapshot().owner, "user:buyer-1:1");
  assert.equal(calls.merges.length, 1);
  assert.equal(calls.memberReads, 0);
  assert.deepEqual(changes, []);
});

test("same-user token renewal keeps an in-flight member addition active and publishes its result", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const { controller, calls } = controllerFixture({ service: {
    addCartItem: async () => pending.promise,
  } });
  controller.setIdentity(member);
  await flush();
  assert.equal(controller.getSnapshot().itemCount, 4);
  const adding = controller.addItem({ skuId: "sku-1", quantity: 2 });
  await flush();
  assert.equal(controller.getSnapshot().adding, true);
  controller.setIdentity({ ...member, accessToken: "renewed-memory-token" });
  assert.equal(controller.getSnapshot().adding, true);
  assert.equal(controller.getSnapshot().itemCount, 4);
  pending.resolve(ok(cart(6, "member-cart")));
  assert.equal((await adding).ok, true);
  assert.equal(controller.getSnapshot().itemCount, 6);
  assert.equal(controller.getSnapshot().adding, false);
  assert.equal(calls.memberReads, 1);
  assert.equal(calls.merges.length, 0);
});

test("token rotation during guest merge preserves readiness, guest credentials and the single pending merge", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  let merges = 0;
  const { controller, storage } = controllerFixture({
    stored: guestSession,
    service: {
      mergeGuestCart: async () => { merges++; return pending.promise; },
    },
  });
  const identity = { ...member, sessionId: 1 };
  controller.setIdentity(identity);
  await flush();
  controller.setIdentity({ ...identity, accessToken: "renewed-memory-token" });
  assert.equal(controller.getSnapshot().loading, true);
  assert.equal(controller.getSnapshot().owner, "user:buyer-1:1");
  assert.deepEqual(storage.read(), guestSession);
  pending.resolve(ok(cart(7)));
  await flush();
  assert.equal(merges, 1);
  assert.equal(controller.getSnapshot().loading, false);
  assert.equal(controller.getSnapshot().itemCount, 7);
  assert.equal(storage.read(), null);
});


test("a new session for the same user invalidates pending cart work", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  let reads = 0;
  const { controller } = controllerFixture({ service: {
    addCartItem: async () => pending.promise,
    getCart: async () => ok(cart(++reads === 1 ? 4 : 2, "member-cart")),
  } });
  controller.setIdentity({ ...member, sessionId: 1 });
  await flush();
  const adding = controller.addItem({ skuId: "sku-1", quantity: 2 });
  await flush();
  controller.setIdentity({ ...member, accessToken: "new-sign-in", sessionId: 2 });
  pending.resolve(ok(cart(99, "old-session-cart")));
  assert.equal((await adding).ok, false);
  await flush();
  assert.equal(controller.getSnapshot().itemCount, 2);
  assert.equal(reads, 2);
});

test("aborting an addition suppresses a late response while retaining the active cart", async () => {
  const pending = deferred<ApiResult<CartSnapshot>>();
  const signal = new AbortController();
  let forwarded: AbortSignal | undefined;
  const { controller } = controllerFixture({ service: {
    addCartItem: async (_input, received) => { forwarded = received; return pending.promise; },
  } });
  controller.setIdentity(member);
  await flush();
  const adding = controller.addItem({ skuId: "sku-1", quantity: 2 }, signal.signal);
  await flush();
  signal.abort();
  pending.resolve(ok(cart(99)));
  assert.equal((await adding).ok, false);
  assert.equal(forwarded, signal.signal);
  assert.equal(controller.getSnapshot().itemCount, 4);
  assert.equal(controller.getSnapshot().adding, false);
});
