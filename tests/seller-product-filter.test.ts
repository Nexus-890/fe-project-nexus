import assert from "node:assert/strict";
import test from "node:test";
import { getSellerProductListings, getSellerProducts } from "../service/sellerService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";
import type { SellerProductStatus } from "../types/sellerType";

const product = { id: "product-1", name: "Draft lamp", slug: "draft-lamp", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", minPrice: null, maxPrice: null, images: [] };
const detail = { ...product, description: "Text", auctionEnable: false, skus: [], images: [] };
const listing = (paths: string[]): ApiContext => ({ getAccessToken: () => "fixture-only", fetch: async (input) => {
  const url = new URL(String(input), "http://fixture.test");
  paths.push(url.pathname + url.search);
  if (url.pathname.endsWith("/mine")) return Response.json({ code: 0, message: "response success", data: [product], page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } });
  return Response.json({ code: 0, message: "response success", data: detail });
} });

test("seller product listing sends the status filter only when one is chosen", async () => {
  const paths: string[] = [];
  const context = listing(paths);
  await getSellerProducts(0, "DRAFT", { context });
  await getSellerProducts(3, undefined, { context });
  const result = await getSellerProductListings(0, "DRAFT", { context });
  assert.equal(result.content[0].status, "DRAFT");
  assert.deepEqual(paths, ["/api/v1/products/mine?page=0&size=10&status=DRAFT", "/api/v1/products/mine?page=3&size=10",
    "/api/v1/products/mine?page=0&size=10&status=DRAFT", "/api/v1/products/mine/product-1"]);
});

test("seller product listing rejects an unknown status or page before any request", async () => {
  const paths: string[] = [];
  const context = listing(paths);
  const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
  await assert.rejects(getSellerProducts(0, "SOLD" as SellerProductStatus, { context }), invalid);
  await assert.rejects(getSellerProducts(-1, undefined, { context }), invalid);
  assert.deepEqual(paths, []);
});

test("seller product listing shows the backend's invalid status problem detail", async () => {
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async () => Response.json(
    { type: "urn:problem:invalid-parameter", title: "Invalid parameter", status: 400, code: "INVALID_PARAMETER", detail: "A valid value is required" },
    { status: 400, headers: { "Content-Type": "application/problem+json" } }) };
  await assert.rejects(getSellerProducts(0, "ACTIVE", { context }), (error) => isApiError(error) && error.status === 400 && error.detail === "A valid value is required");
});
