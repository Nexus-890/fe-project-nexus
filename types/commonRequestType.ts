import type { AxiosHeaders, AxiosRequestConfig, RawAxiosHeaders } from "axios";

export type ApiRequestConfig = Pick<
  AxiosRequestConfig,
  "timeout" | "paramsSerializer" | "withCredentials"
> & { headers?: RawAxiosHeaders | AxiosHeaders };
export type ApiContext = {
  baseUrl?: string;
  getAccessToken?: () => string | null;
  renewAccessToken?: (failedToken: string) => Promise<string | null>;
  getSessionId?: () => number;
  fetch?: typeof globalThis.fetch;
};
export type ServiceRequestOptions = {
  context?: ApiContext;
  signal?: AbortSignal;
  auth?: boolean;
  params?: Readonly<Record<string, unknown>>;
  config?: ApiRequestConfig;
};
export type ApiRequestOptions = Pick<ServiceRequestOptions, "auth" | "signal">;
