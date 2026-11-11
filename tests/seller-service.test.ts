import assert from "node:assert/strict";
import test from "node:test";
import { getSellerProducts, getSellerStock, parseSellerAuction, parseSellerStock, saveSellerProduct, saveSellerSku, scheduleSellerAuction } from "../service/sellerService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";

const product = { id: "product-1", name: "Sample", slug: "sample", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", minPrice: null, images: [] };
const auction = { id: "auction-1", productId: "product-1", skuId: "sku-1", sellerId: "seller-1", title: "Sample auction", imageUrl: null, startingPrice: 120000, currentPrice: 120000, bidIncrement: 10000, bidCount: 0, currency: "VND", startAt: "2026-11-12T00:00:00Z", endAt: "2026-11-15T00:00:00Z", originalEndAt: "2026-11-15T00:00:00Z", extensionCount: 0, status: "SCHEDULED" };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("seller endpoints preserve real private auth, paging, body and schedule method", async () => {
  const requests: { path: string; method: string; auth: string | null; body: unknown }[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    requests.push({ path: url.pathname + url.search, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("Authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = url.pathname.includes("schedule") ? auction : url.pathname.endsWith("mine") ? [product] : product;
    return Response.json({ code: 0, message: "response success", data, ...(Array.isArray(data) ? { page: { number: 2, size: 10, totalElements: 21, totalPages: 3 } } : {}) }, { status: init?.method === "POST" && !url.pathname.includes("schedule") ? 201 : 200 });
  } };
  const list = await getSellerProducts(2, { context });
  assert.equal(list.page, 2); assert.equal(list.content[0].minPrice, null);
  await saveSellerProduct(null, { name: "Sample", description: "Text", categoryId: "category-1", auctionEnable: true }, { context });
  const scheduled = await scheduleSellerAuction("auction-1", { context });
  assert.equal(scheduled.currentPrice, "120000.00");
  assert.equal(requests[0].path, "/api/v1/products/mine?page=2&size=10");
  assert.ok(requests.every((request) => request.auth === "Bearer fixture-only"));
  assert.deepEqual(requests[1].body, { name: "Sample", description: "Text", categoryId: "category-1", auctionEnable: true });
  assert.equal(requests[2].method, "POST"); assert.equal(requests[2].path, "/api/v1/auctions/auction-1/schedule");
});

test("stock parser rejects missing, duplicate, negative and invented SKU balances", () => {
  assert.deepEqual(parseSellerStock([{ skuId: "sku-1", available: 3 }], ["sku-1"]), [{ skuId: "sku-1", available: 3 }]);
  for (const data of [[], [{ skuId: "sku-2", available: 3 }], [{ skuId: "sku-1", available: -1 }], [{ skuId: "sku-1", available: "3" }]]) assert.throws(() => parseSellerStock(data, ["sku-1"]), invalid);
  assert.throws(() => parseSellerStock([{ skuId: "sku-1", available: 3 }, { skuId: "sku-1", available: 2 }], ["sku-1", "sku-2"]), invalid);
});

test("stock read serializes comma separated skuIds without a Bearer token", async () => {
  let observed = "";
  await getSellerStock(["sku-1", "sku-2"], { context: { getAccessToken: () => "must-not-send", fetch: async (input, init) => {
    observed = String(input); assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return Response.json({ code: 0, message: "response success", data: [{ skuId: "sku-1", available: 3 }, { skuId: "sku-2", available: 0 }], page: { number: 0, size: 2, totalElements: 2, totalPages: 1 } });
  } } });
  assert.equal(new URL(observed, "http://fixture.test").searchParams.get("skuIds"), "sku-1,sku-2");
});

test("auction parser keeps numeric wire money distinct and rejects malformed data", () => {
  assert.equal(parseSellerAuction(auction).startingPrice, "120000.00");
  assert.throws(() => parseSellerAuction({ ...auction, currentPrice: "120000" }), invalid);
  assert.throws(() => parseSellerAuction({ ...auction, status: "PAID" }), invalid);
  assert.throws(() => parseSellerAuction({ ...auction, startAt: "invalid" }), invalid);
  assert.throws(() => parseSellerAuction({ ...auction, bidCount: -1 }), invalid);
});

test("SKU writes omit legacy code fields and retain the server code when updating the persisted SKU", async () => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const serverCode = "SKU-11111111111141118111111111111111-01";
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    calls.push({ method: init?.method ?? "GET", path: new URL(String(input), "http://fixture.test").pathname, body: JSON.parse(String(init?.body)) });
    return Response.json({ code: 0, message: "response success", data: { id: "persisted-sku", productId: "product-1", skuCode: serverCode, color: "Silver", size: "Standard", price: 100000, status: "ACTIVE" } }, { status: init?.method === "POST" ? 201 : 200 });
  } };
  // An old caller can still carry this extra runtime property; it is not wire data.
  const body = { skuCode: "CLIENT-MUST-NOT-CHOOSE", color: "Silver", size: "Standard", price: 100000 };
  const saved = await saveSellerSku("product-1", null, body, { context });
  assert.equal(saved.id, "persisted-sku"); assert.equal(saved.price, "100000.00"); assert.equal(saved.skuCode, serverCode);
  const updated = await saveSellerSku(saved.productId, saved.id, body, { context });
  assert.equal(updated.skuCode, serverCode);
  const payload = { color: "Silver", size: "Standard", price: 100000 };
  assert.deepEqual(calls, [{ method: "POST", path: "/api/v1/products/product-1/skus", body: payload }, { method: "PUT", path: "/api/v1/skus/persisted-sku", body: payload }]);
});

test("stock reads batch 101 unique variants into two public requests and restore input order", async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `sku-${index}`);
  const sizes: number[] = [];
  const controller = new AbortController();
  const result = await getSellerStock([...ids, ids[0]], { signal: controller.signal, context: {
    getAccessToken: () => "must-not-send",
    fetch: async (input, init) => {
      const batch = new URL(String(input), "http://fixture.test").searchParams.get("skuIds")!.split(",");
      sizes.push(batch.length);
      assert.equal(new Headers(init?.headers).get("Authorization"), null);
      assert.ok(init?.signal); assert.equal(init.signal.aborted, false);
      return Response.json({ code: 0, message: "response success", data: [...batch].reverse().map((skuId) => ({ skuId, available: 4 })), page: { number: 0, size: batch.length, totalElements: batch.length, totalPages: 1 } });
    },
  } });
  assert.deepEqual(sizes, [100, 1]);
  assert.deepEqual(result.map((stock) => stock.skuId), ids);
});

test("aborting a batched inventory read aborts every in-flight request", async () => {
  const controller = new AbortController();
  let count = 0;
  let aborted = 0;
  let started!: () => void;
  const allStarted = new Promise<void>((resolve) => { started = resolve; });
  const pending = getSellerStock(Array.from({ length: 101 }, (_, index) => `sku-${index}`), { signal: controller.signal, context: {
    fetch: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      assert.ok(init?.signal); assert.equal(init.signal.aborted, false);
      init?.signal?.addEventListener("abort", () => { aborted += 1; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
      count += 1;
      if (count === 2) started();
    }),
  } });
  await allStarted;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(count, 2);
  assert.equal(aborted, 2);
});
