import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { adminCancelAuction, getManagedAuction, getManagedAuctionBids, getManagedAuctionState, getManagedAuctions, updateAuction } from "../service/auctionService";
import { auctionCancelReasonSchema, auctionUpdateSchema, toAuctionUpdateValues } from "../features/adminAuctionUtils";
import type { ApiContext } from "../types/commonRequestType";

const auctionId = "92000000-0000-4000-8000-000000000013";
const reference = "93000000-0000-4000-8000-000000000013";
const auction = {
  id: auctionId, productId: reference, skuId: reference, sellerId: reference, title: "Leica M6 film camera", imageUrl: null,
  startingPrice: 6000000, bidIncrement: 50000, currentPrice: 6000000, bidCount: 0, currency: "VND",
  startAt: "2026-11-20T03:00:00Z", endAt: "2026-11-21T03:00:00Z", originalEndAt: "2026-11-21T03:00:00Z", extensionCount: 0,
  status: "SCHEDULED", cancelledBy: null, cancelledReason: null, cancelledActorId: null, cancelledAt: null,
};
const page = (number: number, totalElements: number) => ({ number, size: 10, totalElements, totalPages: Math.ceil(totalElements / 10) });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
type Call = { method?: string; url: string; auth: string | null; body: unknown };
const recorder = (respond: () => Response) => {
  const calls: Call[] = [];
  const context: ApiContext = { baseUrl: "https://api.test", getAccessToken: () => "admin-token", fetch: async (input, init) => {
    calls.push({ method: init?.method, url: String(input), auth: new Headers(init?.headers).get("Authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return respond();
  } };
  return { calls, context };
};

test("back-office auction list sends the status tab and page with the Bearer and keeps page metadata", async () => {
  const { calls, context } = recorder(() => Response.json({ code: 0, message: "response success", data: [auction], page: page(1, 11) }));
  const result = await getManagedAuctions("SCHEDULED", 1, { context });
  assert.deepEqual(calls, [{ method: "GET", url: "https://api.test/api/v1/auctions/manage?status=SCHEDULED&page=1&size=10", auth: "Bearer admin-token", body: undefined }]);
  assert.equal(result.content[0].startingPrice, "6000000.00");
  assert.deepEqual({ page: result.page, totalElements: result.totalElements, totalPages: result.totalPages }, { page: 1, totalElements: 11, totalPages: 2 });
});

test("auction list rejects another status, another page, a malformed row and an unknown status filter", async () => {
  for (const body of [
    { code: 0, message: "response success", data: [{ ...auction, status: "ACTIVE" }], page: page(0, 1) },
    { code: 0, message: "response success", data: [auction], page: page(1, 11) },
    { code: 0, message: "response success", data: [{ ...auction, currentPrice: -1 }], page: page(0, 1) },
    { code: 0, message: "response success", data: [auction] },
  ]) await assert.rejects(getManagedAuctions("SCHEDULED", 0, { context: { fetch: async () => Response.json(body) } }), invalid);
  const { calls, context } = recorder(() => Response.json({}));
  await assert.rejects(getManagedAuctions("DRAFT" as "CREATED", 0, { context }), invalid);
  await assert.rejects(getManagedAuctions("ACTIVE", -1, { context }), invalid);
  assert.equal(calls.length, 0);
});

test("admin update sends PUT with the Bearer and exactly the UpdateAuctionRequest fields", async () => {
  const { calls, context } = recorder(() => Response.json({ code: 0, message: "response success", data: { ...auction, startingPrice: 7000000.5, currentPrice: 7000000.5 } }));
  const result = await updateAuction(auctionId, { startingPrice: "7000000.5", bidIncrement: "50000", startAt: "2026-11-20T03:00:00.000Z", endAt: "2026-11-21T03:00:00.000Z" }, { context });
  assert.deepEqual(calls, [{ method: "PUT", url: `https://api.test/api/v1/auctions/${auctionId}`, auth: "Bearer admin-token",
    body: { startingPrice: 7000000.5, bidIncrement: 50000, startAt: "2026-11-20T03:00:00.000Z", endAt: "2026-11-21T03:00:00.000Z" } }]);
  assert.equal(result.startingPrice, "7000000.50");
});

test("admin update refuses invalid amounts, a reversed window and another auction's response", async () => {
  const { calls, context } = recorder(() => Response.json({ code: 0, message: "response success", data: { ...auction, id: reference } }));
  const valid = { startingPrice: "6000000", bidIncrement: "50000", startAt: "2026-11-20T03:00:00Z", endAt: "2026-11-21T03:00:00Z" };
  for (const changed of [{ startingPrice: "0" }, { startingPrice: "-1" }, { bidIncrement: "1.234" }, { bidIncrement: "abc" }, { endAt: valid.startAt }, { startAt: "2026-11-20 10:00" }])
    await assert.rejects(updateAuction(auctionId, { ...valid, ...changed }, { context }), invalid);
  await assert.rejects(updateAuction("not-an-id", valid, { context }), invalid);
  assert.equal(calls.length, 0);
  await assert.rejects(updateAuction(auctionId, valid, { context }), invalid);
  assert.equal(calls.length, 1);
});

test("admin update preserves a 409 Problem Details detail", async () => {
  const { context } = recorder(() => Response.json({ type: "urn:problem:auction", title: "Conflict", status: 409, code: "AUCTION_NOT_EDITABLE", detail: "Only an auction that has not started can be configured", instance: `/api/v1/auctions/${auctionId}` }, { status: 409 }));
  await assert.rejects(updateAuction(auctionId, { startingPrice: "6000000", bidIncrement: "50000", startAt: "2026-11-20T03:00:00Z", endAt: "2026-11-21T03:00:00Z" }, { context }),
    (error: unknown) => isApiError(error) && error.status === 409 && error.code === "AUCTION_NOT_EDITABLE" && error.detail === "Only an auction that has not started can be configured");
});

test("admin cancel refuses an empty, blank or oversized reason before any request", async () => {
  const { calls, context } = recorder(() => Response.json({}));
  for (const reason of ["", "   ", "\n\t", "x".repeat(256), "😀".repeat(256)]) await assert.rejects(adminCancelAuction(auctionId, reason, { context }), invalid);
  assert.equal(calls.length, 0);
});

test("admin cancel posts the trimmed reason with the Bearer and requires an ADMIN cancellation snapshot", async () => {
  const cancelled = { ...auction, status: "CANCELLED", cancelledBy: "ADMIN", cancelledReason: "Counterfeit listing", cancelledActorId: reference, cancelledAt: "2026-11-15T03:00:00Z" };
  const { calls, context } = recorder(() => Response.json({ code: 0, message: "response success", data: cancelled }));
  const result = await adminCancelAuction(auctionId, `  Counterfeit listing \n`, { context });
  assert.deepEqual(calls, [{ method: "POST", url: `https://api.test/api/v1/auctions/${auctionId}/admin-cancel`, auth: "Bearer admin-token", body: { reason: "Counterfeit listing" } }]);
  assert.equal(result.status, "CANCELLED");
  assert.equal(result.cancelledReason, "Counterfeit listing");
  assert.equal((await adminCancelAuction(auctionId, "😀".repeat(255), { context })).status, "CANCELLED");
  for (const data of [{ ...cancelled, status: "ACTIVE" }, { ...cancelled, cancelledBy: "SELLER" }])
    await assert.rejects(adminCancelAuction(auctionId, "Counterfeit listing", { context: { fetch: async () => Response.json({ code: 0, message: "response success", data }) } }), invalid);
});

test("back-office detail and state read the manage path with the Bearer and refuse another auction", async () => {
  const restricted = { ...auction, status: "CREATED" };
  const state = { auctionId, currentPrice: 6000000, bidIncrement: 50000, bidCount: 0, leaderBidderName: null, endAt: auction.endAt, status: "CREATED", serverTime: "2026-11-15T03:00:00Z" };
  const detailCalls = recorder(() => Response.json({ code: 0, message: "response success", data: restricted }));
  assert.equal((await getManagedAuction(auctionId, { context: detailCalls.context, auth: false })).status, "CREATED");
  const stateCalls = recorder(() => Response.json({ code: 0, message: "response success", data: state }));
  assert.equal((await getManagedAuctionState(auctionId, { context: stateCalls.context })).status, "CREATED");
  assert.deepEqual([...detailCalls.calls, ...stateCalls.calls].map(({ url, auth }) => [url, auth]), [
    [`https://api.test/api/v1/auctions/manage/${auctionId}`, "Bearer admin-token"],
    [`https://api.test/api/v1/auctions/manage/${auctionId}/state`, "Bearer admin-token"],
  ]);
  await assert.rejects(getManagedAuction(auctionId, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...auction, id: reference } }) } }), invalid);
  await assert.rejects(getManagedAuctionState(auctionId, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...state, auctionId: reference } }) } }), invalid);
  const { calls, context } = recorder(() => Response.json({}));
  await assert.rejects(getManagedAuction("not-an-id", { context }), invalid);
  assert.equal(calls.length, 0);
});

test("back-office bid history keeps the backend newest-first order and masked names", async () => {
  const rows = [{ amount: 6300000, bidderName: "m***h", placedAt: "2026-11-15T02:30:00Z" }, { amount: 6200000, bidderName: "h***g", placedAt: "2026-11-15T02:00:00Z" }];
  const { calls, context } = recorder(() => Response.json({ code: 0, message: "response success", data: rows, page: page(0, 2) }));
  const result = await getManagedAuctionBids(auctionId, 0, { context });
  assert.deepEqual(result.content.map((bid) => [bid.bidderName, bid.amount]), [["m***h", "6300000.00"], ["h***g", "6200000.00"]]);
  assert.equal(calls[0].url, `https://api.test/api/v1/auctions/manage/${auctionId}/bids?page=0&size=10`);
  assert.equal(calls[0].auth, "Bearer admin-token");
});

test("admin auction form converts Vietnam time and rejects blank reasons", () => {
  const values = toAuctionUpdateValues({ ...auction, startingPrice: "6000000.00", bidIncrement: "50000.00", currentPrice: "6000000.00", status: "SCHEDULED", cancelledBy: null, cancelledReason: null });
  assert.deepEqual(values, { startingPrice: "6000000.00", bidIncrement: "50000.00", startAt: "2026-11-20T10:00", endAt: "2026-11-21T10:00" });
  const parsed = auctionUpdateSchema.safeParse({ ...values, startAt: "2026-11-20T12:30" });
  assert.ok(parsed.success);
  assert.equal(parsed.data.startAt, "2026-11-20T05:30:00.000Z");
  assert.equal(auctionUpdateSchema.safeParse({ ...values, endAt: values.startAt }).success, false);
  assert.equal(auctionUpdateSchema.safeParse({ ...values, bidIncrement: "0" }).success, false);
  assert.equal(auctionCancelReasonSchema.safeParse("   ").success, false);
  assert.equal(auctionCancelReasonSchema.safeParse(" Counterfeit ").data, "Counterfeit");
});
