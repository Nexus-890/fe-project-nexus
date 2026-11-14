import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { isApiError } from "../configs/api";
import { confirmAuctionShipping, parseAuctionShippingConfirmation } from "../service/auctionCheckoutService";
import type { CheckoutAddress } from "../types/checkoutType";

const orderId = "a1000000-0000-4000-8000-000000000001";
const orderGroupId = "a1000000-0000-4000-8000-000000000002";
const confirmation = { orderGroupId, shippingFee: 30000, totalAmount: 1530000, dueAt: "2031-01-02T00:00:00Z" };
const address: CheckoutAddress = {
  recipientName: " Winner ", phoneNumber: " 0900000000 ", addressLine: " 1 Main Street ",
  wardCode: " 1003646 ", provinceCode: " 1000001 ",
};
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = server.address();
  assert.ok(endpoint && typeof endpoint !== "string");
  return `http://127.0.0.1:${endpoint.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};
const invalidResponse = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("winning shipping sends a direct normalized address with current Bearer and maps numeric confirmation", async () => {
  const requests: unknown[] = [];
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, `/api/v1/orders/${orderId}/shipping-confirmation`);
    assert.equal(request.headers.authorization, "Bearer fixture-buyer");
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ code: 0, message: "response success", data: confirmation }));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "fixture-buyer" };
  try {
    const result = await confirmAuctionShipping(orderId, address, { context, auth: false, params: { ignored: true } });
    assert.deepEqual(result, { ...confirmation, shippingFee: "30000.00", totalAmount: "1530000.00" });
    await confirmAuctionShipping(orderId, address, { context });
    const expected = { recipientName: "Winner", phoneNumber: "0900000000", addressLine: "1 Main Street", wardCode: "1003646", provinceCode: "1000001", countryCode: "VN" };
    assert.deepEqual(requests, [expected, expected]);
  } finally { await close(server); }
});

test("winning shipping rejects unsafe response money and missing payment handoff fields", () => {
  for (const changed of [
    { shippingFee: "30000.00" }, { totalAmount: -1 }, { shippingFee: 1.001 },
    { totalAmount: 90071992547409.92 }, { shippingFee: 1530001 },
    { orderGroupId: "missing" }, { dueAt: "2031-01-02T00:00:00" }, { dueAt: undefined },
  ]) assert.throws(() => parseAuctionShippingConfirmation({ ...confirmation, ...changed }), invalidResponse);
  assert.equal(parseAuctionShippingConfirmation({ ...confirmation, shippingFee: 0 }).shippingFee, "0.00");
});

test("winning shipping validates order and carrier-compatible address before HTTP", async () => {
  let calls = 0;
  const context = { getAccessToken: () => "fixture-buyer", fetch: (async () => { calls += 1; throw new Error("unexpected HTTP"); }) satisfies typeof fetch };
  await assert.rejects(confirmAuctionShipping("not-an-order", address, { context }), invalidResponse);
  for (const changed of [
    { phoneNumber: "+1 555 1234567" }, { phoneNumber: "090 000 0000" }, { recipientName: " " },
    { addressLine: "x".repeat(256) }, { provinceCode: "0" }, { wardCode: "not-a-code" },
  ]) await assert.rejects(confirmAuctionShipping(orderId, { ...address, ...changed }, { context }), invalidResponse);
  assert.equal(calls, 0);
});

test("winning shipping preserves hold conflicts and abort cancellation", async () => {
  const context = { getAccessToken: () => "fixture-buyer", fetch: (async () => new Response(JSON.stringify({
    type: "urn:problem:domain-error", title: "Conflict", status: 409,
    detail: "The auction hold is not linked to this order yet", code: "COMMERCE_AUCTION_HOLD_NOT_LINKED",
  }), { status: 409, headers: { "Content-Type": "application/problem+json" } })) satisfies typeof fetch };
  await assert.rejects(confirmAuctionShipping(orderId, address, { context }), (error: unknown) =>
    isApiError(error) && error.status === 409 && error.code === "COMMERCE_AUCTION_HOLD_NOT_LINKED");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(confirmAuctionShipping(orderId, address, { context, signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});
