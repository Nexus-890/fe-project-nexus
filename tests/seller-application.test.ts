import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { getSellerApplication, parseSellerApplication, SELLER_APPLICATION_PATH, submitSellerApplication } from "../service/sellerApplicationService";
import { sellerApplicationSchema } from "../features/sellerApplicationSchema";
import type { SellerApplication } from "../types/sellerApplicationType";

const pending: SellerApplication = {
  id: "application-1", shopName: "Nexus Books", description: "Pre-loved books for everyone.",
  status: "PENDING", rejectionReason: null, submittedAt: "2026-11-13T01:00:00Z",
};
const envelope = (data: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data }));

test("seller application reads explicit empty state and validates pending, approval and rejected reason", async () => {
  assert.equal(await getSellerApplication({ context: { fetch: async () => envelope(null) } }), null);
  for (const application of [pending, { ...pending, status: "APPROVED" }, { ...pending, status: "REJECTED", rejectionReason: "Please describe your products." }]) {
    assert.deepEqual(await getSellerApplication({ context: { fetch: async () => envelope(application) } }), application);
  }
  for (const invalid of [{}, [], { ...pending, status: "UNKNOWN" }, { ...pending, status: "REJECTED" }, { ...pending, submittedAt: "invalid" }, { ...pending, shopName: " " }]) {
    assert.throws(() => parseSellerApplication(invalid), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
});

test("seller application services preserve current Bearer, path, method and allowlisted normalized body", async () => {
  let token = "first-token";
  const calls: { method?: string; body: unknown; bearer: string | null }[] = [];
  const context = {
    getAccessToken: () => token,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), SELLER_APPLICATION_PATH);
      calls.push({ method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, bearer: new Headers(init?.headers).get("Authorization") });
      return envelope(pending);
    },
  };
  await getSellerApplication({ context });
  token = "rotated-token";
  await submitSellerApplication({ shopName: " Nexus Books ", description: " Pre-loved books for everyone. ", ...{ status: "APPROVED", roles: ["SELLER"] } }, { context });
  assert.deepEqual(calls, [
    { method: "GET", body: undefined, bearer: "Bearer first-token" },
    { method: "POST", body: { shopName: pending.shopName, description: pending.description }, bearer: "Bearer rotated-token" },
  ]);
});

test("missing seller endpoint, authorization denial and duplicate application remain errors", async () => {
  for (const status of [403, 404, 409]) {
    const context = { fetch: async () => new Response(JSON.stringify({ title: "Rejected", status, code: "SELLER_APPLICATION_CONFLICT" }), { status }) };
    for (const call of [() => getSellerApplication({ context }), () => submitSellerApplication(pending, { context })]) {
      await assert.rejects(call(), (error: unknown) => isApiError(error) && error.status === status);
    }
  }
});

test("seller submission forwards cancellation and rejects missing envelopes", async () => {
  const controller = new AbortController();
  await assert.rejects(submitSellerApplication(pending, {
    signal: controller.signal,
    context: { fetch: async (_input, init) => {
      assert.equal(init?.signal?.aborted, false);
      controller.abort();
      assert.equal(init?.signal?.aborted, true);
      return envelope(pending);
    } },
  }), { name: "AbortError" });
  await assert.rejects(getSellerApplication({ context: { fetch: async () => new Response(JSON.stringify(pending)) } }),
    (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("seller application form rejects blank/oversized data and trims valid input", () => {
  for (const input of [
    { shopName: " ", description: pending.description },
    { shopName: pending.shopName, description: "too short" },
    { shopName: "A".repeat(151), description: pending.description },
    { shopName: pending.shopName, description: "A".repeat(1001) },
  ]) assert.equal(sellerApplicationSchema.safeParse(input).success, false);
  assert.deepEqual(sellerApplicationSchema.parse({ shopName: " Nexus Books ", description: " Pre-loved books for everyone. " }), {
    shopName: pending.shopName, description: pending.description,
  });
});
