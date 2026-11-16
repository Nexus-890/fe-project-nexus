import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { getAuctionBidStatus, placeAuctionBid } from "../service/auctionService";
import { waitForAuctionBidResult } from "../features/auctionBidQueue";

const auctionId = "a1000000-0000-4000-8000-000000000001";
const bidId = "b2000000-0000-4000-8000-000000000001";
const bidderId = "b1000000-0000-4000-8000-000000000001";
const requestedAt = "2026-11-16T01:00:00Z";
const queued = { bidId, status: "QUEUED", requestedAt, amount: 1200000 };
const placed = { ...queued, status: "PLACED", currentPrice: 1200000, leaderBidderId: bidderId };
// Tạo đúng success envelope qua HTTP boundary, không bỏ qua parser thật của service.
const response = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data }), {
  headers: { "Content-Type": "application/json" },
});

// Trạng thái riêng phải gửi token, đúng bidId và chuẩn hóa giá tiền trước khi đến giao diện.
test("private queued bid status uses the exact owner route and validates each processing result", async () => {
  const context = { baseUrl: "https://api.test", getAccessToken: () => "buyer-token", fetch: (async (input, init) => {
    assert.equal(String(input), `https://api.test/api/v1/auctions/${auctionId}/bids/${bidId}`);
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer buyer-token");
    return response(placed);
  }) satisfies typeof fetch };
  assert.deepEqual(await getAuctionBidStatus(auctionId, bidId, { context, auth: false, params: { ignored: true } }), {
    ...placed, amount: "1200000.00", currentPrice: "1200000.00",
  });
  assert.deepEqual(await getAuctionBidStatus(auctionId, bidId, { context: { fetch: async () => response(queued) } }), {
    ...queued, status: "QUEUED", amount: "1200000.00",
  });
  // Các trạng thái lịch sử vẫn đọc được khi replay khóa từ trước migration queue.
  for (const status of ["OUTBID", "WON", "CANCELLED"]) {
    const result = await getAuctionBidStatus(auctionId, bidId, { context: { fetch: async () => response({ ...placed, status }) } });
    assert.equal(result.status, status);
  }
  const rejected = { ...queued, status: "REJECTED", reason: "AUCTION_BID_TOO_LOW", minimum: 1250000 };
  assert.deepEqual(await getAuctionBidStatus(auctionId, bidId, { context: { fetch: async () => response(rejected) } }), {
    ...rejected, amount: "1200000.00", minimum: "1250000.00",
  });
});

// Không chấp nhận UUID khác, trạng thái lạ hoặc thiếu minimum; tránh gán nhầm kết quả/giá cho lần bid.
test("bid result parser rejects foreign references and malformed queued placed and rejected bodies", async () => {
  for (const value of [
    { ...queued, bidId: auctionId }, { ...queued, requestedAt: null }, { ...queued, amount: "1200000" },
    { ...queued, status: "UNKNOWN" }, { ...placed, leaderBidderId: null }, { ...placed, currentPrice: -1 },
    { ...queued, status: "REJECTED", reason: "AUCTION_BID_TOO_LOW" },
    { ...queued, status: "REJECTED", reason: "bad reason", minimum: 1250000 },
    { ...queued, status: "REJECTED", reason: "AUCTION_BID_TOO_LOW", minimum: "1250000" },
  ]) await assert.rejects(getAuctionBidStatus(auctionId, bidId, { context: { fetch: async () => response(value) } }),
    (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

// Biên nhận POST không được chứa trạng thái PLACED thay cho QUEUED; phiên bản cũ phải lộ drift rõ ràng.
test("queue acceptance rejects a legacy placed body and an invalid receipt timestamp", async () => {
  for (const value of [placed, { bidId, status: "QUEUED", requestedAt: "invalid" }])
    await assert.rejects(placeAuctionBid(auctionId, { amount: "1200000", idempotencyKey: bidderId }, {
      context: { fetch: async () => response(value) },
    }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

// QUEUED chỉ kích hoạt GET tiếp theo; lời hứa không hoàn tất trước PLACED và không gửi thêm POST.
test("queued result polling waits for placement and only reads the accepted bid", async () => {
  let reads = 0;
  let completed = false;
  const context = { fetch: (async (input, init) => {
    assert.ok(String(input).endsWith(`/bids/${bidId}`));
    assert.equal(init?.method, "GET");
    reads += 1;
    assert.equal(completed, false);
    return response(reads < 3 ? queued : placed);
  }) satisfies typeof fetch };
  const result = await waitForAuctionBidResult(auctionId, bidId, { context }, { timeoutMs: 1000, intervalMs: 1 });
  completed = true;
  assert.equal(reads, 3);
  assert.equal(result.status, "PLACED");
});

// REJECTED là kết quả đã xử lý, phải trả nguyên mã/minimum cho form thay vì báo thành công.
test("queued result polling preserves a rejection minimum without retrying the rejected command", async () => {
  let reads = 0;
  const context = { fetch: async () => { reads += 1; return response({ ...queued, status: "REJECTED", reason: "AUCTION_BID_TOO_LOW", minimum: 1250000 }); } };
  const result = await waitForAuctionBidResult(auctionId, bidId, { context });
  assert.equal(reads, 1);
  assert.equal(result.status, "REJECTED");
  if (result.status === "REJECTED") assert.equal(result.minimum, "1250000.00");
});

// Hết thời gian chờ không có nghĩa bid thất bại; giữ kết quả chưa xác định để retry cùng bidId.
test("a queue deadline reports pending rather than incorrectly accepting or rejecting a bid", async () => {
  let reads = 0;
  await assert.rejects(waitForAuctionBidResult(auctionId, bidId, { context: { fetch: async () => { reads += 1; return response(queued); } } },
    { timeoutMs: 0, intervalMs: 1 }), (error: unknown) => isApiError(error) && error.code === "AUCTION_BID_PENDING");
  assert.equal(reads, 1);
});

// Rời trang trong lúc nghỉ phải hủy ngay và không phát thêm GET bằng phiên đăng nhập cũ.
test("aborting a queued wait cancels the timer before another result request", async () => {
  const controller = new AbortController();
  let reads = 0;
  const pending = waitForAuctionBidResult(auctionId, bidId, { signal: controller.signal, context: { fetch: async () => {
    reads += 1;
    setTimeout(() => controller.abort(), 5);
    return response(queued);
  } } }, { timeoutMs: 1000, intervalMs: 500 });
  await assert.rejects(pending, (error: unknown) => isApiError(error) && error.kind === "aborted");
  assert.equal(reads, 1);
});

// Lỗi sở hữu 404/phiên 401 từ endpoint kết quả vẫn là lỗi chuẩn, không đổi thành PLACED hay retry vô hạn.
test("private result access errors remain visible and are not retried as successful placement", async () => {
  for (const status of [401, 404]) {
    let reads = 0;
    await assert.rejects(waitForAuctionBidResult(auctionId, bidId, { context: { fetch: async () => {
      reads += 1;
      return new Response(JSON.stringify({ title: "Denied", status, code: status === 404 ? "AUCTION_BID_NOT_FOUND" : "UNAUTHENTICATED" }), {
        status, headers: { "Content-Type": "application/problem+json" },
      });
    } } }), (error: unknown) => isApiError(error) && error.status === status);
    assert.equal(reads, 1);
  }
});