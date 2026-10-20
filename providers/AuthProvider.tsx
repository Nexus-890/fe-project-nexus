"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { createApiClient } from "../lib/api-client";
import { canceledSignIn, isApiError, unwrapApiResult } from "../lib/api-result";
import type { ApiError, ApiResult } from "../types/common/response/type";
import type { LoginRequest, RegisterRequest } from "../types/auth/request/type";
import type { UserResponse } from "../types/auth/response/type";
import { createAuthApi } from "../service/auth";
import { createAccountApi } from "../service/account";
import type { UpdateProfileRequest } from "../types/account/type";
import { queryKeys } from "../configs/query-keys";
import { createAuthStub } from "../tests/fixtures/auth-stub";
import { meQueryOptions, useMeQuery } from "../hooks/auth/useMeQuery";

import type { AuthContextValue, AuthProviderProps } from "../types/auth/type";
export type { AuthContextValue, AuthProviderProps } from "../types/auth/type";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);



const privateQuery = (query: Query) =>
  query.meta?.requiresAuth === true || query.queryKey[0] === "auth";

export function AuthProvider({ children, baseUrl, stub = false, fetch: transport }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [token] = useState(() => {
    let value: string | null = null;
    return {
      get: () => value,
      set: (next: string | null) => { value = next; },
    };
  });
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const profileUpdates = useRef(new Set<AbortController>());
  const [session, setSession] = useState({ accessToken: null as string | null, id: 0, signingIn: false });
  const [api] = useState(() => {
    if (stub && process.env.NODE_ENV === "production") {
      throw new Error("The auth stub is disabled in production.");
    }
    if (stub && transport) throw new Error("Choose either the auth stub or an injected fetch.");
    return createAuthApi(createApiClient({
      baseUrl,
      getAccessToken: token.get,
      fetch: stub ? createAuthStub() : transport,
    }));
  });
  const profile = useMeQuery(api, session.id, Boolean(session.accessToken));
  const { refetch: refetchProfile } = profile;
  const isCurrentSession = useCallback((id: number) =>
    generation.current === id && Boolean(token.get()), [token]);

  const clearSession = useCallback(() => {
    // Invalidate the old generation before cancellation or React's next render.
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

  const login = useMutation<UserResponse, ApiError, {
    payload: LoginRequest;
    id: number;
    controller: AbortController;
  }>({
    mutationKey: ["auth", "login"],
    gcTime: 0,
    retry: false,
    mutationFn: async ({ payload, id, controller }) => {
      const isCurrent = () => generation.current === id && !controller.signal.aborted;
      const response = unwrapApiResult(await api.login(payload, controller.signal));
      if (!isCurrent()) throw canceledSignIn();
      token.set(response.accessToken);
      setSession({ accessToken: response.accessToken, id, signingIn: true });
      const user = await queryClient.fetchQuery(meQueryOptions(api, id));
      if (!isCurrent()) throw canceledSignIn();
      pending.current = null;
      setSession({ accessToken: response.accessToken, id, signingIn: false });
      // Never return LoginResponse: it would put the token into MutationCache.
      return user;
    },
  });

  const registration = useMutation<UserResponse, ApiError, RegisterRequest>({
    mutationKey: ["auth", "register"],
    gcTime: 0,
    retry: false,
    mutationFn: async (payload) => unwrapApiResult(await api.register(payload)),
  });

  const { mutateAsync: loginAsync, reset: resetLogin } = login;
  const { mutateAsync: registerAsync, reset: resetRegistration } = registration;
  const signOut = useCallback(() => {
    clearSession();
    resetLogin();
    resetRegistration();
  }, [clearSession, resetLogin, resetRegistration]);

  const signIn = useCallback(async (payload: LoginRequest): Promise<ApiResult<UserResponse>> => {
    signOut();
    const id = generation.current;
    const controller = new AbortController();
    pending.current = controller;
    setSession({ accessToken: null, id, signingIn: true });
    try {
      return { ok: true, data: await loginAsync({ payload, id, controller }) };
    } catch (error: unknown) {
      if (generation.current !== id || controller.signal.aborted) {
        return { ok: false, error: canceledSignIn() };
      }
      if (!isApiError(error)) throw error;
      if (!token.get() || (error.kind === "http" && error.status === 401)) {
        signOut();
      } else {
        // Login succeeded. A temporary profile failure must not destroy a
        // valid session; callers can retry the auth query without a new login.
        pending.current = null;
        setSession({ accessToken: token.get(), id, signingIn: false });
      }
      return { ok: false, error };
    } finally {
      if (generation.current === id) resetLogin();
    }
  }, [loginAsync, resetLogin, signOut, token]);

  const register = useCallback(async (payload: RegisterRequest): Promise<ApiResult<UserResponse>> => {
    try {
      return { ok: true, data: await registerAsync(payload) };
    } catch (error: unknown) {
      if (!isApiError(error)) throw error;
      return { ok: false, error };
    } finally {
      resetRegistration();
    }
  }, [registerAsync, resetRegistration]);

  useEffect(() => {
    if (profile.error?.kind === "http" && profile.error.status === 401 && session.accessToken) {
      signOut();
    }
  }, [profile.error, session.accessToken, signOut]);

  useEffect(() => () => {
    generation.current += 1;
    pending.current?.abort();
    profileUpdates.current.forEach((controller) => controller.abort());
    profileUpdates.current.clear();
    token.set(null);
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [queryClient, token]);

  const user = session.accessToken ? profile.data ?? null : null;
  const retryProfile = useCallback(async (): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: canceledSignIn() };
    const id = generation.current;
    const result = await refetchProfile();
    if (generation.current !== id) return { ok: false, error: canceledSignIn() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: canceledSignIn() };
    return { ok: true, data: result.data };
  }, [refetchProfile, token]);

  const updateProfile = useCallback(async (payload: UpdateProfileRequest): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: canceledSignIn() };
    const id = generation.current;
    const controller = new AbortController();
    profileUpdates.current.add(controller);
    const isCurrent = () => generation.current === id && !controller.signal.aborted;
    try {
      const result = await createAccountApi(api.client).updateProfile(payload, controller.signal);
      if (!isCurrent()) return { ok: false, error: canceledSignIn() };
      if (!result.ok) {
        if (result.error.status === 401) signOut();
        return result;
      }
      // Prevent an earlier GET from replacing the values just saved by PUT.
      await queryClient.cancelQueries({ queryKey: queryKeys.auth.me(id), exact: true });
      if (!isCurrent()) return { ok: false, error: canceledSignIn() };
      queryClient.setQueryData(queryKeys.auth.me(id), result.data);
      return result;
    } catch (error) {
      if (!isCurrent()) return { ok: false, error: canceledSignIn() };
      throw error;
    } finally {
      profileUpdates.current.delete(controller);
    }
  }, [api.client, queryClient, signOut, token]);
  const status = session.signingIn
    ? "authenticating"
    : user ? "authenticated"
    : session.accessToken ? profile.isError ? "error" : "authenticating"
    : "anonymous";

  return (
    <AuthContext.Provider value={{
      accessToken: session.accessToken,
      sessionId: session.id,
      isCurrentSession,
      user,
      status,
      error: profile.error,
      api,
      signIn,
      register,
      retryProfile,
      updateProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
