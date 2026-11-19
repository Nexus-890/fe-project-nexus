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

const appOrigin = "http://127.0.0.1:3103";
const reputation = {
  score: 62, trustLevel: "TRUSTED", totalTransaction: 9, successfulTransaction: 7, failedTransaction: 1,
  ratingCount: 4, averageRating: 4.3, successfulAuctions: 2, failedAuctions: 1, penaltyCount: 12,
  policyVersion: "reputation-policy-1",
};
const penaltyTypes = ["AUCTION_PAYMENT_TIMEOUT", "USER_RATED", "ADMIN_ADJUSTMENT"];
const penaltyReasons = {
  AUCTION_PAYMENT_TIMEOUT: "Auction payment deadline missed",
  USER_RATED: "Rated 1 star by a buyer",
  ADMIN_ADJUSTMENT: "Listing policy violation",
};
const penalties = Array.from({ length: 12 }, (_, index) => {
  const changeType = penaltyTypes[index % 3];
  const previousScore = 64 + index * 2;
  return {
    id: `7d000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, changeType,
    sourceId: changeType === "ADMIN_ADJUSTMENT" ? null : `5b1c2d3e-4f50-4a61-8b72-${String(index + 1).padStart(12, "0")}`,
    delta: -2, previousScore, newScore: previousScore - 2, previousLevel: "TRUSTED", newLevel: "TRUSTED",
    reason: penaltyReasons[changeType], changedAt: new Date(Date.UTC(2026, 10, 18 - index, 3)).toISOString(),
  };
});
const avatarSignatures = [
  { type: "image/png", test: (b) => b.length >= 4 && b.toString("latin1", 1, 4) === "PNG" },
  { type: "image/jpeg", test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", test: (b) => b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];
const avatars = new Map();
const storedAvatar = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Ga8DAAN5AWVLTgzuAAAAAElFTkSuQmCC", "base64");
function multipartFile(req) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("latin1") : typeof req.body === "string" ? req.body : "";
  const boundary = /boundary=([^;]+)/.exec(String(req.headers["content-type"] || ""))?.[1];
  if (!boundary) return null;
  for (const part of raw.split(`--${boundary}`)) {
    if (!/name="file"/.test(part) || !/filename="/.test(part)) continue;
    return Buffer.from(part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""), "latin1");
  }
  return null;
}
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };

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

// THAY CHO SessionController CỦA GATEWAY (#252): ĐỔI MÃ, LÀM MỚI, ĐĂNG XUẤT QUA COOKIE HttpOnly, CORS CHỈ CHO ORIGIN CỦA APP
const keycloak = "http://127.0.0.1:3913/keycloak/realms/nexus/protocol/openid-connect";
const sessionPaths = new Set(["/v1/auth/session", "/v1/auth/refresh", "/v1/auth/logout"]);
const cookie = (value, maxAge) => `nexus_rt=${value}; Path=/api/v1/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
const sessionCookie = (req) => (req.headers.cookie || "").split(/;\s*/)
  .find((part) => part.startsWith("nexus_rt="))?.slice("nexus_rt=".length) || "";

function cors(req, res) {
  res.setHeader("Vary", "Origin");
  if (!req.headers.origin) return true;
  if (req.headers.origin !== appOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", appOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  return true;
}

function keycloakPost(path, form) {
  return fetch(`${keycloak}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "nexus-web", ...form }),
  });
}

async function session(req, res, path, controls) {
  if (req.headers["x-requested-with"] !== "nexus-web") {
    return json(res, { title: "Forbidden", status: 403, detail: "This request is not allowed from this page" }, 403);
  }
  const signedIn = async (response) => {
    const tokens = await response.json();
    res.setHeader("Set-Cookie", cookie(tokens.refresh_token, tokens.refresh_expires_in));
    return json(res, { code: 0, message: "response success",
      data: { accessToken: tokens.access_token, idToken: tokens.id_token, expiresIn: tokens.expires_in } });
  };
  if (path === "/v1/auth/session") {
    const grant = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const response = await keycloakPost("token", {
      grant_type: "authorization_code", code: grant.code || "",
      code_verifier: grant.codeVerifier || "", redirect_uri: grant.redirectUri || "",
    });
    if (!response.ok) return json(res, { title: "Unauthorized", status: 401, detail: "The sign-in code was rejected" }, 401);
    return signedIn(response);
  }
  if (path === "/v1/auth/refresh") {
    const refreshToken = sessionCookie(req);
    if (!refreshToken) {
      res.writeHead(204, { "Cache-Control": "no-store" });
      return res.end();
    }
    if (controls.refreshStatus) {
      return json(res, { title: "Service Unavailable", status: controls.refreshStatus, detail: "The sign-in service is not reachable" }, controls.refreshStatus);
    }
    const response = await keycloakPost("token", { grant_type: "refresh_token", refresh_token: refreshToken });
    if (!response.ok) {
      res.setHeader("Set-Cookie", cookie("", 0));
      return json(res, { title: "Unauthorized", status: 401, detail: "The session has ended" }, 401);
    }
    return signedIn(response);
  }
  if (sessionCookie(req)) await keycloakPost("logout", { refresh_token: sessionCookie(req) });
  res.writeHead(204, { "Set-Cookie": cookie("", 0), "Cache-Control": "no-store" });
  return res.end();
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
  if (!cors(req, res)) return json(res, { title: "Forbidden", status: 403, detail: "This origin is not allowed" }, 403);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (path === "/health") return json(res, { ready: true });

  if (path === "/__test/reset" && req.method === "POST") {
    await pendingHistoryWrite;
    await pm.state.set("profile-gateway:user", initialUser);
    await pm.state.set("profile-gateway:controls", {});
    await pm.state.set("profile-gateway:requests", []);
    avatars.clear();
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
  const avatarFile = /^\/test\/avatar\/(\d+)$/.exec(path);
  if (avatarFile && avatars.has(avatarFile[1])) {
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    return res.end(storedAvatar);
  }

  if (sessionPaths.has(path) && req.method === "POST") {
    return session(req, res, path, await pm.state.get("profile-gateway:controls") || {});
  }

  const authorization = req.headers.authorization || "";
  const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
  const expiry = await pm.state.get("oidc-keycloak:access-token-expiry");
  const time = await pm.state.get("oidc-keycloak:clock-time") ?? Date.now();
  const authenticated = Boolean(authorization.startsWith("Bearer ") && expectedHash
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash
    && typeof expiry === "number" && expiry > Math.floor(time / 1000));
  const multipart = String(req.headers["content-type"] || "").startsWith("multipart/form-data");
  await recordRequest({ method: req.method, path, body: multipart ? { multipart: true } : req.body ?? null, authenticated });
  const controls = await pm.state.get("profile-gateway:controls") || {};
  const user = await pm.state.get("profile-gateway:user") || initialUser;

  if (path === "/v1/users/me" || path === "/v1/carts/me" || path.startsWith("/v1/users/me/")) {
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

  // @endpoint POST /v1/users/me/avatar
  if (path === "/v1/users/me/avatar" && req.method === "POST") {
    if (controls.avatarStatus) {
      return json(res, { title: "Service Unavailable", status: controls.avatarStatus, code: "USER_AVATAR_STORAGE_UNAVAILABLE", detail: "Avatar storage is unavailable" }, controls.avatarStatus);
    }
    const file = multipartFile(req);
    if (!file || file.length === 0) return json(res, { title: "Bad Request", status: 400, code: "USER_AVATAR_REQUIRED", detail: "Choose an image to upload" }, 400);
    const kind = avatarSignatures.find((signature) => signature.test(file));
    if (!kind) return json(res, { title: "Unsupported Media Type", status: 415, code: "USER_AVATAR_INVALID_TYPE", detail: "The avatar must be a JPEG, PNG or WebP image" }, 415);
    const key = String(avatars.size + 1);
    avatars.set(key, kind.type);
    const next = { ...user, avatarUrl: `http://127.0.0.1:3913/api/test/avatar/${key}` };
    await pm.state.set("profile-gateway:user", next);
    return success(res, next);
  }

  // @endpoint DELETE /v1/users/me/avatar
  if (path === "/v1/users/me/avatar" && req.method === "DELETE") {
    const next = { ...user, avatarUrl: null };
    await pm.state.set("profile-gateway:user", next);
    return success(res, next);
  }

  // @endpoint GET /v1/users/me/reputation
  if (path === "/v1/users/me/reputation" && req.method === "GET") {
    if (controls.reputationStatus) {
      return json(res, { title: "Reputation unavailable", status: controls.reputationStatus, detail: "Unable to load your reputation." }, controls.reputationStatus);
    }
    return success(res, reputation);
  }

  // @endpoint GET /v1/users/me/penalties
  if (path === "/v1/users/me/penalties" && req.method === "GET") {
    const query = new URL(req.url, "http://localhost").searchParams;
    const number = Number(query.get("page") || 0), size = Number(query.get("size") || 10);
    if (!Number.isInteger(number) || number < 0 || !Number.isInteger(size) || size < 1 || size > 50) {
      return json(res, { title: "Bad Request", status: 400, code: "VALIDATION_FAILED", detail: "Invalid page" }, 400);
    }
    const rows = controls.noPenalties ? [] : penalties;
    return json(res, { code: 0, message: "response success", data: rows.slice(number * size, number * size + size),
      page: { number, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size) } });
  }

  // Shared shop shell dependencies; exact category and PageResponse shapes.
  if (path === "/v1/categories/tree") {
    return success(res, [
      { id: "electronics", name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] },
    ]);
  }
  if (path === "/v1/products" || path === "/v1/products/search") {
    return json(res, { code: 0, message: "response success", data: [],
      page: { number: 0, size: 20, totalElements: 0, totalPages: 0 } });
  }
  if (path === "/v1/carts/me") {
    return success(res, { id: "profile-header-cart", userId: user.id, status: "ACTIVE", items: [] });
  }
  return json(res, { title: "Endpoint not modelled", detail: `${req.method} ${path}` }, 501);
});

server.listen(process.env.PORT || 3912);
