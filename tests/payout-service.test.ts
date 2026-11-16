import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isApiError } from "../configs/api";
import { getAdminPayouts, getPayoutDetail, getSellerPayouts, parsePayoutDetail, parseSellerPayout, retryPayout } from "../service/payoutService";
import { payoutNeedsActionStatuses, payoutStatuses } from "../types/payoutType";

const sellerId = "68000000-0000-4000-8000-000000000002";
const otherId = "68000000-0000-4000-8000-000000000099";
const adminId = "68000000-0000-4000-8000-000000000001";
const bankId = "95000000-0000-4000-8000-000000000001";
const orderId = "95000000-0000-4000-8000-000000000002";
const id = "95000000-0000-4000-8000-000000000003";
const createdAt = "2026-11-16T03:00:00Z";
const row = { id, orderId, sellerId, orderAmount: "4800000.00", shippingFee: "30000.00", platformFeeRate: "0.0000", platformFee: "0.00", netAmount: "4770000.00", currency: "VND", status: "ON_HOLD", attemptCount: 0, recipientAccountLast4: null, providerReference: null, createdAt };
const step = { id: bankId, event: "HELD", fromStatus: null, toStatus: "ON_HOLD", attemptNo: 0, amount: "4770000.00", sellerBankId: null, recipientAccountLast4: null, provider: null, providerReference: null, providerStatus: null, errorCode: null, errorMessage: null, simulated: true, actorId: "00000000-0000-0000-0000-000000000000", occurredAt: createdAt };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const status = (expected: number) => (error: unknown) => isApiError(error) && error.status === expected;
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });

test("payout models preserve exact money strings and all issue statuses, including returned", () => {
  for (const state of payoutStatuses) assert.equal(parseSellerPayout({ ...row, status: state,
    ...(["SUCCEEDED", "RETURNED"].includes(state) ? { attemptCount: 1, recipientAccountLast4: "4321", providerReference: "CONFIRMED-1" } : {}) }).status, state);
  assert.deepEqual(payoutNeedsActionStatuses, ["ON_HOLD", "UNKNOWN", "FAILED", "RETURNED"]);
  assert.equal(parseSellerPayout({ ...row, orderAmount: "99999999999999999.99", shippingFee: "0.01", netAmount: "99999999999999999.98" }).netAmount, "99999999999999999.98");
  for (const bad of [{ ...row, status: "PAID" }, { ...row, status: "REVERSED" }, { ...row, netAmount: 4770000 }, { ...row, netAmount: "4.77e6" }, { ...row, netAmount: "4770000.001" }, { ...row, shippingFee: "-1.00" }, { ...row, netAmount: "4800000.00" }, { ...row, platformFeeRate: "1.1" }, { ...row, recipientAccountLast4: "12345678" }, { ...row, recipientAccountNumber: "0012345678" }]) assert.throws(() => parseSellerPayout(bad), invalid);
  for (const state of ["SUCCEEDED", "RETURNED"]) {
    const confirmed = { ...row, status: state, attemptCount: 1, recipientAccountLast4: "4321", providerReference: "CONFIRMED-1" };
    for (const missing of [{ attemptCount: 0 }, { recipientAccountLast4: null }, { providerReference: null }, { providerReference: undefined }])
      assert.throws(() => parseSellerPayout({ ...confirmed, ...missing }), invalid);
  }
});

test("detail history validates statuses, masked snapshots and newest-first steps without losing sandbox labels", () => {
  const value = parsePayoutDetail({ ...row, history: [step] });
  assert.equal(value.history[0].simulated, true); assert.equal(value.history[0].amount, "4770000.00");
  for (const history of [[{ ...step, simulated: undefined }], [{ ...step, recipientAccountLast4: "123456" }], [{ ...step, event: "REVERSED" }], [{ ...step, actorId: "system" }], [step, step], [step, { ...step, id: orderId, occurredAt: "2026-11-17T00:00:00Z" }]]) assert.throws(() => parsePayoutDetail({ ...row, history }), invalid);
});

test("admin repeated status and date filters serialize on the canonical route while seller reads only me", async () => {
  const calls: { method?: string; path: string; statuses: string[]; queryKeys: string[]; auth: string | null }[] = [];
  const options = { context: { getAccessToken: () => "current-user", fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://fixture.test");
    calls.push({ method: init?.method, path: url.pathname, statuses: url.searchParams.getAll("status"), queryKeys: [...url.searchParams.keys()], auth: new Headers(init?.headers).get("Authorization") });
    return Response.json({ ...envelope([row]), page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } });
  } } };
  await getAdminPayouts({ sellerId, status: payoutNeedsActionStatuses, from: "2026-11-16T00:00:00+07:00", to: "2026-11-16T23:59:59+07:00" }, options);
  await getSellerPayouts(0, options);
  assert.deepEqual(calls.map((call) => call.path), ["/api/v1/payments/payouts", "/api/v1/payments/payouts/me"]);
  assert.deepEqual(calls[0].statuses, [...payoutNeedsActionStatuses]); assert.equal(calls[0].queryKeys.includes("status[]"), false);
  assert.deepEqual(calls[1].queryKeys, ["page", "size"]); assert.ok(calls.every((call) => call.method === "GET" && call.auth === "Bearer current-user"));
});

type MockRequest = IncomingMessage & { body?: unknown };
type Bank = { id: string; sellerId: string; bankCode: string; accountLast4: string; accountHolderName: string; verificationStatus: string; isDefault: boolean; active: boolean };
type Fixture = { reset: () => void; releaseHeld: (account: Bank | string) => void; handle: (req: MockRequest, res: ServerResponse, url: URL, claims: { sub: string; roles: string[] } | null) => boolean };
const load = createRequire(path.join(process.cwd(), "package.json"));
const { createPayoutFixture } = load("./postman/mocks/backoffice-gateway/payouts.js") as { createPayoutFixture: (options: Record<string, unknown>) => Fixture };

test("HTTP simulation auto-creates once after funded completion, holds/releases, and retries failed/returned without creating payouts", async () => {
  const banks: Bank[] = [{ id: bankId, sellerId, bankCode: "970436", accountLast4: "4321", accountHolderName: "DEMO SELLER", verificationStatus: "UNVERIFIED", isDefault: true, active: true }];
  const json = (res: ServerResponse, value: unknown, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  const fixture = createPayoutFixture({ ok: (res: ServerResponse, data: unknown, code?: number) => json(res, envelope(data), code),
    problem: (res: ServerResponse, code: number, detail: string, symbol?: string) => json(res, { title: "Rejected", status: code, code: symbol, detail }, code),
    list: (res: ServerResponse, data: unknown[], url: URL) => { const number = Number(url.searchParams.get("page") || 0), size = Number(url.searchParams.get("size") || 10); json(res, { ...envelope(data.slice(number * size, (number + 1) * size)), page: { number, size, totalElements: data.length, totalPages: Math.ceil(data.length / size) } }); },
    bodyOf: (req: MockRequest) => req.body || {}, randomUUID, seller: sellerId, getBankAccounts: () => banks });
  const server = createServer(async (req: MockRequest, res) => {
    let body = ""; for await (const chunk of req) body += String(chunk); req.body = body ? JSON.parse(body) : {};
    const role = req.headers.authorization?.replace("Bearer ", "");
    const claims = role === "seller" ? { sub: sellerId, roles: ["SELLER"] } : role === "admin" ? { sub: adminId, roles: ["ADMIN"] } : role === "support" ? { sub: otherId, roles: ["SUPPORT_STAFF"] } : role === "other" ? { sub: otherId, roles: ["SELLER"] } : null;
    if (!fixture.handle(req, res, new URL(req.url!, "http://fixture.test"), claims)) json(res, {}, 501);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string"); const baseUrl = `http://127.0.0.1:${address.port}`;
    const options = (actor: string) => ({ context: { baseUrl, getAccessToken: () => actor } });
    const control = async (path: string, body: unknown) => { const response = await fetch(`${baseUrl}/test/payouts/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return (await response.json()).data; };
    const completion = { orderId, sellerId, status: "COMPLETED", funded: true, refund: false, orderAmount: "4800000.00", shippingFee: "30000.00" };
    for (const status of ["PAID", "SHIPPED", "DELIVERED", "REFUND_REQUESTED"]) assert.equal((await control("order-completed", { ...completion, status })).payout, null);
    for (const change of [{ funded: false }, { refund: true }, { orderAmount: "100.00", shippingFee: "100.00" }]) assert.equal((await control("order-completed", { ...completion, ...change })).payout, null);
    const created = (await control("order-completed", completion)).payout;
    assert.equal(created.status, "ON_HOLD"); assert.equal(created.netAmount, "4770000.00");
    assert.equal((await control("order-completed", { ...completion, eventId: randomUUID() })).payout.id, created.id);
    assert.equal((await getSellerPayouts(0, options("seller"))).totalElements, 1); assert.equal((await getSellerPayouts(0, options("other"))).totalElements, 0);
    await assert.rejects(getPayoutDetail(created.id, options("other")), status(404));
    await assert.rejects(getAdminPayouts({}, options("seller")), status(403)); await assert.rejects(getAdminPayouts({}, options("support")), status(403));
    banks[0].verificationStatus = "VERIFIED"; fixture.releaseHeld(banks[0]);
    const released = await getPayoutDetail(created.id, options("seller")); assert.equal(released.status, "PENDING"); assert.equal(released.history[0].event, "RELEASED");
    await control("provider", { payoutId: created.id, outcome: "UNKNOWN" });
    const unknown = await getPayoutDetail(created.id, options("admin")); assert.equal(unknown.status, "UNKNOWN"); assert.equal(unknown.attemptCount, 1); assert.equal(unknown.recipientAccountLast4, "4321");
    await assert.rejects(retryPayout(created.id, randomUUID(), options("admin")), status(409));
    await control("provider", { payoutId: created.id, outcome: "FAILED" });
    const key = randomUUID(); const retried = await retryPayout(created.id, key, options("admin"));
    assert.equal(retried.status, "PENDING"); assert.equal(retried.id, created.id); assert.equal(retried.history[0].event, "RETRIED");
    assert.equal((await retryPayout(created.id, key, options("admin"))).history.filter((entry) => entry.event === "RETRIED").length, 1);
    await control("provider", { payoutId: created.id, outcome: "SUCCEEDED" });
    const success = await getPayoutDetail(created.id, options("seller")); assert.equal(success.status, "SUCCEEDED"); assert.equal(success.attemptCount, 2); assert.ok(success.providerReference);
    await control("provider", { payoutId: created.id, outcome: "SUCCEEDED" });
    await control("provider", { payoutId: created.id, outcome: "RETURNED" });
    await retryPayout(created.id, randomUUID(), options("admin"));
    assert.equal((await getSellerPayouts(0, options("seller"))).totalElements, 1);
    const reconciled = (await control("order-completed", { ...completion, orderId: randomUUID(), orderAmount: "1.00", shippingFee: "0.00", platformFeeRate: "0.0050" })).payout;
    assert.equal(reconciled.status, "PENDING"); assert.equal(reconciled.platformFee, "0.01"); assert.equal(reconciled.netAmount, "0.99");
    await control("provider", { payoutId: reconciled.id, outcome: "UNKNOWN" });
    await control("provider", { payoutId: reconciled.id, outcome: "SUCCEEDED" });
    const resolved = await getPayoutDetail(reconciled.id, options("seller"));
    assert.equal(resolved.attemptCount, 1); assert.equal(resolved.history[0].event, "RECONCILED"); assert.equal(resolved.status, "SUCCEEDED");
    assert.equal((await getPayoutDetail(created.id, options("seller"))).platformFeeRate, "0.0000", "the older payout keeps its original fee snapshot");
    const evidence = (await (await fetch(`${baseUrl}/test/payouts/evidence`)).json()).data;
    assert.deepEqual(evidence.transactions.filter((entry: { payoutId: string }) => entry.payoutId === created.id).map((entry: { type: string }) => entry.type), ["PAYOUT", "PAYOUT_RETURN"]);
    assert.ok(evidence.payouts[0].history.every((entry: { simulated: boolean }) => entry.simulated));
    assert.equal(JSON.stringify(evidence).includes("accountNumber"), false);
    const manual = await fetch(`${baseUrl}/api/v1/payments/payouts`, { method: "POST", headers: { Authorization: "Bearer admin" } }); assert.equal(manual.status, 501);
    await assert.rejects(retryPayout(created.id, randomUUID(), options("seller")), status(403));
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("retry is bodyless, sends a stable captured key/current auth and never automatically retries an uncertain response", async () => {
  let calls = 0;
  const options = { context: { getAccessToken: () => "admin", fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++; assert.equal(String(input), `/api/v1/payments/payouts/${id}/retry`); assert.equal(init?.method, "POST"); assert.equal(init?.body, undefined);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin"); assert.equal(new Headers(init?.headers).get("Idempotency-Key"), key);
    return Response.json({ title: "Unavailable", status: 503 }, { status: 503 });
  } } };
  const key = randomUUID(); await assert.rejects(retryPayout(id, key, options), status(503)); assert.equal(calls, 1);
  await assert.rejects(retryPayout(id, key, options), status(503)); assert.equal(calls, 2);
  await assert.rejects(retryPayout(id, "invalid", options), invalid); assert.equal(calls, 2);
});

test("payout reads preserve missing route failures and cancellation, never local success", async () => {
  for (const code of [404, 501]) await assert.rejects(getSellerPayouts(0, { context: { fetch: async () => Response.json({ title: "Unavailable", status: code }, { status: code }) } }), status(code));
  const controller = new AbortController(); controller.abort(); await assert.rejects(getPayoutDetail(id, { signal: controller.signal }), { name: "AbortError" });
});
