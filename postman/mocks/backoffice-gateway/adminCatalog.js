/* Test-only HTTP simulation. SYS DTOs follow delivered config-service OpenAPI. */
exports.createAdminCatalogFixture = ({ ok, problem, list, bodyOf, randomUUID }) => {
  const id = (n) => `a2280000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  let active = false, categories = [], warehouses = [], configs = [], movements = [], balance, requests = [], unavailable = false;
  const defaultWarehouse = { id: "69000000-0000-4000-8000-000000000001", code: "WH_DEFAULT", name: "Default warehouse", address: null, status: "ACTIVE" };
  const reset = () => {
    active = true; unavailable = false; requests = [];
    categories = [
      { id: id(1), name: "Electronics", slug: "electronics", parentId: null, description: "Devices and accessories" },
      { id: id(2), name: "Audio", slug: "audio", parentId: id(1), description: "Sound equipment" },
      { id: id(3), name: "Headphones", slug: "headphones", parentId: id(2), description: "Personal audio" },
      { id: id(4), name: "Books", slug: "books", parentId: null, description: "Books with products", hasProducts: true },
    ];
    warehouses = [{ id: id(20), code: "WH_HCM", name: "Ho Chi Minh warehouse", address: "1 Nguyen Hue", status: "ACTIVE" },
      { id: id(21), code: "WH_HN", name: "Hanoi warehouse", address: null, status: "INACTIVE" }];
    balance = { skuId: id(31), warehouseId: id(20), total: 10, available: 8, reserved: 2, unavailable: 0 };
    movements = Array.from({ length: 12 }, (_, index) => ({ id: id(100 + index), skuId: id(31), warehouseId: id(20),
      movementType: index === 0 ? "ADJUSTMENT" : "INTAKE", quantity: index === 0 ? -2 : 1, referenceId: null,
      reason: index === 0 ? "Damaged packaging" : null, createdAt: new Date(Date.UTC(2026, 10, 17, 1, index)).toISOString() }));
    configs = [
      { key: "AUCTION_MIN_DURATION_MINUTES", value: 60, defaultValue: 60, description: "Minimum auction duration", service: "auction-service", applyMode: "CONFIG_SOURCE", configuredValue: 60 },
      { key: "MAX_LOGIN_ATTEMPTS", value: 5, defaultValue: 5, description: "Maximum failed login attempts", service: "user-service", applyMode: "KEYCLOAK_MANAGED", configuredValue: 5 },
      { key: "ALLOW_GUEST_CART", value: true, defaultValue: true, description: "Allow guest users to have carts", service: "commerce-service", applyMode: "CONFIG_SOURCE", configuredValue: true },
      { key: "NOTIFICATION_RETRY_LIMIT", value: 3, defaultValue: 3, description: "Notification retry attempts", service: "notification-service", applyMode: "RUNTIME", configuredValue: 3 },
    ];
  };
  const depth = (row) => row.parentId ? 1 + depth(categories.find((item) => item.id === row.parentId)) : 1;
  const height = (row) => 1 + Math.max(0, ...categories.filter((item) => item.parentId === row.id).map(height));
  const pathOf = (row) => (row.parentId ? pathOf(categories.find((item) => item.id === row.parentId)) : "/") + row.slug + "/";
  const details = (row) => ({ id: row.id, name: row.name, slug: row.slug, description: row.description, parentId: row.parentId, level: depth(row), path: pathOf(row) });
  const tree = (parentId = null) => categories.filter((row) => row.parentId === parentId).map((row) => ({ ...details(row), children: tree(row.id) }));
  const handle = (req, res, url, claims) => {
    const path = url.pathname;
    if (path === "/test/catalog-admin/reset") { reset(); ok(res, {}); return true; }
    if (path === "/test/catalog-admin/control") { unavailable = Boolean(bodyOf(req).unavailable); ok(res, {}); return true; }
    if (path === "/test/catalog-admin/evidence") { ok(res, { requests, categories, warehouses, configs, balance }); return true; }
    if (!active) {
      if (path === "/v1/warehouses" && req.method === "GET") { ok(res, [defaultWarehouse]); return true; }
      if (path === "/v1/inventory/movements") { list(res, [], url); return true; }
      return false;
    }
    if (!/^\/v1\/(?:categories|warehouses|system\/configs|inventory\/(?:intake|balances|movements)|products(?:\/|$))/.test(path)) return false;
    const body = bodyOf(req);
    requests.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), body, authenticated: Boolean(claims), roles: claims?.roles ?? [] });
    const publicRead = req.method === "GET" && /^\/v1\/(categories|products)/.test(path);
    if (!publicRead && !claims?.roles?.includes("ADMIN")) { problem(res, 403, "Administrator access required"); return true; }
    if (path === "/v1/categories/tree") { ok(res, tree()); return true; }
    if (path === "/v1/categories" && req.method === "POST") {
      const row = { ...body, id: randomUUID() };
      if (categories.some((item) => item.slug === row.slug)) { problem(res, 409, "Category slug already exists"); return true; }
      categories.push(row); ok(res, details(row), 201); return true;
    }
    if (path.startsWith("/v1/categories/")) {
      const row = categories.find((item) => item.id === path.split("/").at(-1));
      if (!row) { problem(res, 404, "Category not found"); return true; }
      if (req.method === "DELETE") {
        if (categories.some((item) => item.parentId === row.id)) problem(res, 409, "Category has children", "CATEGORY_HAS_CHILDREN");
        else if (row.hasProducts) problem(res, 409, "Category has products", "CATEGORY_HAS_PRODUCTS");
        else { categories = categories.filter((item) => item.id !== row.id); res.writeHead(204); res.end(); }
      } else if (req.method === "PATCH") {
        const target = categories.find((item) => item.id === body.parentId);
        if (body.parentId && (!target || depth(target) + height(row) > 3)) problem(res, 400, "Category tree exceeds maximum depth", "CATEGORY_INVALID_MOVE");
        else { Object.assign(row, body); ok(res, details(row)); }
      } else ok(res, details(row));
      return true;
    }
    if (path === "/v1/warehouses") {
      if (req.method === "POST") {
        if (warehouses.some((row) => row.code === body.code)) problem(res, 409, "Warehouse code already exists");
        else { const row = { ...body, id: randomUUID(), status: "ACTIVE" }; warehouses.push(row); ok(res, row, 201); }
      } else ok(res, warehouses);
      return true;
    }
    if (path.startsWith("/v1/warehouses/")) {
      const row = warehouses.find((item) => item.id === path.split("/").at(-1));
      if (!row) problem(res, 404, "Warehouse not found");
      else { Object.assign(row, body); ok(res, row); }
      return true;
    }
    if (path === "/v1/products" || path === `/v1/products/${id(30)}`) {
      const product = { id: id(30), name: "Studio headphones", slug: "studio-headphones", categoryId: id(3), sellerId: id(50), status: "ACTIVE", auctionEnable: false, minPrice: 200000, maxPrice: 200000, images: [],
        skus: [{ id: id(31), productId: id(30), skuCode: "AUDIO-BLK", color: "Black", size: "Standard", price: 200000, status: "ACTIVE" }] };
      if (path === "/v1/products") list(res, [product], url); else ok(res, product);
      return true;
    }
    if (path === "/v1/inventory/intake") {
      if (body.quantity < 1 || !Number.isInteger(body.quantity)) problem(res, 400, "Quantity must be positive");
      else {
        balance.total += body.quantity; balance.available += body.quantity;
        movements.unshift({ id: randomUUID(), skuId: balance.skuId, warehouseId: balance.warehouseId, movementType: "INTAKE", quantity: body.quantity, referenceId: null, reason: null, createdAt: new Date().toISOString() });
        ok(res, balance, 201);
      }
      return true;
    }
    if (path === "/v1/inventory/balances") { list(res, !url.searchParams.get("warehouseId") || url.searchParams.get("warehouseId") === balance.warehouseId ? [balance] : [], url); return true; }
    if (path === "/v1/inventory/movements") { list(res, movements.filter((row) => !url.searchParams.get("warehouseId") || url.searchParams.get("warehouseId") === row.warehouseId), url); return true; }
    if (path.startsWith("/v1/system/configs")) {
      if (unavailable) problem(res, 404, "No configuration API is delivered");
      else if (req.method === "GET") list(res, configs, url);
      else {
        const row = configs.find((item) => item.key === decodeURIComponent(path.split("/").at(-1)));
        if (!row) problem(res, 400, "Unknown system configuration key", "CONFIG_KEY_UNKNOWN");
        else if (row.applyMode === "KEYCLOAK_MANAGED") problem(res, 400, "This configuration is managed by Keycloak", "CONFIG_KEY_EXTERNALLY_MANAGED");
        else if (typeof body.value !== typeof row.value) problem(res, 400, "Configuration value has the wrong type", "CONFIG_VALUE_INVALID");
        else { row.value = body.value; row.configuredValue = body.value; ok(res, { key: row.key, value: row.value }); }
      }
      return true;
    }
    return false;
  };
  return { handle };
};
