import { createServer, request as httpRequest } from "node:http";
import { databaseTask } from "./live-buyer/database.mjs";

const port = Number(process.env.NEXUS_LIVE_ROUTER_PORT || 3994);
const appOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || 3190}`;
const origin = (key, fallback) => {
  const value = process.env[key] || fallback;
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") throw new Error(`${key} must identify a local test service`);
  return value;
};
const targets = {
  catalog: origin("NEXUS_LIVE_CATALOG_ORIGIN", "http://127.0.0.1:4932"),
  commerce: origin("NEXUS_LIVE_COMMERCE_ORIGIN", "http://127.0.0.1:4933"),
  rating: origin("NEXUS_LIVE_RATING_ORIGIN", "http://127.0.0.1:4939"),
  identity: `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || 3993}`,
};
let calls = [];
const envelope = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
const emptyPage = { number: 0, size: 10, totalElements: 0, totalPages: 0 };
const json = (response, body, status = 200) => {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
};

// Only identity and unrelated shell dependencies are stand-ins. Changed buyer API paths always proxy to jars.
const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", appOrigin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With,Idempotency-Key");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  try {
    if (url.pathname === "/health") return json(response, { ready: true, targets });
    if (url.pathname === "/test/reset" && request.method === "POST") { calls = []; return json(response, await databaseTask("seed")); }
    if (url.pathname === "/test/project-completion" && request.method === "POST") return json(response, await databaseTask("project"));
    if (url.pathname === "/test/evidence") return json(response, { calls, database: await databaseTask("evidence") });
    let target;
    let service;
    if (/^\/api\/v1\/(products|categories)(\/|$)/.test(url.pathname)) service = "catalog";
    else if (/^\/api\/v1\/orders(\/|$)/.test(url.pathname)) service = "commerce";
    else if (/^\/api\/v1\/(ratings|reputations)(\/|$)/.test(url.pathname)) service = "rating";
    else if (/^\/api\/v1\/(auth|users|carts)(\/|$)/.test(url.pathname)) service = "identity";
    if (service) target = new URL(request.url, targets[service]);
    else if (url.pathname === "/api/v1/notifications/unread-count") return json(response, envelope({ unreadCount: 0 }));
    else if (["/api/v1/notifications", "/api/v1/shipments", "/api/v1/auctions"].includes(url.pathname)) return json(response, envelope([], emptyPage));
    else if (url.pathname === "/api/v1/inventory") return json(response, envelope([{ skuId: url.searchParams.get("skuIds"), available: 0 }]));
    else return json(response, { error: "Outside the live buyer harness", path: url.pathname }, 501);
    const upstream = httpRequest(target, { method: request.method, headers: { ...request.headers, host: target.host } }, (incoming) => {
      // Keep only transport evidence, never tokens/cookies/authorization-code bodies.
      calls.push({ method: request.method, path: url.pathname, query: url.search, service, status: incoming.statusCode });
      const headers = { ...incoming.headers };
      delete headers["access-control-allow-origin"];
      delete headers["access-control-allow-credentials"];
      response.writeHead(incoming.statusCode, headers);
      incoming.pipe(response);
    });
    upstream.on("error", () => json(response, { error: `Real ${service} service is unavailable` }, 502));
    request.pipe(upstream);
  } catch (error) { json(response, { error: error.message }, 500); }
});
server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
