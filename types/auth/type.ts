import type { ReactNode } from "react";
import type { ApiClient } from "../api/type";
import type { ApiError, ApiResult } from "../common/response/type";
import type { RegisterRequest } from "./request/type";
import type { UserResponse } from "./response/type";
import type { OidcClient } from "../../features/auth/oidc";

export interface AuthApi {
  readonly client: ApiClient;
  register(input: RegisterRequest, signal?: AbortSignal): Promise<ApiResult<UserResponse>>;
  me(signal?: AbortSignal): Promise<ApiResult<UserResponse>>;
}

export interface AuthContextValue {
  accessToken: string | null;
  user: UserResponse | null;
  status: "restoring" | "anonymous" | "authenticating" | "authenticated" | "error";
  error: ApiError | null;
  api: AuthApi;
  signIn(returnTo?: string): Promise<ApiResult<void>>;
  completeSignIn(url: string): Promise<ApiResult<string>>;
  register(payload: RegisterRequest): Promise<ApiResult<UserResponse>>;
  retryProfile(): Promise<ApiResult<UserResponse>>;
  /** Shared by every protected client; renews only within the current session. */
  renewAccessToken(failedToken: string): Promise<string | null>;
  signOut(): Promise<ApiResult<void>>;
}

export interface AuthProviderProps {
  children: ReactNode;
  /** API origin only; auth API paths already include /api/v1. */
  baseUrl?: string;
  stub?: boolean;
  /** Inject a transport for integration tests. */
  fetch?: typeof globalThis.fetch;
  /** Inject the redirect client for isolated session tests. */
  oidc?: OidcClient;
}
