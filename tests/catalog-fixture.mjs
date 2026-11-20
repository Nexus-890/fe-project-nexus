import { createServer } from "node:http";

const fixturePort = Number(process.env.NEXUS_TEST_API_PORT ?? 3911);
const fixtureOrigin = `http://127.0.0.1:${fixturePort}`;

const node = (id, name, slug, parentId, level, children = []) => ({
  id,
  name,
  slug,
  parentId,
  level,
  children,
});

const backendCategories = [
  node("electronics", "Electronics", "electronics", null, 1, [
    node("audio", "Audio", "audio", "electronics", 2, [
      node("headphones", "Headphones", "headphones", "audio", 3),
    ]),
  ]),
  node("fashion", "Fashion", "fashion", null, 1),
  node("home", "Home & Living", "home", null, 1),
];

const product = (id, categoryId) => ({
  id: String(id),
  name: `Product ${id}`,
  slug: `product-${id}`,
  categoryId,
  minPrice: 150000.5 + (id >= 100 ? (id - 100) * 100 : 0),
  maxPrice: id === 1 ? 175000 : 150000.5 + (id >= 100 ? (id - 100) * 100 : 0),
  auctionEnable: categoryId === "headphones",
  createdAt: "2026-11-01T00:00:00Z",
});

const backendProducts = [
  product(1, "electronics"),
  product(2, "electronics"),
  product(3, "fashion"),
  product(4, "fashion"),
  product(5, "audio"),
];

let treeFailure = false;
const defaultNotificationCase = () => ({ list: "default", count: "default", read: "default", readAll: "default" });
let notificationCase = defaultNotificationCase();
let notificationRequests = [];
let pendingNotifications = [];
const notificationSessions = new Map();

const fixtureUser = (account) => ({
  id: `10000000-0000-4000-8000-00000000000${account === "a" ? 1 : 2}`,
  email: `notification-${account}@example.test`,
  phone: account === "a" ? "0900000001" : "0900000002",
  fullName: `Notification ${account.toUpperCase()}`,
  gender: null,
  address: null,
  dateOfBirth: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  createdAt: "2026-11-03T00:00:00Z",
});

const fixtureNotifications = (account) =>
  Array.from({ length: 24 }, (_, index) => ({
    id: `20000000-0000-4000-${account === "a" ? "8000" : "9000"}-${String(index + 1).padStart(12, "0")}`,
    type: "ORDER_UPDATED",
    title: `${account.toUpperCase()} update ${24 - index}`,
    content: `Account ${account.toUpperCase()} notification ${24 - index}. Your order has an update. Open this notification to read the complete information for your account.`,
    readAt: index % 4 === 3 ? "2026-11-03T01:00:00Z" : null,
    createdAt: new Date(Date.parse("2026-11-03T00:30:00Z") - index * 60_000).toISOString(),
  }));

let notificationItems = { a: fixtureNotifications("a"), b: fixtureNotifications("b") };

const success = (data) => ({ code: 0, message: "response success", data });
const releaseNotifications = () => {
  const pending = pendingNotifications;
  pendingNotifications = [];
  pending.forEach((reply) => reply());
};

function json(res, value, status = 200) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  res.end(status === 204 ? undefined : JSON.stringify(value));
}

// The gateway session endpoints (#252) live on the OIDC stand-in. Forward them as the gateway
// would, with headers and cookies intact, so sign-in in this suite gets the same HttpOnly cookie.
async function forwardSession(req, res, url) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = Object.fromEntries(Object.entries(req.headers)
    .filter(([name]) => !["host", "connection", "content-length"].includes(name)));
  const providerPort = process.env.NEXUS_TEST_PROVIDER_PORT ?? process.env.NEXUS_OIDC_SIM_PORT ?? 3913;
  const upstream = await fetch(`http://127.0.0.1:${providerPort}${url.pathname}`, {
    method: req.method,
    headers,
    body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  res.statusCode = upstream.status;
  upstream.headers.forEach((value, name) => {
    if (!["content-length", "content-encoding", "transfer-encoding", "set-cookie"].includes(name))
      res.setHeader(name, value);
  });
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, fixtureOrigin);
  if (url.pathname.startsWith("/api/v1/auth/"))
    return forwardSession(req, res, url).catch(() => json(res, { title: "Bad gateway", status: 502 }, 502));
  if (req.method === "OPTIONS") return json(res, {});
  if (url.pathname === "/api/v1/vouchers") return json(res, { ...success([]), page: { number: 0, size: 4, totalElements: 0, totalPages: 0 } });
  if (url.pathname === "/health") return json(res, {});
  if (url.pathname === "/api/v1/auctions") return json(res, {
    ...success([{ id: "auction-1", productId: "1", title: "Vintage watch", imageUrl: null, currentPrice: 250000, bidCount: 12, currency: "VND", endAt: new Date(Date.now() + 7200000).toISOString() }]),
    page: { number: 0, size: 5, totalElements: 1, totalPages: 1 },
  });
  if (url.pathname === "/test/notifications/reset") {
    releaseNotifications();
    notificationCase = defaultNotificationCase();
    notificationItems = { a: fixtureNotifications("a"), b: fixtureNotifications("b") };
    notificationRequests = [];
    notificationSessions.clear();
    return json(res, {});
  }
  if (url.pathname === "/test/notifications/case") {
    notificationCase = {
      list: url.searchParams.get("list") ?? "default",
      count: url.searchParams.get("count") ?? "default",
      read: url.searchParams.get("read") ?? "default",
      readAll: url.searchParams.get("readAll") ?? "default",
    };
    return json(res, {});
  }
  if (url.pathname === "/test/notifications/release") {
    releaseNotifications();
    return json(res, {});
  }
  if (url.pathname === "/test/notifications/evidence")
    return json(res, notificationRequests);
  if (url.pathname === "/test/notifications/session" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const { account, accessToken } = JSON.parse(body);
    if (!["a", "b"].includes(account) || typeof accessToken !== "string" || !accessToken)
      return json(res, { title: "Invalid fixture session", status: 400 }, 400);
    notificationSessions.set(`Bearer ${accessToken}`, account);
    return json(res, {});
  }
  if (url.pathname === "/api/v1/users/me") {
    const account = notificationSessions.get(req.headers.authorization);
    return account
      ? json(res, success(fixtureUser(account)))
      : json(res, { title: "Unauthorized", status: 401 }, 401);
  }
  if (url.pathname.startsWith("/api/v1/notifications")) {
    const account = notificationSessions.get(req.headers.authorization);
    const evidence = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      authorization: req.headers.authorization ?? null,
      canceled: false,
    };
    notificationRequests.push(evidence);
    res.on("close", () => {
      if (!res.writableEnded) evidence.canceled = true;
    });
    if (!account) return json(res, { title: "Unauthorized", status: 401 }, 401);
    if (req.method === "PATCH") {
      const all = url.pathname === "/api/v1/notifications/read-all";
      const match = url.pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/);
      if (!all && !match)
        return json(res, { title: "Not implemented by delivered contract", status: 501 }, 501);
      const mode = all ? notificationCase.readAll : notificationCase.read;
      if (mode === "error")
        return json(res, { title: "Unavailable", status: 503 }, 503);
      const items = notificationItems[account];
      const selected = all ? items : items.filter((item) => item.id === decodeURIComponent(match[1]));
      if (!all && selected.length === 0)
        return json(res, { title: "Not found", status: 404 }, 404);
      const reply = () => {
        if (res.destroyed) return;
        selected.forEach((item) => { item.readAt ??= "2026-11-03T02:00:00Z"; });
        json(res, null, 204);
      };
      if (mode === "delayed") pendingNotifications.push(reply);
      else reply();
      return;
    }
    if (req.method !== "GET")
      return json(res, { title: "Not implemented by delivered contract", status: 501 }, 501);
    if (url.pathname === "/api/v1/notifications/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
      res.write(`event: notifications\ndata: ${JSON.stringify({ unreadCount: notificationItems[account].filter((item) => item.readAt === null).length, revision: `fixture-${account}` })}\n\n`);
      const heartbeat = setInterval(() => res.write("event: heartbeat\ndata: alive\n\n"), 2_000);
      const expiry = setTimeout(() => res.end(), 30_000);
      res.on("close", () => { clearInterval(heartbeat); clearTimeout(expiry); });
      return;
    }
    const mode = url.pathname.endsWith("/unread-count")
      ? notificationCase.count
      : notificationCase.list;
    if (mode === "error")
      return json(res, { title: "Unavailable", status: 503 }, 503);
    if (url.pathname === "/api/v1/notifications/unread-count")
      return json(res, success({
        count: mode === "zero" ? 0 : mode === "large" ? 125 : notificationItems[account].filter((item) => item.readAt === null).length,
      }));
    if (url.pathname !== "/api/v1/notifications")
      return json(res, { title: "Not implemented by delivered contract", status: 501 }, 501);
    const page = Number(url.searchParams.get("page") ?? 0);
    const size = Number(url.searchParams.get("size") ?? 10);
    const items = mode === "empty" ? [] : notificationItems[account];
    const response = {
      ...success(mode === "malformed" ? [{ invalid: true }] : items.slice(page * size, (page + 1) * size)),
      page: { number: page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) },
    };
    const reply = () => {
      if (!res.destroyed) json(res, response);
    };
    if (mode === "delayed") pendingNotifications.push(reply);
    else reply();
    return;
  }
  if (url.pathname === "/test/tree-failure") {
    treeFailure = url.searchParams.get("enabled") === "true";
    return json(res, {});
  }
  if (url.pathname === "/api/v1/categories/tree") {
    if (treeFailure)
      return json(res, { title: "Unavailable", status: 503 }, 503);
    return json(res, {
      code: 0,
      message: "response success",
      data: backendCategories,
      page: {
        number: 0,
        size: backendCategories.length,
        totalElements: backendCategories.length,
        totalPages: 1,
      },
    });
  }
  if (url.pathname === "/api/v1/products/discovery") {
    const size = Number(url.searchParams.get("size") || 8);
    const ranked = url.searchParams.get("type") === "new"
      ? [...backendProducts].sort((a, b) => b.id.localeCompare(a.id))
      : [backendProducts[2], backendProducts[0]];
    return json(res, success(ranked.slice(0, size)));
  }
  if (url.pathname === "/api/v1/products/search") {
    const categoryId = url.searchParams.get("categoryId");
    const page = Number(url.searchParams.get("page") || 0);
    const size = Number(url.searchParams.get("size") || 20);
    const keyword = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const listingType = url.searchParams.get("listingType") ?? "all";
    const ceiling = url.searchParams.has("maxPrice") ? Number(url.searchParams.get("maxPrice")) : Infinity;
    const sort = url.searchParams.get("sort") ?? "relevance";
    const candidates =
      categoryId === "headphones"
        ? Array.from({ length: 25 }, (_, i) => product(100 + i, categoryId))
        : backendProducts.filter(
            (entry) => !categoryId || entry.categoryId === categoryId,
          );
    // UI fixture only; PostgreSQL integration tests establish the full-text contract.
    const words = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const phrase = words(keyword);
    const matches = (value) => {
      const tokens = words(value ?? "");
      return phrase.length === 0 ? !keyword : tokens.some((_, index) => phrase.every((word, offset) =>
        offset === phrase.length - 1 ? tokens[index + offset]?.startsWith(word) : tokens[index + offset] === word));
    };
    const filtered = candidates.filter((entry) => (matches(entry.name) || matches(entry.description))
      && (listingType === "all" || entry.auctionEnable === (listingType === "auction"))
      && (ceiling === Infinity || (entry.minPrice !== null && entry.minPrice <= ceiling)));
    filtered.sort((a, b) => {
      if (sort.startsWith("price_")) {
        if (a.minPrice === null || b.minPrice === null) return a.minPrice === b.minPrice ? a.id.localeCompare(b.id) : a.minPrice === null ? 1 : -1;
        return (sort === "price_asc" ? a.minPrice - b.minPrice : b.minPrice - a.minPrice) || a.id.localeCompare(b.id);
      }
      const rank = (entry) => entry.name.toLowerCase() === keyword ? 0 : entry.name.toLowerCase().startsWith(keyword) ? 1 : 2;
      return (sort === "relevance" && keyword ? rank(a) - rank(b) : 0)
        || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
    });
    return json(res, {
      code: 0,
      message: "response success",
      data: filtered.slice(page * size, (page + 1) * size),
      page: {
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size),
      },
    });
  }
  return json(res, { title: "Not found", status: 404 }, 404);
});

server.listen(fixturePort, "127.0.0.1");
