import type { ReactNode } from "react";
import type { ApiContext } from "./commonRequestType";
import type { ApiError, ApiResult } from "./commonResponseType";
import type { RegisterRequest } from "./authRequestType";
import type { UserResponse } from "./authResponseType";
import type { OidcClient } from "../features/oidc";

export type AuthContextValue = {
  accessToken: string | null;
  user: UserResponse | null;
  status: "restoring" | "anonymous" | "authenticating" | "authenticated" | "error";
  error: ApiError | null;
  requestContext: ApiContext;
  renewAccessToken: (failedToken: string) => Promise<string | null>;
  sessionId: number;
  isSessionCurrent: (sessionId: number) => boolean;
  signIn: (returnTo?: string) => Promise<ApiResult<void>>;
  completeSignIn: (url: string) => Promise<ApiResult<string>>;
  register: (payload: RegisterRequest) => Promise<ApiResult<UserResponse>>;
  retryProfile: () => Promise<ApiResult<UserResponse>>;
  signOut: () => Promise<ApiResult<void>>;
};

export type AuthProviderProps = {
  children: ReactNode;
  /** Initialization settings; remount the provider to change them. */
  baseUrl?: string;
  stub?: boolean;
  fetch?: typeof globalThis.fetch;
  /** Inject the redirect client for isolated session tests. */
  oidc?: OidcClient;
};
