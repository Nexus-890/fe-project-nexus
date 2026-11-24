import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { performanceHours, performancePercent, performancePeriod } from "../features/carrierPerformanceFormat";
import { getCarrierPerformance } from "../service/supportOperationsService";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const ghn = { carrier: "GHN", name: "Giao Hàng Nhanh", shipments: 5, delivered: 2, failed: 1, inProgress: 1, cancelled: 1, successRate: 0.6667, averageDeliveryHours: 36, onTimeRate: 0.5 };
const idle = { carrier: "FAKE", name: "Simulated carrier", shipments: 0, delivered: 0, failed: 0, inProgress: 0, cancelled: 0, successRate: null, averageDeliveryHours: null, onTimeRate: null };
const from = "2026-11-01T00:00:00.000+07:00", to = "2026-11-19T23:59:59.999+07:00";
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const fixture = (data: unknown) => {
  const calls: { path: string; headers: Headers }[] = [];
  const options: ServiceRequestOptions = { context: { getAccessToken: () => "staff", fetch: async (input, init) => {
    calls.push({ path: String(input), headers: new Headers(init?.headers) });
    return Response.json({ code: 0, message: "response success", data, page: { number: 0, size: Array.isArray(data) ? data.length : 1, totalElements: Array.isArray(data) ? data.length : 1, totalPages: 1 } });
  } } };
  return { calls, options };
};

test("carrier performance sends the period with private auth and keeps rows with no data", async () => {
  const { calls, options } = fixture([ghn, idle]);
  const rows = await getCarrierPerformance(from, to, options);
  assert.deepEqual(rows.map((row) => row.carrier), ["GHN", "FAKE"]);
  assert.equal(rows[1].successRate, null);
  const url = new URL(calls[0].path, "http://x");
  assert.equal(url.pathname, "/api/v1/carriers/performance");
  assert.equal(url.searchParams.get("from"), from);
  assert.equal(url.searchParams.get("to"), to);
  assert.equal(calls[0].headers.get("authorization"), "Bearer staff");
});

test("carrier performance rejects a bad period before calling and malformed rows after", async () => {
  const { calls, options } = fixture([ghn]);
  for (const [a, b] of [[to, from], [from, from], ["2026-11-01", to], [from, "2027-11-19T00:00:00.000+07:00"]]) await assert.rejects(getCarrierPerformance(a, b, options), invalid);
  assert.equal(calls.length, 0);
  for (const bad of [[{ ...ghn, successRate: 1.2 }], [{ ...ghn, delivered: 3 }], [{ ...ghn, averageDeliveryHours: -1 }], [ghn, ghn], [{ ...ghn, carrier: "" }], { ...ghn }]) await assert.rejects(getCarrierPerformance(from, to, fixture(bad).options), invalid);
});

test("performance period uses Vietnam days and caps the span", () => {
  assert.deepEqual(performancePeriod("2026-11-01", "2026-11-19"), { from: "2026-11-01T00:00:00.000+07:00", to: "2026-11-19T23:59:59.999+07:00" });
  assert.equal(performancePeriod("2026-11-19", "2026-11-01"), null);
  assert.equal(performancePeriod("", "2026-11-01"), null);
  assert.equal(performancePeriod("2025-11-01", "2026-11-19"), null);
  assert.ok(performancePeriod("2025-11-20", "2026-11-19"));
  assert.equal(performancePercent(0.6667), "66.7%");
  assert.equal(performancePercent(null), "No data");
  assert.equal(performanceHours(36), "36.0 h");
  assert.equal(performanceHours(52.4), "2.2 days");
  assert.equal(performanceHours(null), "No data");
});
