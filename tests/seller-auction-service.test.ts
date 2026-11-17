import assert from "node:assert/strict";
import test from "node:test";
import { cancelSellerAuction, createSellerAuction, getSellerAuction, getSellerAuctions, parseSellerAuction, scheduleSellerAuction, updateSellerAuction } from "../service/sellerAuctionService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";

const id = "a2250000-0000-4000-8000-000000000100";
const productId = "a2250000-0000-4000-8000-000000000001";
const skuId = "a2250000-0000-4000-8000-000000000002";
const sellerId = "68000000-0000-4000-8000-000000000002";
const body = { productId, skuId, startingPrice: 100000.25, bidIncrement: 10000.5, startAt: "2027-01-01T03:00:00Z", endAt: "2027-01-01T03:03:00Z" };
const auction = { ...body, id, sellerId, title: "Catalog-owned title", imageUrl: null, currentPrice: 100000.25, bidCount: 0, currency: "VND", originalEndAt: body.endAt, extensionCount: 0, status: "CREATED", cancelledBy: null, cancelledReason: null, cancelledActorId: null, cancelledAt: null };
const envelope = (data: unknown, status = 200) => Response.json({ code: 0, message: "response success", data }, { status });
const page = (data: unknown[], number = 0, size = 10, totalElements = data.length, totalPages = totalElements ? 1 : 0) => Response.json({ code: 0, message: "response success", data, page: { number, size, totalElements, totalPages } });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("own auction list keeps exact status/page filters, authentication and normalized prices", async () => {
  const result = await getSellerAuctions({ page: 2, size: 10, status: "CANCELLED" }, { context: { getAccessToken: () => "seller-token", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    assert.equal(url.pathname, "/api/v1/auctions/mine");
    assert.deepEqual([...url.searchParams], [["page", "2"], ["size", "10"], ["status", "CANCELLED"]]);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer seller-token");
    return page([{ ...auction, status: "CANCELLED", cancelledBy: "SELLER", cancelledReason: "Item unavailable", cancelledActorId: sellerId, cancelledAt: "2027-01-01T02:00:00Z" }], 2, 10, 21, 3);
  } } });
  assert.equal(result.page, 2); assert.equal(result.totalPages, 3);
  assert.equal(result.content[0].startingPrice, "100000.25");
  assert.equal(result.content[0].bidIncrement, "10000.50");
  assert.equal(result.content[0].cancelledReason, "Item unavailable");
});

test("system stock cancellation remains readable alongside seller cancellations and in private detail", async () => {
  // AuctionStockRejected now produces this delivered audit snapshot, including the zero system actor UUID.
  const cancelled = { ...auction, status: "CANCELLED", cancelledBy: "SYSTEM", cancelledReason: "STOCK_UNAVAILABLE",
    cancelledActorId: "00000000-0000-0000-0000-000000000000", cancelledAt: "2027-01-01T02:00:00Z" };
  const rows = await getSellerAuctions({ status: "CANCELLED" }, { context: { fetch: async () => page([
    cancelled, { ...cancelled, id: skuId, cancelledBy: "SELLER", cancelledReason: "Item unavailable", cancelledActorId: sellerId },
  ]) } });
  assert.equal(rows.content.length, 2);
  assert.equal(rows.content[0].cancelledBy, "SYSTEM");
  assert.equal(rows.content[0].cancelledReason, "STOCK_UNAVAILABLE");
  assert.equal(rows.content[0].cancelledActorId, "00000000-0000-0000-0000-000000000000");
  assert.equal(rows.content[1].cancelledBy, "SELLER");
  const detail = await getSellerAuction(id, { context: { fetch: async () => page([cancelled], 0, 100) } });
  assert.equal(detail.cancelledBy, "SYSTEM");
  assert.equal(detail.status, "CANCELLED");
});

test("invalid pagination and lifecycle filters never send a request", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls++; return page([]); } };
  for (const filters of [{ page: -1 }, { size: 101 }, { page: 1.5 }, { status: "UNKNOWN" }])
    await assert.rejects(getSellerAuctions(filters as Parameters<typeof getSellerAuctions>[0], { context }), invalid);
  assert.equal(calls, 0);
});

test("seller parser rejects malformed money, identities, lifecycle, timestamps and cancellation audit", () => {
  for (const bad of [{ ...auction, id: "other" }, { ...auction, startingPrice: "100000.25" }, { ...auction, bidIncrement: 0 }, { ...auction, currentPrice: -1 },
    { ...auction, status: "DELETED" }, { ...auction, endAt: body.startAt }, { ...auction, startAt: "2027-01-01" }, { ...auction, extensionCount: -1 },
    { ...auction, cancelledBy: "BUYER" }, { ...auction, cancelledActorId: "unknown" }, { ...auction, cancelledAt: "yesterday" }])
    assert.throws(() => parseSellerAuction(bad), invalid);
});

test("auction response money cannot be zero, rounded, unsafe or rendered as an exponent", () => {
  for (const field of ["startingPrice", "currentPrice", "bidIncrement"] as const) {
    for (const amount of [0, 0.001, 1.001, 1e21, Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY])
      assert.throws(() => parseSellerAuction({ ...auction, [field]: amount }), invalid, `${field}=${amount}`);
  }
  const result = parseSellerAuction({ ...auction, startingPrice: 0.01, currentPrice: 0.02, bidIncrement: 0.01 });
  assert.equal(result.startingPrice, "0.01"); assert.equal(result.currentPrice, "0.02"); assert.equal(result.bidIncrement, "0.01");
});

test("private edit lookup traverses own pages and refuses missing or duplicate snapshots", async () => {
  const calls: number[] = [];
  const result = await getSellerAuction(id, { context: { fetch: async (input) => {
    const number = Number(new URL(String(input), "http://fixture.test").searchParams.get("page")); calls.push(number);
    return page(number === 1 ? [auction] : [], number, 100, 101, 2);
  } } });
  assert.equal(result.id, id); assert.deepEqual(calls, [0, 1]);
  await assert.rejects(getSellerAuction(id, { context: { fetch: async () => page([], 0, 100) } }), (error: unknown) => isApiError(error) && error.status === 404);
  await assert.rejects(getSellerAuctions({}, { context: { fetch: async () => page([auction, auction]) } }), invalid);
  await assert.rejects(getSellerAuctions({ status: "ACTIVE" }, { context: { fetch: async () => page([auction]) } }), invalid);
});

test("create/update/schedule/cancel preserve controller paths and bodies without trusting supplied title", async () => {
  const requests: { path: string; method?: string; body: unknown }[] = [];
  const context: ApiContext = { getAccessToken: () => "seller", fetch: async (input, init) => {
    const path = new URL(String(input), "http://fixture.test").pathname;
    const sent = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path, method: init?.method, body: sent });
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer seller");
    return envelope({ ...auction, status: path.endsWith("/cancel") ? "CANCELLED" : path.endsWith("/schedule") ? "SCHEDULED" : "CREATED" }, path === "/api/v1/auctions" ? 201 : 200);
  } };
  await createSellerAuction({ ...body, title: "Untrusted title" }, { context });
  await updateSellerAuction(id, body, { context });
  await scheduleSellerAuction(id, { context });
  await cancelSellerAuction(id, "  Item unavailable  ", { context });
  assert.deepEqual(requests, [
    { path: "/api/v1/auctions", method: "POST", body },
    { path: `/api/v1/auctions/${id}`, method: "PUT", body: { startingPrice: body.startingPrice, bidIncrement: body.bidIncrement, startAt: body.startAt, endAt: body.endAt } },
    { path: `/api/v1/auctions/${id}/schedule`, method: "POST", body: undefined },
    { path: `/api/v1/auctions/${id}/cancel`, method: "POST", body: { reason: "Item unavailable" } },
  ]);
});

test("unsafe input stops before transport and a stale lifecycle conflict is returned once", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls++; return Response.json({ type: "urn:problem:domain-error", title: "Conflict", status: 409, detail: "This auction already has bids", code: "AUCTION_HAS_BIDS" }, { status: 409 }); } };
  await assert.rejects(createSellerAuction({ ...body, startingPrice: 1.001 }, { context }), invalid);
  await assert.rejects(updateSellerAuction(id, { ...body, bidIncrement: 0 }, { context }), invalid);
  await assert.rejects(cancelSellerAuction(id, " ", { context }), invalid);
  await assert.rejects(cancelSellerAuction(id, "🪙".repeat(256), { context }), invalid);
  assert.equal(calls, 0);
  await assert.rejects(cancelSellerAuction(id, "No stock", { context }), (error: unknown) => isApiError(error) && error.status === 409 && error.code === "AUCTION_HAS_BIDS");
  assert.equal(calls, 1);
  await assert.rejects(scheduleSellerAuction(id, { context: { fetch: async () => envelope({ ...auction, id: productId, status: "SCHEDULED" }) } }), invalid);
});

test("new image and inventory creation rejections retain backend status and code without a retry", async () => {
  for (const [status, code] of [[409, "AUCTION_IMAGE_REQUIRED"], [409, "AUCTION_STOCK_UNAVAILABLE"], [503, "AUCTION_INVENTORY_UNAVAILABLE"]] as const) {
    let calls = 0;
    const context: ApiContext = { fetch: async () => {
      calls++;
      return Response.json({ type: "urn:problem:domain-error", title: "Auction rejected", status, detail: "The auction cannot secure its image or stock", code }, { status });
    } };
    await assert.rejects(createSellerAuction(body, { context }), (error: unknown) => isApiError(error) && error.status === status && error.code === code);
    assert.equal(calls, 1, code);
  }
});
