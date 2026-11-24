import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { getOrderSummary } from "../service/dashboardService";

const statuses = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "REFUND_REQUESTED", "REFUNDED"];
const days = (count: number) => Array.from({ length: count }, (_, index) => ({
  date: `2026-11-${String(24 - count + 1 + index).padStart(2, "0")}`, orderCount: 0, paidOrderCount: 0, revenue: 0,
}));
const summary = (count = 7) => {
  const daily = days(count);
  daily[count - 1] = { ...daily[count - 1], orderCount: 3, paidOrderCount: 2, revenue: 350000 };
  return { from: "2026-11-18T00:00:00+07:00", to: "2026-11-25T00:00:00+07:00", timeZone: "Asia/Ho_Chi_Minh",
    orderCount: 3, paidOrderCount: 2, revenue: 350000,
    statuses: statuses.map((status) => ({ status, count: status === "PAID" ? 2 : status === "PENDING" ? 1 : 0 })), daily };
};
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const reply = (data: unknown) => async () => Response.json({ code: 0, message: "response success", data });

test("managed and sales summaries call their own path with the chosen window and map money to strings", async () => {
  for (const [scope, path] of [["managed", "/api/v1/orders/manage/summary"], ["sales", "/api/v1/orders/sales/summary"]] as const) {
    const report = await getOrderSummary(scope, 7, { context: { getAccessToken: () => "staff", fetch: async (input, init) => {
      const url = new URL(String(input), "http://fixture.test");
      assert.equal(url.pathname, path);
      assert.deepEqual([...url.searchParams.entries()], [["days", "7"]]);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer staff");
      return Response.json({ code: 0, message: "response success", data: summary() });
    } } });
    assert.equal(report.revenue, "350000.00");
    assert.equal(report.daily.length, 7);
    assert.equal(report.daily[6].revenue, "350000.00");
    assert.equal(report.statuses.find((entry) => entry.status === "PAID")?.count, 2);
  }
});

test("a window outside 7, 30 or 90 days is refused before any request", async () => {
  let called = false;
  await assert.rejects(getOrderSummary("sales", 14 as never, { context: { fetch: async () => { called = true; return Response.json({}); } } }), invalid);
  assert.equal(called, false);
});

test("summaries whose days, statuses or totals disagree fail strict parsing", async () => {
  const base = summary();
  for (const bad of [
    { ...base, daily: base.daily.slice(1) },
    { ...base, daily: [...base.daily].reverse() },
    { ...base, statuses: base.statuses.slice(1) },
    { ...base, statuses: [...base.statuses.slice(1), base.statuses[1]] },
    { ...base, orderCount: 4 },
    { ...base, paidOrderCount: 5 },
    { ...base, revenue: -1 },
    { ...base, statuses: base.statuses.map((entry) => entry.status === "PAID" ? { ...entry, status: "LOST" } : entry) },
    { ...base, from: "2026-11-18" },
  ]) await assert.rejects(getOrderSummary("managed", 7, { context: { fetch: reply(bad) } }), invalid);
});
