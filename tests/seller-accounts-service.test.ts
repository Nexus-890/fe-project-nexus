import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isApiError } from "../configs/api";
import { getSellerProfile, parseSellerProfile, updateSellerProfile } from "../service/sellerProfileService";
import { addSellerBankAccount, getAdminBankAccounts, getSellerBankAccounts, maskedSellerBankAccount, parseSellerBankAccount, setDefaultSellerBankAccount, updateSellerBankAccount, verifySellerBankAccount } from "../service/sellerBankService";
import type { SellerBankAccount } from "../types/sellerBankType";
import type { ApiContext } from "../types/commonRequestType";

const sellerId = "68000000-0000-4000-8000-000000000002";
const bankId = "95000000-0000-4000-8000-000000000001";
const bank = { id: bankId, sellerId, bankCode: "970436", accountLast4: "4321", accountHolderName: "DEMO SELLER", verificationStatus: "UNVERIFIED", isDefault: true, active: true, version: 0 };
const profile = { userId: sellerId, companyName: "Seller Shop", contactPhone: "0901234567", status: "ACTIVE" };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const status = (expected: number) => (error: unknown) => isApiError(error) && error.status === expected;
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });

test("seller profile maps the delivered userId and writes only companyName/contactPhone", async () => {
  const calls: unknown[] = [];
  const context: ApiContext = { getAccessToken: () => "current-seller", fetch: async (input, init) => {
    assert.equal(String(input), "/api/v1/sellers/me");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer current-seller");
    calls.push(init?.body ? JSON.parse(String(init.body)) : null);
    return Response.json(envelope(profile));
  } };
  const result = await getSellerProfile({ context });
  assert.equal(result.status, "ACTIVE"); assert.equal(result.sellerId, sellerId);
  await updateSellerProfile({ companyName: " Seller Shop ", contactPhone: " 0901234567 ", status: "REJECTED", sellerId: bankId } as Parameters<typeof updateSellerProfile>[0], { context });
  assert.deepEqual(calls, [null, { companyName: "Seller Shop", contactPhone: "0901234567" }]);
  for (const bad of [{ ...profile, userId: "bad" }, { ...profile, userId: undefined, sellerId }, { ...profile, status: "VERIFIED" }, { ...profile, companyName: "" }, { ...profile, contactPhone: 123 }]) assert.throws(() => parseSellerProfile(bad), invalid);
});

test("bank parser retains a safe mask and rejects leaked full or encrypted account fields", () => {
  const result = parseSellerBankAccount(bank);
  assert.equal(maskedSellerBankAccount(result), "•••• 4321");
  for (const bad of [{ ...bank, accountLast4: "123456789" }, { ...bank, bankCode: "VCB" }, { ...bank, verificationStatus: "PENDING" },
    { ...bank, version: undefined }, { ...bank, version: -1 }, { ...bank, version: 1.5 },
    { ...bank, accountNumber: "00012344321" }, { ...bank, accountNumberEncrypted: "ciphertext" }, { ...bank, account_number: "00012344321" }])
    assert.throws(() => parseSellerBankAccount(bad), invalid);
});

test("bank creation preserves leading zeroes and unchanged verified updates keep the server decision", async () => {
  const input = { bankCode: "970436", accountNumber: "000004321", accountHolderName: " DEMO SELLER " };
  const context: ApiContext = { getAccessToken: () => "seller", fetch: async (url, init) => {
    assert.equal(String(url), "/api/v1/payments/seller-bank-accounts");
    assert.deepEqual(JSON.parse(String(init?.body)), { bankCode: "970436", accountNumber: "000004321", accountHolderName: "DEMO SELLER" });
    return Response.json(envelope(bank), { status: 201 });
  } };
  assert.equal((await addSellerBankAccount(input, { context })).accountLast4, "4321");
  const unchanged = await updateSellerBankAccount(bankId, input, { context: { fetch: async () => Response.json(envelope({ ...bank, verificationStatus: "VERIFIED" })) } });
  assert.equal(unchanged.verificationStatus, "VERIFIED");
  for (const mismatch of [{ id: randomUUID() }, { bankCode: "970415" }, { accountLast4: "9999" }, { accountHolderName: "OTHER HOLDER" }]) {
    await assert.rejects(updateSellerBankAccount(bankId, input, { context: { fetch: async () => Response.json(envelope({ ...bank, ...mismatch })) } }), invalid);
  }
  let sent = false;
  await assert.rejects(addSellerBankAccount({ ...input, accountNumber: "1e10" }, { context: { fetch: async () => { sent = true; return Response.json(envelope(bank)); } } }), invalid);
  assert.equal(sent, false);
});

test("bank review sends the displayed version and preserves409 without retrying or refreshing the decision", async () => {
  const calls: unknown[] = [];
  const current = { ...bank, version: 7 };
  const verified = await verifySellerBankAccount(bankId, { verificationStatus: "VERIFIED", expectedVersion: current.version }, {
    context: { fetch: async (_url, init) => {
      calls.push(JSON.parse(String(init?.body)));
      return Response.json(envelope({ ...current, verificationStatus: "VERIFIED", version: 8 }));
    } },
  });
  assert.equal(verified.version, 8);
  assert.deepEqual(calls, [{ verificationStatus: "VERIFIED", expectedVersion: 7 }]);
  let sent = 0;
  const conflict = { context: { fetch: async () => {
    sent++;
    return Response.json({ title: "Conflict", status: 409, code: "PAYMENT_SELLER_BANK_ACCOUNT_CONFLICT",
      detail: "Bank account changed; review the latest details" }, { status: 409 });
  } } };
  await assert.rejects(verifySellerBankAccount(bankId, { verificationStatus: "VERIFIED", expectedVersion: 7 }, conflict), status(409));
  assert.equal(sent, 1);
  for (const expectedVersion of [undefined, null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(verifySellerBankAccount(bankId,
      { verificationStatus: "VERIFIED", expectedVersion } as Parameters<typeof verifySellerBankAccount>[1], conflict), invalid);
  }
  assert.equal(sent, 1, "invalid version is rejected before transport");
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
  onVerified: (account: SellerBankAccount) => void;
};
const requireFixture = createRequire(path.join(process.cwd(), "package.json"));
const { createSellerAccountsFixture } = requireFixture("./postman/mocks/backoffice-gateway/sellerAccounts.js") as {
  createSellerAccountsFixture: (dependencies: FixtureDependencies) => { handle: (req: MockRequest, res: ServerResponse, url: URL, claims: Claims | null) => boolean };
};

test("native HTTP profile/bank flow edits, selects defaults, verifies and hides foreign accounts with404", async () => {
  const json = (res: ServerResponse, data: unknown, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
  const releases: string[] = [];
  const fixture = createSellerAccountsFixture({ ok: (res, data, code) => json(res, envelope(data), code),
    problem: (res, code, detail, symbol) => json(res, { title: "Rejected", status: code, code: symbol, detail }, code),
    list: (res, data, url) => { const page = Number(url.searchParams.get("page") || 0), size = Number(url.searchParams.get("size") || 10); json(res, { ...envelope(data.slice(page * size, (page + 1) * size)), page: { number: page, size, totalElements: data.length, totalPages: Math.ceil(data.length / size) } }); },
    bodyOf: (req) => req.body, randomUUID, seller: sellerId, onVerified: (account) => releases.push(account.id),
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
    const savedProfile = await updateSellerProfile({ companyName: "Updated shop", contactPhone: "0907654321" }, options("seller"));
    assert.equal(savedProfile.companyName, "Updated shop"); assert.equal((await getSellerProfile(options("seller"))).contactPhone, "0907654321");
    const created = await addSellerBankAccount({ bankCode: "970415", accountNumber: "000012345678", accountHolderName: "Seller Account" }, options("seller"));
    assert.equal(created.accountLast4, "5678"); assert.equal(created.verificationStatus, "UNVERIFIED");
    await setDefaultSellerBankAccount(created.id, options("seller"));
    let mine = await getSellerBankAccounts(options("seller"));
    assert.equal(mine.filter((row) => row.isDefault && row.active).length, 1); assert.equal(mine.find((row) => row.isDefault)?.id, created.id);
    await assert.rejects(updateSellerBankAccount(created.id, { bankCode: "970415", accountNumber: "000012345678", accountHolderName: "Wrong seller" }, options("other")), status(404));
    await assert.rejects(setDefaultSellerBankAccount(created.id, options("other")), status(404));
    assert.deepEqual(await getSellerBankAccounts(options("other")), []);
    await assert.rejects(getAdminBankAccounts({ page: 0, size: 10 }, options("seller")), status(403));
    const adminPage = await getAdminBankAccounts({ page: 0, size: 10, verificationStatus: "UNVERIFIED" }, options("admin"));
    assert.equal(adminPage.content[0].id, bankId, "oldest unverified account is reviewed first");
    const current = mine.find((row) => row.id === created.id)!;
    const reviewed = await verifySellerBankAccount(created.id, { verificationStatus: "VERIFIED", expectedVersion: current.version }, options("admin"));
    assert.deepEqual(releases, [created.id]);
    const edited = await updateSellerBankAccount(created.id, { bankCode: "970415", accountNumber: "000098765432", accountHolderName: "Updated Seller" }, options("seller"));
    assert.equal(edited.verificationStatus, "UNVERIFIED"); assert.equal(edited.accountLast4, "5432");
    await assert.rejects(verifySellerBankAccount(created.id, { verificationStatus: "VERIFIED", expectedVersion: reviewed.version }, options("admin")), status(409));
    assert.deepEqual(releases, [created.id], "stale approval must not release held payouts again");
    await verifySellerBankAccount(created.id, { verificationStatus: "REJECTED", reason: "Holder details need correction", expectedVersion: edited.version }, options("admin"));
    mine = await getSellerBankAccounts(options("seller")); assert.equal(mine.find((row) => row.id === created.id)?.verificationStatus, "REJECTED");
    await assert.rejects(verifySellerBankAccount(bankId, { verificationStatus: "VERIFIED", expectedVersion: 0 }, options("seller")), status(403));
    const evidence = await (await fetch(`${baseUrl}/test/seller-accounts/evidence`)).text();
    assert.equal(evidence.includes("000012345678"), false); assert.equal(evidence.includes("000098765432"), false); assert.equal(evidence.includes("accountNumber"), false);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});

test("seller bank and profile unavailability stays an HTTP error and no malformed or stale success is rendered", async () => {
  for (const code of [404, 501]) {
    const options = { context: { fetch: async () => Response.json({ title: "Unavailable", status: code }, { status: code }) } };
    await assert.rejects(getSellerBankAccounts(options), status(code)); await assert.rejects(getSellerProfile(options), status(code));
  }
  let generation = 1;
  const options = { context: { getAccessToken: () => "same-token", getSessionId: () => generation, fetch: async () => { generation++; return Response.json(envelope(profile)); } } };
  await assert.rejects(getSellerProfile(options), (error) => isApiError(error) && error.kind === "aborted");
  await assert.rejects(getSellerBankAccounts({ context: { fetch: async () => Response.json({ ...envelope([bank, bank]), page: { number: 0, size: 100, totalElements: 2, totalPages: 1 } }) } }), invalid);
});
