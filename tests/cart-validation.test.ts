import { test } from "node:test";
import assert from "node:assert/strict";
import { isApiError } from "../configs/api";
import { parseCartValidation, validateCart } from "../service/cartService";
import { cartIssueMessage, isBlockingCartIssue } from "../features/cartUtils";

const itemId = "6f4d3f52-0d8b-4a4f-9a8e-1f2b3c4d5e6f";
const skuId = "0b1c2d3e-4f50-4617-8a9b-c0d1e2f3a4b5";

test("cart validation posts to the delivered route with the account token and reads issues", async () => {
  const calls: Array<{ path: string; method: string; auth: string | null; body: unknown }> = [];
  const result = await validateCart({ context: {
    baseUrl: "https://api.nexus.test",
    getAccessToken: () => "member-token",
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ path: new URL(String(input)).pathname, method: init?.method ?? "GET",
        auth: new Headers(init?.headers).get("Authorization"),
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined });
      return new Response(JSON.stringify({ code: 0, message: "success", data: {
        valid: false, issues: [{ itemId, skuId, code: "PRICE_CHANGED" }, { itemId, skuId, code: "PRODUCT_INACTIVE" }],
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  } });
  assert.deepEqual(calls, [{ path: "/api/v1/carts/me/validate", method: "POST", auth: "Bearer member-token", body: {} }]);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["PRICE_CHANGED", "PRODUCT_INACTIVE"]);
  assert.equal(result.valid, false);
});

test("cart validation rejects unknown codes, missing ids and a valid flag that contradicts the issues", () => {
  assert.deepEqual(parseCartValidation({ valid: true, issues: [] }), { valid: true, issues: [] });
  for (const value of [
    { valid: false, issues: [{ itemId, skuId, code: "SOMETHING_NEW" }] },
    { valid: false, issues: [{ itemId: " ", skuId, code: "OUT_OF_STOCK" }] },
    { valid: true, issues: [{ itemId, skuId, code: "OUT_OF_STOCK" }] },
    { valid: false, issues: [] },
    { issues: [] },
  ]) assert.throws(() => parseCartValidation(value), (error) => isApiError(error));
});

test("inactive, out of stock and own-shop lines block checkout while price and quantity changes only need review", () => {
  const blocking = (code: Parameters<typeof cartIssueMessage>[0]) => isBlockingCartIssue({ itemId, skuId, code });
  assert.deepEqual(["OUT_OF_STOCK", "PRODUCT_INACTIVE", "SELF_PURCHASE"].map((code) => blocking(code as never)), [true, true, true]);
  assert.deepEqual(["PRICE_CHANGED", "QUANTITY_CAPPED"].map((code) => blocking(code as never)), [false, false]);
  assert.match(cartIssueMessage("PRICE_CHANGED"), /current price/);
});
