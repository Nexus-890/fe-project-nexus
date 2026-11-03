"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { createOidcClient } from "../features/auth/oidc";
import { createTokenSession, renewalDelay } from "../features/auth/token-session";
import { createApiClient } from "../lib/api-client";
import { canceledSignIn, isApiError, unwrapApiResult } from "../lib/api-result";
import type { ApiError, ApiResult } from "../types/common/response/type";
import type { RegisterRequest } from "../types/auth/request/type";
import type { UserResponse } from "../types/auth/response/type";
import { createAuthApi } from "../service/auth";
import { createAuthStub } from "../tests/fixtures/auth-stub";
import { meQueryOptions, useMeQuery } from "../hooks/auth/useMeQuery";
import type { AuthContextValue, AuthProviderProps } from "../types/auth/type";
export type { AuthContextValue, AuthProviderProps } from "../types/auth/type";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const privateQuery = (query: Query) =>
  query.meta?.requiresAuth === true || query.queryKey[0] === "auth";

// Provider exceptions may include callback URLs or token responses. Never put
// them into UI errors, logs, or TanStack's mutation cache.
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

export function AuthProvider({ children, baseUrl, stub = false, fetch: transport, oidc: injectedOidc }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [oidc] = useState(() => injectedOidc ?? createOidcClient());
  // An imperative transaction counter, shared with callbacks installed once
  // in the token coordinator. It does not participate in rendering.
  const [generation] = useState(() => {
    let value = 0;
    return { read: () => value, advance: () => ++value };
  });
  const mounted = useRef(false);
  const restoreStarted = useRef(false);
  const callback = useRef<{
    url: string;
    result: Promise<ApiResult<string>>;
    retry?: () => Promise<ApiResult<string>>;
  } | null>(null);
  const [session, setSession] = useState(() => emptySession(0, true));
  const renewalFailed = useCallback(() => {
    setSession(emptySession(generation.advance()));
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
    void oidc.clearSession().catch(() => {});
  }, [generation, oidc, queryClient]);
  const [tokens] = useState(() => createTokenSession({
    oidc,
    onRenew: (next) => setSession((previous) => ({ ...previous, accessToken: next.accessToken, expiresAt: next.expiresAt })),
    onFailure: renewalFailed,
  }));
  const [api] = useState(() => {
    if (stub && process.env.NODE_ENV === "production") throw new Error("The auth stub is disabled in production.");
    if (stub && transport) throw new Error("Choose either the auth stub or an injected fetch.");
    return createAuthApi(createApiClient({
      baseUrl, getAccessToken: tokens.getAccessToken, renewAccessToken: tokens.renewAccessToken,
      fetch: stub ? createAuthStub() : transport,
    }));
  });
  const profile = useMeQuery(api, session.id, Boolean(session.accessToken) && !session.signingIn && !session.restoring);

  const clearSession = useCallback(() => {
    const id = generation.advance();
    tokens.clear();
    setSession(emptySession(id));
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [generation, queryClient, tokens]);

  const registration = useMutation<UserResponse, ApiError, RegisterRequest>({
    mutationKey: ["auth", "register"], gcTime: 0, retry: false,
    mutationFn: async (payload) => unwrapApiResult(await api.register(payload)),
  });
  const { mutateAsync: registerAsync, reset: resetRegistration } = registration;

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
    // StrictMode replays the callback effect. Exchange each code once and
    // share the result with both subscribers.
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
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
      window.history.replaceState(window.history.state, "", "/auth/callback");
    }
    let destination = "/";
    const loadProfile = async (): Promise<ApiResult<string>> => {
      setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), id, signingIn: true, restoring: false }));
      try {
        await queryClient.fetchQuery(meQueryOptions(api, id));
        if (generation.read() !== id) return { ok: false, error: canceledSignIn() };
        setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), id, signingIn: false, restoring: false }));
        return { ok: true, data: destination };
      } catch (error: unknown) {
        if (generation.read() !== id) return { ok: false, error: canceledSignIn() };
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
          return { ok: false, error: canceledSignIn() };
        }
        tokens.start(response);
        setSession((previous) => ({ ...previous, expiresAt: response.expiresAt }));
        destination = response.returnTo;
        // Fetch with the new token before enabling the profile observer. Tokens
        // and codes never enter query keys or mutation data/variables.
        return loadProfile();
      } catch (error: unknown) {
        if (generation.read() !== id) return { ok: false, error: canceledSignIn() };
        clearSession();
        await oidc.clearSession().catch(() => {});
        return { ok: false, error: isApiError(error) ? error : redirectError("Sign in could not be completed. Please try again.") };
      }
    })();
    callback.current = { url, result };
    return result;
  }, [api, clearSession, generation, oidc, queryClient, tokens]);

  const signOut = useCallback(async (): Promise<ApiResult<void>> => {
    rememberLogout(true);
    clearSession();
    callback.current = null;
    resetRegistration();
    try {
      // The redirect client still has its in-memory ID token for end-session.
      await oidc.signOut();
      return { ok: true, data: undefined };
    } catch {
      // Retain the logout hint so a retry can end the remote session.
      return { ok: false, error: redirectError("Sign out could not be completed. Please try again.") };
    }
  }, [clearSession, oidc, resetRegistration]);

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
    // The silent callback only posts its URL to the parent frame. Starting
    // another restore here would recursively open more hidden iframes.
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
        await queryClient.fetchQuery(meQueryOptions(api, id));
        if (generation.read() !== id) return;
        setSession((previous) => ({ ...previous, accessToken: tokens.getAccessToken(), restoring: false }));
      } catch {
        if (generation.read() !== id) return;
        clearSession();
        await oidc.clearSession().catch(() => {});
      }
    })();
  }, [api, clearSession, generation, oidc, queryClient, stub, tokens]);

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
      // Query observers notify during cache processing. Invalidate the session
      // after that notification settles, and only if it is still the same one.
      queueMicrotask(() => {
        if (generation.read() !== id || tokens.getAccessToken() !== session.accessToken) return;
        clearSession();
        void oidc.clearSession().catch(() => {});
      });
    }
  }, [clearSession, generation, oidc, profile.error, session.accessToken, tokens]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode immediately replays setup. Only a real unmount invalidates
      // pending callback work and removes this provider's private cache.
      queueMicrotask(() => {
        if (mounted.current) return;
        generation.advance();
        tokens.clear();
        void oidc.clearSession().catch(() => {});
        void queryClient.cancelQueries({ predicate: privateQuery });
        queryClient.removeQueries({ predicate: privateQuery });
      });
    };
  }, [generation, oidc, queryClient, tokens]);

  const retryProfile = async (): Promise<ApiResult<UserResponse>> => {
    if (!tokens.getAccessToken()) return { ok: false, error: canceledSignIn() };
    const id = generation.read();
    const result = await profile.refetch();
    if (generation.read() !== id) return { ok: false, error: canceledSignIn() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: canceledSignIn() };
    return { ok: true, data: result.data };
  };
  const user = session.accessToken ? profile.data ?? null : null;
  const status = session.restoring ? "restoring" : session.signingIn ? "authenticating"
    : user ? "authenticated"
      : session.accessToken ? profile.isError ? "error" : "authenticating" : "anonymous";

  return <AuthContext.Provider value={{ accessToken: session.accessToken, user, status,
    error: profile.error, api, signIn, completeSignIn, register, retryProfile, signOut,
    renewAccessToken: tokens.renewAccessToken }}>
    {children}
  </AuthContext.Provider>;
}
