import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";
import { AxiosHeaders } from "axios";
import { isApiError } from "../configs/api";
import {
  getActiveAuctions, getAuction, getAuctionBids, getAuctionState, getMyAuctionBid,
  parseAuctionBidMinimum, parseAuctionRoom, parseAuctionState, placeAuctionBid,
} from "../service/auctionService";

const item = { id: "auction-1", productId: "product-1", title: "Watch", imageUrl: null, currentPrice: 250000, bidCount: 12, currency: "VND", endAt: "2026-11-10T20:00:00Z" };
const response = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data, page: { number: 0, size: 5, totalElements: 1, totalPages: 1 } }), { headers: { "Content-Type": "application/json" } });

test("homepage auction request is public and normalizes money and closing order", async () => {
  const context = {
    baseUrl: "https://api.test",
    getAccessToken: () => "private-token",
    fetch: (async (input, init) => {
      assert.equal(String(input), "https://api.test/api/v1/auctions?status=ACTIVE&page=0&size=5");
      assert.equal(new Headers(init?.headers).get("Authorization"), null);
      return response([item, { ...item, id: "auction-2", endAt: "2026-11-10T19:00:00Z" }]);
    }) satisfies typeof fetch,
  };
  const auctions = await getActiveAuctions({ context });
  assert.equal(auctions[0].auctionId, "auction-2");
  assert.equal(auctions[0].currentBid, "250000.00");
  assert.equal(auctions[0].imageUrl, undefined);
});

test("homepage rejects malformed auction prices, timestamps and bid counts", async () => {
  for (const changed of [{ currentPrice: -1 }, { endAt: "invalid" }, { bidCount: -1 }, { imageUrl: 123 }]) {
    await assert.rejects(getActiveAuctions({ context: { fetch: async () => response([{ ...item, ...changed }]) } }), (error: unknown) => typeof error === "object" && error !== null && "kind" in error && error.kind === "invalid-response");
  }
});

const auctionId = "a1000000-0000-4000-8000-000000000001";
const otherId = "a1000000-0000-4000-8000-000000000002";
const bidderId = "b1000000-0000-4000-8000-000000000001";
const bidId = "b2000000-0000-4000-8000-000000000001";
const key = "c1000000-0000-4000-8000-000000000001";
const room = {
  id: auctionId, productId: otherId, skuId: otherId, sellerId: otherId,
  title: "Rolex Submariner Watch", imageUrl: null,
  startingPrice: 6000, currentPrice: 9850, bidIncrement: 50,
  bidCount: 18, currency: "USD", startAt: "2026-11-13T10:00:00Z",
  endAt: "2026-11-13T11:00:05Z", originalEndAt: "2026-11-13T10:55:05Z",
  extensionCount: 1, status: "ACTIVE",
};
const state = {
  auctionId, currentPrice: 9850, bidIncrement: 50, bidCount: 18,
  leaderBidderName: "j***n", endAt: room.endAt,
  status: "ACTIVE", serverTime: "2026-11-13T11:00:00Z",
};
const ownBid = {
  auctionId, title: room.title, amount: 9850, placedAt: "2026-11-13T10:57:00Z",
  auctionStatus: "ACTIVE", leading: true, won: false,
};
const json = (data: unknown, page?: { number: number; size: number; totalElements: number; totalPages: number }) =>
  ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
const fetchJson = (data: unknown): typeof fetch => async () => new Response(JSON.stringify(json(data)), {
  headers: { "Content-Type": "application/json" },
});
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("auction public detail, state and masked history use exact routes without Bearer over HTTP", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.headers.authorization, undefined);
    requests.push(request.url ?? "");
    response.writeHead(200, { "Content-Type": "application/json" });
    const body = request.url?.includes("/state") ? json(state)
      : request.url?.includes("/bids") ? json([{ amount: 9850, bidderName: "j***n", placedAt: ownBid.placedAt }], { number: 1, size: 10, totalElements: 11, totalPages: 2 })
        : json(room);
    response.end(JSON.stringify(body));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "private-token" };
  try {
    const detail = await getAuction(auctionId, { context, auth: true, params: { ignored: true } });
    assert.equal(detail.currentPrice, "9850.00");
    assert.equal(detail.finalPrice, null);
    assert.equal(detail.paymentDueAt, null);
    assert.equal(detail.orderId, null);
    const current = await getAuctionState(auctionId, { context, auth: true });
    assert.ok(current.remainingMs >= 0 && current.remainingMs <= 5000);
    assert.equal(current.currentPrice, "9850.00");
    const history = await getAuctionBids(auctionId, 1, { context, auth: true });
    assert.deepEqual(history, { content: [{ amount: "9850.00", bidderName: "j***n", placedAt: ownBid.placedAt }], page: 1, size: 10, totalElements: 11, totalPages: 2 });
    assert.deepEqual(requests, [`/api/v1/auctions/${auctionId}`, `/api/v1/auctions/${auctionId}/state`, `/api/v1/auctions/${auctionId}/bids?page=1&size=10`]);
  } finally { await close(server); }
});

test("auction countdown uses server time and monotonic request duration, including extension and expiration", () => {
  const parsed = parseAuctionState(state, 100, 800);
  assert.equal(parsed.receivedAt, 800);
  assert.equal(parsed.remainingMs, 4300);
  assert.equal(parseAuctionState({ ...state, endAt: "2026-11-13T11:05:05Z" }, 100, 800).remainingMs, 304300);
  assert.equal(parseAuctionState({ ...state, endAt: "2026-11-13T10:59:59Z" }, 100, 800).remainingMs, 0);
  for (const changed of [{ serverTime: "invalid" }, { serverTime: "2026-11-13T11:00:00" }, { serverTime: undefined }, { bidIncrement: 0 }, { currentPrice: "9850" }, { bidCount: 1.5 }, { status: "UNKNOWN" }, { leaderBidderName: undefined }]) {
    assert.throws(() => parseAuctionState({ ...state, ...changed }, 100, 800));
  }
  assert.throws(() => parseAuctionState(state, 800, 100));
});

test("auction detail validates settlement references and rejects unsafe money or malformed resource data", () => {
  const settled = parseAuctionRoom({ ...room, status: "WON", finalPrice: 9850, paymentDueAt: "2026-11-14T11:00:05Z", orderId: otherId });
  assert.equal(settled.finalPrice, "9850.00");
  assert.equal(settled.orderId, otherId);
  for (const changed of [{ startingPrice: -1 }, { currentPrice: 1.001 }, { bidIncrement: 0 }, { currentPrice: Number.MAX_SAFE_INTEGER }, { id: "not-a-uuid" }, { imageUrl: 1 }, { extensionCount: -1 }, { orderId: "made-up-order" }, { paymentDueAt: "invalid" }, { finalPrice: "9850" }]) {
    assert.throws(() => parseAuctionRoom({ ...room, ...changed }));
  }
});

test("auction services reject mismatched resources and malformed history before publishing state", async () => {
  for (const request of [
    () => getAuction(auctionId, { context: { fetch: fetchJson({ ...room, id: otherId }) } }),
    () => getAuctionState(auctionId, { context: { fetch: fetchJson({ ...state, auctionId: otherId }) } }),
  ]) {
    await assert.rejects(request(), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
  for (const changed of [{ amount: "9850" }, { amount: -1 }, { bidderName: null }, { placedAt: "invalid" }]) {
    await assert.rejects(getAuctionBids(auctionId, 0, { context: { fetch: async () => new Response(JSON.stringify(json([{ amount: 9850, bidderName: "j***n", placedAt: ownBid.placedAt, ...changed }], { number: 0, size: 10, totalElements: 1, totalPages: 1 })), { headers: { "Content-Type": "application/json" } }) } }));
  }
});

test("personal auction bid lookup searches every delivered page using current auth and preserves absence", async () => {
  const urls: string[] = [];
  let token = "first";
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    urls.push(request.url ?? "");
    const page = Number(new URL(request.url ?? "", "http://localhost").searchParams.get("page"));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(json([page === 0 ? { ...ownBid, auctionId: otherId } : ownBid], { number: page, size: 100, totalElements: 2, totalPages: 2 })));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const found = await getMyAuctionBid(auctionId, { context, auth: false, params: { ignored: true } });
    assert.equal(found?.amount, "9850.00");
    assert.equal(found?.leading, true);
    token = "second";
    assert.equal(await getMyAuctionBid(bidderId, { context }), null);
    assert.deepEqual(urls, ["/api/v1/bids/mine?page=0&size=100", "/api/v1/bids/mine?page=1&size=100", "/api/v1/bids/mine?page=0&size=100", "/api/v1/bids/mine?page=1&size=100"]);
  } finally { await close(server); }
});

test("auction bids serialize numeric money with the supplied idempotency key for creation and replay", async () => {
  let count = 0;
  let token = "first";
  const server = createServer(async (request, response) => {
    count += 1;
    assert.equal(request.url, `/api/v1/auctions/${auctionId}/bids`);
    assert.equal(request.method, "POST");
    assert.equal(request.headers["idempotency-key"], key);
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString()), { amount: 9900.5 });
    response.writeHead(count === 1 ? 201 : 200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(json({ bidId, currentPrice: 9900.5, leaderBidderId: bidderId })));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  const headers = new AxiosHeaders({ "Idempotency-Key": "incorrect" });
  try {
    const accepted = await placeAuctionBid(auctionId, { amount: "9900.50", idempotencyKey: key }, { context, auth: false, params: { ignored: true }, config: { headers } });
    token = "second";
    assert.deepEqual(await placeAuctionBid(auctionId, { amount: "9900.5", idempotencyKey: key }, { context }), accepted);
    assert.equal(accepted.currentPrice, "9900.50");
    assert.equal(headers.get("Idempotency-Key"), "incorrect");
  } finally { await close(server); }
});

test("auction bid inputs reject nonpositive, fractional-cent and unsafe precision before transport", async () => {
  let sends = 0;
  const context = { fetch: (async () => { sends += 1; throw new Error("must not send"); }) satisfies typeof fetch };
  for (const amount of ["0", "-1", "1.001", "1e3", "NaN", "90071992547409.92", "99999999999999999.99", ""]) {
    await assert.rejects(placeAuctionBid(auctionId, { amount, idempotencyKey: key }, { context }));
  }
  await assert.rejects(placeAuctionBid(auctionId, { amount: "9900", idempotencyKey: "invalid" }, { context }));
  await assert.rejects(getAuction("invalid", { context }));
  assert.equal(sends, 0);
});

test("auction low-bid feedback reads only a validated numeric minimum from the named 400 problem", async () => {
  const error = { kind: "http" as const, status: 400, title: "Bad Request", code: "AUCTION_BID_TOO_LOW", extensions: { minimum: 9950 } };
  assert.equal(parseAuctionBidMinimum(error), "9950.00");
  for (const changed of [{ status: 409 }, { code: "AUCTION_NOT_ACTIVE" }, { extensions: { minimum: "9950" } }, { extensions: { minimum: -1 } }, { extensions: { minimum: 1.001 } }, { extensions: {} }]) {
    assert.equal(parseAuctionBidMinimum({ ...error, ...changed }), null);
  }
  const server = createServer((request, response) => {
    response.writeHead(400, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ ...error, kind: undefined, type: "urn:problem:domain-error", detail: "Bid at least 9950", instance: request.url, minimum: 9950, extensions: undefined }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    await assert.rejects(placeAuctionBid(auctionId, { amount: "9900", idempotencyKey: key }, { context }), (failure: unknown) => parseAuctionBidMinimum(failure) === "9950.00");
  } finally { await close(server); }
});

test("auction cancellation remains aborted for public reads, private lookup and bid writes", async () => {
  const controller = new AbortController();
  controller.abort();
  let sends = 0;
  const context = { fetch: (async () => { sends += 1; throw new Error("must not send"); }) satisfies typeof fetch };
  const options = { context, signal: controller.signal };
  for (const request of [
    () => getAuction(auctionId, options), () => getAuctionState(auctionId, options),
    () => getAuctionBids(auctionId, 0, options), () => getMyAuctionBid(auctionId, options),
    () => placeAuctionBid(auctionId, { amount: "9900", idempotencyKey: key }, options),
  ]) {
    await assert.rejects(request(), (error: unknown) => error instanceof Error && error.name === "AbortError");
  }
  assert.equal(sends, 0);
});
