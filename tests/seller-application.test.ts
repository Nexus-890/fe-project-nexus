import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { parseSellerApplication, SELLER_APPLICATION_PATH, submitSellerApplication } from "../service/sellerApplicationService";
import { sellerApplicationSchema } from "../features/sellerApplicationSchema";
import type { SellerApplicationInput } from "../types/sellerApplicationType";

const input: SellerApplicationInput = { companyName: "Nexus Books", phone: "0901234567", note: "Pre-loved books for everyone." };
const acknowledgement = { id: "seller-1", status: "PENDING" };
const envelope = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data }));

test("seller issue model accepts PENDING, ACTIVE and REJECTED without invented timestamps", () => {
  for (const status of ["PENDING", "ACTIVE", "REJECTED"]) {
    assert.deepEqual(parseSellerApplication({ ...acknowledgement, status, reason: status === "REJECTED" ? "Please clarify your business." : null }, input), {
      ...input, id: acknowledgement.id, status, rejectionReason: status === "REJECTED" ? "Please clarify your business." : null,
    });
  }
  for (const invalid of [null, {}, [], { ...acknowledgement, status: "APPROVED" }, { ...acknowledgement, status: "UNKNOWN" }, { ...acknowledgement, reason: 123 }]) {
    assert.throws(() => parseSellerApplication(invalid, input), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
});

test("seller buyer submits exactly the issue POST body with current Bearer and never reads the admin list", async () => {
  let token = "first-token";
  const calls: { method?: string; body: unknown; bearer: string | null }[] = [];
  const context = {
    getAccessToken: () => token,
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(url), "/api/v1/sellers/applications");
      assert.equal(SELLER_APPLICATION_PATH, "/api/v1/sellers/applications");
      assert.equal(init?.method, "POST", "buyers must not request the admin-only GET list");
      calls.push({ method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, bearer: new Headers(init?.headers).get("Authorization") });
      return envelope(acknowledgement);
    },
  };
  await submitSellerApplication(input, { context });
  token = "rotated-token";
  const updated = await submitSellerApplication({ companyName: " Nexus Books ", phone: "(090) 123-4567", note: " Pre-loved books for everyone. ", ...{ status: "ACTIVE", roles: ["SELLER"], shopName: "ignored" } }, { context });
  assert.deepEqual(calls, [
    { method: "POST", body: input, bearer: "Bearer first-token" },
    { method: "POST", body: input, bearer: "Bearer rotated-token" },
  ]);
  assert.deepEqual(updated, { ...input, ...acknowledgement, rejectionReason: null });
});

test("seller missing endpoint, authorization denial and defined duplicate codes remain errors", async () => {
  for (const [status, code] of [[403, "FORBIDDEN"], [404, "NOT_FOUND"], [409, "SELLER_APPLICATION_EXISTS"], [409, "SELLER_APPLICATION_NOT_PENDING"]] as const) {
    await assert.rejects(submitSellerApplication(input, { context: { fetch: async () => new Response(JSON.stringify({ title: "Rejected", status, code }), { status }) } }),
      (error: unknown) => isApiError(error) && error.status === status && error.code === code);
  }
});

test("seller submission forwards cancellation and rejects missing or malformed acknowledgements", async () => {
  const controller = new AbortController();
  await assert.rejects(submitSellerApplication(input, {
    signal: controller.signal,
    context: { fetch: async (_url, init) => {
      assert.equal(init?.signal?.aborted, false);
      controller.abort();
      assert.equal(init?.signal?.aborted, true);
      return envelope(acknowledgement);
    } },
  }), { name: "AbortError" });
  for (const data of [acknowledgement, { code: 0, message: "response success", data: null }, { code: 0, message: "response success", data: { id: "seller-1" } }]) {
    await assert.rejects(submitSellerApplication(input, { context: { fetch: async () => new Response(JSON.stringify(data)) } }),
      (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
});

test("seller form requires a valid contact phone and normalizes submitted fields", () => {
  for (const invalid of [
    { ...input, companyName: " " }, { ...input, phone: "" }, { ...input, phone: "letters" },
    { ...input, phone: "123456" }, { ...input, phone: "1".repeat(16) },
    { ...input, note: "A".repeat(1001) },
  ]) assert.equal(sellerApplicationSchema.safeParse(invalid).success, false);
  assert.deepEqual(sellerApplicationSchema.parse({ companyName: " Nexus Books ", phone: "(090) 123-4567", note: " Pre-loved books for everyone. " }), input);
});
