import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isApiError } from "../configs/api";
import { addSellerBankAccount, createSellerPayout, getPayableOrders, getSellerBankAccounts, getSellerPayouts, maskedBankAccount, parseSellerBankAccount, parseSellerPayout } from "../service/payoutService";
import type { ApiContext } from "../types/commonRequestType";

const sellerId = "68000000-0000-4000-8000-000000000002";
const bankId = "95000000-0000-4000-8000-000000000001";
const orderId = "95000000-0000-4000-8000-000000000002";
const account = { id: bankId, bankCode: "VCB", bankName: "Vietcombank", accountHolder: "DEMO SELLER", last4: "4321", verified: false, createdAt: "2026-11-14T03:00:00Z" };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const status = (expected: number, code?: string) => (error: unknown) => isApiError(error) && error.status === expected && (!code || error.code === code);
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });

test("bank models contain only four digits and reject leaked full account fields", () => {
  assert.deepEqual(parseSellerBankAccount(account), account);
  assert.equal(maskedBankAccount(account), "•••• 4321");
  for (const bad of [{ ...account, last4: "123456789" }, { ...account, accountNumber: "123456789" },
    { ...account, bankAccountNumber: "123456789" }, { ...account, verified: "true" }, { ...account, createdAt: "bad" }])
    assert.throws(() => parseSellerBankAccount(bad), invalid);
});

test("bank creation sends write-only number with current auth and consumes a masked unverified response", async () => {
  const context: ApiContext = { getAccessToken: () => "seller-token", fetch: async (input, init) => {
    assert.equal(String(input), "/api/v1/sellers/me/bank-accounts");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer seller-token");
    assert.deepEqual(JSON.parse(String(init?.body)), { bankCode: "VCB", bankName: "Vietcombank", accountHolder: "DEMO SELLER", accountNumber: "123454321" });
    return Response.json(envelope(account), { status: 201 });
  } };
  const result = await addSellerBankAccount({ bankCode: " VCB ", bankName: "Vietcombank", accountHolder: "DEMO SELLER", accountNumber: "123454321" }, { context });
  assert.equal(result.last4, "4321"); assert.equal("accountNumber" in result, false);
  await assert.rejects(addSellerBankAccount({ bankCode: "VCB", bankName: "Bank", accountHolder: "Seller", accountNumber: "12345" }), invalid);
  await assert.rejects(addSellerBankAccount({ bankCode: "VCB", bankName: "Bank", accountHolder: "Seller", accountNumber: "123454321" },
    { context: { fetch: async () => Response.json(envelope({ ...account, verified: true })) } }), invalid);
});

test("payout reads reject noncompleted, refunded or previously paid candidates and malformed money", async () => {
  const candidate = { orderId, orderNumber: "NX-PAYOUT-1", sellerId, sellerName: "Demo Seller", status: "COMPLETED", completedAt: account.createdAt,
    totalAmount: 4800000, payoutId: null, refundStatus: null, bankAccounts: [account] };
  const response = (data: unknown) => Response.json({ ...envelope([data]), page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } });
  const valid = await getPayableOrders(0, { context: { fetch: async () => response(candidate) } });
  assert.equal(valid.content[0].totalAmount, "4800000.00");
  for (const bad of [{ ...candidate, status: "PAID" }, { ...candidate, refundStatus: "REQUESTED" }, { ...candidate, payoutId: randomUUID() }, { ...candidate, totalAmount: "4800000" }])
    await assert.rejects(getPayableOrders(0, { context: { fetch: async () => response(bad) } }), invalid);
});

test("payout and payable-order amounts reject silent rounding and values outside exact display support", async () => {
  const payout = { id: orderId, orderId, orderNumber: "NX-PAYOUT-1", bankAccount: account, status: "PENDING", createdAt: account.createdAt, paidAt: null, reference: null, amount: 0.01 };
  assert.equal(parseSellerPayout(payout).amount, "0.01");
  for (const amount of [0, -1, 0.001, 1.001, 1e21, Number.MAX_SAFE_INTEGER, Number.POSITIVE_INFINITY]) {
    assert.throws(() => parseSellerPayout({ ...payout, amount }), invalid);
    const candidate = { orderId, orderNumber: "NX-PAYOUT-1", sellerId, sellerName: "Demo Seller", status: "COMPLETED", completedAt: account.createdAt, totalAmount: amount, payoutId: null, refundStatus: null, bankAccounts: [account] };
    await assert.rejects(getPayableOrders(0, { context: { fetch: async () => Response.json({ ...envelope([candidate]), page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } }) } }), invalid);
  }
});

type MockRequest = IncomingMessage & { body?: unknown };
type Claims = { sub: string; roles: string[] };
type FixtureDependencies = {
  ok: (res: ServerResponse, data: unknown, status?: number) => void;
  problem: (res: ServerResponse, status: number, detail: string, code?: string) => void;
  list: (res: ServerResponse, data: unknown[], url: URL) => void;
  bodyOf: (req: MockRequest) => unknown;
  randomUUID: () => string;
  seller: string;
};
const loadFixture = createRequire(path.join(process.cwd(), "package.json"));
const { createPayoutFixture } = loadFixture("./postman/mocks/backoffice-gateway/payouts.js") as {
  createPayoutFixture: (dependencies: FixtureDependencies) => { handle: (req: MockRequest, res: ServerResponse, url: URL, claims: Claims | null) => boolean; reset: () => void };
};

test("HTTP simulation keeps account scope, blocks unverified/noncompleted payouts and replays one payout", async () => {
  const json = (res: ServerResponse, data: unknown, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  const fixture = createPayoutFixture({
    ok: (res, data, code) => json(res, envelope(data), code),
    problem: (res, code, detail, symbol) => json(res, { title: "Rejected", status: code, code: symbol, detail }, code),
    list: (res, data, url) => { const number = Number(url.searchParams.get("page") || 0), size = Number(url.searchParams.get("size") || 10); json(res, { ...envelope(data.slice(number * size, (number + 1) * size)), page: { number, size, totalElements: data.length, totalPages: Math.ceil(data.length / size) } }); },
    bodyOf: (req) => req.body, randomUUID, seller: sellerId,
  });
  const server = createServer(async (request: MockRequest, response) => {
    let body = ""; for await (const chunk of request) body += String(chunk);
    request.body = body ? JSON.parse(body) : {};
    const actor = request.headers.authorization?.replace("Bearer ", "");
    const claims = actor === "seller" ? { sub: sellerId, roles: ["SELLER"] } : actor === "admin" ? { sub: "68000000-0000-4000-8000-000000000001", roles: ["ADMIN"] } : actor === "other" ? { sub: "68000000-0000-4000-8000-000000000099", roles: ["SELLER"] } : null;
    if (!fixture.handle(request, response, new URL(request.url!, "http://fixture.test"), claims)) json(response, {}, 501);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const options = (actor: string) => ({ context: { baseUrl, getAccessToken: () => actor } });
    const sellerAccounts = await getSellerBankAccounts(options("seller"));
    assert.equal(sellerAccounts[0].verified, false);
    assert.deepEqual(await getSellerBankAccounts(options("other")), []);
    const crossSeller = await fetch(`${baseUrl}/api/v1/sellers/${sellerId}/bank-accounts`, { headers: { Authorization: "Bearer other" } });
    assert.equal(crossSeller.status, 403);
    const key = randomUUID(), body = { orderId, bankAccountId: bankId };
    await assert.rejects(createSellerPayout(body, key, options("admin")), status(409, "PAYOUT_BANK_ACCOUNT_UNVERIFIED"));
    assert.equal((await getSellerPayouts(0, options("seller"))).totalElements, 0);
    await fetch(`${baseUrl}/test/payouts-verify`, { method: "POST", headers: { Authorization: "Bearer admin", "Content-Type": "application/json" }, body: "{}" });
    for (let number = 3; number <= 6; number++) await assert.rejects(createSellerPayout({ ...body, orderId: `95000000-0000-4000-8000-${String(number).padStart(12, "0")}` }, randomUUID(), options("admin")), status(409, "PAYOUT_ORDER_NOT_COMPLETED"));
    const paid = await createSellerPayout(body, key, options("admin"));
    const replay = await createSellerPayout(body, key, options("admin"));
    assert.equal(replay.id, paid.id); assert.equal(paid.status, "PENDING");
    assert.equal((await getSellerPayouts(0, options("seller"))).totalElements, 1);
    assert.equal((await getSellerPayouts(0, options("other"))).totalElements, 0);
    assert.equal((await getPayableOrders(0, options("admin"))).totalElements, 0);
    await assert.rejects(createSellerPayout(body, randomUUID(), options("admin")), status(409, "PAYOUT_ALREADY_EXISTS"));
    await assert.rejects(createSellerPayout({ ...body, bankAccountId: randomUUID() }, key, options("admin")), status(409, "PAYOUT_IDEMPOTENCY_CONFLICT"));
    await assert.rejects(createSellerPayout(body, key, options("seller")), status(403));
    const evidence = await (await fetch(`${baseUrl}/test/payouts/evidence`)).text();
    assert.equal(evidence.includes("accountNumber"), false); assert.equal(evidence.includes("123454321"), false);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("unavailable bank API stays a typed failure with no local success fallback", async () => {
  for (const code of [404, 501]) await assert.rejects(getSellerBankAccounts({ context: { fetch: async () => Response.json({ title: "Unavailable", status: code }, { status: code }) } }), status(code));
  await assert.rejects(createSellerPayout({ orderId, bankAccountId: bankId }, "invalid"), invalid);
});
