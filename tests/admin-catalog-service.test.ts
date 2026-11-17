import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { deleteAdminCategory, getAdminMovements, getAdminWarehouse, getAdminWarehouses, updateAdminCategory, updateAdminWarehouse } from "../service/adminCatalogService";
import { getSystemConfigs, updateSystemConfig } from "../service/adminConfigService";
import { flattenAdminCategories } from "../features/adminCategoryUtils";
import type { ApiContext } from "../types/commonRequestType";

const id = "a2280000-0000-4000-8000-000000000001";
const category = { id, name: "Audio", slug: "audio", parentId: null, description: "Speakers", level: 1, path: "/audio/" };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
test("category PATCH distinguishes omitted fields from explicit root and description clearing", async () => {
  const bodies: unknown[] = [];
  const context: ApiContext = { getAccessToken: () => "admin", fetch: async (input, init) => {
    assert.equal(new URL(String(input), "http://fixture").pathname, `/api/v1/categories/${id}`);
    assert.equal(init?.method, "PATCH");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json(envelope(category));
  } };
  await updateAdminCategory(id, { name: "Audio" }, { context });
  await updateAdminCategory(id, { parentId: null, description: null }, { context });
  assert.deepEqual(bodies, [{ name: "Audio" }, { parentId: null, description: null }]);
});
test("category delete accepts empty 204 and retains actionable 409 and 400 backend details", async () => {
  await deleteAdminCategory(id, { context: { fetch: async () => new Response(null, { status: 204 }) } });
  for (const [status, detail] of [[409, "Category has products"], [409, "Category has children"], [400, "Invalid category move"]] as const) {
    const context: ApiContext = { fetch: async () => Response.json({ title: "Rejected", status, detail }, { status }) };
    await assert.rejects(deleteAdminCategory(id, { context }), (error: unknown) => isApiError(error) && error.status === status && error.detail === detail);
  }
});
test("warehouse updates send PUT without immutable code and validate server status", async () => {
  const warehouse = { id, code: "WH_HCM", name: "HCM", address: null, status: "MAINTENANCE" as const };
  const context: ApiContext = { fetch: async (_input, init) => {
    assert.equal(init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(init?.body)), { name: "HCM", address: null, status: "MAINTENANCE" });
    return Response.json(envelope(warehouse));
  } };
  assert.equal((await updateAdminWarehouse(id, warehouse, { context })).code, "WH_HCM");
  await assert.rejects(getAdminWarehouses({ context: { fetch: async () => Response.json(envelope([{ ...warehouse, status: "UNKNOWN" }])) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("ledger keeps page, SKU and warehouse filters and allows signed historical adjustments", async () => {
  const movement = { id, skuId: id, warehouseId: id, movementType: "ADJUSTMENT", quantity: -2, referenceId: null, reason: "Damaged", createdAt: "2026-11-17T01:00:00Z" };
  const context: ApiContext = { fetch: async (input) => {
    const url = new URL(String(input), "http://fixture");
    assert.equal(url.searchParams.get("skuId"), id); assert.equal(url.searchParams.get("warehouseId"), id); assert.equal(url.searchParams.get("page"), "1");
    return Response.json({ ...envelope([movement]), page: { number: 1, size: 10, totalElements: 11, totalPages: 2 } });
  } };
  const page = await getAdminMovements(id, id, 1, { context });
  assert.equal(page.content[0].quantity, -2); assert.equal(page.totalPages, 2);
  await assert.rejects(getAdminMovements(id, undefined, 0, { context: { fetch: async () => Response.json({ ...envelope([{ ...movement, skuId: "a2280000-0000-4000-8000-000000000002" }]), page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } }) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("warehouse detail uses the authenticated WH-03 read and rejects a mismatched reference", async () => {
  const context: ApiContext = { getAccessToken: () => "admin", fetch: async (input, init) => {
    assert.equal(new URL(String(input), "http://fixture").pathname, `/api/v1/warehouses/${id}`);
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    return Response.json(envelope({ id: "a2280000-0000-4000-8000-000000000002", code: "WH_OTHER", name: "Other", address: null, status: "ACTIVE" }));
  } };
  await assert.rejects(getAdminWarehouse(id, { context }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("pending config contract preserves backend type errors and encodes setting keys", async () => {
  const context: ApiContext = { getAccessToken: () => "admin", fetch: async (input, init) => {
    assert.ok(String(input).includes("AUCTION%2FMIN"));
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    assert.deepEqual(JSON.parse(String(init?.body)), { value: "wrong-type" });
    return Response.json({ title: "Wrong type", status: 400, detail: "Expected number" }, { status: 400 });
  } };
  await assert.rejects(updateSystemConfig("AUCTION/MIN", "wrong-type", { context }), (error: unknown) => isApiError(error) && error.status === 400 && error.detail === "Expected number");
  await assert.rejects(getSystemConfigs({ context: { fetch: async () => Response.json(envelope([{ key: "X", value: {}, defaultValue: 1, description: "", group: "" }])) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("parent choices retain ancestry so descendants can never become parents", () => {
  const rows = flattenAdminCategories([{ id, name: "Root", slug: "root", parentId: null, level: 1, children: [{ id: "child", name: "Child", slug: "child", parentId: id, level: 2, children: [] }] }]);
  assert.deepEqual(rows[1].ancestors, [id]); assert.equal(rows[1].depth, 1);
});
