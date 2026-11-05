import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useApiQuery,
  type ApiQueryOptions,
  type ApiQueryRequest,
} from "../hooks/useApi";
import { isApiError, requestApi, resolveApiUrl } from "../configs/api";
import Provider from "../providers/Provider";
import { getMe } from "../service/authService";
import type { ApiError, ProblemDetails } from "../types/commonResponseType";

const backendProblem: ProblemDetails = {
  status: 400,
  title: "Validation Failed",
  code: "VALIDATION_FAILED",
  detail: "Email is invalid",
  traceId: "test-trace",
  errors: [
    { field: "email", code: "VALIDATION_EMAIL", detail: "Invalid email" },
  ],
};
const success = (data: unknown) =>
  new Response(JSON.stringify({ code: 0, message: "response success", data }));

/** Render the actual shared hook, then exercise the query it registered in the cache. */
const renderQuery = <TResponse, TSelected = TResponse>(
  client: QueryClient,
  request: ApiQueryRequest<TResponse>,
  options: ApiQueryOptions<TResponse, TSelected> = {},
) => {
  let selectedData: TSelected | undefined;
  function Probe() {
    selectedData = useApiQuery<TResponse, TSelected>(request, {
      ...options,
      enabled: false,
    }).data;
    return null;
  }
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(Probe)),
  );
  const query = client
    .getQueryCache()
    .find<TResponse, ApiError>({ queryKey: request.queryKey, exact: true });
  assert.ok(query, "The shared hook must register its query");
  return { query, selectedData };
};

test("shared GET hook rejects typed field errors and does not retry a delivered 400", async () => {
  const client = new QueryClient();
  let calls = 0;
  const context = {
    fetch: (async () => {
      calls++;
      return new Response(JSON.stringify(backendProblem), { status: 400 });
    }) satisfies typeof fetch,
  };
  const key = ["validation"];
  const { query } = renderQuery(client, {
    queryKey: key,
    service: async (signal) =>
      (await requestApi("GET", "/validation", undefined, { context, signal }))
        .data,
  });
  try {
    let returnedError: unknown;
    await assert.rejects(query.fetch(), (error: unknown) => {
      assert.ok(isApiError(error));
      returnedError = error;
      assert.equal(error.code, "VALIDATION_FAILED");
      assert.deepEqual(error.fieldErrors, { email: ["Invalid email"] });
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(client.getQueryState(key)?.status, "error");
    assert.equal(client.getQueryState(key)?.error, returnedError);
  } finally {
    client.clear();
  }
});

test("disabled shared query sends no request and its observer can enable the registered service", async () => {
  const client = new QueryClient();
  let calls = 0;
  const key = ["auth", 1, "me"];
  const { query } = renderQuery(client, {
    queryKey: key,
    service: async () => {
      calls++;
      return { id: "user-1" };
    },
  });
  const options = {
    ...query.options,
    queryKey: key,
    enabled: false,
    retry: false,
  };
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.equal(calls, 0);
    assert.equal(observer.getCurrentResult().isLoading, false);
    observer.setOptions({ ...options, enabled: true });
    await observer.refetch();
    assert.equal(calls, 1);
    assert.deepEqual(observer.getCurrentResult().data, { id: "user-1" });
  } finally {
    unsubscribe();
    client.clear();
  }
});

test("shared query cache is reused while fresh and isolates session generations", async () => {
  const client = new QueryClient();
  let calls = 0;
  const mount = (id: number) =>
    renderQuery(
      client,
      {
        queryKey: ["auth", id, "me"],
        service: async () => ++calls,
        meta: { requiresAuth: true },
      },
      { staleTime: 60_000 },
    ).query;
  try {
    const first = mount(1);
    assert.equal(
      await client.fetchQuery({
        ...first.options,
        queryKey: first.queryKey,
        staleTime: 60_000,
      }),
      1,
    );
    assert.equal(
      await client.fetchQuery({
        ...first.options,
        queryKey: first.queryKey,
        staleTime: 60_000,
      }),
      1,
    );
    const second = mount(2);
    assert.equal(
      await client.fetchQuery({
        ...second.options,
        queryKey: second.queryKey,
        staleTime: 60_000,
      }),
      2,
    );
    assert.equal(calls, 2);
    assert.equal(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.queryKey),
      ).includes("token"),
      false,
    );
  } finally {
    client.clear();
  }
});

test("query cancellation forwards AbortSignal through Axios and protected cache can be removed", async () => {
  const client = new QueryClient();
  let signal: AbortSignal | null | undefined;
  let announceStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    announceStarted = resolve;
  });
  const context = {
    fetch: ((_, init) =>
      new Promise<Response>((_, reject) => {
        signal = init?.signal;
        announceStarted();
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Canceled", "AbortError")),
          { once: true },
        );
      })) satisfies typeof fetch,
  };
  const { query } = renderQuery(
    client,
    {
      queryKey: ["cart", 1],
      meta: { requiresAuth: true },
      service: async (signal) =>
        (await requestApi("GET", "/cart", undefined, { context, signal })).data,
    },
    { retry: false },
  );
  client.setQueryData(["catalog", "public"], "keep");
  try {
    const rejected = assert.rejects(query.fetch());
    await started;
    await client.cancelQueries({
      predicate: (query) => query.meta?.requiresAuth === true,
    });
    client.removeQueries({
      predicate: (query) => query.meta?.requiresAuth === true,
    });
    await rejected;
    assert.equal(signal?.aborted, true);
    assert.equal(client.getQueryData(["cart", 1]), undefined);
    assert.equal(client.getQueryData(["catalog", "public"]), "keep");
  } finally {
    client.clear();
  }
});

test("required private metadata survives caller options and transient GET failure retries once", async () => {
  const client = new QueryClient();
  let calls = 0;
  const { query } = renderQuery(
    client,
    {
      queryKey: ["cart", 1],
      meta: { requiresAuth: true },
      service: async () => {
        calls++;
        if (calls === 1)
          throw {
            kind: "http",
            status: 503,
            title: "Unavailable",
          } satisfies ApiError;
        return "recovered";
      },
    },
    { meta: { requiresAuth: false, description: "caller" }, retryDelay: 0 },
  );
  try {
    assert.equal(query.meta?.requiresAuth, true);
    assert.equal(query.meta?.description, "caller");
    assert.equal(await query.fetch(), "recovered");
    assert.equal(calls, 2);
    const retry = query.options.retry;
    assert.equal(typeof retry, "function");
    if (typeof retry !== "function")
      throw new Error("Expected shared hook retry policy");
    for (const status of [400, 401, 403, 409, 423]) {
      assert.equal(
        retry(0, { kind: "http", status, title: "Rejected" }),
        false,
      );
    }
    assert.equal(
      retry(0, { kind: "network", status: 0, title: "Offline" }),
      true,
    );
    assert.equal(
      retry(1, { kind: "http", status: 503, title: "Unavailable" }),
      false,
    );
    assert.equal(
      retry(0, { kind: "aborted", status: 0, title: "Canceled" }),
      false,
    );
  } finally {
    client.clear();
  }
});

test("select transforms the actual hook observer data without changing the raw query cache", () => {
  const client = new QueryClient();
  const key = ["products", "detail", "a/b"];
  const raw = { id: "a/b", name: "Laptop" };
  client.setQueryData(key, raw);
  try {
    const { selectedData } = renderQuery(
      client,
      {
        queryKey: key,
        service: async () => raw,
      },
      { select: (product) => product.name },
    );
    assert.equal(selectedData, "Laptop");
    assert.deepEqual(client.getQueryData(key), raw);
  } finally {
    client.clear();
  }
});

test("service callback supports encoded path/query/request config through the shared hook", async () => {
  const client = new QueryClient();
  let seenUrl = "";
  let seenHeader: string | null = null;
  const context = {
    fetch: (async (input, init) => {
      seenUrl = String(input);
      seenHeader = new Headers(init?.headers).get("X-Trace");
      return success({ id: "a/b", name: "Laptop" });
    }) satisfies typeof fetch,
  };
  const { query } = renderQuery(client, {
    queryKey: ["product", "a/b", { page: 2, search: "Laptop x" }],
    service: async (signal) =>
      (
        await requestApi(
          "GET",
          resolveApiUrl("/api/product/:id", { id: "a/b" }),
          undefined,
          {
            context,
            signal,
            params: { page: 2, search: "Laptop x" },
            config: { headers: { "X-Trace": "test" }, timeout: 1_000 },
          },
        )
      ).data,
  });
  try {
    assert.deepEqual(await query.fetch(), { id: "a/b", name: "Laptop" });
    assert.equal(seenUrl, "/api/product/a%2Fb?page=2&search=Laptop+x");
    assert.equal(seenHeader, "test");
  } finally {
    client.clear();
  }
});

test("missing path params reject before transport; profile service preserves runtime validation", async () => {
  const client = new QueryClient();
  let calls = 0;
  const context = {
    fetch: (async () => {
      calls++;
      return success({});
    }) satisfies typeof fetch,
  };
  const { query } = renderQuery(client, {
    queryKey: ["missing"],
    service: async (signal) =>
      (
        await requestApi("GET", resolveApiUrl("/products/:id"), undefined, {
          context,
          signal,
        })
      ).data,
  });
  try {
    await assert.rejects(query.fetch(), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.kind, "invalid-response");
      assert.match(error.detail ?? "", /Missing path parameter: id/);
      return true;
    });
    assert.equal(calls, 0);
    assert.equal(resolveApiUrl("/products/:id", { id: 0 }), "/products/0");
    const profile = renderQuery(client, {
      queryKey: ["auth", 1, "me"],
      service: (signal) => getMe({ context, signal }),
    }).query;
    await assert.rejects(
      profile.fetch(),
      (error: unknown) =>
        isApiError(error) && error.kind === "invalid-response",
    );
  } finally {
    client.clear();
  }
});

test("application provider creates the source defaults and keeps /me disabled anonymously", () => {
  let queryClient: QueryClient | undefined;
  function Probe() {
    queryClient = useQueryClient();
    const defaults = queryClient.getDefaultOptions();
    assert.deepEqual(defaults.mutations, { retry: 0 });
    assert.equal(defaults.queries?.gcTime, 300_000);
    assert.equal(defaults.queries?.staleTime, 30_000);
    assert.equal(defaults.queries?.refetchOnWindowFocus, false);
    const retry = defaults.queries?.retry;
    assert.equal(typeof retry, "function");
    if (typeof retry === "function") {
      assert.equal(
        retry(
          0,
          Object.assign(new Error("Bad Request"), {
            kind: "http",
            status: 400,
            title: "Bad Request",
          }),
        ),
        false,
      );
      assert.equal(
        retry(
          0,
          Object.assign(new Error("Offline"), {
            kind: "network",
            status: 0,
            title: "Offline",
          }),
        ),
        true,
      );
    }
    return null;
  }
  try {
    renderToString(createElement(Provider, null, createElement(Probe)));
    assert.ok(queryClient);
    const profile = queryClient
      .getQueryCache()
      .find({ queryKey: ["auth", 0, "me"] });
    assert.ok(profile);
    assert.equal(profile.state.fetchStatus, "idle");
    assert.equal(profile.meta?.requiresAuth, true);
  } finally {
    queryClient?.clear();
  }
});
