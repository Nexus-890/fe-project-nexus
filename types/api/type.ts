import type { AxiosRequestConfig, RawAxiosHeaders, AxiosHeaders } from "axios";
import type { ApiRequestOptions } from "../common/request/type";
import type { ApiResult } from "../common/response/type";

/** Per-request configuration; transport, URL and auth stay owned by the client. */
export type ApiRequestConfig = Omit<AxiosRequestConfig,
  "headers" | "data" | "method" | "params" | "signal" | "url" | "baseURL" | "adapter" | "env"
  | "auth" | "transformRequest" | "transformResponse" | "responseType" | "validateStatus"
> & { headers?: RawAxiosHeaders | AxiosHeaders };

export interface ApiClientRequestOptions extends ApiRequestOptions {
  params?: Readonly<Record<string, unknown>>;
  config?: ApiRequestConfig;
}

export interface ApiClient {
  get<T>(path: string, options?: ApiClientRequestOptions): Promise<ApiResult<T>>;
  post<T>(path: string, body?: unknown, options?: ApiClientRequestOptions): Promise<ApiResult<T>>;
}

export interface CreateApiClientOptions {
  /** Origin only, for example https://api.example.com. Paths include /api/v1. */
  baseUrl?: string;
  getAccessToken?: () => string | null;
  /**
   * Renew after a 401 for the token actually sent. Publish the replacement in
   * getAccessToken before resolving. Return null after logout/session changes;
   * implementations must share renewal across clients in the same session.
   */
  renewAccessToken?: (failedToken: string) => Promise<string | null>;
  /** Optional fetch adapter, used by the fixture and integration tests. */
  fetch?: typeof globalThis.fetch;
}
