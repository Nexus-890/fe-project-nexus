import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { deleteAdminCategory, getAdminMovements, getAdminWarehouse, getAdminWarehouses, getOwnWarehouse, saveOwnWarehouse, updateAdminCategory, updateAdminWarehouse } from "../service/adminCatalogService";
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
test("seller warehouse reads 404 as not set up yet, saves name and address and keeps its owner", async () => {
  const own = { id, code: "SELLER-68000000000040008000000000000002", name: "District 7", address: null, status: "ACTIVE", sellerId: "68000000-0000-4000-8000-000000000002" };
  const notFound: ApiContext = { fetch: async (input) => {
    assert.equal(new URL(String(input), "http://fixture").pathname, "/api/v1/warehouses/me");
    return Response.json({ title: "Not Found", status: 404, detail: "Warehouse not found", code: "INVENTORY_WAREHOUSE_NOT_FOUND" }, { status: 404 });
  } };
  assert.equal(await getOwnWarehouse({ context: notFound }), null);
  await assert.rejects(getOwnWarehouse({ context: { fetch: async () => Response.json({ title: "Forbidden", status: 403, code: "FORBIDDEN" }, { status: 403 }) } }), (error: unknown) => isApiError(error) && error.status === 403);
  const context: ApiContext = { getAccessToken: () => "seller", fetch: async (_input, init) => {
    assert.equal(init?.method, "PUT");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer seller");
    assert.deepEqual(JSON.parse(String(init?.body)), { name: "District 7", address: null });
    return Response.json(envelope(own));
  } };
  assert.equal((await saveOwnWarehouse({ name: "District 7", address: null }, { context })).sellerId, own.sellerId);
  const pickup = { ...own, address: "12 Kim Ma", provinceCode: "201", wardCode: "20309" };
  const withPickup: ApiContext = { fetch: async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { name: "District 7", address: "12 Kim Ma", provinceCode: "201", wardCode: "20309" });
    return Response.json(envelope(pickup));
  } };
  const saved = await saveOwnWarehouse({ name: "District 7", address: "12 Kim Ma", provinceCode: "201", wardCode: "20309" }, { context: withPickup });
  assert.equal(saved.provinceCode, "201");
  assert.equal(saved.wardCode, "20309");
  assert.equal((await getOwnWarehouse({ context: { fetch: async () => Response.json(envelope(own)) } }))?.provinceCode, null);
  for (const broken of [{ ...pickup, wardCode: null }, { ...pickup, provinceCode: "20A" }, { ...pickup, wardCode: 20309 }])
    await assert.rejects(getOwnWarehouse({ context: { fetch: async () => Response.json(envelope(broken)) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  assert.equal((await getAdminWarehouses({ context: { fetch: async () => Response.json(envelope([{ ...own, sellerId: undefined }])) } }))[0].sellerId, null);
  await assert.rejects(getAdminWarehouses({ context: { fetch: async () => Response.json(envelope([{ ...own, sellerId: "seller" }])) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
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
  const transfer = await getAdminMovements(id, undefined, 0, { context: { fetch: async () => Response.json({ ...envelope([{ ...movement, movementType: "TRANSFER", quantity: 17, reason: null }]), page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } }) } });
  assert.equal(transfer.content[0].movementType, "TRANSFER");
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
test("config contract preserves backend type errors and encodes setting keys", async () => {
  const context: ApiContext = { getAccessToken: () => "admin", fetch: async (input, init) => {
    assert.ok(String(input).includes("AUCTION%2FMIN"));
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    assert.deepEqual(JSON.parse(String(init?.body)), { value: "wrong-type" });
    return Response.json({ title: "Wrong type", status: 400, detail: "Expected number" }, { status: 400 });
  } };
  await assert.rejects(updateSystemConfig("AUCTION/MIN", "wrong-type", { context }), (error: unknown) => isApiError(error) && error.status === 400 && error.detail === "Expected number");
  await assert.rejects(getSystemConfigs({ context: { fetch: async () => Response.json({ ...envelope([{ key: "X", value: 1, defaultValue: 1, description: "", service: "auction-service", applyMode: "CONFIG_SOURCE", configuredValue: 1 }]), page: { number: 1, size: 10, totalElements: 1, totalPages: 1 } }) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});
test("config GET parses the delivered service/applyMode/configuredValue row and PUT parses its short response", async () => {
  const context: ApiContext = { getAccessToken: () => "admin", fetch: async (_input, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin");
    const method = init?.method ?? "GET";
    if (method === "GET") return Response.json({ ...envelope([{ key: "NOTIFICATION_RETRY_LIMIT", value: 3, defaultValue: 3, description: "Retry attempts", service: "notification-service", applyMode: "RUNTIME", configuredValue: 3 }]), page: { number: 0, size: 57, totalElements: 57, totalPages: 1 } });
    return Response.json(envelope({ key: "NOTIFICATION_RETRY_LIMIT", value: 4 }));
  } };
  const rows = await getSystemConfigs({ context });
  assert.equal(rows[0].service, "notification-service");
  assert.equal(rows[0].applyMode, "RUNTIME");
  assert.equal(rows[0].configuredValue, 3);
  const updated = await updateSystemConfig("NOTIFICATION_RETRY_LIMIT", 4, { context });
  assert.deepEqual(updated, { key: "NOTIFICATION_RETRY_LIMIT", value: 4 });
});
test("config GET accepts nullable effective values, zero, false and distinct configured values", async () => {
  const rows = [
    { key: "MAX_LOGIN_ATTEMPTS", value: 0, defaultValue: 5, configuredValue: 5, service: "user-service", applyMode: "KEYCLOAK_MANAGED", description: "Realm value" },
    { key: "ALLOW_GUEST_CART", value: false, defaultValue: true, configuredValue: false, service: "commerce-service", applyMode: "CONFIG_SOURCE", description: "Guest carts" },
    { key: "NULL_EFFECTIVE", value: null, defaultValue: null, configuredValue: "source", service: "application", applyMode: "RUNTIME", description: "Nullable scalar" },
  ];
  assert.deepEqual(await getSystemConfigs({ context: { fetch: async () => Response.json({ ...envelope(rows), page: { number: 0, size: 3, totalElements: 3, totalPages: 1 } }) } }), rows);
});
test("config parsers reject obsolete proposals, malformed metadata and mismatched PUT keys", async () => {
  const row = { key: "NOTIFICATION_RETRY_LIMIT", value: 3, defaultValue: 3, configuredValue: 3, service: "notification-service", applyMode: "RUNTIME", description: "Retry attempts" };
  const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
  for (const data of [
    [{ key: row.key, value: 3, defaultValue: 3, description: "Retry attempts", group: "Notification" }],
    [{ ...row, applyMode: "UNKNOWN" }], [{ ...row, configuredValue: null }], [{ ...row, value: {} }], [row, row],
  ]) await assert.rejects(getSystemConfigs({ context: { fetch: async () => Response.json({ ...envelope(data), page: { number: 0, size: data.length, totalElements: data.length, totalPages: 1 } }) } }), invalid);
  for (const data of [{ key: "OTHER", value: 4 }, { key: row.key }, { key: row.key, value: {} }])
    await assert.rejects(updateSystemConfig(row.key, 4, { context: { fetch: async () => Response.json(envelope(data)) } }), invalid);
});
test("parent choices retain ancestry so descendants can never become parents", () => {
  const rows = flattenAdminCategories([{ id, name: "Root", slug: "root", parentId: null, level: 1, children: [{ id: "child", name: "Child", slug: "child", parentId: id, level: 2, children: [] }] }]);
  assert.deepEqual(rows[1].ancestors, [id]); assert.equal(rows[1].depth, 1);
});
