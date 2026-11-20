import assert from "node:assert/strict";
import { test } from "node:test";
import { getDiscoveryProducts, parseDiscoveryProducts } from "../service/catalogService";
import type { ApiContext } from "../types/commonRequestType";

const product = (id: string) => ({ id, name: `Product ${id}`, slug: `product-${id}`, minPrice: 150000, maxPrice: 175000, images: [] });

test("discovery parses a short unpaged list and rejects oversized, duplicate or malformed lists", () => {
  assert.deepEqual(parseDiscoveryProducts([product("a"), product("b")]).map((item) => [item.id, item.minPrice]), [["a", "150000.00"], ["b", "150000.00"]]);
  assert.deepEqual(parseDiscoveryProducts([]), []);
  assert.throws(() => parseDiscoveryProducts(Array.from({ length: 25 }, (_, index) => product(String(index)))));
  assert.throws(() => parseDiscoveryProducts([product("a"), product("a")]));
  assert.throws(() => parseDiscoveryProducts([{ id: "a" }]));
  assert.throws(() => parseDiscoveryProducts({ content: [] }));
});

test("discovery calls the public endpoint with type and size and never sends the access token", async () => {
  const calls: Array<{ path: string; auth: string | null }> = [];
  const context: ApiContext = {
    getAccessToken: () => "must-not-leak",
    fetch: async (input, init) => {
      const url = new URL(String(input), "http://mock.local");
      calls.push({ path: url.pathname + url.search, auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ code: 0, message: "response success", data: [product(url.searchParams.get("type") ?? "")] }));
    },
  };
  assert.equal((await getDiscoveryProducts("popular", 6, { context }))[0].id, "popular");
  assert.equal((await getDiscoveryProducts("new", 24, { context }))[0].id, "new");
  await assert.rejects(getDiscoveryProducts("new", 25, { context }));
  await assert.rejects(getDiscoveryProducts("new", 0, { context }));
  assert.deepEqual(calls, [
    { path: "/api/v1/products/discovery?type=popular&size=6", auth: null },
    { path: "/api/v1/products/discovery?type=new&size=24", auth: null },
  ]);
});
