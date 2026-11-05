import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import {
  addCartItem,
  CART_API_BASE_URL,
  getCart,
  parseCart,
  removeCartItem,
  updateCartItem,
} from "../service/cartService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";

const cart = {
  id: "cart-1", userId: "buyer-1", status: "ACTIVE",
  items: [{ id: "line-1", productId: "product-1", skuId: "sku-1", quantity: 2, unitPrice: 150000 }],
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
};

test("cart services serialize GET/POST/pending PUT/DELETE through native HTTP with current auth", async () => {
  const seen: Array<{ method?: string; url?: string; body: string; auth?: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    seen.push({ method: request.method, url: request.url, body, auth: request.headers.authorization });
    if (request.method === "DELETE") {
      response.writeHead(204).end();
      return;
    }
    const quantity = request.method === "PUT" ? JSON.parse(body).quantity : 2;
    response.writeHead(request.method === "POST" ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({ ...cart, items: [{ ...cart.items[0], quantity }] })));
  });
  let token = "first";
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const read = await getCart({ context, auth: false });
    assert.equal(read.id, "cart-1");
    assert.equal(read.items[0].unitPrice, "150000.00");
    token = "second";
    await addCartItem({ skuId: "sku-1", quantity: 2 }, { context });
    const updated = await updateCartItem({ itemId: "line /?#", quantity: 3 }, { context });
    assert.equal(updated.items[0].quantity, 3);
    assert.equal(updated.items[0].unitPrice, "150000.00");
    assert.equal(await removeCartItem("line /?#", { context }), undefined);
    assert.deepEqual(seen, [
      { method: "GET", url: "/api/v1/carts/me", body: "", auth: "Bearer first" },
      { method: "POST", url: "/api/v1/carts/me/items", body: '{"skuId":"sku-1","quantity":2}', auth: "Bearer second" },
      { method: "PUT", url: "/api/v1/carts/me/items/line%20%2F%3F%23", body: '{"quantity":3}', auth: "Bearer second" },
      { method: "DELETE", url: "/api/v1/carts/me/items/line%20%2F%3F%23", body: "", auth: "Bearer second" },
    ]);
  } finally {
    await close(server);
  }
});

test("cart services preserve real HTTP rejection status and reason without inventing a cart", async () => {
  let status = 400;
  const server = createServer((request, response) => {
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Cart rejected", status, code: `CART_${status}`, detail: "Quantity refused", instance: request.url }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (status of [400, 404, 503]) {
      for (const call of [
        () => getCart({ context }),
        () => updateCartItem({ itemId: "line-1", quantity: 3 }, { context }),
        () => removeCartItem("line-1", { context }),
      ]) {
        await assert.rejects(call, (error: unknown) => {
          assert.ok(isApiError(error));
          assert.equal(error.kind, "http");
          assert.equal(error.status, status);
          assert.equal(error.code, `CART_${status}`);
          assert.equal(error.detail, "Quantity refused");
          return true;
        });
      }
    }
  } finally {
    await close(server);
  }
});

test("Cart origin stays blank and explicit request context, token and cancellation survive", async () => {
  assert.equal(CART_API_BASE_URL, "");
  let path = "";
  const context: ApiContext = {
    getAccessToken: () => "current",
    fetch: async (input, init) => {
      path = String(input);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current");
      return new Response(JSON.stringify(envelope(cart)));
    },
  };
  await getCart({ context });
  assert.equal(path, "/api/v1/carts/me");
  const controller = new AbortController();
  let started: () => void = () => {};
  const pendingFetch = new Promise<void>((resolve) => { started = resolve; });
  let observedAbort = false;
  const pending = getCart({
    context: {
      ...context,
      fetch: async (_, init) => new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          observedAbort = true;
          reject(new DOMException("Canceled", "AbortError"));
        }, { once: true });
        started();
      }),
    },
    signal: controller.signal,
  });
  await pendingFetch;
  controller.abort();
  await assert.rejects(pending,
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(observedAbort, true);
  await assert.rejects(
    updateCartItem({ itemId: "line-1", quantity: 3 }, { context, signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("invalid cart mutation inputs reject before any HTTP request", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls++; return new Response(); } };
  for (const quantity of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(updateCartItem({ itemId: "line-1", quantity }, { context }));
    await assert.rejects(addCartItem({ skuId: "sku-1", quantity }, { context }));
  }
  for (const id of ["", "   "]) {
    await assert.rejects(updateCartItem({ itemId: id, quantity: 1 }, { context }));
    await assert.rejects(removeCartItem(id, { context }));
  }
  assert.equal(calls, 0);
});

test("cart parsing accepts an empty persisted cart and rejects malformed data/envelopes", async () => {
  assert.deepEqual(parseCart({ ...cart, items: [] }).items, []);
  assert.equal(parseCart({ ...cart, items: [{ ...cart.items[0], unitPrice: 0.1 }] }).items[0].unitPrice, "0.10");
  for (const value of [
    null,
    { ...cart, id: " " },
    { ...cart, status: "CHECKED_OUT" },
    { ...cart, items: [{ ...cart.items[0], quantity: 0 }] },
    { ...cart, items: [{ ...cart.items[0], quantity: Number.MAX_SAFE_INTEGER }, cart.items[0]] },
    { ...cart, items: [{ ...cart.items[0], unitPrice: -1 }] },
    { ...cart, items: [{ ...cart.items[0], unitPrice: "0.001" }] },
  ]) assert.throws(() => parseCart(value));
  for (const value of [cart, envelope(null), envelope({ ...cart, items: null })])
    await assert.rejects(
      getCart({ context: { fetch: async () => new Response(JSON.stringify(value)) } }),
      (error: unknown) => isApiError(error) && error.kind === "invalid-response",
    );
});
