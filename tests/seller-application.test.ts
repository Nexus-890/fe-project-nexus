import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import { getSellerApplication, parseSellerApplication, SELLER_APPLICATION_PATH, submitSellerApplication } from "../service/sellerApplicationService";
import { sellerApplicationSchema } from "../features/sellerApplicationSchema";
import type { SellerApplicationInput } from "../types/sellerApplicationType";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { approveSellerApplication, getAdminSellerApplications, rejectSellerApplication } from "../service/adminSellerApplicationService";

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

test("Admin seller list and decisions serialize real HTTP with scoped Bearer and allowlisted input", async () => {
  const captured: { method: string; url: string; authorization?: string; body: string }[] = [];
  const id = "seller / 1";
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    captured.push({ method: request.method ?? "", url: request.url ?? "", authorization: request.headers.authorization, body });
    const approving = request.url?.endsWith("/approve");
    const rejecting = request.url?.endsWith("/reject");
    const status = approving ? "ACTIVE" : rejecting ? "REJECTED" : "PENDING";
    const data = { ...pending, id, status, reason: rejecting ? "Please clarify the product range." : null };
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ code: 0, message: "response success", data: request.method === "GET" ? [data] : data, ...(request.method === "GET" ? { page: { number: 2, size: 10, totalElements: 21, totalPages: 3 } } : {}) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const context = { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, getAccessToken: () => "admin-current-token" };
  try {
    const listed = await getAdminSellerApplications({ status: "PENDING", page: 2, size: 10, ...{ userId: "ignored" } }, { context, params: { status: "REJECTED", injected: true } });
    assert.equal(listed.page.number, 2);
    assert.equal(listed.applications[0].id, id);
    assert.equal((await approveSellerApplication(id, { context, params: { injected: true } })).status, "ACTIVE");
    const rejected = await rejectSellerApplication(id, { reason: " Please clarify the product range. ", ...{ status: "ACTIVE", roles: ["SELLER"] } }, { context });
    assert.equal(rejected.rejectionReason, "Please clarify the product range.");
    const url = new URL(captured[0].url, context.baseUrl);
    assert.equal(url.pathname, SELLER_APPLICATION_PATH);
    assert.deepEqual(Object.fromEntries(url.searchParams), { page: "2", size: "10", status: "PENDING" });
    assert.deepEqual(captured.map(({ method, url, body }) => ({ method, url: url.split("?")[0], body })), [
      { method: "GET", url: SELLER_APPLICATION_PATH, body: "" },
      { method: "POST", url: `${SELLER_APPLICATION_PATH}/seller%20%2F%201/approve`, body: "" },
      { method: "POST", url: `${SELLER_APPLICATION_PATH}/seller%20%2F%201/reject`, body: JSON.stringify({ reason: "Please clarify the product range." }) },
    ]);
    assert.ok(captured.every((request) => request.authorization === "Bearer admin-current-token"));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Admin seller list rejects missing paging, malformed resources and ignored server filters", async () => {
  const page = { number: 0, size: 10, totalElements: 1, totalPages: 1 };
  for (const body of [
    { code: 0, message: "response success", data: [] },
    { code: 0, message: "response success", data: null, page },
    { code: 0, message: "response success", data: [{ ...pending, phone: "letters" }], page },
    { code: 0, message: "response success", data: [{ ...pending, status: "ACTIVE" }], page },
    { code: 0, message: "response success", data: [pending], page: { ...page, number: 1 } },
  ]) await assert.rejects(getAdminSellerApplications({ status: "PENDING" }, { context: { fetch: async () => new Response(JSON.stringify(body)) } }), invalidResponse);
  const empty = await getAdminSellerApplications({}, { context: { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: [], page: { ...page, totalElements: 0, totalPages: 0 } })) } });
  assert.deepEqual(empty.applications, []);
});

test("Admin seller decisions validate authoritative returned identity, state and stored rejection reason", async () => {
  for (const data of [pending, { ...pending, id: "different", status: "ACTIVE" }, null]) {
    await assert.rejects(approveSellerApplication(pending.id, { context: { fetch: async () => envelope(data) } }), invalidResponse);
  }
  for (const data of [pending, { ...pending, status: "REJECTED", reason: " " }, { ...pending, id: "different", status: "REJECTED", reason: "Change the application." }]) {
    await assert.rejects(rejectSellerApplication(pending.id, { reason: "Change the application." }, { context: { fetch: async () => envelope(data) } }), invalidResponse);
  }
  for (const reason of [" ", "x".repeat(1001)]) {
    let sent = false;
    await assert.rejects(rejectSellerApplication(pending.id, { reason }, { context: { fetch: async () => { sent = true; return envelope(pending); } } }), invalidResponse);
    assert.equal(sent, false);
  }
});

test("Admin seller service preserves authorization, unavailable route and concurrent decision errors", async () => {
  for (const status of [401, 403, 404, 409, 503]) {
    const context = { fetch: async () => new Response(JSON.stringify({ title: "Decision failed", status, code: status === 409 ? "SELLER_APPLICATION_NOT_PENDING" : "FAILURE" }), { status }) };
    for (const call of [
      () => getAdminSellerApplications({}, { context }),
      () => approveSellerApplication(pending.id, { context }),
      () => rejectSellerApplication(pending.id, { reason: "Change the application." }, { context }),
    ]) await assert.rejects(call(), (error: unknown) => isApiError(error) && error.status === status && (status !== 409 || error.code === "SELLER_APPLICATION_NOT_PENDING"));
  }
});

test("Admin seller reads and decisions preserve cancellation instead of reporting success", async () => {
  for (const operation of ["list", "approve", "reject"]) {
    const controller = new AbortController();
    const options = { signal: controller.signal, context: { fetch: async () => { controller.abort(); return envelope(pending); } } };
    await assert.rejects(operation === "list" ? getAdminSellerApplications({}, options) : operation === "approve" ? approveSellerApplication(pending.id, options) : rejectSellerApplication(pending.id, { reason: "Change the application." }, options), { name: "AbortError" });
  }
});
