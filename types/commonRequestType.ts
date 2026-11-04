import type { AxiosHeaders, AxiosRequestConfig, RawAxiosHeaders } from "axios";

export type ApiRequestConfig = Pick<
  AxiosRequestConfig,
  "timeout" | "paramsSerializer" | "withCredentials"
> & { headers?: RawAxiosHeaders | AxiosHeaders };
export type ApiContext = {
  baseUrl?: string;
  getAccessToken?: () => string | null;
  fetch?: typeof globalThis.fetch;
  /** Account identity for the explicitly enabled development cart transport. */
  mockUser?: { id: string; email: string };
};
export type ServiceRequestOptions = {
  context?: ApiContext;
  signal?: AbortSignal;
  auth?: boolean;
  params?: Readonly<Record<string, unknown>>;
  config?: ApiRequestConfig;
};
export type ApiRequestOptions = Pick<ServiceRequestOptions, "auth" | "signal">;
