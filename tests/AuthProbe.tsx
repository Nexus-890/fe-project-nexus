"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthSession } from "../providers/Provider";
import { isApiError } from "../configs/api";
import { getMe } from "../service/authService";
import { createAuthStub } from "../mocks/authStub";
import { useAuth } from "../hooks/useAuth";
import type { ApiError, FieldErrors } from "../types/commonResponseType";
import type { OidcClient } from "../features/oidc";
import type { RegisterRequest } from "../types/authRequestType";

type DelayRule = {
  method: string;
  path: string;
  delayMs: number;
  ignoreAbort: boolean;
};

type StorageSnapshot = {
  ready: boolean;
  localCount: number;
  sessionCount: number;
  entries: string[];
};

type HarnessEvidence = {
  bearerMeMatchesLatestLogin: boolean | null;
  publicLoginHasAuthorization: boolean | null;
  cacheKeysContainRawToken: boolean;
  storageUnchanged: boolean | null;
  storageHasToken: boolean | null;
  storageBeforeEntryCount: number | null;
  storageAfterEntryCount: number | null;
  mutationDataContainsRawToken: boolean;
  privateQueryCount: number;
  privateCachedDataCount: number;
  mutationCount: number;
  requestCount: number;
  latestLoginCaptured: boolean;
};

type ActionError = {
  status: number | null;
  fieldErrors: FieldErrors | null;
};

type FixturePair = {
  primary: RegisterRequest;
  secondary: RegisterRequest;
};

type AuthProbeHarness = {
  fetch: typeof globalThis.fetch;
  oidc: OidcClient;
  callbackFor(input: { email: string; password: string }): string;
  captureInitialStorage(): void;
  delayNext(
    method: string,
    path: string,
    delayMs: number,
    ignoreAbort: boolean,
  ): void;
  failNextMe(status: number): void;
  evidence(queryClient: QueryClient): HarnessEvidence;
};

const API_BASE_URL = "http://auth-smoke.local";
const LOGIN_PATH = "/api/v1/auth/login";
const ME_PATH = "/api/v1/users/me";

export default function AuthProbe() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  );
  const [harness] = useState(() => createProbeHarness());
  const [, refreshAfterStorageCapture] = useState(0);

  useEffect(() => {
    harness.captureInitialStorage();
    const timer = window.setTimeout(
      () => refreshAfterStorageCapture((value) => value + 1),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [harness]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSession baseUrl={API_BASE_URL} fetch={harness.fetch} oidc={harness.oidc}>
        <AuthProbePanel harness={harness} />
      </AuthSession>
    </QueryClientProvider>
  );
}

function AuthProbePanel({ harness }: { harness: AuthProbeHarness }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const fixtures = useMemo(() => createFixtures(), []);
  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const started = await auth.signIn("/");
    if (!started.ok) return started;
    return auth.completeSignIn(harness.callbackFor(input));
  }, [auth, harness]);
  const [lastError, setLastError] = useState<ActionError>({
    status: null,
    fieldErrors: null,
  });
  const [, refresh] = useState(0);

  const rerender = useCallback(() => refresh((value) => value + 1), []);

  useEffect(() => {
    // Cache notifications can happen while the parent hook renders. Defer the
    // probe update so test instrumentation never sets React state during render.
    let active = true;
    const notify = () =>
      queueMicrotask(() => {
        if (active) rerender();
      });
    const unsubscribeQueryCache = queryClient.getQueryCache().subscribe(notify);
    const unsubscribeMutationCache = queryClient
      .getMutationCache()
      .subscribe(notify);
    return () => {
      active = false;
      unsubscribeQueryCache();
      unsubscribeMutationCache();
    };
  }, [queryClient, rerender]);

  const run = useCallback(
    async (action: () => Promise<ActionError | null>) => {
      const error = await action();
      setLastError(error ?? { status: null, fieldErrors: null });
      rerender();
    },
    [rerender],
  );

  const registerPrimary = useCallback(
    () =>
      run(async () => {
        const result = await auth.register(fixtures.primary);
        return result.ok ? null : toActionError(result.error);
      }),
    [auth, fixtures.primary, run],
  );

  const loginPrimary = useCallback(
    () =>
      run(async () => {
        const result = await signIn(toLogin(fixtures.primary));
        return result.ok ? null : toActionError(result.error);
      }),
    [fixtures.primary, run, signIn],
  );

  const signOut = useCallback(async () => {
    await auth.signOut();
    setLastError({ status: null, fieldErrors: null });
    rerender();
  }, [auth, rerender]);

  const meAfterLogout = useCallback(
    () =>
      run(async () => {
        await auth.signOut();
        try {
          await getMe({ context: auth.requestContext });
          return null;
        } catch (error: unknown) {
          if (!isApiError(error)) throw error;
          return toActionError(error);
        }
      }),
    [auth, run],
  );

  const invalidRegister400 = useCallback(
    () =>
      run(async () => {
        const invalid: RegisterRequest = {
          ...fixtures.primary,
          email: "",
          identityNumber: "",
        };
        const result = await auth.register(invalid);
        return result.ok ? null : toActionError(result.error);
      }),
    [auth, fixtures.primary, run],
  );

  const expiredMe401 = useCallback(
    () =>
      run(async () => {
        harness.failNextMe(401);
        await queryClient.refetchQueries({
          queryKey: ["auth"],
          type: "active",
        });
        await wait(0);
        return { status: 401, fieldErrors: null };
      }),
    [harness, queryClient, run],
  );

  const transientProfileFailure = useCallback(
    () =>
      run(async () => {
        await ensureRegistered(auth.register, fixtures.primary);
        harness.failNextMe(503);
        const result = await signIn(toLogin(fixtures.primary));
        return result.ok ? null : toActionError(result.error);
      }),
    [auth, fixtures.primary, harness, run, signIn],
  );

  const retryProfile = useCallback(
    () =>
      run(async () => {
        const result = await auth.retryProfile();
        return result.ok ? null : toActionError(result.error);
      }),
    [auth, run],
  );

  const delayedLoginRace = useCallback(
    () =>
      run(async () => {
        await ensureRegistered(auth.register, fixtures.primary);
        await ensureRegistered(auth.register, fixtures.secondary);
        harness.delayNext("POST", LOGIN_PATH, 150, true);

        const first = signIn(toLogin(fixtures.primary));
        await wait(10);
        const second = signIn(toLogin(fixtures.secondary));
        const results = await Promise.allSettled([first, second]);
        const rejected = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (rejected) throw rejected.reason;
        const firstResult = results[0];
        const secondResult = results[1];
        if (
          firstResult.status === "fulfilled" &&
          !firstResult.value.ok &&
          firstResult.value.error.kind !== "aborted"
        ) {
          return toActionError(firstResult.value.error);
        }
        if (secondResult.status === "fulfilled" && !secondResult.value.ok) {
          return toActionError(secondResult.value.error);
        }
        return null;
      }),
    [auth, fixtures.primary, fixtures.secondary, harness, run, signIn],
  );

  const delayedMeRace = useCallback(
    () =>
      run(async () => {
        await ensureRegistered(auth.register, fixtures.primary);
        harness.delayNext("GET", ME_PATH, 150, true);
        const pending = signIn(toLogin(fixtures.primary));
        await wait(10);
        await auth.signOut();
        const result = await pending;
        await wait(170);
        if (!result.ok && result.error.kind !== "aborted") {
          return toActionError(result.error);
        }
        return null;
      }),
    [auth, fixtures.primary, harness, run, signIn],
  );

  const accountSwitchSecond = useCallback(
    () =>
      run(async () => {
        await ensureRegistered(auth.register, fixtures.secondary);
        const result = await signIn(toLogin(fixtures.secondary));
        return result.ok ? null : toActionError(result.error);
      }),
    [auth, fixtures.secondary, run, signIn],
  );

  const state = {
    hasToken: Boolean(auth.accessToken),
    userEmail: auth.user?.email ?? null,
    status: auth.status,
    lastErrorStatus: lastError.status,
    fieldErrors: lastError.fieldErrors,
  };

  const evidence = harness.evidence(queryClient);

  return (
    <main
      aria-label="Auth smoke probe"
      style={{ fontFamily: "sans-serif", padding: 24 }}
    >
      <h1>Auth smoke probe</h1>
      <p>
        Browser-only acceptance harness for in-memory auth session behavior.
      </p>
      <ControlButton onClick={registerPrimary}>register</ControlButton>
      <ControlButton onClick={loginPrimary}>login</ControlButton>
      <ControlButton onClick={signOut}>signout</ControlButton>
      <ControlButton onClick={meAfterLogout}>me after logout</ControlButton>
      <ControlButton onClick={invalidRegister400}>
        invalid register 400
      </ControlButton>
      <ControlButton onClick={expiredMe401}>
        expired me 401 query invalidation
      </ControlButton>
      <ControlButton onClick={transientProfileFailure}>
        transient me 503 during login
      </ControlButton>
      <ControlButton onClick={retryProfile}>retry profile</ControlButton>
      <ControlButton onClick={delayedLoginRace}>
        delayed login ignoring abort
      </ControlButton>
      <ControlButton onClick={delayedMeRace}>
        delayed me ignoring abort
      </ControlButton>
      <ControlButton onClick={accountSwitchSecond}>
        account switch second fixture
      </ControlButton>
      <pre data-testid="state">{JSON.stringify(state)}</pre>
      <pre data-testid="evidence">{JSON.stringify(evidence)}</pre>
    </main>
  );
}

function ControlButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      style={{ display: "block", marginBlock: 8 }}
    >
      {children}
    </button>
  );
}

function createProbeHarness(): AuthProbeHarness {
  const stub = createAuthStub();
  const delays: DelayRule[] = [];
  let nextMeFailure: number | null = null;
  let beforeStorage: StorageSnapshot = emptyStorageSnapshot(false);
  let requestCount = 0;
  let latestLoginToken: string | null = null;
  let publicLoginHasAuthorization: boolean | null = null;
  let bearerMeMatchesLatestLogin: boolean | null = null;

  const transport: typeof globalThis.fetch = async (input, init) => {
    const url = toUrl(input);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const path = url.pathname;
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const authorization = headers.get("Authorization");
    requestCount += 1;

    if (method === "POST" && path === LOGIN_PATH) {
      publicLoginHasAuthorization = Boolean(authorization);
    }

    const delay = consumeDelay(delays, method, path);
    if (delay) {
      await wait(delay.delayMs);
    }

    if (nextMeFailure && method === "GET" && path === ME_PATH) {
      const status = nextMeFailure;
      nextMeFailure = null;
      return problemResponse(
        status,
        "Profile request rejected",
        "Injected auth smoke failure.",
      );
    }

    const response = await stub(
      input,
      delay?.ignoreAbort ? stripSignal(init) : init,
    );

    if (method === "POST" && path === LOGIN_PATH && response.ok) {
      const body = (await response
        .clone()
        .json()
        .catch(() => null)) as { data?: { accessToken?: unknown } } | null;
      latestLoginToken =
        typeof body?.data?.accessToken === "string"
          ? body.data.accessToken
          : latestLoginToken;
    }

    if (method === "GET" && path === ME_PATH && authorization) {
      bearerMeMatchesLatestLogin =
        Boolean(latestLoginToken) &&
        authorization === `Bearer ${latestLoginToken}`;
    }

    return response;
  };

  let callbackId = 0;
  const callbacks = new Map<string, { email: string; password: string }>();
  // Test-only adapter issues a fixture token; production sign-in never posts a password.
  const oidc: OidcClient = {
    signIn: async () => {},
    completeSignIn: async (url) => {
      const input = callbacks.get(url);
      callbacks.delete(url);
      if (!input) throw new Error("Unknown test callback");
      const response = await transport(API_BASE_URL + LOGIN_PATH, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw body;
      return { accessToken: body.data.accessToken, returnTo: "/" };
    },
    signOut: async () => {},
    clearSession: async () => {},
  };
  return {
    fetch: transport,
    oidc,
    callbackFor(input) {
      const url = "http://auth-smoke.local/auth/callback?code=fixture-" + ++callbackId;
      callbacks.set(url, input);
      return url;
    },
    captureInitialStorage() {
      beforeStorage = readStorageSnapshot();
    },
    delayNext(method, path, delayMs, ignoreAbort) {
      delays.push({ method: method.toUpperCase(), path, delayMs, ignoreAbort });
    },
    failNextMe(status) {
      nextMeFailure = status;
    },
    evidence(queryClient) {
      const afterStorage = beforeStorage.ready
        ? readStorageSnapshot()
        : emptyStorageSnapshot(false);
      const privateQueryCount = countPrivateQueries(queryClient);
      const mutationCount = queryClient.getMutationCache().getAll().length;
      return {
        bearerMeMatchesLatestLogin,
        publicLoginHasAuthorization,
        cacheKeysContainRawToken: containsRawToken(
          queryClient,
          latestLoginToken,
        ),
        storageUnchanged:
          beforeStorage.ready && afterStorage.ready
            ? snapshotsEqual(beforeStorage, afterStorage)
            : null,
        storageHasToken:
          latestLoginToken && afterStorage.ready
            ? afterStorage.entries.some((entry) =>
                entry.includes(latestLoginToken as string),
              )
            : null,
        storageBeforeEntryCount: beforeStorage.ready
          ? beforeStorage.entries.length
          : null,
        storageAfterEntryCount: afterStorage.ready
          ? afterStorage.entries.length
          : null,
        mutationDataContainsRawToken: mutationDataContainsRawToken(
          queryClient,
          latestLoginToken,
        ),
        privateQueryCount,
        privateCachedDataCount: queryClient
          .getQueryCache()
          .findAll()
          .filter(
            (query) =>
              (query.meta?.requiresAuth === true ||
                query.queryKey[0] === "auth") &&
              query.state.data !== undefined,
          ).length,
        mutationCount,
        requestCount,
        latestLoginCaptured: Boolean(latestLoginToken),
      };
    },
  };
}

function createFixtures(): FixturePair {
  const runId = runtimeId()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  return {
    primary: createRegisterFixture(`primary-${runId}`),
    secondary: createRegisterFixture(`secondary-${runId}`),
  };
}

function createRegisterFixture(label: string): RegisterRequest {
  const unique = `${label}-${runtimeId()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10)}`;
  return {
    email: `${unique}@auth-smoke.test`,
    phone: `09${digits(8)}`,
    password: `Pw-${runtimeId()}-${digits(4)}`,
    fullName: `Smoke User ${unique}`,
    identityNumber: digits(12),
    gender: "OTHER",
    address: `Smoke Address ${unique}`,
    dateOfBirth: "1999-01-01",
  };
}

function toLogin(input: RegisterRequest) {
  return { email: input.email, password: input.password };
}

async function ensureRegistered(
  register: (
    payload: RegisterRequest,
  ) => Promise<{ ok: true } | { ok: false; error: ApiError }>,
  fixture: RegisterRequest,
) {
  const result = await register(fixture);
  if (!result.ok && result.error.status !== 409) {
    throw result.error;
  }
}

function toActionError(error: ApiError): ActionError {
  return { status: error.status, fieldErrors: error.fieldErrors ?? null };
}

function consumeDelay(
  delays: DelayRule[],
  method: string,
  path: string,
): DelayRule | null {
  const index = delays.findIndex(
    (delay) => delay.method === method && delay.path === path,
  );
  if (index === -1) return null;
  return delays.splice(index, 1)[0] ?? null;
}

function stripSignal(init: RequestInit | undefined): RequestInit | undefined {
  if (!init) return undefined;
  return { ...init, signal: undefined };
}

function toUrl(input: RequestInfo | URL): URL {
  if (input instanceof Request) return new URL(input.url, API_BASE_URL);
  return new URL(String(input), API_BASE_URL);
}

function problemResponse(
  status: number,
  title: string,
  detail: string,
): Response {
  return new Response(
    JSON.stringify({
      type: `https://httpstatuses.com/${status}`,
      title,
      status,
      detail,
      code: status === 401 ? "UNAUTHENTICATED" : "SERVICE_UNAVAILABLE",
    }),
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}

function containsRawToken(
  queryClient: QueryClient,
  token: string | null,
): boolean {
  if (!token) return false;
  const queryKeys = queryClient
    .getQueryCache()
    .findAll()
    .map((query) => query.queryKey);
  const mutationKeys = queryClient
    .getMutationCache()
    .getAll()
    .map((mutation) => mutation.options.mutationKey);
  return [...queryKeys, ...mutationKeys].some((key) =>
    JSON.stringify(key).includes(token),
  );
}

function mutationDataContainsRawToken(
  queryClient: QueryClient,
  token: string | null,
): boolean {
  if (!token) return false;
  return queryClient
    .getMutationCache()
    .getAll()
    .some((mutation) => {
      const data = mutation.state.data;
      return data !== undefined && JSON.stringify(data).includes(token);
    });
}

function countPrivateQueries(queryClient: QueryClient): number {
  return queryClient
    .getQueryCache()
    .findAll()
    .filter(
      (query) =>
        query.meta?.requiresAuth === true || query.queryKey[0] === "auth",
    ).length;
}

function readStorageSnapshot(): StorageSnapshot {
  if (typeof window === "undefined") return emptyStorageSnapshot(false);

  return {
    ready: true,
    localCount: window.localStorage.length,
    sessionCount: window.sessionStorage.length,
    entries: [
      ...storageEntries("local", window.localStorage),
      ...storageEntries("session", window.sessionStorage),
    ].sort(),
  };
}

function storageEntries(
  scope: "local" | "session",
  storage: Storage,
): string[] {
  const entries: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    entries.push(`${scope}:${key}=${storage.getItem(key) ?? ""}`);
  }
  return entries;
}

function emptyStorageSnapshot(ready: boolean): StorageSnapshot {
  return { ready, localCount: 0, sessionCount: 0, entries: [] };
}

function snapshotsEqual(
  left: StorageSnapshot,
  right: StorageSnapshot,
): boolean {
  return (
    left.localCount === right.localCount &&
    left.sessionCount === right.sessionCount &&
    left.entries.length === right.entries.length &&
    left.entries.every((entry, index) => entry === right.entries[index])
  );
}

function runtimeId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  );
}

function digits(length: number): string {
  let output = "";
  while (output.length < length) {
    output += Math.floor(Math.random() * 10).toString();
  }
  return output.slice(0, length);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
