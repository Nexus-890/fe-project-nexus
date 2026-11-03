"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { createOidcClient } from "../features/auth/oidc";
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

export function AuthProvider({ children, baseUrl, stub = false, fetch: transport, oidc: injectedOidc }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [oidc] = useState(() => injectedOidc ?? createOidcClient());
  const [token] = useState(() => {
    let value: string | null = null;
    return { get: () => value, set: (next: string | null) => { value = next; } };
  });
  const generation = useRef(0);
  const mounted = useRef(false);
  const callback = useRef<{
    url: string;
    result: Promise<ApiResult<string>>;
    retry?: () => Promise<ApiResult<string>>;
  } | null>(null);
  const [session, setSession] = useState({ accessToken: null as string | null, id: 0, signingIn: false });
  const [api] = useState(() => {
    if (stub && process.env.NODE_ENV === "production") throw new Error("The auth stub is disabled in production.");
    if (stub && transport) throw new Error("Choose either the auth stub or an injected fetch.");
    return createAuthApi(createApiClient({
      baseUrl, getAccessToken: token.get, fetch: stub ? createAuthStub() : transport,
    }));
  });
  const profile = useMeQuery(api, session.id, Boolean(session.accessToken));

  const clearSession = useCallback(() => {
    generation.current += 1;
    token.set(null);
    setSession({ accessToken: null, id: generation.current, signingIn: false });
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [queryClient, token]);

  const registration = useMutation<UserResponse, ApiError, RegisterRequest>({
    mutationKey: ["auth", "register"], gcTime: 0, retry: false,
    mutationFn: async (payload) => unwrapApiResult(await api.register(payload)),
  });
  const { mutateAsync: registerAsync, reset: resetRegistration } = registration;

  const signIn = useCallback(async (returnTo?: string): Promise<ApiResult<void>> => {
    clearSession();
    callback.current = null;
    const id = generation.current;
    setSession({ accessToken: null, id, signingIn: true });
    try {
      await oidc.signIn(returnTo);
      return { ok: true, data: undefined };
    } catch {
      if (generation.current === id) clearSession();
      return { ok: false, error: redirectError("Unable to open sign in. Please try again.") };
    }
  }, [clearSession, oidc]);

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
    const id = generation.current;
    setSession({ accessToken: null, id, signingIn: true });
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
      window.history.replaceState(window.history.state, "", "/auth/callback");
    }
    let destination = "/";
    const loadProfile = async (): Promise<ApiResult<string>> => {
      setSession({ accessToken: token.get(), id, signingIn: true });
      try {
        await queryClient.fetchQuery(meQueryOptions(api, id));
        if (generation.current !== id) return { ok: false, error: canceledSignIn() };
        setSession({ accessToken: token.get(), id, signingIn: false });
        return { ok: true, data: destination };
      } catch (error: unknown) {
        if (generation.current !== id) return { ok: false, error: canceledSignIn() };
        if (token.get() && !(isApiError(error) && error.status === 401)) {
          setSession({ accessToken: token.get(), id, signingIn: false });
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
        if (generation.current !== id) {
          await oidc.clearSession();
          return { ok: false, error: canceledSignIn() };
        }
        token.set(response.accessToken);
        destination = response.returnTo;
        // Fetch with the new token before enabling the profile observer. Tokens
        // and codes never enter query keys or mutation data/variables.
        return loadProfile();
      } catch (error: unknown) {
        if (generation.current !== id) return { ok: false, error: canceledSignIn() };
        clearSession();
        await oidc.clearSession().catch(() => {});
        return { ok: false, error: isApiError(error) ? error : redirectError("Sign in could not be completed. Please try again.") };
      }
    })();
    callback.current = { url, result };
    return result;
  }, [api, clearSession, oidc, queryClient, token]);

  const signOut = useCallback(async (): Promise<ApiResult<void>> => {
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
    if (profile.error?.kind === "http" && profile.error.status === 401 && session.accessToken) {
      clearSession();
      void oidc.clearSession().catch(() => {});
    }
  }, [clearSession, oidc, profile.error, session.accessToken]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode immediately replays setup. Only a real unmount invalidates
      // pending callback work and removes this provider's private cache.
      queueMicrotask(() => {
        if (mounted.current) return;
        generation.current += 1;
        token.set(null);
        void oidc.clearSession().catch(() => {});
        void queryClient.cancelQueries({ predicate: privateQuery });
        queryClient.removeQueries({ predicate: privateQuery });
      });
    };
  }, [oidc, queryClient, token]);

  const retryProfile = async (): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: canceledSignIn() };
    const id = generation.current;
    const result = await profile.refetch();
    if (generation.current !== id) return { ok: false, error: canceledSignIn() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: canceledSignIn() };
    return { ok: true, data: result.data };
  };
  const user = session.accessToken ? profile.data ?? null : null;
  const status = session.signingIn ? "authenticating"
    : user ? "authenticated"
      : session.accessToken ? profile.isError ? "error" : "authenticating" : "anonymous";

  return <AuthContext.Provider value={{ accessToken: session.accessToken, user, status,
    error: profile.error, api, signIn, completeSignIn, register, retryProfile, signOut }}>
    {children}
  </AuthContext.Provider>;
}
