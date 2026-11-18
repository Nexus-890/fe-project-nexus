/* Issue #257/#261 HTTP stand-in. Stores masks only; never persists/logs full numbers. */
function createSellerAccountsFixture({ ok, problem, list, bodyOf, randomUUID, seller, onVerified = () => {} }) {
  let accounts, profiles, requests;
  const seedBank = "95000000-0000-4000-8000-000000000001";
  const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const safe = (account) => ({ id: account.id, sellerId: account.sellerId, bankCode: account.bankCode, accountLast4: account.accountLast4,
    accountHolderName: account.accountHolderName, verificationStatus: account.verificationStatus,
    isDefault: account.isDefault, active: account.active, version: account.version });
  function reset() {
    profiles = new Map([[seller, { userId: seller, companyName: "Demo Seller Shop", contactPhone: "0901234567", status: "ACTIVE" }]]);
    accounts = [{ id: seedBank, sellerId: seller, bankCode: "970436", accountLast4: "4321", accountHolderName: "DEMO SELLER", verificationStatus: "UNVERIFIED", isDefault: true, active: true, version: 0, createdAt: "2026-11-14T03:00:00Z" }];
    requests = [];
  }
  const reject = (res, status, detail, code) => { problem(res, status, detail, code); return true; };
  const respond = (res, data, status) => { ok(res, data, status); return true; };
  const validInput = (body) => typeof body.bankCode === "string" && /^\d{6}$/.test(body.bankCode) &&
    typeof body.accountNumber === "string" && /^\d{6,34}$/.test(body.accountNumber) && typeof body.accountHolderName === "string" &&
    body.accountHolderName.trim().length > 0 && body.accountHolderName.trim().length <= 100 &&
    Object.keys(body).every((key) => ["bankCode", "accountNumber", "accountHolderName"].includes(key));
  function handle(req, res, url, claims) {
    const path = url.pathname.replace(/^\/api/, ""), bankPath = "/v1/payments/seller-bank-accounts";
    if (path === "/test/seller-accounts/evidence" && req.method === "GET") return respond(res, { accounts: accounts.map(safe), profiles: [...profiles.values()], requests });
    if (!path.startsWith(bankPath) && !/^\/v1\/sellers\/(?:me|[^/]+)$/.test(path)) return false;
    const body = bodyOf(req);
    requests.push({ method: req.method, path, actor: claims?.sub || null,
      ...(path === "/v1/sellers/me" && req.method === "PUT" ? { body: { companyName: body.companyName, contactPhone: body.contactPhone } } : {}),
      ...(path.startsWith(bankPath) && ["POST", "PUT"].includes(req.method) ? { body: path.endsWith("/verify") ? { verificationStatus: body.verificationStatus, expectedVersion: body.expectedVersion, reason: body.reason } : { bankCode: body.bankCode, accountLast4: typeof body.accountNumber === "string" ? body.accountNumber.slice(-4) : undefined, accountHolderName: body.accountHolderName } } : {}) });
    if (!claims) return reject(res, 401, "Sign in first", "UNAUTHENTICATED");
    const has = (role) => claims.roles?.includes(role);
    if (path === "/v1/sellers/me") {
      if (!has("SELLER")) return reject(res, 403, "Seller role required", "FORBIDDEN");
      let profile = profiles.get(claims.sub);
      if (!profile) { profile = { userId: claims.sub, companyName: "Seller shop", contactPhone: "0901234567", status: "ACTIVE" }; profiles.set(claims.sub, profile); }
      if (req.method === "GET") return respond(res, profile);
      if (req.method === "PUT") {
        if (typeof body.companyName !== "string" || !body.companyName.trim() || body.companyName.trim().length > 200 ||
          typeof body.contactPhone !== "string" || !/^\+?[0-9 ()-]{6,20}$/.test(body.contactPhone.trim()) ||
          !Object.keys(body).every((key) => ["companyName", "contactPhone"].includes(key))) return reject(res, 400, "Valid company name and contact phone are required", "VALIDATION_FAILED");
        profile.companyName = body.companyName.trim(); profile.contactPhone = body.contactPhone.trim();
        return respond(res, profile);
      }
    }
    if (path.startsWith("/v1/sellers/")) return reject(res, 404, "Seller profile not found", "SELLER_NOT_FOUND");
    if (path === `${bankPath}/me` && req.method === "GET") {
      if (!has("SELLER")) return reject(res, 403, "Seller role required", "FORBIDDEN");
      list(res, accounts.filter((row) => row.sellerId === claims.sub).map(safe), url); return true;
    }
    if (path === bankPath && req.method === "GET") {
      if (!has("ADMIN")) return reject(res, 403, "Administrator role required", "FORBIDDEN");
      const sellerId = url.searchParams.get("sellerId"), status = url.searchParams.get("verificationStatus");
      if (sellerId && !uuid(sellerId) || status && !["UNVERIFIED", "VERIFIED", "REJECTED"].includes(status)) return reject(res, 400, "Invalid bank account filters", "INVALID_PARAMETER");
      const rows = accounts.filter((row) => (!sellerId || row.sellerId === sellerId) && (!status || row.verificationStatus === status))
        .sort((a, b) => Number(b.verificationStatus === "UNVERIFIED") - Number(a.verificationStatus === "UNVERIFIED") || Date.parse(a.createdAt) - Date.parse(b.createdAt));
      list(res, rows.map(safe), url); return true;
    }
    if (path === bankPath && req.method === "POST") {
      if (!has("SELLER")) return reject(res, 403, "Seller role required", "FORBIDDEN");
      if (!validInput(body)) return reject(res, 400, "Valid bank BIN, account number and holder are required", "SELLER_BANK_ACCOUNT_INVALID");
      const account = { id: randomUUID(), sellerId: claims.sub, bankCode: body.bankCode, accountLast4: body.accountNumber.slice(-4), accountHolderName: body.accountHolderName.trim(), verificationStatus: "UNVERIFIED", isDefault: false, active: true, version: 0, createdAt: new Date().toISOString() };
      accounts.push(account); return respond(res, safe(account), 201);
    }
    const match = new RegExp(`^${bankPath}/([^/]+)(?:/(default|verify))?$`).exec(path);
    if (match) {
      const account = accounts.find((row) => row.id === match[1]);
      if (match[2] === "verify" && req.method === "POST") {
        if (!has("ADMIN")) return reject(res, 403, "Administrator role required", "FORBIDDEN");
        if (!account) return reject(res, 404, "Bank account not found", "SELLER_BANK_ACCOUNT_NOT_FOUND");
        if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || !["VERIFIED", "REJECTED"].includes(body.verificationStatus) ||
          body.reason != null && (typeof body.reason !== "string" || !body.reason.trim() || body.reason.trim().length > 500) ||
          body.verificationStatus === "REJECTED" && !body.reason?.trim()) return reject(res, 400, "Provide a decision and rejection reason", "VALIDATION_FAILED");
        if (body.expectedVersion !== account.version)
          return reject(res, 409, "Bank account changed; review the latest details", "PAYMENT_SELLER_BANK_ACCOUNT_CONFLICT");
        account.verificationStatus = body.verificationStatus; account.version++;
        if (account.verificationStatus === "VERIFIED") onVerified(safe(account));
        return respond(res, safe(account));
      }
      if (!has("SELLER")) return reject(res, 403, "Seller role required", "FORBIDDEN");
      if (!account || account.sellerId !== claims.sub) return reject(res, 404, "Bank account not found", "SELLER_BANK_ACCOUNT_NOT_FOUND");
      if (req.method === "PUT" && !match[2]) {
        if (!validInput(body)) return reject(res, 400, "Valid bank details are required", "SELLER_BANK_ACCOUNT_INVALID");
        Object.assign(account, { bankCode: body.bankCode, accountLast4: body.accountNumber.slice(-4), accountHolderName: body.accountHolderName.trim(), verificationStatus: "UNVERIFIED", version: account.version + 1 });
        return respond(res, safe(account));
      }
      if (req.method === "POST" && match[2] === "default") {
        if (!account.active) return reject(res, 400, "Default bank account must be active", "SELLER_BANK_ACCOUNT_INVALID");
        accounts.filter((row) => row.sellerId === claims.sub).forEach((row) => {
          const isDefault = row.id === account.id;
          if (row.isDefault !== isDefault) { row.isDefault = isDefault; row.version++; }
        });
        if (account.verificationStatus === "VERIFIED") onVerified(safe(account));
        return respond(res, safe(account));
      }
    }
    return reject(res, 501, "Seller account endpoint is not modelled", "NOT_IMPLEMENTED");
  }
  reset();
  return { reset, handle, get accounts() { return accounts.map(safe); }, getSellerAccounts: (sellerId) => accounts.filter((row) => row.sellerId === sellerId).map(safe),
    verifyDefault: (sellerId) => accounts.filter((row) => row.sellerId === sellerId && row.isDefault).forEach((row) => { row.verificationStatus = "VERIFIED"; row.version++; }) };
}
module.exports = { createSellerAccountsFixture };
