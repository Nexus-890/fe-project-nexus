import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePage, findCategory } from "../lib/catalog-model";
import { isCategoryTree, isProductPage } from "../lib/catalog-validation";
import { categoryHref } from "../lib/catalog-url";
import { createCatalogService } from "../service/catalog";
import type { ApiClient } from "../types/api/type";
import type { ApiResult } from "../types/common/response/type";

const categoryFixture = [{
  id: "1", name: "Điện tử", slug: "dien-tu", level: 1, parentId: null,
  children: [{
    id: "4", name: "Âm thanh", slug: "am-thanh", level: 2, parentId: "1",
    children: [{ id: "5", name: "Tai nghe", slug: "tai-nghe", level: 3, parentId: "4", children: [] }],
  }],
}];

function fixtureClient(values: Record<string, unknown>): { client: ApiClient; calls: Array<{ path: string; options?: unknown }> } {
  const calls: Array<{ path: string; options?: unknown }> = [];
  return {
    calls,
    client: {
      get: async <T>(path: string, options?: unknown): Promise<ApiResult<T>> => {
        calls.push({ path, options });
        return { ok: true, data: values[path] as T };
      },
      post: async () => ({ ok: false, error: { kind: "network", status: 0, title: "unused" } }),
      put: async () => ({ ok: false, error: { kind: "network", status: 0, title: "unused" } }),
      delete: async () => ({ ok: false, error: { kind: "network", status: 0, title: "unused" } }),
    },
  } as { client: ApiClient; calls: Array<{ path: string; options?: unknown }> };
}

test("page validation prevents invalid API offsets", () => {
  for (const input of [undefined, ["2", "3"], "0", "-1", "1.5", "1e2", "NaN", "99999999999999999999", "2147483648"]) {
    assert.equal(parsePage(input), 1);
  }
  assert.equal(parsePage("2"), 2);
});
test("slug resolution searches nested categories and encodes path segments", () => {
  const leaf = { id: "2", name: "Audio", slug: "audio", level: 2, parentId: "1", children: [] };
  assert.equal(findCategory([{ id: "1", name: "Electronics", slug: "electronics", level: 1, parentId: null, children: [leaf] }], "audio"), leaf);
  assert.equal(findCategory([{ id: "1", name: "Electronics", slug: "electronics", level: 1, parentId: null, children: [leaf] }], "1")?.slug, "electronics");
  assert.equal(findCategory([], "missing"), undefined);
  assert.equal(categoryHref("audio/video"), "/categories/audio%2Fvideo");
});
test("wire validation rejects malformed data before render", () => {
  assert.equal(isCategoryTree([]), true);
  assert.equal(isCategoryTree([{ id: "bad" }]), false);
  assert.equal(isProductPage({ content: [], page: 0, size: 12, totalElements: 0 }), true);
  assert.equal(isProductPage({ content: [], page: 0, size: 0, totalElements: 0 }), false);
  assert.equal(isProductPage({ content: [{}], page: 0, size: 12, totalElements: 1 }), false);
});

test("backend catalog service keeps endpoint and query parameters unchanged", async () => {
  const fixture = fixtureClient({
    "/api/v1/categories/tree": categoryFixture,
    "/api/v1/products": { content: [], page: 1, size: 12, totalElements: 0 },
  });
  const service = createCatalogService({ client: fixture.client });
  const categories = await service.getCategoryTree();
  assert.equal(categories.ok, true);
  const result = await service.getProducts({ categoryId: "5", page: 1, size: 12 });
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.calls, [
    { path: "/api/v1/categories/tree", options: { signal: undefined, auth: false } },
    { path: "/api/v1/products", options: { params: { categoryId: "5", page: 1, size: 12 }, signal: undefined, auth: false } },
  ]);
});
