import type { ReactNode } from "react";
import type { ApiContext } from "./commonRequestType";
import type { ApiError, ApiResult } from "./commonResponseType";
import type { LoginRequest, RegisterRequest } from "./authRequestType";
import type { UserResponse } from "./authResponseType";
import type { UpdateProfileRequest } from "./accountType";

export type AuthContextValue = {
  accessToken: string | null;
  user: UserResponse | null;
  status: "anonymous" | "authenticating" | "authenticated" | "error";
  error: ApiError | null;
  requestContext: ApiContext;
  sessionId: number;
  isSessionCurrent: (sessionId: number) => boolean;
  signIn: (payload: LoginRequest) => Promise<ApiResult<UserResponse>>;
  register: (payload: RegisterRequest) => Promise<ApiResult<UserResponse>>;
  retryProfile: () => Promise<ApiResult<UserResponse>>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<ApiResult<UserResponse>>;
  signOut: () => void;
};

export type AuthProviderProps = {
  children: ReactNode;
  /** Initialization settings; remount the provider to change them. */
  baseUrl?: string;
  stub?: boolean;
  fetch?: typeof globalThis.fetch;
};
