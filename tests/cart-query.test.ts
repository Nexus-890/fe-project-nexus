import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "../configs/query-keys";
import { useCart } from "../hooks/cart/useCart";
import { createApiClient } from "../lib/api-client";
import { AuthContext } from "../providers/AuthProvider";
import { createAuthApi } from "../service/auth";
import type { AuthContextValue } from "../types/auth/type";
import type { Cart } from "../types/cart/response/type";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function snapshot(quantity: number): Cart {
  return {
    id: "cart-1", status: "ACTIVE", currency: "VND", updatedAt: "2026-10-20T00:00:00Z",
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

function mountCart(queryClient: QueryClient, transport: typeof globalThis.fetch) {
  const api = createAuthApi(createApiClient({
    baseUrl: "http://cart-query.test", getAccessToken: () => "test-token", fetch: transport,
  }));
  const auth: AuthContextValue = {
    api, accessToken: "test-token", sessionId: 1, isCurrentSession: (id) => id === 1,
    status: "authenticated", error: null,
    user: {
      id: "buyer-1", email: "buyer@example.com", fullName: "Buyer", phone: "0900000000",
      roles: ["BUYER"], status: "ACTIVE", gender: null, address: null, dateOfBirth: null,
      createdAt: "2026-10-20T00:00:00Z",
    },
    signOut: () => { throw new Error("Unexpected sign out"); },
    signIn: async () => { throw new Error("Unexpected sign in"); },
    register: async () => { throw new Error("Unexpected registration"); },
    retryProfile: async () => { throw new Error("Unexpected profile request"); },
    updateProfile: async () => { throw new Error("Unexpected profile write"); },
  };
  let hook: ReturnType<typeof useCart> | undefined;
  function Probe() {
    hook = useCart();
    return null;
  }
  renderToString(createElement(QueryClientProvider, { client: queryClient },
    createElement(AuthContext.Provider, { value: auth }, createElement(Probe))));
  if (!hook) throw new Error("Cart hook did not render");
  return hook;
}

test("a GET started during a cart write cannot overwrite the confirmed snapshot", { timeout: 5000 }, async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const postStarted = deferred<void>();
  const getStarted = deferred<void>();
  const postResponse = deferred<Response>();
  const getResponse = deferred<Response>();
  let getSignal: AbortSignal | null | undefined;
  const transport: typeof globalThis.fetch = async (_, init) => {
    if (init?.method === "POST") {
      postStarted.resolve();
      return postResponse.promise;
    }
    assert.equal(init?.method, "GET");
    getSignal = init.signal;
    getStarted.resolve();
    // Deliberately ignore cancellation to model a server finishing an old read.
    return getResponse.promise;
  };
  const cart = mountCart(queryClient, transport);
  const key = queryKeys.cart.me(1);
  queryClient.setQueryData(key, snapshot(1));

  try {
    const write = cart.addItem.mutateAsync({ skuId: "sku-1", quantity: 1 });
    await postStarted.promise;
    const concurrentRead = cart.refetch();
    await getStarted.promise;
    postResponse.resolve(backendResponse(2));
    await write;
    assert.equal(getSignal?.aborted, true, "write completion must cancel a read started while POST was pending");
    getResponse.resolve(backendResponse(1));
    await concurrentRead;
    assert.equal(queryClient.getQueryData<Cart>(key)?.items[0].quantity, 2);
    assert.equal(queryClient.getQueryData<Cart>(key)?.subtotal, "200000.00");
  } finally {
    postResponse.resolve(backendResponse(2));
    getResponse.resolve(backendResponse(1));
    queryClient.clear();
  }
});
