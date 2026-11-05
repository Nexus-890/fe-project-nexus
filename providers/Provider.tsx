"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { API_BASE_URL, createCanceledError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { createOidcClient } from "../features/oidc";
import { createTokenSession, renewalDelay } from "../features/tokenSession";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getMe, register as registerUser } from "../service/authService";
import { updateProfile as saveProfile } from "../service/accountService";
import { createAuthStub } from "../mocks/authStub";
import type { ApiContext } from "../types/commonRequestType";
import type { ApiError, ApiResult } from "../types/commonResponseType";
import type { RegisterRequest } from "../types/authRequestType";
import type { UpdateProfileRequest } from "../types/accountType";
import type { UserResponse } from "../types/authResponseType";
import type { AuthContextValue, AuthProviderProps } from "../types/authType";
import CartProvider from "./CartProvider";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const privateQuery = (query: Query) =>
  query.meta?.requiresAuth === true || query.queryKey[0] === "auth";

// Provider exceptions can contain callback URLs or tokens. Keep them out of the
// UI and TanStack caches; report only a sanitized action-level error.
const redirectError = (title: string): ApiError => ({ kind: "network", status: 0, title });
const LOGGED_OUT_KEY = "nexus.auth.logged-out";
const emptySession = (id: number, restoring = false) => ({
  accessToken: null as string | null, expiresAt: 0, id, signingIn: false, restoring,
});

function rememberLogout(loggedOut: boolean): void {
  try {
    if (loggedOut) window.sessionStorage.setItem(LOGGED_OUT_KEY, "1");
    else window.sessionStorage.removeItem(LOGGED_OUT_KEY);
  } catch { /* Remote end-session still runs if browser storage is blocked. */ }
}

function explicitlyLoggedOut(): boolean {
  try { return window.sessionStorage.getItem(LOGGED_OUT_KEY) === "1"; }
  catch { return false; }
}

/** AuthSession is below QueryClientProvider, including in the browser harness. */
export function AuthSession({
  children,
  baseUrl,
  stub = false,
  fetch: transport,
  oidc: injectedOidc,
}: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [oidc] = useState(() => injectedOidc ?? createOidcClient());
  // The coordinator callbacks and request context share this imperative counter.
  const [generation] = useState(() => {
    let value = 0;
    return { read: () => value, advance: () => ++value };
  });
  const mounted = useRef(false);
  const [profileUpdates] = useState(() => new Set<AbortController>());
  const restoreStarted = useRef(false);
  const callback = useRef<{
    url: string;
    result: Promise<ApiResult<string>>;
    retry?: () => Promise<ApiResult<string>>;
  } | null>(null);
  const [session, setSession] = useState(() => emptySession(0, true));
  const renewalFailed = useCallback(() => {
    profileUpdates.forEach((controller) => controller.abort());
    profileUpdates.clear();
    setSession(emptySession(generation.advance()));
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
    void oidc.clearSession().catch(() => {});
  }, [generation, oidc, queryClient, profileUpdates]);
  const [tokens] = useState(() => createTokenSession({
    oidc,
    onRenew: (next) => setSession((previous) => ({ ...previous, accessToken: next.accessToken, expiresAt: next.expiresAt })),
    onFailure: renewalFailed,
  }));
  const [requestContext] = useState<ApiContext>(() => {
    if (stub && process.env.NODE_ENV === "production")
      throw new Error("The auth stub is disabled in production.");
    if (stub && transport)
      throw new Error("Choose either the auth stub or an injected fetch.");
    return {
      baseUrl: baseUrl ?? API_BASE_URL,
      getAccessToken: tokens.getAccessToken,
      renewAccessToken: tokens.renewAccessToken,
      getSessionId: generation.read,
      fetch: stub ? createAuthStub() : transport,
    };
  });

  const profile = useApiQuery<UserResponse>(
    {
      queryKey: queryKeys.auth.me(session.id),
      service: (signal) => getMe({ context: requestContext, signal }),
      meta: { requiresAuth: true },
    },
    {
      staleTime: 60_000,
      retry: false,
      // A failed callback profile request waits for an explicit retry.
      enabled: (query) => Boolean(session.accessToken) && !session.signingIn && !session.restoring &&
        (query.state.status !== "error" || query.state.data !== undefined),
    },
  );

  const clearSession = useCallback(() => {
    profileUpdates.forEach((controller) => controller.abort());
    profileUpdates.clear();
    tokens.clear();
    setSession(emptySession(generation.advance()));
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [generation, queryClient, tokens, profileUpdates]);

  const registration = useApiMutation<UserResponse, RegisterRequest>(
    {
      mutationKey: ["auth", "register"],
      execute: (payload) => registerUser(payload, { context: requestContext }),
    },
    { gcTime: 0, retry: false },
  );
  const { mutateAsync: registerAsync, reset: resetRegistration } = registration;

  const profileUpdate = useApiMutation<UserResponse, {
    body: UpdateProfileRequest;
    sessionId: number;
    controller: AbortController;
  }>(
    {
      mutationKey: ["auth", "update-profile"],
      execute: ({ body, controller }) => saveProfile(body, {
        context: requestContext,
        signal: controller.signal,
      }),
      isCurrent: ({ sessionId, controller }) =>
        generation.read() === sessionId && Boolean(tokens.getAccessToken()) && !controller.signal.aborted,
    },
    {
      gcTime: 0,
      retry: false,
      onSuccess: async (user, { sessionId, controller }) => {
        // An older GET must not overwrite the values returned by the update.
        await queryClient.cancelQueries({ queryKey: queryKeys.auth.me(sessionId), exact: true });
        if (generation.read() !== sessionId || controller.signal.aborted || !tokens.getAccessToken()) return;
        queryClient.setQueryData(queryKeys.auth.me(sessionId), user);
      },
    },
  );
  const { mutateAsync: saveProfileAsync, reset: resetProfileUpdate } = profileUpdate;

  const signIn = useCallback(async (returnTo?: string): Promise<ApiResult<void>> => {
    clearSession();
    rememberLogout(false);
    callback.current = null;
    const id = generation.read();
    setSession({ ...emptySession(id), signingIn: true });
    try {
      await oidc.signIn(returnTo);
      return { ok: true, data: undefined };
    } catch {
      if (generation.read() === id) clearSession();
      return { ok: false, error: redirectError("Unable to open sign in. Please try again.") };
    }
  }, [clearSession, generation, oidc]);

  const completeSignIn = useCallback((url: string): Promise<ApiResult<string>> => {
    // StrictMode replays callback effects. Share one exchange result and retry
    // only the profile load when its transient failure leaves a valid token.
    if (callback.current?.url === url) {
      if (callback.current.retry) {
        const retry = callback.current.retry;
        callback.current.retry = undefined;
        callback.current.result = retry();
      }
      return callback.current.result;
    }
    clearSession();
    const id = generation.read();
    setSession({ ...emptySession(id), signingIn: true });
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback")
      window.history.replaceState(window.history.state, "", "/auth/callback");
    let destination = "/";
    const loadProfile = async (): Promise<ApiResult<string>> => {
      setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), id, signingIn: true, restoring: false }));
      try {
        await queryClient.fetchQuery({
          queryKey: queryKeys.auth.me(id),
          queryFn: ({ signal }) => getMe({ context: requestContext, signal }),
          meta: { requiresAuth: true },
          staleTime: 60_000,
          retry: false,
        });
        if (generation.read() !== id) return { ok: false, error: createCanceledError() };
        setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), id, signingIn: false, restoring: false }));
        return { ok: true, data: destination };
      } catch (error: unknown) {
        if (generation.read() !== id) return { ok: false, error: createCanceledError() };
        if (tokens.getAccessToken() && !(isApiError(error) && error.status === 401)) {
          setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), id, signingIn: false, restoring: false }));
          if (callback.current?.url === url) callback.current.retry = loadProfile;
        } else {
          clearSession();
          await oidc.clearSession().catch(() => {});
        }
        return { ok: false, error: isApiError(error) ? error : redirectError("Unable to load your account. Please try again.") };
      }
    };
    const result = (async (): Promise<ApiResult<string>> => {
      try {
        const response = await oidc.completeSignIn(url);
        if (generation.read() !== id) {
          return { ok: false, error: createCanceledError() };
        }
        tokens.start(response);
        setSession((previous) => ({ ...previous, expiresAt: response.expiresAt }));
        destination = response.returnTo;
        return loadProfile();
      } catch (error: unknown) {
        if (generation.read() !== id) return { ok: false, error: createCanceledError() };
        clearSession();
        await oidc.clearSession().catch(() => {});
        return { ok: false, error: isApiError(error) ? error : redirectError("Sign in could not be completed. Please try again.") };
      }
    })();
    callback.current = { url, result };
    return result;
  }, [clearSession, generation, oidc, queryClient, requestContext, tokens]);

  const signOut = useCallback(async (): Promise<ApiResult<void>> => {
    rememberLogout(true);
    clearSession();
    callback.current = null;
    resetRegistration();
    resetProfileUpdate();
    try {
      // The adapter retains its in-memory ID token for the end-session request.
      await oidc.signOut();
      return { ok: true, data: undefined };
    } catch {
      return { ok: false, error: redirectError("Sign out could not be completed. Please try again.") };
    }
  }, [clearSession, oidc, resetProfileUpdate, resetRegistration]);

  const register = useCallback(async (payload: RegisterRequest): Promise<ApiResult<UserResponse>> => {
    try {
      return { ok: true, data: await registerAsync(payload) };
    } catch (error: unknown) {
      if (!isApiError(error)) throw error;
      return { ok: false, error };
    } finally { resetRegistration(); }
  }, [registerAsync, resetRegistration]);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    // The silent callback relays its URL to the parent; it must not open more frames.
    if (window.location.pathname === "/auth/silent" || window.location.pathname === "/auth/callback") return;
    const id = generation.read();
    void (async () => {
      try {
        const restored = await (stub || explicitlyLoggedOut() ? Promise.resolve(null) : oidc.restoreSession());
        if (generation.read() !== id) return;
        if (!restored) {
          setSession(emptySession(id));
          return;
        }
        tokens.start(restored);
        setSession({ ...emptySession(id, true), accessToken: restored.accessToken, expiresAt: restored.expiresAt });
        await queryClient.fetchQuery({
          queryKey: queryKeys.auth.me(id),
          queryFn: ({ signal }) => getMe({ context: requestContext, signal }),
          meta: { requiresAuth: true },
          staleTime: 60_000,
          retry: false,
        });
        if (generation.read() !== id) return;
        setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), restoring: false }));
      } catch {
        if (generation.read() !== id) return;
        clearSession();
        await oidc.clearSession().catch(() => {});
      }
    })();
  }, [clearSession, generation, oidc, queryClient, requestContext, stub, tokens]);

  useEffect(() => {
    if (!session.accessToken || !session.expiresAt) return;
    const timer = window.setTimeout(() => { void tokens.renew(); }, renewalDelay(session.expiresAt));
    const checkExpiry = () => {
      if (document.visibilityState !== "hidden" && session.expiresAt * 1000 - Date.now() <= 60_000) void tokens.renew();
    };
    window.addEventListener("focus", checkExpiry);
    document.addEventListener("visibilitychange", checkExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", checkExpiry);
      document.removeEventListener("visibilitychange", checkExpiry);
    };
  }, [session.accessToken, session.expiresAt, tokens]);

  useEffect(() => {
    if (profile.error?.kind === "http" && profile.error.status === 401 && session.accessToken) {
      const id = generation.read();
      // Query observers notify during cache processing. Clear only this session,
      // after that notification settles, preserving newer sign-ins/renewals.
      queueMicrotask(() => {
        if (generation.read() !== id || tokens.getAccessToken() !== session.accessToken) return;
        clearSession();
        void oidc.clearSession().catch(() => {});
      });
    }
  }, [clearSession, generation, oidc, profile.error, session.accessToken, tokens]);

  useEffect(() => {
    mounted.current = true;
    const pendingUpdates = profileUpdates;
    return () => {
      mounted.current = false;
      // StrictMode immediately replays setup; only real unmount invalidates work.
      queueMicrotask(() => {
        if (mounted.current) return;
        generation.advance();
        pendingUpdates.forEach((controller) => controller.abort());
        pendingUpdates.clear();
        tokens.clear();
        void oidc.clearSession().catch(() => {});
        void queryClient.cancelQueries({ predicate: privateQuery });
        queryClient.removeQueries({ predicate: privateQuery });
      });
    };
  }, [generation, oidc, queryClient, tokens, profileUpdates]);

  const { refetch: refetchProfile } = profile;
  const retryProfile = useCallback(async (): Promise<ApiResult<UserResponse>> => {
    if (!tokens.getAccessToken()) return { ok: false, error: createCanceledError() };
    const id = generation.read();
    const result = await refetchProfile();
    if (generation.read() !== id) return { ok: false, error: createCanceledError() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: createCanceledError() };
    return { ok: true, data: result.data };
  }, [generation, refetchProfile, tokens]);
  const updateProfile = useCallback(async (payload: UpdateProfileRequest): Promise<ApiResult<UserResponse>> => {
    const id = session.id;
    if (generation.read() !== id || !tokens.getAccessToken())
      return { ok: false, error: createCanceledError() };
    const controller = new AbortController();
    profileUpdates.add(controller);
    try {
      const user = await saveProfileAsync({ body: payload, sessionId: id, controller });
      if (generation.read() !== id || controller.signal.aborted)
        return { ok: false, error: createCanceledError() };
      return { ok: true, data: user };
    } catch (error: unknown) {
      if (generation.read() !== id || controller.signal.aborted)
        return { ok: false, error: createCanceledError() };
      if (!isApiError(error)) throw error;
      if (error.status === 401) {
        clearSession();
        void oidc.clearSession().catch(() => {});
      }
      return { ok: false, error };
    } finally {
      profileUpdates.delete(controller);
      resetProfileUpdate();
    }
  }, [clearSession, oidc, resetProfileUpdate, saveProfileAsync, session.id, generation, tokens, profileUpdates]);
  const isSessionCurrent = useCallback(
    (id: number) => generation.read() === id && Boolean(tokens.getAccessToken()),
    [generation, tokens],
  );
  const user = session.accessToken ? (profile.data ?? null) : null;
  const status = session.restoring ? "restoring" : session.signingIn ? "authenticating"
    : user ? "authenticated" : session.accessToken
      ? profile.isError ? "error" : "authenticating" : "anonymous";

  return (
    <AuthContext.Provider value={{
      accessToken: session.accessToken, user, status, error: profile.error,
      requestContext, sessionId: session.id, isSessionCurrent, signIn,
      completeSignIn, register, retryProfile, updateProfile, signOut, renewAccessToken: tokens.renewAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function Provider({
  children,
  stub = process.env.NEXT_PUBLIC_AUTH_STUB === "true",
  ...settings
}: AuthProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      mutations: { retry: 0 },
      queries: {
        gcTime: 5 * 60 * 1_000,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failures, error) => isApiError(error) &&
          (error.kind === "network" || error.status >= 500) && failures < 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSession {...settings} stub={stub}>
        <CartProvider>{children}</CartProvider>
      </AuthSession>
    </QueryClientProvider>
  );
}

export default Provider;
