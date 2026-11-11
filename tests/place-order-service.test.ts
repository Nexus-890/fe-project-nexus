import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { AxiosHeaders } from "axios";
import { isApiError } from "../configs/api";
import {
  parseCheckoutConflict,
  parseCheckoutOrderGroup,
  placeOrder,
} from "../service/checkoutService";
import type { CheckoutDestination } from "../types/checkoutType";
import type { components } from "../types/commerceGeneratedType";

const destination: CheckoutDestination = {
  recipientName: " Buyer Name ", phoneNumber: "0901234567",
  addressLine: "12 Nguyen Trai", provinceCode: "202", districtCode: "1442",
  wardCode: "20308", city: "Ho Chi Minh City", district: "District 4",
  ward: "Ward 4", countryCode: "VN",
};
const key = "c8000000-0000-4000-8000-000000000007";
const item: components["schemas"]["OrderItem"] = {
  orderItemId: "line-1", productId: "product-1", skuId: "sku-1",
  productName: "Canvas backpack", skuCode: "BAG-BLUE", imageUrl: null,
  quantity: 2, unitPrice: 150000, totalPrice: 300000,
};
const order: components["schemas"]["Order"] = {
  orderId: "order-1", orderNumber: "NX001", userId: "buyer-1", sellerId: "seller-1",
  orderType: "STANDARD", status: "PENDING", createdAt: "2026-11-04T10:00:00Z",
  totalAmount: 300000, items: [item],
  orderGroupId: "c8000000-0000-4000-8000-000000000006",
  subtotal: 300000, shippingFee: 0, discountAmount: 0, taxAmount: 0,
};
const group: components["schemas"]["OrderGroup"] = {
  orderGroupId: "c8000000-0000-4000-8000-000000000006", status: "PENDING",
  totalAmount: 450000, currency: "VND", dueAt: "2026-11-04T10:15:00Z",
  orders: [order, {
    ...order, orderId: "order-2", sellerId: "seller-2", totalAmount: 150000, subtotal: 150000,
    items: [{ ...item, orderItemId: "line-2", quantity: 1, totalPrice: 150000 }],
  }],
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

test("order creation and replay send the supplied key and current auth over HTTP and parse one multi-shop group", async () => {
  const requests: Array<{ url?: string; method?: string; key?: string; auth?: string; body: string; client?: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      url: request.url, method: request.method,
      key: request.headers["idempotency-key"] as string,
      auth: request.headers.authorization,
      client: request.headers["x-client"] as string,
      body: Buffer.concat(chunks).toString(),
    });
    response.writeHead(requests.length === 1 ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(group)));
  });
  let token = "first";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const config = { headers: new AxiosHeaders({ "Idempotency-Key": "wrong", "X-Client": "checkout" }) };
    const created = await placeOrder(destination, key, { context, config, auth: false, params: { ignored: true } });
    token = "second";
    const replayed = await placeOrder(destination, key, { context, config });
    assert.deepEqual(replayed, created);
    assert.equal(created.orderGroupId, group.orderGroupId);
    assert.equal(created.totalAmount, "450000.00");
    assert.equal(created.orders.length, 2);
    assert.equal(created.orders[0].items[0].unitPrice, "150000.00");
    assert.deepEqual(requests.map(({ key: sentKey, auth, url, method, client }) => ({ key: sentKey, auth, url, method, client })), [
      { key, auth: "Bearer first", url: "/api/v1/orders", method: "POST", client: "checkout" },
      { key, auth: "Bearer second", url: "/api/v1/orders", method: "POST", client: "checkout" },
    ]);
    assert.deepEqual(JSON.parse(requests[0].body), {
      paymentMethod: "SEPAY",
      shippingAddress: {
        recipientName: "Buyer Name", phoneNumber: destination.phoneNumber,
        addressLine: destination.addressLine, provinceCode: destination.provinceCode,
        wardCode: destination.wardCode, countryCode: "VN",
      },
    });
    assert.equal(config.headers.get("Idempotency-Key"), "wrong");
  } finally {
    await close(server);
  }
});

test("HTTP Problem Details preserve numeric price extensions and named stock feedback for explicit confirmation", async () => {
  let problem: Record<string, unknown> = {
    code: "COMMERCE_PRICE_CHANGED", skuId: "sku-1", oldPrice: 150000, newPrice: 180000,
  };
  const server = createServer((request, response) => {
    response.writeHead(409, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({
      type: "urn:problem:domain-error", title: "Conflict", status: 200,
      detail: "Review this item before continuing", instance: request.url,
      ...problem,
    }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    await assert.rejects(placeOrder(destination, key, { context }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.status, 409);
      assert.equal(error.detail, "Review this item before continuing");
      assert.deepEqual(error.extensions, { skuId: "sku-1", oldPrice: 150000, newPrice: 180000 });
      assert.deepEqual(parseCheckoutConflict(error), {
        kind: "price-changed", skuId: "sku-1", oldPrice: "150000.00", newPrice: "180000.00",
        detail: "Review this item before continuing",
      });
      return true;
    });
    problem = { code: "COMMERCE_INSUFFICIENT_STOCK", skuId: "sku-1", productName: "Canvas backpack" };
    await assert.rejects(placeOrder(destination, key, { context }), (error: unknown) => {
      assert.deepEqual(parseCheckoutConflict(error), {
        kind: "insufficient-stock", skuId: "sku-1", productName: "Canvas backpack",
        detail: "Review this item before continuing",
      });
      return true;
    });
  } finally {
    await close(server);
  }
});

test("conflict parser rejects malformed prices and wrong HTTP statuses without inventing confirmation data", () => {
  const error = {
    kind: "http", status: 409, title: "Conflict", code: "COMMERCE_PRICE_CHANGED",
    extensions: { skuId: "sku-1", oldPrice: 150000, newPrice: 180000 },
  };
  for (const invalidPrice of ["180000", -1, Infinity, NaN, 0.001, Number.MAX_SAFE_INTEGER, null]) {
    assert.equal(parseCheckoutConflict({ ...error, extensions: { ...error.extensions, newPrice: invalidPrice } }), null);
  }
  for (const invalid of [
    null, { ...error, status: 503 }, { ...error, kind: "network" },
    { ...error, extensions: {} }, { ...error, code: "COMMERCE_UNKNOWN" },
  ]) assert.equal(parseCheckoutConflict(invalid), null);
  assert.deepEqual(parseCheckoutConflict({
    ...error, code: "COMMERCE_INSUFFICIENT_STOCK", detail: "Stock exhausted",
    extensions: { skuId: 123, productName: { unsafe: true } },
  }), { kind: "insufficient-stock", skuId: undefined, productName: undefined, detail: "Stock exhausted" });
});

test("order group parser rejects malformed resources and unsafe numeric amounts", () => {
  for (const invalid of [
    null, { ...group, orderGroupId: " " }, { ...group, dueAt: "invalid date" },
    { ...group, dueAt: "2026-11-04" },
    { ...group, orders: [] }, { ...group, totalAmount: "450000" },
    { ...group, totalAmount: Number.MAX_SAFE_INTEGER }, { ...group, totalAmount: 1 },
    { ...group, orders: [order, order] },
    { ...group, orders: [{ ...order, items: [{ ...item, quantity: 0 }] }] },
    { ...group, orders: [{ ...order, items: [{ ...item, unitPrice: 0.001 }] }] },
    { ...group, orders: [{ ...order, items: [{ ...item, imageUrl: undefined }] }] },
  ]) assert.throws(() => parseCheckoutOrderGroup(invalid), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("invalid keys and incomplete shipping data fail before transport", async () => {
  let calls = 0;
  const context = { fetch: async () => { calls++; return new Response(); } };
  for (const invalidKey of ["", "key-1", `${key}\n`, `${key}\r\nInjected: yes`])
    await assert.rejects(placeOrder(destination, invalidKey, { context }));
  await assert.rejects(placeOrder({ ...destination, ward: " " }, key, { context }));
  assert.equal(calls, 0);
});

test("in-flight order cancellation stays AbortError and timeout leaves an explicit retryable network failure", async () => {
  let started: () => void = () => {};
  let requests = 0;
  const server = createServer(() => { requests++; started(); });
  const context = { baseUrl: await listen(server) };
  try {
    const requestStarted = new Promise<void>((resolve) => { started = resolve; });
    const controller = new AbortController();
    const pending = placeOrder(destination, key, { context, signal: controller.signal });
    await requestStarted;
    controller.abort();
    await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
    await assert.rejects(placeOrder(destination, key, { context, config: { timeout: 50 } }), (error: unknown) => isApiError(error) && error.kind === "network");
    assert.equal(requests, 2);
  } finally {
    await close(server);
  }
});
