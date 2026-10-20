/* Postman loads mock handlers as CommonJS, including in ESM projects. */
/* eslint-disable @typescript-eslint/no-require-imports */
/** Local profile contract from this repository's UserController and IAM DTOs. */
const http = require("node:http");

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
  res.writeHead(status, headers);
  res.end(JSON.stringify(value));
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") return json(res, {});
  if (path === "/health") return json(res, { ready: true });

  if (path === "/__test/reset" && req.method === "POST") {
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
    return json(res, await pm.state.get("profile-gateway:requests") || []);
  }

  const history = await pm.state.get("profile-gateway:requests") || [];
  history.push({ method: req.method, path, body: req.body ?? null, authenticated: Boolean(req.headers.authorization) });
  await pm.state.set("profile-gateway:requests", history);
  const controls = await pm.state.get("profile-gateway:controls") || {};
  const user = await pm.state.get("profile-gateway:user") || initialUser;

  if (path === "/v1/users/me" && req.headers.authorization !== "Bearer local-profile-fixture-token") {
    return json(res, { title: "Unauthorized", status: 401 }, 401);
  }

  // The simulation strips routeKey /api, preserving the real caller's URL.
  // @endpoint POST /v1/auth/login
  if (path === "/v1/auth/login" && req.method === "POST") {
    if (req.body?.email !== initialUser.email || req.body?.password !== "profile-password") {
      return json(res, { title: "Unauthorized", status: 401, detail: "Invalid credentials" }, 401);
    }
    return json(res, { accessToken: "local-profile-fixture-token", expiresIn: 3600, tokenType: "Bearer" });
  }

  // @endpoint GET /v1/users/me
  if (path === "/v1/users/me" && req.method === "GET") {
    if (controls.getDelayMs) await new Promise(resolve => setTimeout(resolve, controls.getDelayMs));
    if (controls.getStatus) {
      return json(res, { title: "Profile unavailable", status: controls.getStatus, detail: "Unable to load your profile." }, controls.getStatus);
    }
    return json(res, user);
  }

  // @endpoint PUT /v1/users/me
  if (path === "/v1/users/me" && req.method === "PUT") {
    if (controls.putStatus === 400) {
      return json(res, {
        title: "Validation failed", status: 400,
        errors: [{ field: "phone", message: "Phone number is invalid" }],
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
    return json(res, next);
  }

  // Shared shop shell dependencies; exact category and PageResponse shapes.
  if (path === "/v1/categories/tree") {
    return json(res, [
      { id: "electronics", name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] },
    ]);
  }
  if (path === "/v1/products") {
    return json(res, { content: [], page: 0, size: 20, totalElements: 0 });
  }
  return json(res, { title: "Endpoint not modelled", detail: `${req.method} ${path}` }, 501);
});

server.listen(process.env.PORT || 3912);
