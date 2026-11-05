import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePage,
  findCategory,
  flattenCategories,
  readQueryValue,
  categoryHref,
  searchHref,
} from "../features/catalogUtils";
import {
  isCategoryTree,
  getCategoryTree,
  getProducts,
  parseProductPage,
  normalizeMoney,
} from "../service/catalogService";
import { formatVND } from "../components/formatPrice";
import { signUpSchema } from "../features/signUpSchema";
import { multiplyMoney } from "../mocks/product-detail";
import type { ApiContext } from "../types/commonRequestType";
import type { PageInfo } from "../types/commonResponseType";

const categories = [
  {
    id: "1",
    name: "Electronics",
    slug: "electronics",
    parentId: null,
    level: 1,
    children: [
      {
        id: "2",
        name: "Audio",
        slug: "audio",
        parentId: "1",
        level: 2,
        children: [],
      },
    ],
  },
];
const envelope = (data: unknown, page?: PageInfo) => ({
  code: 0,
  message: "response success",
  data,
  ...(page ? { page } : {}),
});

test("page validation prevents invalid API offsets", () => {
  for (const input of [
    undefined,
    ["2", "3"],
    "0",
    "-1",
    "1.5",
    "1e2",
    "NaN",
    "99999999999999999999",
    "2147483648",
  ])
    assert.equal(parsePage(input), 1);
  assert.equal(parsePage("2"), 2);
});
test("slug resolution searches nested categories and encodes path segments", () => {
  assert.equal(findCategory(categories, "audio")?.id, "2");
  assert.equal(findCategory(categories, "1")?.slug, "electronics");
  assert.equal(findCategory(categories, "missing"), undefined);
  assert.equal(categoryHref("audio/video"), "/categories/audio%2Fvideo");
});
test("tree flattening preserves hierarchy/order/depth without mutating input", () => {
  const before = JSON.stringify(categories);
  assert.deepEqual(
    flattenCategories(categories).map(({ id, depth }) => ({ id, depth })),
    [
      { id: "1", depth: 0 },
      { id: "2", depth: 1 },
    ],
  );
  assert.equal(JSON.stringify(categories), before);
});
test("query normalization and search URLs preserve encoding and omit default pages", () => {
  assert.equal(readQueryValue(undefined), "");
  assert.equal(readQueryValue([]), "");
  assert.equal(readQueryValue(["  audio  ", "ignored"]), "audio");
  assert.equal(searchHref({}), "/search");
  assert.equal(
    searchHref({ q: "a & b", category: "x/y", sort: "price,asc", page: 2 }),
    "/search?q=a+%26+b&category=x%2Fy&sort=price%2Casc&page=2",
  );
  assert.equal(searchHref({ q: "abc", page: 1 }), "/search?q=abc");
});
test("wire validation rejects malformed trees/pages before render", () => {
  assert.equal(isCategoryTree([]), true);
  assert.equal(isCategoryTree([{ id: "bad" }]), false);
  const page = { number: 0, size: 12, totalElements: 0, totalPages: 0 };
  assert.deepEqual(parseProductPage(envelope([], page)), {
    content: [],
    page: 0,
    size: 12,
    totalElements: 0,
    totalPages: 0,
  });
  assert.throws(() => parseProductPage(envelope([{}], page)));
  assert.throws(() => parseProductPage(envelope([])));
});
test("backend catalog service preserves paths, pagination and public auth policy", async () => {
  const calls: Array<{ path: string; auth: string | null }> = [];
  const context: ApiContext = {
    getAccessToken: () => "must-not-leak",
    fetch: async (input, init) => {
      const url = new URL(String(input), "http://mock.local");
      calls.push({
        path: url.pathname + url.search,
        auth: new Headers(init?.headers).get("authorization"),
      });
      return new Response(
        JSON.stringify(
          url.pathname.endsWith("tree")
            ? envelope(categories)
            : envelope([], {
                number: 1,
                size: 12,
                totalElements: 0,
                totalPages: 0,
              }),
        ),
      );
    },
  };
  assert.deepEqual(await getCategoryTree({ context }), categories);
  assert.deepEqual(
    (await getProducts({ categoryId: "2", page: 1, size: 12 }, { context }))
      .content,
    [],
  );
  assert.deepEqual(calls, [
    { path: "/api/v1/categories/tree", auth: null },
    { path: "/api/v1/products?categoryId=2&page=1&size=12", auth: null },
  ]);
});
test("VND formatting preserves decimal precision, grouping and invalid/null fallbacks", () => {
  for (const [input, expected] of [
    ["150000", "150.000 ₫"],
    ["150000.5", "150.000,50 ₫"],
    ["001000.125", "1.000,125 ₫"],
    ["12345678901234567890.12", "12.345.678.901.234.567.890,12 ₫"],
    ["0", "0 ₫"],
  ])
    assert.equal(formatVND(input), expected);
  for (const input of [null, "", "invalid", "-1", "1e3"])
    assert.equal(formatVND(input), null);
});
test("money normalization and fixture multiplication retain separate decimal semantics", () => {
  assert.equal(normalizeMoney("1.2"), "1.2");
  assert.equal(normalizeMoney(1.2), "1.20");
  for (const input of [null, -1, NaN, Infinity, {}, "-1"])
    assert.equal(normalizeMoney(input), null);
  assert.equal(multiplyMoney("150000.50", 3), "450001.50");
});
test("form schemas preserve required fields, password confirmation and terms rules", () => {
  assert.equal(
    signUpSchema.safeParse({ email: "bad", password: "" })
      .success,
    false,
  );
  const valid = {
    fullName: "Buyer",
    email: "buyer@example.test",
    phone: "0900000000",
    identityNumber: "123456",
    gender: "MALE",
    dateOfBirth: "1999-01-01",
    address: "Address",
    password: "Password123!",
    confirmPassword: "Password123!",
    termsAccepted: true,
  };
  assert.equal(signUpSchema.safeParse(valid).success, true);
  assert.equal(
    signUpSchema.safeParse({ ...valid, confirmPassword: "different" }).success,
    false,
  );
  assert.equal(
    signUpSchema.safeParse({ ...valid, termsAccepted: false }).success,
    false,
  );
  assert.equal(
    signUpSchema.safeParse({ ...valid, gender: "unknown" }).success,
    false,
  );
});

test("catalog/cart dev transports model numeric wire money and honor abort", async () => {
  const { getCatalogMockFetch } = await import("../mocks/catalogStub");
  const previousProduct = process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK;
  const previousCart = process.env.NEXT_PUBLIC_CART_MOCK;
  try {
    process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK = "true";
    process.env.NEXT_PUBLIC_CART_MOCK = "true";
    const productFetch = getCatalogMockFetch("/api/v1/products/mock-id");
    assert.ok(productFetch);
    const productResponse = await productFetch(
      "http://mock.local/api/v1/products/mock-id",
    );
    const product = await productResponse.json();
    assert.equal(typeof product.data.skus[0].price, "number");
    const cartFetch = getCatalogMockFetch("/api/v1/carts/me/items");
    assert.ok(cartFetch);
    const cartResponse = await cartFetch(
      "http://mock.local/api/v1/carts/me/items",
      { method: "POST", body: JSON.stringify({ skuId: "sku-1", quantity: 2 }) },
    );
    const cart = await cartResponse.json();
    assert.equal(typeof cart.data.items[0].unitPrice, "number");
    assert.equal(cartResponse.status, 201);
    await assert.rejects(
      productFetch("http://mock.local/api/v1/products/mock-id", {
        signal: AbortSignal.abort(),
      }),
      { name: "AbortError" },
    );
  } finally {
    if (previousProduct === undefined)
      delete process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK;
    else process.env.NEXT_PUBLIC_PRODUCT_DETAIL_MOCK = previousProduct;
    if (previousCart === undefined) delete process.env.NEXT_PUBLIC_CART_MOCK;
    else process.env.NEXT_PUBLIC_CART_MOCK = previousCart;
  }
});
test("catalog and cart mock flags are rejected in production", async () => {
  const { spawnSync } = await import("node:child_process");
  for (const flag of [
    "NEXT_PUBLIC_PRODUCT_DETAIL_MOCK",
    "NEXT_PUBLIC_CART_MOCK",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        `require(${JSON.stringify(require.resolve("../mocks/catalogStub"))}).getCatalogMockFetch('/api/v1/products/mock-id')`,
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
          NEXT_PUBLIC_CART_MOCK: "false",
          [flag]: "true",
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /mocks are disabled in production/);
  }
});
