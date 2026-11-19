import { requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";

export const PASSWORD_RESET_PATH = "/api/v1/auth/password-reset";
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const requestPasswordReset = async (email: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("POST", PASSWORD_RESET_PATH, { email: email.trim() }, { ...options, auth: false });
};

export const confirmPasswordReset = async (token: string, newPassword: string, options: ServiceRequestOptions = {}): Promise<void> => {
  await requestApi<unknown>("POST", `${PASSWORD_RESET_PATH}/confirm`, { token, newPassword }, { ...options, auth: false });
};

export const passwordProblem = (password: string, confirmation: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!password.trim()) return "The password cannot be only spaces.";
  if (password !== confirmation) return "The passwords do not match.";
  return null;
};
