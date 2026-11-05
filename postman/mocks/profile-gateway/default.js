/* Postman loads mock handlers as CommonJS, including in ESM projects. */
/** Local profile contract from origin/develop's ApiResponse, UserController and IAM DTOs. */
const http = require("node:http");
const { createHash } = require("node:crypto");

const initialUser = {
  id: "9e1018ac-5fb0-47a6-bc3c-3e32a41f49af",
  email: "lan.nguyen@example.com",
  phone: "+84912345678",
  fullName: "Nguyễn Thị Lan",
  gender: "FEMALE",
  address: "227 Nguyễn Văn Cừ, Ward 4, District 5, Ho Chi Minh City",
  dateOfBirth: "2001-05-12",
  roles: ["BUYER"],
  status: "ACTIVE",
  createdAt: "2026-08-12T09:30:00Z",
};

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};

function json(res, value, status = 200) {
  if (status >= 400) {
    const code = value.code || ({ 400: "VALIDATION_FAILED", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 503: "SERVICE_UNAVAILABLE" }[status] || "INTERNAL_ERROR");
    const problemType = ({ VALIDATION_FAILED: "validation-error", UNAUTHENTICATED: "unauthorized" }[code] || code.toLowerCase().replaceAll("_", "-"));
    const type = value.type || `urn:problem:${problemType}`;
    value = { type, code, status, ...value };
  }
  res.writeHead(status, {
    ...headers,
    "Content-Type": status >= 400 ? "application/problem+json" : "application/json",
  });
  res.end(JSON.stringify(value));
}

function success(res, data, status = 200) {
  return json(res, { code: 0, message: "response success", data }, status);
}

let pendingHistoryWrite = Promise.resolve();
function recordRequest(entry) {
  const write = pendingHistoryWrite.then(async () => {
    const history = await pm.state.get("profile-gateway:requests") || [];
    history.push(entry);
    await pm.state.set("profile-gateway:requests", history);
  });
  pendingHistoryWrite = write.catch(() => {});
  return write;
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") return json(res, {});
  if (path === "/health") return json(res, { ready: true });

  if (path === "/__test/reset" && req.method === "POST") {
    await pendingHistoryWrite;
    await pm.state.set("profile-gateway:user", initialUser);
    await pm.state.set("profile-gateway:controls", {});
    await pm.state.set("profile-gateway:requests", []);
    return json(res, {});
  }
  if (path === "/__test/control" && req.method === "POST") {
    const current = await pm.state.get("profile-gateway:controls") || {};
    await pm.state.set("profile-gateway:controls", { ...current, ...req.body });
    return json(res, {});
  }
  if (path === "/__test/requests") {
    await pendingHistoryWrite;
    return json(res, await pm.state.get("profile-gateway:requests") || []);
  }
  if (path === "/__test/user") {
    return json(res, await pm.state.get("profile-gateway:user") || initialUser);
  }

  const authorization = req.headers.authorization || "";
  const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
  const expiry = await pm.state.get("oidc-keycloak:access-token-expiry");
  const time = await pm.state.get("oidc-keycloak:clock-time") ?? Date.now();
  const authenticated = Boolean(authorization.startsWith("Bearer ") && expectedHash
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash
    && typeof expiry === "number" && expiry > Math.floor(time / 1000));
  await recordRequest({ method: req.method, path, body: req.body ?? null, authenticated });
  const controls = await pm.state.get("profile-gateway:controls") || {};
  const user = await pm.state.get("profile-gateway:user") || initialUser;

  if (path === "/v1/users/me" || path === "/v1/carts/me") {
    if (!authenticated) {
      return json(res, { title: "Unauthorized", status: 401 }, 401);
    }
  }

  // The simulation strips routeKey /api, preserving the real caller's URL.
  // @endpoint GET /v1/users/me
  if (path === "/v1/users/me" && req.method === "GET") {
    if (controls.getDelayMs) await new Promise(resolve => setTimeout(resolve, controls.getDelayMs));
    if (controls.getStatus) {
      return json(res, { title: "Profile unavailable", status: controls.getStatus, detail: "Unable to load your profile." }, controls.getStatus);
    }
    return success(res, user);
  }

  // @endpoint PUT /v1/users/me
  if (path === "/v1/users/me" && req.method === "PUT") {
    if (controls.putStatus === 400) {
      return json(res, {
        type: "urn:problem:validation-error", title: "Validation Failed", status: 400,
        code: "VALIDATION_FAILED", detail: "The request data is invalid",
        errors: [{ field: "phone", code: "VALIDATION_PATTERN", detail: "Phone number is invalid" }],
      }, 400);
    }
    if (controls.putStatus) {
      return json(res, { title: "Profile update failed", status: controls.putStatus, detail: "Unable to update your profile." }, controls.putStatus);
    }
    const next = { ...user };
    // UpdateProfileRequest deliberately ignores unknown fields, including phone.
    for (const field of ["fullName", "dateOfBirth", "gender", "address", "email"]) {
      if (req.body[field] != null) next[field] = req.body[field];
    }
    if (typeof next.fullName === "string") next.fullName = next.fullName.trim();
    if (typeof next.address === "string") next.address = next.address.trim();
    if (typeof next.email === "string") next.email = next.email.trim().toLowerCase();
    await pm.state.set("profile-gateway:user", next);
    return success(res, next);
  }

  // Shared shop shell dependencies; exact category and PageResponse shapes.
  if (path === "/v1/categories/tree") {
    return success(res, [
      { id: "electronics", name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] },
    ]);
  }
  if (path === "/v1/products") {
    return json(res, { code: 0, message: "response success", data: [],
      page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
  }
  if (path === "/v1/carts/me") {
    return success(res, { id: "profile-header-cart", userId: user.id, status: "ACTIVE", items: [] });
  }
  return json(res, { title: "Endpoint not modelled", detail: `${req.method} ${path}` }, 501);
});

server.listen(process.env.PORT || 3912);
