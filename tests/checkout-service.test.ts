import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import {
  getCheckoutPreview,
  getProvinces,
  getWards,
} from "../service/checkoutService";
import type { CheckoutDestination } from "../types/checkoutType";

const destination: CheckoutDestination = {
  recipientName: "Buyer Name",
  phoneNumber: "0901234567",
  addressLine: "12 Nguyen Trai",
  provinceCode: "202",
  wardCode: "20308",
  city: "Ho Chi Minh City",
  ward: "Ward 4",
  countryCode: "VN",
};
const item = {
  itemId: "line-1", productId: "product-1", skuId: "sku-1",
  quantity: 2, unitPrice: 125000.25, lineTotal: 250000.5,
};
const preview = {
  items: [item, { ...item, itemId: "line-2", skuId: "sku-2", quantity: 1, unitPrice: 50000, lineTotal: 50000 }],
  subtotal: 300000.5, shippingFee: 30000, taxAmount: 0, discountAmount: 0,
  total: 330000.5, issues: [],
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listEnvelope = (data: unknown) => ({
  ...envelope(data),
  page: { number: 0, size: 1, totalElements: 1, totalPages: 1 },
});
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
const invalidResponse = (error: unknown): boolean =>
  isApiError(error) && error.kind === "invalid-response";

test("checkout services send locality filters/current auth and the #188 preview body over native HTTP", async () => {
  const seen: Array<{ method?: string; url?: string; body: string; auth?: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({ method: request.method, url: request.url, body: Buffer.concat(chunks).toString(), auth: request.headers.authorization });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(request.method === "POST"
      ? envelope(preview)
      : listEnvelope([{ code: "001", name: "A locality" }])));
  });
  let token = "first-session";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await getProvinces({ context, auth: false, params: { ignored: true } }), [{ code: "001", name: "A locality" }]);
    token = "second-session";
    await getWards("202 /?#", { context, params: { provinceCode: "wrong" } });
    const result = await getCheckoutPreview(destination, { context, auth: false });
    assert.equal(result.items[0].unitPrice, "125000.25");
    assert.equal(result.items[0].lineTotal, "250000.50");
    assert.equal(result.subtotal, "300000.50");
    assert.equal(result.shippingFee, "30000.00");
    assert.equal(result.total, "330000.50");
    assert.deepEqual(seen.slice(0, 2), [
      { method: "GET", url: "/api/v1/shipping/provinces", body: "", auth: "Bearer first-session" },
      { method: "GET", url: "/api/v1/shipping/wards?provinceCode=202+%2F%3F%23", body: "", auth: "Bearer second-session" },
    ]);
    assert.equal(seen[2].method, "POST");
    assert.equal(seen[2].url, "/api/v1/checkout/preview");
    assert.equal(seen[2].auth, "Bearer second-session");
    assert.deepEqual(JSON.parse(seen[2].body), {
      shippingAddress: {
        recipientName: destination.recipientName,
        phoneNumber: destination.phoneNumber,
        addressLine: destination.addressLine,
        provinceCode: destination.provinceCode,
        wardCode: destination.wardCode,
        countryCode: "VN",
      },
      paymentMethod: "SEPAY",
    });
  } finally {
    await close(server);
  }
});

test("preview preserves unavailable shipping and draft item issues instead of treating null as zero", async () => {
  const issue = { itemId: "line-1", skuId: "sku-1", code: "PRICE_CHANGED" };
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({ ...preview, shippingFee: null, total: preview.subtotal, issues: [issue] })));
  });
  const context = { baseUrl: await listen(server) };
  try {
    const result = await getCheckoutPreview(destination, { context });
    assert.equal(result.shippingFee, null);
    assert.equal(result.total, "300000.50");
    assert.deepEqual(result.issues, [issue]);
  } finally {
    await close(server);
  }
});

test("checkout preserves Problem Details field errors and HTTP status through native HTTP", async () => {
  let status = 400;
  const server = createServer((request, response) => {
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({
      title: "Checkout unavailable", status: 200, code: "VALIDATION_FAILED",
      detail: "Please correct the shipping address", instance: request.url,
      errors: [{ field: "shippingAddress.phoneNumber", code: "VALIDATION_SIZE", detail: "Phone is invalid" }],
    }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (status of [400, 401, 403, 503]) {
      await assert.rejects(getCheckoutPreview(destination, { context }), (error: unknown) => {
        assert.ok(isApiError(error));
        assert.equal(error.kind, "http");
        assert.equal(error.status, status);
        assert.equal(error.code, "VALIDATION_FAILED");
        assert.equal(error.detail, "Please correct the shipping address");
        assert.deepEqual(error.fieldErrors, { "shippingAddress.phoneNumber": ["Phone is invalid"] });
        return true;
      });
    }
  } finally {
    await close(server);
  }
});

test("locality lists reject malformed envelopes, missing pages, ambiguous codes and invalid entries", async () => {
  let body: unknown = listEnvelope([]);
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const context = { baseUrl: await listen(server) };
  try {
    assert.deepEqual(await getProvinces({ context }), []);
    for (body of [
      [{ code: "001", name: "Province" }],
      envelope([{ code: "001", name: "Province" }]),
      { ...listEnvelope([]), page: { number: -1, size: 1, totalElements: 0, totalPages: 0 } },
      listEnvelope([{ code: 202, name: "Province" }]),
      listEnvelope([{ code: " ", name: "Province" }]),
      listEnvelope([{ code: "001", name: "" }]),
      listEnvelope([{ code: "001", name: "One" }, { code: "001", name: "Other" }]),
    ]) await assert.rejects(getProvinces({ context }), invalidResponse);
  } finally {
    await close(server);
  }
});

test("preview rejects malformed amounts and totals that cannot be reconciled", async () => {
  let body: unknown = envelope(preview);
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (body of [
      preview,
      envelope({ ...preview, shippingFee: undefined }),
      envelope({ ...preview, shippingFee: "30000.00" }),
      envelope({ ...preview, shippingFee: -1 }),
      envelope({ ...preview, shippingFee: 0.001 }),
      envelope({ ...preview, total: Number.MAX_SAFE_INTEGER }),
      envelope({ ...preview, total: 0 }),
      envelope({ ...preview, subtotal: 0 }),
      envelope({ ...preview, items: [{ ...item, lineTotal: 1 }] }),
      envelope({ ...preview, items: [{ ...item, quantity: 0 }] }),
      envelope({ ...preview, issues: [{ itemId: "line-1", skuId: "sku-1" }] }),
    ]) await assert.rejects(getCheckoutPreview(destination, { context }), invalidResponse);
  } finally {
    await close(server);
  }
});

test("empty address/filter values reject before transport and in-flight preview cancellation stays AbortError", async () => {
  let calls = 0;
  const context = { fetch: async () => { calls++; return new Response(); } };
  await assert.rejects(getWards("", { context }), invalidResponse);
  for (const field of Object.keys(destination)) {
    await assert.rejects(getCheckoutPreview({ ...destination, [field]: "" }, { context }), invalidResponse);
  }
  assert.equal(calls, 0);

  let started: () => void = () => {};
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  const server = createServer(() => { started(); });
  const controller = new AbortController();
  const pending = getCheckoutPreview(destination, {
    context: { baseUrl: await listen(server) }, signal: controller.signal,
  });
  try {
    await requestStarted;
    controller.abort();
    await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  } finally {
    await close(server);
  }
});
