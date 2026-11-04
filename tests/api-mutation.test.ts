import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  useApiMutation,
  type ApiMutationOptions,
  type ApiMutationVariables,
} from "../hooks/useApi";
import { isApiError, requestApi, resolveApiUrl } from "../configs/api";
import type { ApiError } from "../types/commonResponseType";

type CacheTargets<TData, TVariables> =
  | readonly QueryKey[]
  | ((data: TData, variables: TVariables) => readonly QueryKey[]);
type Executor<TData, TVariables> = {
  mutationKey?: QueryKey;
  execute: (variables: TVariables) => Promise<TData>;
  invalidateKey?: CacheTargets<TData, TVariables>;
  removeKey?: CacheTargets<TData, TVariables>;
  isCurrent?: (variables: TVariables) => boolean;
};
const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const renderMutation = <TData, TVariables, TContext = unknown>(
  client: QueryClient,
  request: Executor<TData, TVariables>,
  options: ApiMutationOptions<TData, TVariables, TContext> = {},
) => {
  let result:
    | UseMutationResult<TData, ApiError, TVariables, TContext>
    | undefined;
  function Probe() {
    result = useApiMutation<TData, TVariables, TContext>(request, {
      gcTime: 0,
      ...options,
    });
    return null;
  }
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(Probe)),
  );
  assert.ok(
    result,
    "The actual generic mutation hook must render under QueryClientProvider",
  );
  return result;
};
const aborted = (error: unknown) =>
  isApiError(error) && error.kind === "aborted";

test("mutation invalidates prefixes/refetches active only, removes exact keys, then calls full success/settled callbacks", async () => {
  const client = new QueryClient();
  const activeKey = ["products", "list", { page: 0 }];
  const inactiveKey = ["products", "list", { page: 1 }];
  const removedKey = ["products", "deleted"];
  const descendantKey = ["products", "deleted", "history"];
  const gate = deferred<void>();
  const refetchStarted = deferred<void>();
  const events: string[] = [];
  let activeCalls = 0;
  const variables = { id: "p-1" };
  const response = { id: "p-1", status: "saved" };
  const snapshot = { previous: "old-value" };
  client.setQueryData(activeKey, ["stale"]);
  client.setQueryData(inactiveKey, ["inactive"]);
  client.setQueryData(removedKey, "remove");
  client.setQueryData(descendantKey, "keep-child");
  const observer = new QueryObserver(client, {
    queryKey: activeKey,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      activeCalls++;
      events.push("refetch-start");
      refetchStarted.resolve();
      await gate.promise;
      events.push("refetch-end");
      return ["fresh"];
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  const mutation = renderMutation(
    client,
    {
      mutationKey: ["products", "save"],
      execute: async (input: typeof variables) => {
        assert.equal(input, variables);
        events.push("execute");
        return response;
      },
      invalidateKey: [["products"]],
      removeKey: [removedKey],
    },
    {
      meta: { source: "mutation-test" },
      onMutate: (input, context) => {
        assert.equal(input, variables);
        assert.equal(context.client, client);
        assert.deepEqual(context.mutationKey, ["products", "save"]);
        events.push("onMutate");
        return snapshot;
      },
      onSuccess: (data, input, onMutateResult, context) => {
        assert.equal(data, response);
        assert.equal(input, variables);
        assert.equal(onMutateResult, snapshot);
        assert.equal(context.client, client);
        assert.deepEqual(context.meta, { source: "mutation-test" });
        assert.deepEqual(client.getQueryData(activeKey), ["fresh"]);
        assert.equal(client.getQueryState(inactiveKey)?.isInvalidated, true);
        assert.equal(client.getQueryData(removedKey), undefined);
        assert.equal(client.getQueryData(descendantKey), "keep-child");
        events.push("onSuccess");
      },
      onSettled: (data, error, input, onMutateResult, context) => {
        assert.equal(data, response);
        assert.equal(error, null);
        assert.equal(input, variables);
        assert.equal(onMutateResult, snapshot);
        assert.equal(context.client, client);
        events.push("onSettled");
      },
    },
  );
  try {
    assert.equal(activeCalls, 0);
    const pending = mutation.mutateAsync(variables);
    await refetchStarted.promise;
    assert.deepEqual(events, ["onMutate", "execute", "refetch-start"]);
    assert.equal(
      client.getQueryData(removedKey),
      "remove",
      "Removal waits for active refetch",
    );
    assert.equal(
      client.getMutationCache().find({ mutationKey: ["products", "save"] })
        ?.state.status,
      "pending",
    );
    gate.resolve();
    assert.equal(await pending, response);
    assert.equal(activeCalls, 1);
    assert.deepEqual(
      client.getQueryData(inactiveKey),
      ["inactive"],
      "Inactive matches are stale but not refetched",
    );
    assert.deepEqual(events, [
      "onMutate",
      "execute",
      "refetch-start",
      "refetch-end",
      "onSuccess",
      "onSettled",
    ]);
  } finally {
    gate.resolve();
    mutation.reset();
    unsubscribe();
    client.clear();
  }
});

test("mutation callback cache resolvers receive returned data and original variables", async () => {
  const client = new QueryClient();
  const variables = { session: 7, id: "sku-1" };
  const response = { cartId: "cart-7" };
  const cartKey = ["cart", 7, "me"];
  const removedKey = ["cart", 7, "sku-1"];
  const descendant = [...removedKey, "details"];
  client.setQueryData(cartKey, "old-cart");
  client.setQueryData(["cart", 8, "me"], "other-session");
  client.setQueryData(removedKey, "old-item");
  client.setQueryData(descendant, "history");
  const resolvers: string[] = [];
  const mutation = renderMutation(client, {
    execute: async (input: typeof variables) => {
      assert.equal(input, variables);
      return response;
    },
    invalidateKey: (data, input) => {
      assert.equal(data, response);
      assert.equal(input, variables);
      resolvers.push("invalidate");
      return [["cart", input.session]];
    },
    removeKey: (data, input) => {
      assert.equal(data.cartId, "cart-7");
      assert.equal(input, variables);
      resolvers.push("remove");
      return [["cart", input.session, input.id]];
    },
  });
  try {
    await mutation.mutateAsync(variables);
    assert.deepEqual(resolvers, ["invalidate", "remove"]);
    assert.equal(client.getQueryState(cartKey)?.isInvalidated, true);
    assert.equal(client.getQueryState(["cart", 8, "me"])?.isInvalidated, false);
    assert.equal(client.getQueryData(removedKey), undefined);
    assert.equal(client.getQueryData(descendant), "history");
  } finally {
    mutation.reset();
    client.clear();
  }
});

test("failed mutation forwards optimistic context to onError/onSettled, never runs success cache work or retries by default", async () => {
  const client = new QueryClient();
  const key = ["cart", 1];
  const failure: ApiError = {
    kind: "http",
    status: 409,
    code: "COMMERCE_CONFLICT",
    title: "Conflict",
  };
  const variables = { quantity: 2 };
  const events: string[] = [];
  let calls = 0;
  client.setQueryData(key, { quantity: 1 });
  const mutation = renderMutation(
    client,
    {
      execute: async (
        input: typeof variables,
      ): Promise<{ quantity: number }> => {
        assert.equal(input, variables);
        calls++;
        events.push("execute");
        throw failure;
      },
      invalidateKey: [["cart"]],
      removeKey: [key],
    },
    {
      onMutate: (input) => {
        const previous = client.getQueryData<{ quantity: number }>(key);
        client.setQueryData(key, input);
        events.push("onMutate");
        return { previous };
      },
      onSuccess: () => {
        assert.fail("Failed mutation must not run onSuccess");
      },
      onError: (error, input, snapshot, context) => {
        assert.equal(error, failure);
        assert.equal(input, variables);
        assert.equal(context.client, client);
        client.setQueryData(key, snapshot?.previous);
        events.push("onError");
      },
      onSettled: (data, error, input, snapshot, context) => {
        assert.equal(data, undefined);
        assert.equal(error, failure);
        assert.equal(input, variables);
        assert.deepEqual(snapshot?.previous, { quantity: 1 });
        assert.equal(context.client, client);
        events.push("onSettled");
      },
    },
  );
  try {
    await assert.rejects(
      mutation.mutateAsync(variables),
      (error: unknown) => error === failure,
    );
    assert.equal(calls, 1);
    assert.deepEqual(client.getQueryData(key), { quantity: 1 });
    assert.equal(client.getQueryState(key)?.isInvalidated, false);
    assert.deepEqual(events, ["onMutate", "execute", "onError", "onSettled"]);
  } finally {
    mutation.reset();
    client.clear();
  }
});

test("service mutation forwards typed body/path/query/config and signal into an actual HTTP request", async () => {
  const client = new QueryClient();
  const controller = new AbortController();
  type Body = { skuId: string; quantity: number };
  type Path = { cartId: string };
  type Query = { include: string };
  type Result = { accepted: boolean };
  type Variables = ApiMutationVariables<Body, Path, Query>;
  let received:
    | { url: string; body: string | undefined; trace: string | null }
    | undefined;
  let mutation: UseMutationResult<Result, ApiError, Variables> | undefined;
  const context = {
    fetch: (async (input, init) => {
      received = {
        url: String(input),
        body: init?.body?.toString(),
        trace: new Headers(init?.headers).get("X-Trace"),
      };
      return new Response(
        JSON.stringify({
          code: 0,
          message: "response success",
          data: { accepted: true },
        }),
        { status: 201 },
      );
    }) satisfies typeof fetch,
  };
  function Probe() {
    mutation = useApiMutation<Result, Body, Path, Query>(
      {
        mutationKey: ["cart", "add"],
        service: async (variables, signal) => {
          assert.equal(signal, controller.signal);
          const response = await requestApi<Result>(
            "POST",
            resolveApiUrl("/carts/:cartId/items", variables.pathParams),
            variables.body,
            {
              context,
              signal,
              auth: false,
              params: variables.query,
              config: variables.config,
            },
          );
          return response.data;
        },
      },
      { gcTime: 0 },
    );
    return null;
  }
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(Probe)),
  );
  assert.ok(mutation);
  try {
    const result = await mutation.mutateAsync({
      body: { skuId: "sku-1", quantity: 2 },
      pathParams: { cartId: "a/b" },
      query: { include: "count" },
      config: { headers: { "X-Trace": "mutation" } },
      signal: controller.signal,
    });
    assert.deepEqual(result, { accepted: true });
    assert.deepEqual(received, {
      url: "/carts/a%2Fb/items?include=count",
      body: '{"skuId":"sku-1","quantity":2}',
      trace: "mutation",
    });
  } finally {
    mutation.reset();
    client.clear();
  }
});

test("executor generation guards reject stale operations before endpoint execution and after a pending response", async () => {
  const client = new QueryClient();
  let generation = 1;
  let calls = 0;
  let successCalls = 0;
  const response = deferred<{ id: string }>();
  const started = deferred<void>();
  const mutation = renderMutation(
    client,
    {
      mutationKey: ["cart", "update"],
      isCurrent: (variables: { session: number }) =>
        variables.session === generation,
      execute: async () => {
        calls++;
        started.resolve();
        return response.promise;
      },
      invalidateKey: [["cart"]],
      removeKey: [["cart", 2]],
    },
    {
      onSuccess: (data, variables) => {
        successCalls++;
        client.setQueryData(["cart", variables.session], data);
      },
    },
  );
  client.setQueryData(["catalog", "public"], "keep");
  try {
    await assert.rejects(mutation.mutateAsync({ session: 0 }), aborted);
    assert.equal(
      calls,
      0,
      "Already stale operations must not reach their executor",
    );
    const pending = mutation.mutateAsync({ session: 1 });
    const rejected = assert.rejects(pending, aborted);
    await started.promise;
    generation = 2;
    client.removeQueries({ queryKey: ["cart", 1] });
    client.setQueryData(["cart", 2], "new-session");
    response.resolve({ id: "old-cart" });
    await rejected;
    assert.equal(successCalls, 0);
    assert.equal(client.getQueryData(["cart", 1]), undefined);
    assert.equal(client.getQueryData(["cart", 2]), "new-session");
    assert.equal(client.getQueryState(["cart", 2])?.isInvalidated, false);
    assert.equal(client.getQueryData(["catalog", "public"]), "keep");
    assert.equal(
      client.getMutationCache().find({ mutationKey: ["cart", "update"] })?.state
        .data,
      undefined,
    );
  } finally {
    response.resolve({ id: "cleanup" });
    mutation.reset();
    client.clear();
  }
});

test("generation changes during awaited invalidation suppress later removal and caller success", async () => {
  const client = new QueryClient();
  let generation = 1;
  let successCalls = 0;
  const gate = deferred<void>();
  const started = deferred<void>();
  const key = ["catalog", "active"];
  client.setQueryData(key, "stale");
  client.setQueryData(["cart", 2], "new-session");
  const observer = new QueryObserver(client, {
    queryKey: key,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      started.resolve();
      await gate.promise;
      return "fresh";
    },
  });
  const unsubscribe = observer.subscribe(() => {});
  const mutation = renderMutation(
    client,
    {
      execute: async (variables: { session: number }) => {
        assert.equal(variables.session, 1);
        return "saved";
      },
      isCurrent: (variables) => variables.session === generation,
      invalidateKey: [["catalog"]],
      removeKey: [["cart", 2]],
    },
    {
      onSuccess: () => {
        successCalls++;
      },
    },
  );
  try {
    const pending = mutation.mutateAsync({ session: 1 });
    await started.promise;
    generation = 2;
    gate.resolve();
    await pending;
    assert.equal(client.getQueryData(["cart", 2]), "new-session");
    assert.equal(successCalls, 0);
  } finally {
    gate.resolve();
    mutation.reset();
    unsubscribe();
    client.clear();
  }
});

test("canceling a service mutation preserves AbortError and never invalidates, removes or reports success", async () => {
  const client = new QueryClient();
  const controller = new AbortController();
  const started = deferred<void>();
  const key = ["cart", 1];
  client.setQueryData(key, "existing");
  let calls = 0;
  let observedError: unknown;
  type Variables = ApiMutationVariables<{ quantity: number }>;
  let mutation: UseMutationResult<void, ApiError, Variables> | undefined;
  const context = {
    fetch: ((input, init) =>
      new Promise<Response>((resolve, reject) => {
        assert.equal(String(input), "/cart/items");
        calls++;
        started.resolve();
        if (!init?.signal) {
          resolve(new Response(null, { status: 204 }));
          return;
        }
        init.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Canceled", "AbortError")),
          { once: true },
        );
      })) satisfies typeof fetch,
  };
  function Probe() {
    mutation = useApiMutation<void, { quantity: number }>(
      {
        service: async (variables, signal) => {
          await requestApi("POST", "/cart/items", variables.body, {
            context,
            signal,
          });
        },
        invalidateKey: [["cart"]],
        removeKey: [key],
      },
      {
        gcTime: 0,
        onSuccess: () => {
          assert.fail("Canceled mutation must not report success");
        },
        onError: (error) => {
          observedError = error;
        },
      },
    );
    return null;
  }
  renderToString(
    createElement(QueryClientProvider, { client }, createElement(Probe)),
  );
  assert.ok(mutation);
  try {
    const pending = mutation.mutateAsync({
      body: { quantity: 2 },
      signal: controller.signal,
    });
    const rejected = assert.rejects(
      pending,
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError",
    );
    await started.promise;
    controller.abort();
    await rejected;
    assert.ok(
      observedError instanceof DOMException &&
        observedError.name === "AbortError",
    );
    assert.equal(calls, 1);
    assert.equal(client.getQueryData(key), "existing");
    assert.equal(client.getQueryState(key)?.isInvalidated, false);
  } finally {
    controller.abort();
    mutation.reset();
    client.clear();
  }
});
