import type { ReactNode } from "react";
import type { ApiClient } from "../api/type";
import type { ApiError, ApiResult } from "../common/response/type";
import type { RegisterRequest, LoginRequest } from "./request/type";
import type { UserResponse, LoginResponse } from "./response/type";
import type { UpdateProfileRequest } from "../account/type";

export interface AuthApi {
  readonly client: ApiClient;
  register(input: RegisterRequest, signal?: AbortSignal): Promise<ApiResult<UserResponse>>;
  login(input: LoginRequest, signal?: AbortSignal): Promise<ApiResult<LoginResponse>>;
  me(signal?: AbortSignal): Promise<ApiResult<UserResponse>>;
}

export interface AuthContextValue {
  accessToken: string | null;
  user: UserResponse | null;
  status: "anonymous" | "authenticating" | "authenticated" | "error";
  error: ApiError | null;
  api: AuthApi;
  signIn(payload: LoginRequest): Promise<ApiResult<UserResponse>>;
  register(payload: RegisterRequest): Promise<ApiResult<UserResponse>>;
  retryProfile(): Promise<ApiResult<UserResponse>>;
  updateProfile(payload: UpdateProfileRequest): Promise<ApiResult<UserResponse>>;
  signOut(): void;
}

export interface AuthProviderProps {
  children: ReactNode;
  /** API origin only; auth API paths already include /api/v1. */
  baseUrl?: string;
  stub?: boolean;
  /** Inject a transport for integration tests. */
  fetch?: typeof globalThis.fetch;
}
