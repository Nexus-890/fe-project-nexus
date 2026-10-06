import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { apiQueryOptions } from "../hooks/api-query-options";
import { unwrapApiResult } from "../lib/api-result";
import type { ApiError } from "../types/api";

const fieldError: ApiError = {
  kind: "http", status: 400, title: "Validation failed",
  detail: "Email is invalid", traceId: "test-trace",
  fieldErrors: { email: ["Invalid email"] },
};

test("query adapter rejects with the original typed field-error object", async () => {
  const client = new QueryClient();
  let calls = 0;
  try {
    await assert.rejects(client.fetchQuery(apiQueryOptions({
      queryKey: ["validation"],
      queryFn: async () => { calls++; return { ok: false, error: fieldError }; },
    })), (error: unknown) => error === fieldError);
    assert.equal(calls, 1);
    assert.equal(client.getQueryState(["validation"])?.status, "error");
    assert.equal(client.getQueryState(["validation"])?.error, fieldError);
  } finally { client.clear(); }
});

test("disabled GET does not request; enabling fetches typed data", async () => {
  const client = new QueryClient();
  let calls = 0;
  const options = apiQueryOptions({
    queryKey: ["auth", 1, "me"],
    queryFn: async () => { calls++; return { ok: true, data: { id: "user-1" } }; },
    enabled: false,
    retry: false,
  });
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
  const options = (id: number) => apiQueryOptions({
    queryKey: ["auth", id, "me"], staleTime: 60_000,
    queryFn: async () => ({ ok: true, data: ++calls }),
  });
  try {
    assert.equal(await client.fetchQuery(options(1)), 1);
    assert.equal(await client.fetchQuery(options(1)), 1);
    assert.equal(await client.fetchQuery(options(2)), 2);
    assert.equal(calls, 2);
  } finally { client.clear(); }
});

test("GET cancellation forwards AbortSignal and cache can be removed", async () => {
  const client = new QueryClient();
  let signal: AbortSignal | undefined;
  const request = client.fetchQuery(apiQueryOptions({
    queryKey: ["auth", 1, "me"], retry: false,
    queryFn: (inputSignal) => new Promise((_, reject) => {
      signal = inputSignal;
      inputSignal.addEventListener("abort", () => reject(new DOMException("Canceled", "AbortError")), { once: true });
    }),
  }));
  const rejected = assert.rejects(request);
  await client.cancelQueries({ queryKey: ["auth"] });
  client.removeQueries({ queryKey: ["auth"] });
  await rejected;
  assert.equal(signal?.aborted, true);
  assert.equal(client.getQueryData(["auth", 1, "me"]), undefined);
  client.clear();
});

test("HTTP 401/403/409/423 are not retried", () => {
  const options = apiQueryOptions({
    queryKey: ["retry"], queryFn: async () => ({ ok: true, data: null }),
  });
  assert.equal(typeof options.retry, "function");
  if (typeof options.retry !== "function") throw new Error("Expected retry function");
  for (const status of [400, 401, 403, 409, 423]) {
    assert.equal(options.retry(0, { kind: "http", status, title: "Rejected" }), false);
  }
});

test("unwrap returns data but never turns failure into success", () => {
  assert.equal(unwrapApiResult({ ok: true, data: 42 }), 42);
  assert.throws(() => unwrapApiResult({ ok: false, error: fieldError }), (error: unknown) => error === fieldError);
});
