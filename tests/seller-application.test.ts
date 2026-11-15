import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { getSellerApplication, parseSellerApplication, SELLER_APPLICATION_PATH, submitSellerApplication } from "../service/sellerApplicationService";
import { sellerApplicationSchema } from "../features/sellerApplicationSchema";
import type { SellerApplicationInput } from "../types/sellerApplicationType";

const input: SellerApplicationInput = { companyName: "Nexus Books", phone: "0901234567", note: "Pre-loved books for everyone." };
const pending = { id: "seller-1", ...input, status: "PENDING", reason: null };
const envelope = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data }));
const invalidResponse = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("seller own read sends the proposed private GET with current Bearer and no admin-list filters", async () => {
  let token = "first-token";
  const calls: { method?: string; body: unknown; bearer: string | null }[] = [];
  const context = {
    getAccessToken: () => token,
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(url), "/api/v1/sellers/applications/me");
      calls.push({ method: init?.method, body: init?.body, bearer: new Headers(init?.headers).get("Authorization") });
      return envelope(pending);
    },
  };
  const first = await getSellerApplication({ context });
  token = "rotated-token";
  const second = await getSellerApplication({ context });
  assert.deepEqual(first, { id: pending.id, ...input, status: "PENDING", rejectionReason: null });
  assert.deepEqual(second, first);
  assert.deepEqual(calls, [
    { method: "GET", body: undefined, bearer: "Bearer first-token" },
    { method: "GET", body: undefined, bearer: "Bearer rotated-token" },
  ]);
});

test("seller own read distinguishes no application from missing route, forbidden access and malformed data", async () => {
  assert.equal(await getSellerApplication({ context: { fetch: async () => envelope(null) } }), null);
  for (const status of [401, 403, 404, 503]) {
    await assert.rejects(getSellerApplication({ context: { fetch: async () => new Response(JSON.stringify({ title: "Read failed", status }), { status }) } }),
      (error: unknown) => isApiError(error) && error.status === status);
  }
  for (const response of [pending, { code: 0, message: "response success", data: { id: pending.id, status: "PENDING" } }]) {
    await assert.rejects(getSellerApplication({ context: { fetch: async () => new Response(JSON.stringify(response)) } }), invalidResponse);
  }
});

test("seller parses the full server-owned status and rejected reason without timestamps or submitted fallback", () => {
  for (const status of ["PENDING", "ACTIVE", "REJECTED"]) {
    const reason = status === "REJECTED" ? "Please clarify your business." : null;
    assert.deepEqual(parseSellerApplication({ ...pending, status, reason }), {
      ...input, id: pending.id, status, rejectionReason: reason,
    });
  }
  for (const invalid of [
    null, {}, [], { id: pending.id, status: "PENDING" },
    { ...pending, companyName: undefined }, { ...pending, companyName: " " },
    { ...pending, phone: undefined }, { ...pending, phone: "letters" },
    { ...pending, note: undefined }, { ...pending, status: "APPROVED" },
    { ...pending, status: "UNKNOWN" }, { ...pending, reason: undefined },
    { ...pending, reason: 123 }, { ...pending, status: "REJECTED", reason: null },
    { ...pending, status: "REJECTED", reason: " " },
  ]) assert.throws(() => parseSellerApplication(invalid), invalidResponse);
});

test("a fresh seller read observes persisted rejection after the response changes", async () => {
  let current: { id: string; companyName: string; phone: string; note: string; status: string; reason: string | null } = pending;
  const context = { getAccessToken: () => "same-account-token", fetch: async () => envelope(current) };
  assert.equal((await getSellerApplication({ context }))?.status, "PENDING");
  current = { ...pending, status: "REJECTED", reason: "More detail about your products is needed." };
  const rejected = await getSellerApplication({ context });
  assert.equal(rejected?.status, "REJECTED");
  assert.equal(rejected?.rejectionReason, "More detail about your products is needed.");
});

test("seller POST allowlists exact issue input but renders the complete returned application", async () => {
  const canonical = { ...pending, companyName: "Server canonical name", note: "Server canonical note" };
  const calls: { method?: string; body: unknown; bearer: string | null }[] = [];
  const result = await submitSellerApplication({ companyName: " Nexus Books ", phone: "(090) 123-4567", note: " Pre-loved books for everyone. ", ...{ status: "ACTIVE", roles: ["SELLER"], reason: "ignored", id: "ignored" } }, {
    context: {
      getAccessToken: () => "current-token",
      fetch: async (url, init) => {
        assert.equal(SELLER_APPLICATION_PATH, "/api/v1/sellers/applications");
        assert.equal(String(url), "/api/v1/sellers/applications");
        calls.push({ method: init?.method, body: JSON.parse(String(init?.body)), bearer: new Headers(init?.headers).get("Authorization") });
        return envelope(canonical);
      },
    },
  });
  assert.deepEqual(calls, [{ method: "POST", body: input, bearer: "Bearer current-token" }]);
  assert.deepEqual(result, { ...input, companyName: canonical.companyName, note: canonical.note, id: pending.id, status: "PENDING", rejectionReason: null });
  for (const data of [null, { id: pending.id, status: "PENDING" }]) {
    await assert.rejects(submitSellerApplication(input, { context: { fetch: async () => envelope(data) } }), invalidResponse);
  }
});

test("seller missing endpoint, authorization denial and defined duplicate codes remain errors", async () => {
  for (const [status, code] of [[403, "FORBIDDEN"], [404, "NOT_FOUND"], [409, "SELLER_APPLICATION_EXISTS"], [409, "SELLER_APPLICATION_NOT_PENDING"]] as const) {
    await assert.rejects(submitSellerApplication(input, { context: { fetch: async () => new Response(JSON.stringify({ title: "Rejected", status, code }), { status }) } }),
      (error: unknown) => isApiError(error) && error.status === status && error.code === code);
  }
});

test("seller own GET and submission preserve explicit cancellation", async () => {
  for (const operation of ["GET", "POST"]) {
    const controller = new AbortController();
    const options = {
      signal: controller.signal,
      context: { fetch: async (_url: RequestInfo | URL, init?: RequestInit) => {
        assert.equal(init?.method, operation);
        assert.equal(init?.signal?.aborted, false);
        controller.abort();
        assert.equal(init?.signal?.aborted, true);
        return envelope(pending);
      } },
    };
    await assert.rejects(operation === "GET" ? getSellerApplication(options) : submitSellerApplication(input, options), { name: "AbortError" });
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
