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
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { getMe, login, register as registerUser } from "../service/authService";
import { updateProfile as updateAccountProfile } from "../service/accountService";
import { createAuthStub } from "../mocks/authStub";
import type { ApiContext } from "../types/commonRequestType";
import type { ApiResult } from "../types/commonResponseType";
import type { LoginRequest, RegisterRequest } from "../types/authRequestType";
import type { UserResponse } from "../types/authResponseType";
import type { AuthContextValue, AuthProviderProps } from "../types/authType";
import type { UpdateProfileRequest } from "../types/accountType";

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const privateQuery = (query: Query) =>
  query.meta?.requiresAuth === true || query.queryKey[0] === "auth";

type LoginOperation = {
  payload: LoginRequest;
  id: number;
  controller: AbortController;
};

/** AuthSession is below QueryClientProvider, including in the browser test harness. */
export function AuthSession({
  children,
  baseUrl,
  stub = false,
  fetch: transport,
}: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [token] = useState(() => {
    let value: string | null = null;
    return {
      get: () => value,
      set: (next: string | null) => {
        value = next;
      },
    };
  });
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const profileUpdates = useRef(new Set<AbortController>());
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
      // Preserve a failed login profile request until the caller explicitly retries.
      enabled: (query) =>
        Boolean(session.accessToken) &&
        (query.state.status !== "error" || query.state.data !== undefined),
    },
  );

  const { refetch: refetchProfile } = profile;

  const clearSession = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
    profileUpdates.current.forEach((controller) => controller.abort());
    profileUpdates.current.clear();
    token.set(null);
    setSession({ accessToken: null, id: generation.current, signingIn: false });
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [queryClient, token]);

  const loginMutation = useApiMutation<UserResponse, LoginOperation>(
    {
      mutationKey: ["auth", "login"],
      isCurrent: ({ id, controller }) =>
        generation.current === id && !controller.signal.aborted,
      execute: async ({ payload, id, controller }) => {
        const isCurrent = () =>
          generation.current === id && !controller.signal.aborted;
        const response = await login(payload, {
          context: requestContext,
          signal: controller.signal,
        });
        if (!isCurrent()) throw createCanceledError();
        token.set(response.accessToken);
        setSession({ accessToken: response.accessToken, id, signingIn: true });
        const user = await queryClient.fetchQuery({
          queryKey: queryKeys.auth.me(id),
          queryFn: ({ signal }) => getMe({ context: requestContext, signal }),
          meta: { requiresAuth: true },
          staleTime: 60_000,
          retry: false,
        });
        if (!isCurrent()) throw createCanceledError();
        pending.current = null;
        setSession({ accessToken: response.accessToken, id, signingIn: false });
        // Return only the user: the /login access token never enters MutationCache.
        return user;
      },
    },
    { gcTime: 0, retry: false },
  );

  const registration = useApiMutation<UserResponse, RegisterRequest>(
    {
      mutationKey: ["auth", "register"],
      execute: (payload) => registerUser(payload, { context: requestContext }),
    },
    { gcTime: 0, retry: false },
  );

  const { mutateAsync: loginAsync, reset: resetLogin } = loginMutation;
  const { mutateAsync: registerAsync, reset: resetRegistration } = registration;
  const signOut = useCallback(() => {
    clearSession();
    resetLogin();
    resetRegistration();
  }, [clearSession, resetLogin, resetRegistration]);

  const signIn = useCallback(
    async (payload: LoginRequest): Promise<ApiResult<UserResponse>> => {
      signOut();
      const id = generation.current;
      const controller = new AbortController();
      pending.current = controller;
      setSession({ accessToken: null, id, signingIn: true });
      try {
        return {
          ok: true,
          data: await loginAsync({ payload, id, controller }),
        };
      } catch (error: unknown) {
        if (generation.current !== id || controller.signal.aborted)
          return { ok: false, error: createCanceledError() };
        if (!isApiError(error)) throw error;
        if (!token.get() || (error.kind === "http" && error.status === 401)) {
          signOut();
        } else {
          pending.current = null;
          setSession({ accessToken: token.get(), id, signingIn: false });
        }
        return { ok: false, error };
      } finally {
        if (generation.current === id) resetLogin();
      }
    },
    [loginAsync, resetLogin, signOut, token],
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<ApiResult<UserResponse>> => {
      try {
        return { ok: true, data: await registerAsync(payload) };
      } catch (error: unknown) {
        if (!isApiError(error)) throw error;
        return { ok: false, error };
      } finally {
        resetRegistration();
      }
    },
    [registerAsync, resetRegistration],
  );

  useEffect(() => {
    if (
      profile.error?.kind === "http" &&
      profile.error.status === 401 &&
      session.accessToken
    )
      signOut();
  }, [profile.error, session.accessToken, signOut]);

  useEffect(
    () => () => {
      generation.current += 1;
      pending.current?.abort();
      profileUpdates.current.forEach((controller) => controller.abort());
      profileUpdates.current.clear();
      token.set(null);
      void queryClient.cancelQueries({ predicate: privateQuery });
      queryClient.removeQueries({ predicate: privateQuery });
    },
    [queryClient, token],
  );

  const retryProfile = useCallback(async (): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: createCanceledError() };
    const id = generation.current;
    const result = await refetchProfile();
    if (generation.current !== id)
      return { ok: false, error: createCanceledError() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: createCanceledError() };
    return { ok: true, data: result.data };
  }, [refetchProfile, token]);

  const updateProfile = useCallback(async (payload: UpdateProfileRequest): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: createCanceledError() };
    const id = generation.current;
    const controller = new AbortController();
    profileUpdates.current.add(controller);
    const isCurrent = () => generation.current === id && !controller.signal.aborted;
    try {
      const user = await updateAccountProfile(payload, { context: requestContext, signal: controller.signal });
      if (!isCurrent()) return { ok: false, error: createCanceledError() };
      await queryClient.cancelQueries({ queryKey: queryKeys.auth.me(id), exact: true });
      if (!isCurrent()) return { ok: false, error: createCanceledError() };
      queryClient.setQueryData(queryKeys.auth.me(id), user);
      return { ok: true, data: user };
    } catch (error: unknown) {
      if (!isCurrent()) return { ok: false, error: createCanceledError() };
      if (!isApiError(error)) throw error;
      if (error.status === 401) signOut();
      return { ok: false, error };
    } finally {
      profileUpdates.current.delete(controller);
    }
  }, [queryClient, requestContext, signOut, token]);
  const isSessionCurrent = useCallback(
    (id: number) => generation.current === id && Boolean(token.get()),
    [token],
  );
  const user = session.accessToken ? (profile.data ?? null) : null;
  const status = session.signingIn
    ? "authenticating"
    : user
      ? "authenticated"
      : session.accessToken
        ? profile.isError
          ? "error"
          : "authenticating"
        : "anonymous";

  return (
    <AuthContext.Provider
      value={{
        accessToken: session.accessToken,
        user,
        status,
        error: profile.error,
        requestContext,
        sessionId: session.id,
        isSessionCurrent,
        signIn,
        register,
        retryProfile,
        updateProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function Provider({
  children,
  stub = process.env.NEXT_PUBLIC_AUTH_STUB === "true",
  ...settings
}: AuthProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: 0 },
          queries: {
            gcTime: 5 * 60 * 1_000,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failures, error) =>
              isApiError(error) &&
              (error.kind === "network" || error.status >= 500) &&
              failures < 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSession {...settings} stub={stub}>
        {children}
      </AuthSession>
    </QueryClientProvider>
  );
}

export default Provider;
