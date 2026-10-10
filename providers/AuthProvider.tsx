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

  const clearSession = useCallback(() => {
    // Invalidate the old generation before cancellation or React's next render.
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
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
    token.set(null);
    void queryClient.cancelQueries({ predicate: privateQuery });
    queryClient.removeQueries({ predicate: privateQuery });
  }, [queryClient, token]);

  const user = session.accessToken ? profile.data ?? null : null;
  const retryProfile = async (): Promise<ApiResult<UserResponse>> => {
    if (!token.get()) return { ok: false, error: canceledSignIn() };
    const id = generation.current;
    const result = await profile.refetch();
    if (generation.current !== id) return { ok: false, error: canceledSignIn() };
    if (result.error) return { ok: false, error: result.error };
    if (!result.data) return { ok: false, error: canceledSignIn() };
    return { ok: true, data: result.data };
  };
  const status = session.signingIn
    ? "authenticating"
    : user ? "authenticated"
    : session.accessToken ? profile.isError ? "error" : "authenticating"
    : "anonymous";

  return (
    <AuthContext.Provider value={{
      accessToken: session.accessToken,
      user,
      status,
      error: profile.error,
      api,
      signIn,
      register,
      retryProfile,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
