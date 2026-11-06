import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "../configs/queryKeys";
import { useCart } from "../features/useCart";
import { CartContext } from "../providers/CartProvider";
import { AuthContext } from "../providers/Provider";
import type { AuthContextValue } from "../types/authType";
import type { Cart } from "../types/cartResponseType";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function snapshot(quantity: number): Cart {
  return {
    id: "cart-1", userId: "buyer-1", status: "ACTIVE", currency: "VND", updatedAt: "2026-10-20T00:00:00Z",
    items: [{
      id: "item-1", skuId: "sku-1", productId: "product-1", productName: "Headphones",
      quantity, unitPrice: "100000.00", lineTotal: `${quantity * 100000}.00`,
    }],
    subtotal: `${quantity * 100000}.00`,
  };
}

function backendResponse(quantity: number) {
  return new Response(JSON.stringify({
    code: 0, message: "response success",
    data: {
      id: "cart-1", userId: "buyer-1", status: "ACTIVE",
      items: [{ id: "item-1", skuId: "sku-1", productId: "product-1", quantity, unitPrice: 100000 }],
    },
  }));
}

function mountCart(
  queryClient: QueryClient,
  transport: typeof globalThis.fetch,
  isSessionCurrent: (id: number) => boolean = (id) => id === 1,
) {
  const requestContext = {
    baseUrl: "http://cart-query.test", getAccessToken: () => "test-token", fetch: transport,
  };
  const auth: AuthContextValue = {
    requestContext, accessToken: "test-token", sessionId: 1, isSessionCurrent,
    status: "authenticated", error: null,
    user: {
      id: "buyer-1", email: "buyer@example.com", fullName: "Buyer", phone: "0900000000",
      roles: ["BUYER"], status: "ACTIVE", gender: null, address: null, dateOfBirth: null,
      createdAt: "2026-10-20T00:00:00Z",
    },
    renewAccessToken: async () => { throw new Error("Unexpected token renewal"); },
    signOut: () => { throw new Error("Unexpected sign out"); },
    signIn: async () => { throw new Error("Unexpected sign in"); },
    completeSignIn: async () => { throw new Error("Unexpected sign in callback"); },
    register: async () => { throw new Error("Unexpected registration"); },
    retryProfile: async () => { throw new Error("Unexpected profile request"); },
    updateProfile: async () => { throw new Error("Unexpected profile write"); },
  };
  if (!queryClient.getQueryData(queryKeys.cart.me(1))) queryClient.setQueryData(queryKeys.cart.me(1), snapshot(1));
  const cartContext = {
    ready: true, loading: false, adding: false, guestEnabled: false,
    itemCount: 1, error: null, mergeError: null,
    addItem: async () => { throw new Error("Unexpected addition"); },
    retryMerge: async () => { throw new Error("Unexpected merge"); },
  };
  let hook: ReturnType<typeof useCart> | undefined;
  function Probe() {
    hook = useCart();
    return null;
  }
  renderToString(createElement(QueryClientProvider, { client: queryClient },
    createElement(AuthContext.Provider, { value: auth },
      createElement(CartContext.Provider, { value: cartContext }, createElement(Probe)))));
  if (!hook) throw new Error("Cart hook did not render");
  return hook;
}

function editCart(cart: ReturnType<typeof useCart>, client: QueryClient, quantity: number): Promise<void> {
  const finished = new Promise<void>((resolve, reject) => {
    const unsubscribe = client.getMutationCache().subscribe(() => {
      const mutation = client.getMutationCache().getAll().at(-1);
      if (mutation?.state.status === "success") { unsubscribe(); resolve(); }
      if (mutation?.state.status === "error") { unsubscribe(); reject(mutation.state.error); }
    });
  });
  cart.updateQuantity("item-1", quantity);
  return finished;
}

test("a GET started during a cart write cannot overwrite the confirmed snapshot", { timeout: 5000 }, async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const putStarted = deferred<void>();
  const getStarted = deferred<void>();
  const putResponse = deferred<Response>();
  const getResponse = deferred<Response>();
  let getSignal: AbortSignal | null | undefined;
  let reads = 0;
  const transport: typeof globalThis.fetch = async (_, init) => {
    if (init?.method === "PUT") {
      putStarted.resolve();
      return putResponse.promise;
    }
    assert.equal(init?.method, "GET");
    if (++reads > 1) return backendResponse(2);
    getSignal = init.signal;
    getStarted.resolve();
    // Deliberately ignore cancellation to model a server finishing an old read.
    return getResponse.promise;
  };
  const cart = mountCart(queryClient, transport);
  const key = queryKeys.cart.me(1);
  queryClient.setQueryData(key, snapshot(1));

  try {
    const write = editCart(cart, queryClient, 2);
    await putStarted.promise;
    const concurrentRead = cart.cart.refetch();
    await getStarted.promise;
    putResponse.resolve(backendResponse(2));
    await write;
    assert.equal(getSignal?.aborted, true, "write completion must cancel a read started while PUT was pending");
    getResponse.resolve(backendResponse(1));
    await concurrentRead;
    assert.equal(queryClient.getQueryData<Cart>(key)?.items[0].quantity, 2);
    assert.equal(queryClient.getQueryData<Cart>(key)?.subtotal, "200000.00");
  } finally {
    putResponse.resolve(backendResponse(2));
    getResponse.resolve(backendResponse(1));
    queryClient.clear();
  }
});

test("rejected optimistic edit restores exact totals and stays pending until reconciliation", { timeout: 5000 }, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const putStarted = deferred<void>();
  const getStarted = deferred<void>();
  const putResponse = deferred<Response>();
  const getResponse = deferred<Response>();
  const transport: typeof globalThis.fetch = async (_, init) => {
    if (init?.method === "PUT") {
      putStarted.resolve();
      return putResponse.promise;
    }
    assert.equal(init?.method, "GET");
    getStarted.resolve();
    return getResponse.promise;
  };
  const cart = mountCart(client, transport);
  const key = queryKeys.cart.me(1);
  client.setQueryData(key, snapshot(1));
  let finished = false;
  try {
    const write = editCart(cart, client, 3);
    const rejection = assert.rejects(write, { status: 400 });
    void write.then(() => { finished = true; }, () => { finished = true; });
    await putStarted.promise;
    assert.equal(client.getQueryData<Cart>(key)?.items[0].quantity, 3);
    assert.equal(client.getQueryData<Cart>(key)?.items[0].lineTotal, "300000.00");
    assert.equal(client.getQueryData<Cart>(key)?.subtotal, "300000.00");
    putResponse.resolve(new Response(JSON.stringify({
      title: "Quantity rejected", status: 400, detail: "Quantity refused", code: "INVALID_QUANTITY",
    }), { status: 400 }));
    await getStarted.promise;
    assert.equal(client.getQueryData<Cart>(key)?.subtotal, "100000.00");
    assert.equal(finished, false, "mutation lock must cover the authoritative GET");
    getResponse.resolve(backendResponse(1));
    await rejection;
    assert.equal(client.getQueryData<Cart>(key)?.items[0].quantity, 1);
  } finally {
    putResponse.resolve(backendResponse(3));
    getResponse.resolve(backendResponse(1));
    client.clear();
  }
});

test("a late old-session edit cannot restore private data or start a new read", { timeout: 5000 }, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const started = deferred<void>();
  const response = deferred<Response>();
  let current = true;
  let reads = 0;
  const cart = mountCart(client, async (_, init) => {
    if (init?.method === "PUT") { started.resolve(); return response.promise; }
    reads++;
    return backendResponse(1);
  }, () => current);
  const key = queryKeys.cart.me(1);
  client.setQueryData(key, snapshot(1));
  try {
    const write = editCart(cart, client, 3);
    const rejection = assert.rejects(write, { kind: "aborted" });
    await started.promise;
    current = false;
    client.removeQueries({ queryKey: key, exact: true });
    response.resolve(backendResponse(3));
    await rejection;
    assert.equal(client.getQueryData(key), undefined);
    assert.equal(reads, 0);
  } finally {
    response.resolve(backendResponse(3));
    client.clear();
  }
});
