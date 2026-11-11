import assert from "node:assert/strict";
import test from "node:test";
import { getStockBalances, intakeStock, parseStockBalance } from "../service/backofficeService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";

const skuId = "a1000000-0000-4000-8000-000000000001";
const warehouseId = "a1000000-0000-4000-8000-000000000002";
const otherWarehouse = "a1000000-0000-4000-8000-000000000003";
const balance = { skuId, warehouseId, total: 14, available: 10, reserved: 3, unavailable: 1 };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("admin intake sends the current scoped Bearer and exact allowed body, then returns persisted totals", async () => {
  const calls: { method?: string; path: string; auth: string | null; body: unknown }[] = [];
  let token = "admin-fixture";
  const context: ApiContext = { getAccessToken: () => token, fetch: async (input, init) => {
    calls.push({ method: init?.method, path: new URL(String(input), "http://fixture.test").pathname,
      auth: new Headers(init?.headers).get("Authorization"), body: JSON.parse(String(init?.body)) });
    return Response.json({ code: 0, message: "response success", data: balance }, { status: 201 });
  } };
  const result = await intakeStock({ skuId, quantity: 10, roles: ["ADMIN"], total: 999 } as { skuId: string; quantity: number }, { context });
  token = "rotated-admin-fixture";
  await intakeStock({ skuId, quantity: 10, warehouseId }, { context });
  assert.equal(result.total, 14); assert.equal(result.available, 10);
  assert.deepEqual(calls, [
    { method: "POST", path: "/api/v1/inventory/intake", auth: "Bearer admin-fixture", body: { skuId, quantity: 10 } },
    { method: "POST", path: "/api/v1/inventory/intake", auth: "Bearer rotated-admin-fixture", body: { skuId, quantity: 10, warehouseId } },
  ]);
});

test("intake rejects invalid quantities before sending and preserves forbidden, HTTP status and application error", async () => {
  let requests = 0;
  const context: ApiContext = { fetch: async () => { requests++; return Response.json({ title: "Forbidden", status: 403, code: "INVENTORY_FORBIDDEN", detail: "Only Admin can add stock." }, { status: 403 }); } };
  for (const quantity of [0, -1, 1.5, 2147483648, Number.NaN]) await assert.rejects(intakeStock({ skuId, quantity }, { context }), invalid);
  await assert.rejects(intakeStock({ skuId, quantity: 1, warehouseId: "bad" }, { context }), invalid);
  assert.equal(requests, 0);
  await assert.rejects(intakeStock({ skuId, quantity: 1 }, { context }), (error: unknown) =>
    isApiError(error) && error.status === 403 && error.code === "INVENTORY_FORBIDDEN");
  assert.equal(requests, 1, "non-idempotent intake must not retry automatically");
});

test("balance reads retain SKU scope and assemble multiple warehouses across server pages", async () => {
  const pages: number[] = [];
  const results = await getStockBalances(skuId, undefined, { context: { getAccessToken: () => "admin", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    const page = Number(url.searchParams.get("page")); pages.push(page);
    assert.equal(url.pathname, "/api/v1/inventory/balances");
    assert.equal(url.searchParams.get("skuId"), skuId); assert.equal(url.searchParams.get("size"), "100");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    return Response.json({ code: 0, message: "response success", data: [{ ...balance, warehouseId: page ? otherWarehouse : warehouseId }],
      page: { number: page, size: 100, totalElements: 101, totalPages: 2 } });
  } } });
  assert.deepEqual(pages, [0, 1]); assert.deepEqual(results.map((row) => row.warehouseId), [warehouseId, otherWarehouse]);
});

test("stock parser rejects malformed balances and an intake response for another SKU", async () => {
  for (const value of [{ ...balance, available: -1 }, { ...balance, total: 15 }, { ...balance, reserved: "3" }, { ...balance, warehouseId: "bad" }]) assert.throws(() => parseStockBalance(value), invalid);
  await assert.rejects(intakeStock({ skuId, quantity: 1 }, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...balance, skuId: otherWarehouse } }) } }), invalid);
  await assert.rejects(getStockBalances(skuId, warehouseId, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: [{ ...balance, warehouseId: otherWarehouse }], page: { number: 0, size: 100, totalElements: 1, totalPages: 1 } }) } }), invalid);
});

test("canceling intake preserves AbortError without another write", async () => {
  const controller = new AbortController();
  let started!: () => void;
  const sending = new Promise<void>((resolve) => { started = resolve; });
  const pending = intakeStock({ skuId, quantity: 1 }, { signal: controller.signal, context: { fetch: async (_input, init) => {
    started();
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true }));
  } } });
  await sending; controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
