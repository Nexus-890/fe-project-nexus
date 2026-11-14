/* Local-only provisional #210 dependency model. No live backend guarantee is
 * inferred from this handler; see account.context.yaml and account UI docs.
 */
const { createHash, randomUUID } = require("node:crypto");
const handleAddresses = require("./addresses.js");
const initialEvidence = () => ({ requests: [], sellerSubmissions: 0, emailSends: 0, phoneSends: 0, phoneConfirms: 0 });
let evidence = initialEvidence();
const hash = (value) => createHash("sha256").update(value).digest("hex");

module.exports = async function handleAccount(req, res, url, helpers) {
  const { state, json, problem, bodyOf, envelope, user } = helpers;
  const path = url.pathname;
  const send = (data, status) => { json(res, envelope(data), status); return true; };
  const reject = (status, code, detail) => { problem(res, status, code, detail, undefined, {}, "/api" + path); return true; };
  if (path === "/test/account/reset") {
    evidence = initialEvidence();
    for (const [key, value] of Object.entries({ sellerApplication: null, options: {}, addresses: [], addressFailure: false, phone: { phone: user.phone, phoneVerifiedAt: null }, phoneSends: [], phoneCode: null, emailSends: {}, offset: 0 })) await state.set("account-api:" + key, value);
    json(res, { ready: true });
    return true;
  }
  if (path === "/test/account/evidence") { json(res, evidence); return true; }
  if (path === "/test/account/control") {
    const body = bodyOf(req);
    for (const key of ["sellerApplication", "addresses", "phone", "addressFailure"]) {
      if (Object.hasOwn(body, key)) await state.set("account-api:" + key, body[key]);
    }
    if (body.advanceMs) await state.set("account-api:offset", (await state.get("account-api:offset") || 0) + body.advanceMs);
    const options = { ...await state.get("account-api:options") || {}, ...body };
    await state.set("account-api:options", options);
    json(res, { ready: true });
    return true;
  }
  const publicRoute = path === "/v1/auth/verification-email" || path === "/v1/auth/register";
  const relevant = publicRoute || path === "/v1/users/me" || path.startsWith("/v1/sellers/applications") || path.startsWith("/v1/users/me/phone/verification") || path.startsWith("/v1/users/me/addresses");
  if (!relevant) return false;
  const authorization = req.headers.authorization || "";
  const expectedHash = await state.get("oidc-keycloak:access-token-hash");
  const authorized = Boolean(authorization.startsWith("Bearer ") && expectedHash && hash(authorization.slice(7)) === expectedHash);
  const body = ["GET", "HEAD"].includes(req.method) ? null : bodyOf(req);
  // Do not retain OTP values or passwords even in the local evidence record.
  evidence.requests.push({ method: req.method, path, authorized, body: body ? Object.fromEntries(Object.entries(body).filter(([key]) => !["code", "password"].includes(key))) : null });
  if (!publicRoute && !authorized) return reject(401, "UNAUTHENTICATED", "A valid access token is required.");
  const options = await state.get("account-api:options") || {};
  const now = Date.now() + (await state.get("account-api:offset") || 0);
  if (path === "/v1/users/me" && req.method === "GET") {
    const phone = await state.get("account-api:phone") || { phone: user.phone, phoneVerifiedAt: null };
    return send({ ...user, phone: phone.phone, phoneVerifiedAt: phone.phoneVerifiedAt });
  }
  if (path === "/v1/users/me" && req.method === "PUT") {
    const current = await state.get("account-api:phone") || { phone: user.phone, phoneVerifiedAt: null };
    const phone = typeof body.phone === "string" ? body.phone.trim().replace(/[\s()-]/g, "") : current.phone;
    if (!/^\+?[0-9]{7,15}$/.test(phone)) return reject(400, "VALIDATION_FAILED", "Invalid phone.");
    const next = { phone, phoneVerifiedAt: phone === current.phone ? current.phoneVerifiedAt : null };
    await state.set("account-api:phone", next);
    return send({ ...user, ...next });
  }
  if (path.startsWith("/v1/users/me/addresses")) {
    return handleAddresses(req, res, url, helpers);
  }
  if (path === "/v1/auth/register" && req.method === "POST") {
    if (options.registrationEmailFailure) return reject(502, "USER_VERIFICATION_EMAIL_FAILED", "The account is kept; request another email.");
    return send({ ...user, ...body, id: randomUUID(), roles: ["BUYER"], password: undefined, phoneVerifiedAt: null }, 201);
  }
  if (path === "/v1/auth/verification-email" && req.method === "POST") {
    if (options.emailFailure) return reject(503, "SERVICE_UNAVAILABLE", "Email is temporarily unavailable.");
    const email = String(body.email || "").trim().toLowerCase();
    const sends = await state.get("account-api:emailSends") || {};
    if (now - (sends[email] || 0) < 60000) return reject(429, "RATE_LIMITED", "Please wait before requesting another email.");
    sends[email] = now;
    await state.set("account-api:emailSends", sends);
    evidence.emailSends += 1;
    res.writeHead(204); res.end(); return true;
  }
  if (path === "/v1/sellers/applications") {
    if (options.sellerFailure) return reject(503, "SERVICE_UNAVAILABLE", "Applications are temporarily unavailable.");
    const application = await state.get("account-api:sellerApplication");
    // Issue #210 reserves GET list/approve/reject for Admin. This fixture has a
    // buyer identity; a caller cannot use that list to invent own-status reads.
    if (req.method === "GET") return reject(403, "FORBIDDEN", "Only Admin can list seller applications.");
    if (req.method === "POST") {
      evidence.sellerSubmissions += 1;
      if (typeof body.companyName !== "string" || !body.companyName.trim() || typeof body.phone !== "string" || !/^\+?\d{7,15}$/.test(body.phone) || typeof body.note !== "string") return reject(400, "VALIDATION_FAILED", "Company name, contact phone and note are required.");
      if (options.sellerConflict || application && application.status !== "REJECTED") {
        if (!application) await state.set("account-api:sellerApplication", { id: randomUUID(), companyName: body.companyName, phone: body.phone, note: body.note, status: "PENDING" });
        return reject(409, "SELLER_APPLICATION_EXISTS", "An application is already awaiting review.");
      }
      const created = { id: randomUUID(), companyName: body.companyName, phone: body.phone, note: body.note, status: "PENDING" };
      await state.set("account-api:sellerApplication", created);
      return send(created, 201);
    }
  }
  if (path.startsWith("/v1/users/me/phone/verification")) {
    if (options.phoneFailure) return reject(503, "SERVICE_UNAVAILABLE", "Phone verification is temporarily unavailable.");
    const current = await state.get("account-api:phone") || { phone: user.phone, phoneVerifiedAt: null };
    if (path === "/v1/users/me/phone/verification" && req.method === "POST") {
      if (body && Object.keys(body).length) return reject(400, "VALIDATION_FAILED", "Send has no request body.");
      const sends = (await state.get("account-api:phoneSends") || []).filter((at) => now - at < 900000);
      if (sends.length >= 3) return reject(429, "PHONE_CODE_RATE_LIMITED", "Please wait before sending another code.");
      await state.set("account-api:phoneSends", [...sends, now]);
      await state.set("account-api:phoneCode", { phone: current.phone, hash: hash("123456"), expiresAt: now + 300000, attempts: 0 });
      evidence.phoneSends += 1;
      return send({ phone: current.phone, expiresAt: new Date(Date.now() + 300000).toISOString() }, 202);
    }
    if (path.endsWith("/confirm") && req.method === "POST") {
      if (Object.keys(body).some((key) => key !== "code")) return reject(400, "VALIDATION_FAILED", "Confirm accepts only code.");
      evidence.phoneConfirms += 1;
      const challenge = await state.get("account-api:phoneCode");
      if (!challenge || challenge.phone !== current.phone || challenge.expiresAt <= now) return reject(400, "PHONE_CODE_EXPIRED", "Request a new verification code.");
      if (challenge.attempts >= 5) return reject(429, "PHONE_CODE_RATE_LIMITED", "Too many attempts.");
      if (challenge.hash !== hash(String(body.code))) {
        challenge.attempts += 1; await state.set("account-api:phoneCode", challenge);
        return reject(400, "PHONE_CODE_INVALID", "The verification code is incorrect.");
      }
      const verified = { phone: current.phone, phoneVerifiedAt: new Date(now).toISOString() };
      await state.set("account-api:phone", verified);
      await state.set("account-api:phoneCode", null);
      return send(verified);
    }
  }
  return reject(501, "NOT_IMPLEMENTED", "This account operation is not modeled.");
};
