/* Local API contract fixture; /api routing prefix is removed by the simulation. */
const http = require("node:http");
const { createHash } = require("node:crypto");
const initial = () => ({ meRequests: 0, bearerRequests: 0, passwordLeaks: 0, loginRequests: 0, registrations: 0 });
const user = {
  id: "68000000-0000-4000-8000-000000000003", email: "buyer@nexus.local", phone: "0901234567",
  fullName: "Fixture Buyer", gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01",
  roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-03T00:00:00Z",
};
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3103");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://127.0.0.1:3913");
  if (url.pathname === "/test/reset") {
    await pm.state.set("oidc-api:evidence", initial());
    await pm.state.set("oidc-api:mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  const evidence = await pm.state.get("oidc-api:evidence") || initial();
  if (url.pathname === "/test/evidence") return json(res, evidence);
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (url.pathname !== "/v1/auth/register" && /password/i.test(body)) evidence.passwordLeaks += 1;
  if (url.pathname === "/v1/auth/login") evidence.loginRequests += 1;
  if (url.pathname === "/v1/users/me") {
    evidence.meRequests += 1;
    const authorization = req.headers.authorization || "";
    const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
    const bearer = authorization.startsWith("Bearer ") && expectedHash
      && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash;
    if (bearer) evidence.bearerRequests += 1;
    await pm.state.set("oidc-api:evidence", evidence);
    const mode = await pm.state.get("oidc-api:mode") || "success";
    if (mode === "profile-503-once" && evidence.meRequests === 1) {
      return json(res, { title: "Profile temporarily unavailable", status: 503 }, 503);
    }
    if (mode === "profile-401") return json(res, { title: "Unauthorized", status: 401 }, 401);
    return bearer ? json(res, user) : json(res, { title: "Unauthorized", status: 401 }, 401);
  }
  if (url.pathname === "/v1/auth/register" && req.method === "POST") {
    const fields = typeof req.body === "object" && req.body ? req.body : JSON.parse(body);
    if (!fields.password || !fields.email) return json(res, { title: "Invalid registration", status: 400 }, 400);
    evidence.registrations += 1;
    await pm.state.set("oidc-api:evidence", evidence);
    return json(res, { ...user, email: fields.email, fullName: fields.fullName }, 201);
  }
  await pm.state.set("oidc-api:evidence", evidence);
  if (url.pathname === "/v1/categories/tree") return json(res, []);
  if (url.pathname === "/v1/products") return json(res, { content: [], page: 0, size: 12, totalElements: 0 });
  return json(res, { title: "Fixture endpoint not implemented", status: 501 }, 501);
});
server.listen(process.env.PORT);
