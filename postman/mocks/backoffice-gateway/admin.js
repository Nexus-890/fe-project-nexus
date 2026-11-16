/* Local-only #227 HTTP stand-ins. Users writes follow unmerged #211;
 * seller decisions follow the explicit #210 proposal, not a delivered backend. */
exports.createAdminFixture = ({ ok, problem, list, bodyOf, randomUUID }) => {
  const id = (n) => `b2270000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let users, applications, requests, healthReads, failure, signInLocks;
  const reset = () => {
    users = [
      { id: id(1), fullName: "Nguyễn Thị Lan", email: "lan.nguyen@example.com", phone: "0912345678", gender: "FEMALE", roles: ["BUYER"], status: "ACTIVE", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01", createdAt: "2026-11-01T00:00:00Z" },
      { id: id(2), fullName: "Trần Quốc Bảo", email: "bao.tran@example.com", phone: "0909771002", gender: "MALE", roles: ["SELLER"], status: "LOCKED", address: "Ha Noi", dateOfBirth: "1995-02-03", createdAt: "2026-11-02T00:00:00Z" },
    ];
    applications = [
      { id: id(10), companyName: "Lan Audio", phone: "0912345678", note: "Audio equipment and accessories", status: "PENDING", reason: null },
      { id: id(11), companyName: "Bao Books", phone: "0909771002", note: "Books and stationery", status: "PENDING", reason: null },
    ];
    requests = []; healthReads = 0; failure = null; signInLocks = new Set([id(1)]);
  };
  reset();
  const events = [{ id: id(20), eventId: id(21), eventType: "ShipmentFailed", aggregateType: "SHIPMENT", aggregateId: "SHIP-227", operatorId: null, traceId: "trace-admin-227", topic: "shipment.events", occurredAt: "2026-11-16T03:00:00Z", receivedAt: "2026-11-16T03:00:01Z" }];
  const audit = [{ id: id(30), eventId: id(31), actorId: id(1), action: "UserRoleAssigned", entityType: "USER", entityId: id(2), traceId: "trace-audit-227", occurredAt: "2026-11-16T02:00:00Z", receivedAt: "2026-11-16T02:00:01Z" }];
  const filtered = (rows, url, keys) => rows.filter((row) => keys.every((key) => !url.searchParams.get(key) || row[key] === url.searchParams.get(key)) &&
    (!url.searchParams.get("q") || JSON.stringify(row).toLowerCase().includes(url.searchParams.get("q").toLowerCase())) &&
    (!url.searchParams.get("from") || Date.parse(row.occurredAt) >= Date.parse(url.searchParams.get("from"))) &&
    (!url.searchParams.get("to") || Date.parse(row.occurredAt) <= Date.parse(url.searchParams.get("to"))));
  const handle = (req, res, url, claims) => {
    const path = url.pathname;
    if (path === "/test/admin-evidence") { ok(res, { requests, users, applications, healthReads }); return true; }
    if (path === "/test/admin-control") { failure = bodyOf(req).failure; ok(res, {}); return true; }
    const sellerMatch = /^\/v1\/sellers\/applications(?:\/([^/]+)\/(approve|reject))?$/.exec(path);
    if (!/^\/v1\/(?:users(?:\/|$)|roles$|event-logs(?:\/|$)|audit-logs$|system\/health(?:\/|$))/.test(path) && !sellerMatch || path === "/v1/users/me") return false;
    const body = bodyOf(req);
    const safeBody = Object.fromEntries(Object.entries(body).filter(([key]) => !["password", "newPassword"].includes(key)));
    requests.push({ method: req.method, path: `/api${path}`, query: Object.fromEntries(url.searchParams), body: safeBody, authenticated: !!claims, roles: claims?.roles || [] });
    if (!claims) { problem(res, 401, "Sign in first", "UNAUTHENTICATED"); return true; }
    const admin = claims.roles.includes("ADMIN"), support = claims.roles.includes("SUPPORT_STAFF");
    if (!admin && !support || (path === "/v1/audit-logs" || path === "/v1/roles" || sellerMatch) && !admin || req.method !== "GET" && !admin && !(req.method === "PUT" && /^\/v1\/users\/[^/]+$/.test(path))) {
      problem(res, 403, "This operation is restricted to administrators", "FORBIDDEN"); return true;
    }
    if (failure && path.includes(failure)) { problem(res, 503, "Temporary upstream outage", "SERVICE_UNAVAILABLE"); return true; }
    if (path === "/v1/users" && req.method === "GET") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      list(res, users.filter((user) => (!q || `${user.fullName} ${user.email}`.toLowerCase().includes(q)) && (!url.searchParams.get("role") || user.roles.includes(url.searchParams.get("role"))) && (!url.searchParams.get("status") || user.status === url.searchParams.get("status"))), url); return true;
    }
    if (path === "/v1/users" && req.method === "POST") {
      if (users.some((user) => user.email === body.email)) problem(res, 409, "Email is already used", "USER_EMAIL_ALREADY_USED");
      else { const profile = Object.fromEntries(Object.entries(body).filter(([key]) => !["password", "identityNumber", "roleCodes"].includes(key))); const user = { ...profile, id: randomUUID(), roles: body.roleCodes, status: "ACTIVE", createdAt: new Date().toISOString() }; users.push(user); ok(res, user, 201); }
      return true;
    }
    const userMatch = /^\/v1\/users\/([^/]+)(?:\/(password|roles|unlock))?$/.exec(path);
    if (userMatch) {
      const user = users.find((entry) => entry.id === userMatch[1]);
      if (!user) problem(res, 404, "User not found", "USER_NOT_FOUND");
      else if (req.method === "DELETE") { users = users.filter((entry) => entry.id !== user.id); res.writeHead(204); res.end(); }
      else if (userMatch[2] === "unlock") {
        if (!signInLocks.has(user.id)) problem(res, 409, "Account is not locked by brute-force detection", "USER_ACCOUNT_NOT_LOCKED");
        else { signInLocks.delete(user.id); res.writeHead(204); res.end(); }
      }
      else if (userMatch[2] === "password") { res.writeHead(204); res.end(); }
      else { if (req.method === "PUT") Object.assign(user, userMatch[2] === "roles" ? { roles: body.roleCodes } : body); ok(res, user); }
      return true;
    }
    if (path === "/v1/roles") { list(res, ["ADMIN", "SUPPORT_STAFF", "BUYER", "SELLER"].map((code, n) => ({ id: id(40 + n), code, name: code, description: null, privileges: [] })), url); return true; }
    if (sellerMatch) {
      if (!sellerMatch[1] && req.method === "GET") list(res, applications.filter((entry) => !url.searchParams.get("status") || entry.status === url.searchParams.get("status")), url);
      else if (req.method !== "POST" || !sellerMatch[1]) problem(res, 501, "Seller operation not modelled", "NOT_MODELLED");
      else if (sellerMatch[2] === "reject" && (typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 1000)) problem(res, 400, "A rejection reason is required", "VALIDATION_FAILED");
      else if (sellerMatch[2] === "approve" && Object.keys(body).length) problem(res, 400, "Approval must be bodyless", "VALIDATION_FAILED");
      else {
        const application = applications.find((entry) => entry.id === sellerMatch[1]);
        if (!application) problem(res, 404, "Application not found", "SELLER_APPLICATION_NOT_FOUND");
        else if (application.status !== "PENDING") problem(res, 409, "Application already reviewed", "SELLER_APPLICATION_NOT_PENDING");
        else { application.status = sellerMatch[2] === "approve" ? "ACTIVE" : "REJECTED"; application.reason = sellerMatch[2] === "reject" ? body.reason : null; ok(res, application); }
      }
      return true;
    }
    if (path === "/v1/event-logs") { list(res, filtered(events, url, ["eventType", "aggregateType", "aggregateId", "operatorId"]), url); return true; }
    if (path.startsWith("/v1/event-logs/")) {
      const event = events.find((entry) => entry.id === path.split("/").at(-1));
      if (!event) problem(res, 404, "Event not found");
      else { const payload = { shipmentId: "SHIP-227", reason: "Carrier unavailable", nested: { attempts: [1, 2] } }; const envelope = { ...event, payload, extraField: "retained" }; ok(res, { event, payload, envelope, rawEnvelope: JSON.stringify(envelope) }); }
      return true;
    }
    if (path === "/v1/audit-logs") { list(res, filtered(audit, url, ["actorId", "action", "entityType", "entityId"]), url); return true; }
    if (path === "/v1/system/health") { healthReads++; ok(res, { services: ["user-service", "catalog-service", "commerce-service", "auction-service", "payment-service", "inventory-service", "shipment-service", "notification-service", "rating-service", "api-gateway", "config-service", "discovery-service", "keycloak"].map((name) => ({ name, status: name === "shipment-service" ? "DOWN" : "UP" })), brokers: [{ name: "kafka", status: "UP", lastCheckedAt: new Date().toISOString() }] }); return true; }
    if (path === "/v1/system/health/brokers") { list(res, [{ name: "kafka", status: "UP", lastCheckedAt: new Date().toISOString(), lastFailureAt: "2026-11-15T01:00:00Z", lastRecoveredAt: "2026-11-15T01:01:00Z" }], url); return true; }
    problem(res, 501, "Operation not modelled", "NOT_MODELLED"); return true;
  };
  return { handle, reset };
};
