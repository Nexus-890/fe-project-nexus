import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { isApiError } from "../configs/api";
import { getAuctions, getMyAuctionBids } from "../service/auctionService";
import { getMyAuctionOffers, parseAuctionOffer, respondToAuctionOffer } from "../service/auctionOfferService";

const auctionId = "a1000000-0000-4000-8000-000000000001";
const otherId = "a1000000-0000-4000-8000-000000000002";
const auction = {
  id: auctionId, productId: otherId, skuId: otherId, sellerId: otherId, title: "Collector watch",
  imageUrl: null, startingPrice: 6000, bidIncrement: 50, currentPrice: 9850, bidCount: 18,
  currency: "VND", startAt: "2026-11-13T10:00:00Z", endAt: "2026-11-13T11:00:00Z",
  originalEndAt: "2026-11-13T11:00:00Z", extensionCount: 0, status: "ACTIVE",
};
const own = { auctionId, title: auction.title, amount: 9850, placedAt: auction.startAt, auctionStatus: "ACTIVE", leading: true, won: false };
const response = (data: unknown, number: number, size: number) => new Response(JSON.stringify({
  code: 0, message: "response success", data,
  page: { number, size, totalElements: 17, totalPages: Math.ceil(17 / size) },
}), { headers: { "Content-Type": "application/json" } });

test("auction list sends a public exact status/page request and retains server paging", async () => {
  const calls: string[] = [];
  const context = { baseUrl: "https://auction.test", getAccessToken: () => "private-token", fetch: (async (input, init) => {
    calls.push(String(input));
    assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return response([{ ...auction, status: "SCHEDULED" }], 1, 8);
  }) satisfies typeof fetch };
  const result = await getAuctions("SCHEDULED", 1, { context, auth: true, params: { size: 99, status: "CANCELLED" } });
  assert.deepEqual(calls, ["https://auction.test/api/v1/auctions?status=SCHEDULED&page=1&size=8"]);
  assert.equal(result.page, 1);
  assert.equal(result.totalElements, 17);
  assert.equal(result.totalPages, 3);
  assert.equal(result.content[0].currentPrice, "9850.00");
  assert.equal(result.content[0].status, "SCHEDULED");
});

test("personal bid page reads current session token and preserves truthful final results", async () => {
  let token = "session-a";
  const headers: (string | null)[] = [];
  const context = { baseUrl: "https://auction.test", getAccessToken: () => token, fetch: (async (input, init) => {
    assert.equal(String(input), "https://auction.test/api/v1/bids/mine?page=1&size=10");
    headers.push(new Headers(init?.headers).get("Authorization"));
    return response([{ ...own, auctionStatus: "WON", leading: false, won: true }], 1, 10);
  }) satisfies typeof fetch };
  const result = await getMyAuctionBids(1, { context, auth: false });
  token = "session-b";
  await getMyAuctionBids(1, { context });
  assert.deepEqual(headers, ["Bearer session-a", "Bearer session-b"]);
  assert.equal(result.content[0].amount, "9850.00");
  assert.equal(result.content[0].won, true);
  assert.equal(result.content[0].leading, false);
  assert.equal(result.page, 1);
  assert.equal(result.totalElements, 17);
});

test("auction list rejects a mismatched page and malformed personal bid data", async () => {
  await assert.rejects(getAuctions("ACTIVE", 1, { context: { fetch: async () => response([auction], 0, 8) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  for (const changed of [{ amount: "9850" }, { won: "true" }, { auctionStatus: "UNKNOWN" }, { placedAt: "invalid" }]) {
    await assert.rejects(getMyAuctionBids(0, { context: { fetch: async () => response([{ ...own, ...changed }], 0, 10) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
});

test("auction list and own bid cancellation stop before transport", async () => {
  const controller = new AbortController();
  controller.abort();
  let sends = 0;
  const context = { fetch: (async () => { sends += 1; throw new Error("must not send"); }) satisfies typeof fetch };
  const options = { context, signal: controller.signal };
  await assert.rejects(getAuctions("ACTIVE", 0, options), (error: unknown) => error instanceof Error && error.name === "AbortError");
  await assert.rejects(getMyAuctionBids(0, options), (error: unknown) => error instanceof Error && error.name === "AbortError");
  assert.equal(sends, 0);
});

const offerId = "b1000000-0000-4000-8000-000000000001";
const offer = { id: offerId, auctionId, title: "Collector watch", imageUrl: null, currency: "VND", amount: 4800000,
  status: "OFFERED", offeredAt: "2026-11-13T11:00:00Z", expiresAt: "2026-11-14T11:00:00Z", orderId: null, paymentDueAt: null };

test("offer reads preserve the recipient price, server status and authenticated pagination", async () => {
  const context = { baseUrl: "https://auction.test", getAccessToken: () => "recipient-token", fetch: (async (input, init) => {
    assert.equal(String(input), "https://auction.test/api/v1/auctions/offers/me?page=1&size=10");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer recipient-token");
    return response([offer], 1, 10);
  }) satisfies typeof fetch };
  const result = await getMyAuctionOffers(1, { context, auth: false });
  assert.equal(result.content[0].amount, "4800000.00");
  assert.equal(result.content[0].status, "OFFERED");
  assert.equal(result.content[0].orderId, null);
});

test("offer response sends only the named action and accepts matching server-created orders", async () => {
  const calls: string[] = [];
  const accepted = { ...offer, status: "ACCEPTED", orderId: otherId, paymentDueAt: "2026-11-15T11:00:00Z" };
  const context = { baseUrl: "https://auction.test", getAccessToken: () => "recipient-token", fetch: (async (input, init) => {
    calls.push(String(input));
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer recipient-token");
    const data = String(input).endsWith("/accept") ? accepted : { ...offer, status: "DECLINED" };
    return new Response(JSON.stringify({ code: 0, message: "response success", data }), { headers: { "Content-Type": "application/json" } });
  }) satisfies typeof fetch };
  const result = await respondToAuctionOffer(auctionId, offerId, "accept", { context, auth: false, params: { amount: 5000000 } });
  await respondToAuctionOffer(auctionId, offerId, "decline", { context });
  assert.equal(result.amount, "4800000.00");
  assert.equal(result.orderId, otherId);
  assert.equal(result.paymentDueAt, accepted.paymentDueAt);
  assert.deepEqual(calls, [`https://auction.test/api/v1/auctions/offers/${offerId}/accept`, `https://auction.test/api/v1/auctions/offers/${offerId}/decline`]);
});

test("F2 offers use only the canonical authenticated me and offer action routes over HTTP", async () => {
  const calls: { path: string; method: string; bearer: string | undefined; body: string }[] = [];
  const server = createServer(async (request, reply) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    calls.push({ path: request.url ?? "", method: request.method ?? "", bearer: request.headers.authorization, body: Buffer.concat(chunks).toString("utf8") });
    const data = request.method === "GET" ? [offer] : request.url?.endsWith("/accept")
      ? { ...offer, status: "ACCEPTED", orderId: otherId, paymentDueAt: "2031-11-15T11:00:00Z" }
      : { ...offer, status: "DECLINED" };
    reply.writeHead(200, { "Content-Type": "application/json" });
    reply.end(JSON.stringify({ code: 0, message: "response success", data,
      ...(request.method === "GET" ? { page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } } : {}) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const endpoint = server.address();
  assert.ok(endpoint && typeof endpoint !== "string");
  let token = "recipient-one";
  const context = { baseUrl: `http://127.0.0.1:${endpoint.port}`, getAccessToken: () => token };
  try {
    await getMyAuctionOffers(0, { context, auth: false });
    await respondToAuctionOffer(auctionId, offerId, "accept", { context, params: { amount: 5000000 } });
    token = "recipient-two";
    await respondToAuctionOffer(auctionId, offerId, "decline", { context });
    assert.deepEqual(calls, [
      { path: "/api/v1/auctions/offers/me?page=0&size=10", method: "GET", bearer: "Bearer recipient-one", body: "" },
      { path: `/api/v1/auctions/offers/${offerId}/accept`, method: "POST", bearer: "Bearer recipient-one", body: "" },
      { path: `/api/v1/auctions/offers/${offerId}/decline`, method: "POST", bearer: "Bearer recipient-two", body: "" },
    ]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("offer parser rejects incomplete accepted orders and invalid price/window data", () => {
  for (const changed of [{ amount: "4800000" }, { amount: 0 }, { amount: -1 }, { expiresAt: offer.offeredAt }, { offeredAt: "invalid" }, { status: "UNKNOWN" }, { status: ["OFFERED"] }, { status: "ACCEPTED" }, { status: "ACCEPTED", orderId: otherId }, { status: "ACCEPTED", orderId: "wrong", paymentDueAt: "2026-11-15T11:00:00Z" }]) {
    assert.throws(() => parseAuctionOffer({ ...offer, ...changed }));
  }
  assert.equal(parseAuctionOffer({ ...offer, status: "EXPIRED" }).status, "EXPIRED");
});

test("offer action rejects mismatched resource/status and preserves cancellation", async () => {
  for (const changed of [{ id: otherId }, { auctionId: otherId }, { status: "DECLINED" }]) {
    await assert.rejects(respondToAuctionOffer(auctionId, offerId, "accept", { context: { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: { ...offer, status: "ACCEPTED", orderId: otherId, paymentDueAt: "2026-11-15T11:00:00Z", ...changed } }), { headers: { "Content-Type": "application/json" } }) } }));
  }
  const controller = new AbortController();
  controller.abort();
  let sends = 0;
  const context = { fetch: (async () => { sends += 1; throw new Error("must not send"); }) satisfies typeof fetch };
  await assert.rejects(getMyAuctionOffers(0, { context, signal: controller.signal }), (error: unknown) => error instanceof Error && error.name === "AbortError");
  await assert.rejects(respondToAuctionOffer(auctionId, offerId, "accept", { context, signal: controller.signal }), (error: unknown) => error instanceof Error && error.name === "AbortError");
  await assert.rejects(respondToAuctionOffer("invalid", offerId, "accept", { context }));
  assert.equal(sends, 0);
});
