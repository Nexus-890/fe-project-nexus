import assert from "node:assert/strict";
import test from "node:test";
import { deleteSellerProduct, reorderSellerImages, updateSellerProduct } from "../service/sellerService";
import { isApiError } from "../configs/api";
import type { ApiContext } from "../types/commonRequestType";

type Call = { method: string; path: string; auth: string | null; body: unknown };
const product = { id: "product-1", name: "Edited lamp", slug: "edited-lamp", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", minPrice: null, maxPrice: null, images: [] };
const images = [{ id: "image-2", imageUrl: "https://images.example.test/2.jpg", sortOrder: 0 }, { id: "image-1", imageUrl: "https://images.example.test/1.jpg", sortOrder: 1 }];
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const fixture = (respond: (call: Call) => Response) => {
  const calls: Call[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    const call = { method: init?.method ?? "GET", path: new URL(String(input), "http://fixture.test").pathname,
      auth: new Headers(init?.headers).get("Authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    return respond(call);
  } };
  return { calls, context };
};
const problem = (status: number, code: string, detail: string) =>
  Response.json({ type: "urn:problem:domain-error", title: "Request rejected", status, code, detail }, { status, headers: { "Content-Type": "application/problem+json" } });

test("product edit sends the exact protected PUT body and rejects a response for another product", async () => {
  const body = { name: "Edited lamp", description: "Dimmable", categoryId: "category-1", auctionEnable: false };
  const { calls, context } = fixture(() => Response.json({ code: 0, message: "response success", data: product }));
  const saved = await updateSellerProduct("product-1", body, { context });
  assert.equal(saved.name, "Edited lamp");
  assert.deepEqual(calls, [{ method: "PUT", path: "/api/v1/products/product-1", auth: "Bearer fixture-only", body }]);
  const other = fixture(() => Response.json({ code: 0, message: "response success", data: { ...product, id: "product-2" } }));
  await assert.rejects(updateSellerProduct("product-1", body, { context: other.context }), invalid);
  await assert.rejects(updateSellerProduct(" ", body, { context: other.context }), invalid);
  assert.equal(other.calls.length, 1);
});

test("product delete accepts the bodyless 204 and keeps the backend's 409 detail", async () => {
  const { calls, context } = fixture(() => new Response(null, { status: 204 }));
  assert.equal(await deleteSellerProduct("product 1", { context }), undefined);
  assert.deepEqual(calls, [{ method: "DELETE", path: "/api/v1/products/product%201", auth: "Bearer fixture-only", body: undefined }]);
  const conflict = fixture(() => problem(409, "CATALOG_PRODUCT_HAS_ORDERS", "Cannot delete a product that has orders"));
  await assert.rejects(deleteSellerProduct("product-1", { context: conflict.context }), (error: unknown) =>
    isApiError(error) && error.kind === "http" && error.status === 409 && error.code === "CATALOG_PRODUCT_HAS_ORDERS" && error.detail === "Cannot delete a product that has orders");
});

test("image reorder sends every image id in the new order and rejects a mismatched or invalid order", async () => {
  const { calls, context } = fixture(() => Response.json({ code: 0, message: "response success", data: images, page: { number: 0, size: 2, totalElements: 2, totalPages: 1 } }));
  assert.deepEqual(await reorderSellerImages("product-1", ["image-2", "image-1"], { context }), images);
  assert.deepEqual(calls, [{ method: "PUT", path: "/api/v1/products/product-1/images/order", auth: "Bearer fixture-only", body: { imageIds: ["image-2", "image-1"] } }]);
  const swapped = fixture(() => Response.json({ code: 0, message: "response success", data: [...images].reverse() }));
  await assert.rejects(reorderSellerImages("product-1", ["image-2", "image-1"], { context: swapped.context }), invalid);
  const stale = fixture(() => Response.json({ code: 0, message: "response success", data: images.map((image) => ({ ...image, sortOrder: 7 })) }));
  await assert.rejects(reorderSellerImages("product-1", ["image-2", "image-1"], { context: stale.context }), invalid);
  const unsent = fixture(() => Response.json({}));
  await assert.rejects(reorderSellerImages("product-1", ["image-1", "image-1"], { context: unsent.context }), invalid);
  await assert.rejects(reorderSellerImages("product-1", ["image-1", " "], { context: unsent.context }), invalid);
  assert.equal(unsent.calls.length, 0);
});

test("image reorder keeps the backend's 400 detail", async () => {
  const { context } = fixture(() => problem(400, "CATALOG_IMAGE_ORDER_INVALID", "imageIds must contain exactly the product's image IDs without duplicates"));
  await assert.rejects(reorderSellerImages("product-1", ["image-1"], { context }), (error: unknown) =>
    isApiError(error) && error.status === 400 && error.code === "CATALOG_IMAGE_ORDER_INVALID");
});
