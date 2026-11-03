/* Postman loads local mock handlers as CommonJS. */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Local-only stand-in from delivered notification GET shapes and
 * origin/develop's NotificationController/Service PATCH implementation.
 * The CLI is signed out, so published owner mocks could not be searched.
 */
const http = require("node:http");
const stateKey = (name) => `notification-gateway:${name}`;
const prefix = "/api/v1/notifications";
const idFor = (account, number) =>
  `${account === "a" ? "68000000" : "69000000"}-0000-4000-8000-${String(number).padStart(12, "0")}`;
const seed = (account) => Array.from({ length: 24 }, (_, index) => ({
  id: idFor(account, 24 - index),
  type: "ORDER_CREATED",
  title: `${account.toUpperCase()} update ${24 - index}`,
  content: `Notification ${24 - index} for account ${account.toUpperCase()}.`,
  readAt: index % 4 === 3 ? "2026-11-02T01:00:00Z" : null,
  createdAt: new Date(Date.UTC(2026, 10, 3, 0, 30 - index)).toISOString(),
}));
const json = (res, value, status = 200) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
};
const success = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
const problem = (res, status, code, path) => {
  res.writeHead(status, { "Content-Type": "application/problem+json" });
  res.end(JSON.stringify({
    type: "urn:problem:domain-error",
    title: { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 503: "Service Unavailable" }[status],
    status, code, detail: code, instance: path,
  }));
};
let historyWrite = Promise.resolve();
const record = (entry) => {
  const next = historyWrite.then(async () => {
    const history = await pm.state.get(stateKey("requests")) || [];
    history.push(entry);
    await pm.state.set(stateKey("requests"), history);
  });
  historyWrite = next.catch(() => {});
  return next;
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://notification.local");
  const path = url.pathname;
  if (path === "/__test/reset" && req.method === "POST") {
    await historyWrite;
    await pm.state.set(stateKey("requests"), []);
    await pm.state.set(stateKey("controls"), {});
    await pm.state.set(stateKey("a"), seed("a"));
    await pm.state.set(stateKey("b"), seed("b"));
    return json(res, {});
  }
  if (path === "/__test/control" && req.method === "POST") {
    await pm.state.set(stateKey("controls"), req.body || {});
    return json(res, {});
  }
  if (path === "/__test/requests" && req.method === "GET") {
    await historyWrite;
    return json(res, await pm.state.get(stateKey("requests")) || []);
  }
  const account = ["a", "b"].find((candidate) =>
    req.headers.authorization === `Bearer notification-simulation-${candidate}`);
  await record({
    method: req.method,
    path,
    query: Object.fromEntries(url.searchParams),
    account: account || null,
    hasBody: Number(req.headers["content-length"] || 0) > 0 ||
      (req.body != null && Object.keys(req.body).length > 0),
  });
  if (!path.startsWith(prefix)) return json(res, { title: "Endpoint not modelled" }, 501);
  if (!account) return problem(res, 401, "NOTIFICATION_UNAUTHENTICATED", path);
  const rows = await pm.state.get(stateKey(account)) || seed(account);
  // @endpoint GET /api/v1/notifications/unread-count
  if (path === `${prefix}/unread-count` && req.method === "GET")
    return json(res, success({ count: rows.filter((row) => row.readAt === null).length }));
  // @endpoint GET /api/v1/notifications
  if (path === prefix && req.method === "GET") {
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 10);
    if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100)
      return problem(res, 400, "NOTIFICATION_DATA_INVALID", path);
    return json(res, success(rows.slice(page * size, (page + 1) * size), {
      number: page, size, totalElements: rows.length, totalPages: Math.ceil(rows.length / size),
    }));
  }
  const match = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
  // @endpoint PATCH /api/v1/notifications/{id}/read
  // @endpoint PATCH /api/v1/notifications/read-all
  if (req.method === "PATCH" && (match || path === `${prefix}/read-all`)) {
    const controls = await pm.state.get(stateKey("controls")) || {};
    if (controls.patchStatus === 503) return problem(res, 503, "SERVICE_UNAVAILABLE", path);
    let id;
    if (match) {
      id = decodeURIComponent(match[1]);
      if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id))
        return problem(res, 400, "INVALID_PARAMETER", path);
      if (!rows.some((row) => row.id === id)) {
        const other = await pm.state.get(stateKey(account === "a" ? "b" : "a")) || seed(account === "a" ? "b" : "a");
        return problem(res, other.some((row) => row.id === id) ? 403 : 404,
          other.some((row) => row.id === id) ? "NOTIFICATION_NOT_OWNER" : "NOTIFICATION_NOT_FOUND", path);
      }
    }
    const readAt = new Date().toISOString();
    await pm.state.set(stateKey(account), rows.map((row) =>
      row.readAt === null && (id === undefined || row.id === id) ? { ...row, readAt } : row));
    res.writeHead(204);
    return res.end();
  }
  return json(res, { title: "Endpoint not modelled" }, 501);
}).listen(process.env.PORT || 3915);
