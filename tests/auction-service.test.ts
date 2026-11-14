import assert from "node:assert/strict";
import test from "node:test";
import { getActiveAuctions, getAuction } from "../service/auctionService";
import { createServer } from "node:http";

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

test("auction room reads the actual public snapshot and validates its seller, identities and prices", async () => {
  const id = "68000000-0000-4000-8000-000000000011";
  const snapshot = {
    id, productId: "68000000-0000-4000-8000-000000000012", skuId: "68000000-0000-4000-8000-000000000013",
    sellerId: "68000000-0000-4000-8000-000000000004", title: "Auction watch", imageUrl: null,
    startingPrice: 200000, currentPrice: 250000, bidIncrement: 10000, bidCount: 3, currency: "VND",
    startAt: "2026-11-14T01:00:00Z", endAt: "2026-11-15T01:00:00Z", originalEndAt: "2026-11-15T01:00:00Z",
    extensionCount: 0, status: "ACTIVE",
  };
  let result: unknown = snapshot;
  const calls: string[] = [];
  const server = createServer((request, response) => {
    calls.push(request.url ?? "");
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ code: 0, message: "response success", data: result }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const context = { baseUrl: `http://127.0.0.1:${address.port}`, getAccessToken: () => "must-not-be-sent" };
  try {
    const auction = await getAuction(id, { context, auth: true, params: { id: "another" } });
    assert.equal(auction.sellerId, snapshot.sellerId);
    assert.equal(auction.currentPrice, "250000.00");
    assert.deepEqual(calls, [`/api/v1/auctions/${id}`]);
    for (const changed of [{ id: snapshot.sellerId }, { sellerId: "invalid" }, { status: "UNKNOWN" }, { bidIncrement: 0 }, { currentPrice: -1 }, { endAt: "invalid" }, { bidCount: 1.5 }]) {
      result = { ...snapshot, ...changed };
      await assert.rejects(getAuction(id, { context }));
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
