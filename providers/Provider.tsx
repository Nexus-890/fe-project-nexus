"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { createCanceledError, isApiError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { createOidcClient } from "../features/oidc";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getMe, register as registerUser } from "../service/authService";
import { createAuthStub } from "../mocks/authStub";
import type { ApiContext } from "../types/commonRequestType";
import type { ApiError, ApiResult } from "../types/commonResponseType";
import type { RegisterRequest } from "../types/authRequestType";
import type { UserResponse } from "../types/authResponseType";
import type { AuthContextValue, AuthProviderProps } from "../types/authType";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const privateQuery = (query: Query) =>
  query.meta?.requiresAuth === true || query.queryKey[0] === "auth";

// Provider exceptions can contain callback URLs or tokens. Keep them out of the
// UI and TanStack caches; report only a sanitized action-level error.
const redirectError = (title: string): ApiError => ({ kind: "network", status: 0, title });

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
  const [session, setSession] = useState({
    accessToken: null as string | null,
    id: 0,
    signingIn: false,
  });
  const [requestContext] = useState<ApiContext>(() => {
    if (stub && process.env.NODE_ENV === "production")
      throw new Error("The auth stub is disabled in production.");
    if (stub && transport)
      throw new Error("Choose either the auth stub or an injected fetch.");
    return {
      baseUrl,
      getAccessToken: token.get,
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
      enabled: (query) => Boolean(session.accessToken) &&
        (query.state.status !== "error" || query.state.data !== undefined),
    },
  );

  const clearSession = useCallback(() => {
    generation.current += 1;
    token.set(null);
    setSession({ accessToken: null, id: generation.current, signingIn: false });
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [queryClient, token]);

  const registration = useApiMutation<UserResponse, RegisterRequest>(
    {
      mutationKey: ["auth", "register"],
      execute: (payload) => registerUser(payload, { context: requestContext }),
    },
    { gcTime: 0, retry: false },
  );
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
    const id = generation.current;
    setSession({ accessToken: null, id, signingIn: true });
    if (typeof window !== "undefined" && window.location.pathname === "/auth/callback")
      window.history.replaceState(window.history.state, "", "/auth/callback");
    let destination = "/";
    const loadProfile = async (): Promise<ApiResult<string>> => {
      setSession({ accessToken: token.get(), id, signingIn: true });
      try {
        await queryClient.fetchQuery({
          queryKey: queryKeys.auth.me(id),
          queryFn: ({ signal }) => getMe({ context: requestContext, signal }),
          meta: { requiresAuth: true },
          staleTime: 60_000,
          retry: false,
        });
        if (generation.current !== id) return { ok: false, error: createCanceledError() };
        setSession({ accessToken: token.get(), id, signingIn: false });
        return { ok: true, data: destination };
      } catch (error: unknown) {
        if (generation.current !== id) return { ok: false, error: createCanceledError() };
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
          return { ok: false, error: createCanceledError() };
        }
        token.set(response.accessToken);
        destination = response.returnTo;
        return loadProfile();
      } catch (error: unknown) {
        if (generation.current !== id) return { ok: false, error: createCanceledError() };
        clearSession();
        await oidc.clearSession().catch(() => {});
        return { ok: false, error: isApiError(error) ? error : redirectError("Sign in could not be completed. Please try again.") };
      }
    })();
    callback.current = { url, result };
    return result;
  }, [clearSession, oidc, queryClient, requestContext, token]);

  const signOut = useCallback(async (): Promise<ApiResult<void>> => {
    clearSession();
    callback.current = null;
    resetRegistration();
    try {
      // The adapter retains its in-memory ID token for the end-session request.
      await oidc.signOut();
      return { ok: true, data: undefined };
    } catch {
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
      // StrictMode immediately replays setup; only real unmount invalidates work.
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
    if (!token.get()) return { ok: false, error: createCanceledError() };
    const id = generation.current;
    const result = await profile.refetch();
    if (generation.current !== id) return { ok: false, error: createCanceledError() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: createCanceledError() };
    return { ok: true, data: result.data };
  };
  const isSessionCurrent = useCallback(
    (id: number) => generation.current === id && Boolean(token.get()),
    [token],
  );
  const user = session.accessToken ? (profile.data ?? null) : null;
  const status = session.signingIn ? "authenticating"
    : user ? "authenticated" : session.accessToken
      ? profile.isError ? "error" : "authenticating" : "anonymous";

  return (
    <AuthContext.Provider value={{
      accessToken: session.accessToken, user, status, error: profile.error,
      requestContext, sessionId: session.id, isSessionCurrent, signIn,
      completeSignIn, register, retryProfile, signOut,
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
      <AuthSession {...settings} stub={stub}>{children}</AuthSession>
    </QueryClientProvider>
  );
}

export default Provider;
