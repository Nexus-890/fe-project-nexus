import { createServer } from "node:http";

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
  minPrice: 150000.5,
});

const backendProducts = [
  product(1, "electronics"),
  product(2, "electronics"),
  product(3, "fashion"),
  product(4, "fashion"),
  product(5, "audio"),
];

let treeFailure = false;

function json(res, value, status = 200) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:3911");
  if (req.method === "OPTIONS") return json(res, {});
  if (url.pathname === "/health") return json(res, {});
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
  if (url.pathname === "/api/v1/products") {
    const categoryId = url.searchParams.get("categoryId");
    const page = Number(url.searchParams.get("page") || 0);
    const size = Number(url.searchParams.get("size") || 20);
    const filtered =
      categoryId === "headphones"
        ? Array.from({ length: 25 }, (_, i) => product(100 + i, categoryId))
        : backendProducts.filter(
            (entry) => !categoryId || entry.categoryId === categoryId,
          );
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

server.listen(3911, "127.0.0.1");
