import assert from "node:assert/strict";
import test from "node:test";
import { getActiveAuctions } from "../service/auctionService";

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
