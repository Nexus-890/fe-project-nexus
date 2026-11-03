import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryObserver, useQueryClient } from "@tanstack/react-query";
import { apiQueryOptions, resolveApiUrl } from "../hooks/api-query-options";
import { createApiClient } from "../lib/api-client";
import { unwrapApiResult } from "../lib/api-result";
import { AppProviders } from "../providers/AppProviders";
import { createAuthApi } from "../service/auth";
import { meQueryOptions } from "../hooks/auth/useMeQuery";
import type { ApiError, BackendProblemDetails } from "../types/common/response/type";

const backendProblem: BackendProblemDetails = {
  status: 400, title: "Validation Failed",
  detail: "Email is invalid", traceId: "test-trace",
  errors: [{ field: "email", code: "VALIDATION_EMAIL", detail: "Invalid email" }],
};
const fieldError: ApiError = {
  ...backendProblem, kind: "http",
  errors: [{ field: "email", message: "Invalid email" }],
  fieldErrors: { email: ["Invalid email"] },
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

test("GET rejects with a typed field-error object and does not retry 400", async () => {
  const client = new QueryClient();
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls++; return json(backendProblem, 400); } });
  try {
    let returnedError: unknown;
    await assert.rejects(client.fetchQuery(apiQueryOptions({
      queryKey: ["validation"], url: "/validation", client: api,
    })), (error: unknown) => {
      returnedError = error;
      assert.deepEqual(error, { ...fieldError, type: undefined, instance: undefined });
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(client.getQueryState(["validation"])?.status, "error");
    assert.equal(client.getQueryState(["validation"])?.error, returnedError);
  } finally { client.clear(); }
});

test("disabled GET does not request; enabling fetches typed data", async () => {
  const client = new QueryClient();
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls++; return json({ id: "user-1" }); } });
  const options = apiQueryOptions<{ id: string }>({
    queryKey: ["auth", 1, "me"], url: "/me", client: api,
  }, { enabled: false, retry: false });
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.equal(calls, 0);
    assert.equal(observer.getCurrentResult().isLoading, false);
    observer.setOptions({ ...options, enabled: true });
    await observer.refetch();
    assert.equal(calls, 1);
    assert.deepEqual(observer.getCurrentResult().data, { id: "user-1" });
  } finally { unsubscribe(); client.clear(); }
});

test("GET cache is reused while fresh and separates session generations", async () => {
  const client = new QueryClient();
  let calls = 0;
  const api = createApiClient({ fetch: async () => json(++calls) });
  const options = (id: number) => apiQueryOptions<number>({
    queryKey: ["auth", id, "me"], url: "/me", client: api,
  }, { staleTime: 60_000 });
  try {
    assert.equal(await client.fetchQuery(options(1)), 1);
    assert.equal(await client.fetchQuery(options(1)), 1);
    assert.equal(await client.fetchQuery(options(2)), 2);
    assert.equal(calls, 2);
  } finally { client.clear(); }
});

test("GET cancellation forwards AbortSignal through Axios and cache can be removed", async () => {
  const client = new QueryClient();
  let signal: AbortSignal | null | undefined;
  const api = createApiClient({ fetch: (_, init) => new Promise((_, reject) => {
    signal = init?.signal;
    signal?.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true });
  }) });
  const request = client.fetchQuery(apiQueryOptions({
    queryKey: ["auth", 1, "me"], url: "/me", client: api,
  }, { retry: false }));
  const rejected = assert.rejects(request);
  await client.cancelQueries({ queryKey: ["auth"] });
  client.removeQueries({ queryKey: ["auth"] });
  await rejected;
  assert.equal(signal?.aborted, true);
  assert.equal(client.getQueryData(["auth", 1, "me"]), undefined);
  client.clear();
});

test("HTTP 4xx are not retried; transient failures are retried once", () => {
  const options = apiQueryOptions({ queryKey: ["retry"], url: "/retry" });
  if (typeof options.retry !== "function") throw new Error("Expected retry function");
  for (const status of [400, 401, 403, 409, 423]) {
    assert.equal(options.retry(0, { kind: "http", status, title: "Rejected" }), false);
  }
  assert.equal(options.retry(0, { kind: "network", status: 0, title: "Offline" }), true);
  assert.equal(options.retry(1, { kind: "http", status: 503, title: "Unavailable" }), false);
});

test("unwrap returns data but never turns failure into success", () => {
  assert.equal(unwrapApiResult({ ok: true, data: 42 }), 42);
  assert.throws(() => unwrapApiResult({ ok: false, error: fieldError }), (error: unknown) => error === fieldError);
});

test("source-shaped GET supports encoded path params, query, config and select", async () => {
  const client = new QueryClient();
  let seenUrl = "";
  let seenHeader: string | null = null;
  const api = createApiClient({ fetch: async (input, init) => {
    seenUrl = String(input);
    seenHeader = new Headers(init?.headers).get("X-Trace");
    return json({ id: "a/b", name: "Laptop" });
  } });
  const options = apiQueryOptions<{ id: string; name: string }, string, { productId: string }, { page: number; search: string }>({
    queryKey: ["product", "a/b", { page: 2, search: "Laptop x" }],
    url: "/api/product/:productId", pathParams: { productId: "a/b" },
    query: { page: 2, search: "Laptop x" }, config: { headers: { "X-Trace": "test" }, timeout: 1_000 },
    client: api,
  }, { select: (product) => product.name, retry: false });
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    assert.equal(seenUrl, "/api/product/a%2Fb?page=2&search=Laptop+x");
    assert.equal(seenHeader, "test");
    assert.equal(observer.getCurrentResult().data, "Laptop");
    assert.deepEqual(client.getQueryData(options.queryKey), { id: "a/b", name: "Laptop" });
  } finally { unsubscribe(); client.clear(); }
});

test("missing path params reject with typed error before transport", async () => {
  const client = new QueryClient();
  let calls = 0;
  const api = createApiClient({ fetch: async () => { calls++; return json({}); } });
  try {
    await assert.rejects(client.fetchQuery(apiQueryOptions({
      queryKey: ["missing"], url: "/products/:id", client: api,
    })), (error: unknown) => {
      assert.equal((error as ApiError).kind, "invalid-response");
      assert.match((error as ApiError).detail ?? "", /Missing path parameter: id/);
      return true;
    });
    assert.equal(calls, 0);
    assert.equal(resolveApiUrl("/products/:id", { id: 0 }), "/products/0");
  } finally { client.clear(); }
});

test("/me GET retains runtime UserResponse validation", async () => {
  const client = new QueryClient();
  const api = createAuthApi(createApiClient({ fetch: async () => json({ id: "incomplete" }) }));
  try {
    await assert.rejects(client.fetchQuery(meQueryOptions(api, 1)), (error: unknown) =>
      (error as ApiError).kind === "invalid-response");
  } finally { client.clear(); }
});

test("application provider adopts stable source QueryClient defaults", () => {
  let queryClient: QueryClient | undefined;
  function Probe() {
    queryClient = useQueryClient();
    const defaults = queryClient.getDefaultOptions();
    assert.deepEqual(defaults, {
      mutations: { retry: 0 },
      queries: { gcTime: 300_000, refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
    });
    return null;
  }
  try {
    renderToString(createElement(AppProviders, null, createElement(Probe)));
  } finally { queryClient?.clear(); }
});
