import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { API_BASE_URL, createAxiosClient } from "../configs/api";
import type { ApiError, ApiResult, FieldErrors, ValidationError } from "../types/common/response/type";

import type { ApiClientRequestOptions, ApiClient, CreateApiClientOptions } from "../types/api/type";
export type { ApiRequestConfig, ApiClientRequestOptions, ApiClient, CreateApiClientOptions } from "../types/api/type";

const JSON_CONTENT_TYPE = "application/json";

export function createApiClient(options: CreateApiClientOptions = {}): ApiClient {
  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? API_BASE_URL,
  );
  const getAccessToken = options.getAccessToken ?? (() => null);
  const transport = createAxiosClient({
    baseURL: baseUrl,
    // Axios supports custom fetch with Request/Response disabled for relative URLs.
    ...(options.fetch ? {
      adapter: "fetch",
      // Runtime supports null; Axios declarations currently omit it.
      env: { fetch: options.fetch, Request: null, Response: null } as unknown as AxiosRequestConfig["env"],
    } : {}),
  });

  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    body: unknown,
    requestOptions: ApiClientRequestOptions = {},
  ): Promise<ApiResult<T>> {
    const safePath = normalizeApiPath(path);
    if (!safePath.ok) return { ok: false, error: safePath.error };

    const headers = new AxiosHeaders(requestOptions.config?.headers);
    headers.set("Accept", JSON_CONTENT_TYPE);
    headers.delete("Authorization");
    if (method !== "GET") headers.set("Content-Type", JSON_CONTENT_TYPE);
    if (requestOptions.auth !== false) {
      const token = getAccessToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    // Pin security-sensitive settings even if an untyped caller supplies them.
    const config: AxiosRequestConfig = {
      ...requestOptions.config,
      baseURL: baseUrl,
      adapter: transport.defaults.adapter,
      env: transport.defaults.env,
      auth: undefined,
      method,
      url: safePath.path,
      params: requestOptions.params,
      headers,
      signal: requestOptions.signal,
      data: method !== "GET" ? JSON.stringify(body ?? {}) : undefined,
      transformRequest: [],
      transformResponse: [],
      responseType: "text",
      validateStatus: () => true,
    };

    try {
      const response = await transport.request<string>(config);
      return readApiResponse<T>(response);
    } catch (error) {
      if (axios.isCancel(error) || isAbortError(error)) {
        throw new DOMException("Request canceled", "AbortError");
      }
      return {
        ok: false,
        error: {
          kind: "network",
          status: 0,
          title: "Network request failed",
          detail: error instanceof Error ? error.message : undefined,
        },
      };
    }
  }

  return {
    get: <T>(path: string, requestOptions?: ApiClientRequestOptions) => request<T>("GET", path, undefined, requestOptions),
    post: <T>(path: string, body?: unknown, requestOptions?: ApiClientRequestOptions) => request<T>("POST", path, body, requestOptions),
    put: <T>(path: string, body?: unknown, requestOptions?: ApiClientRequestOptions) => request<T>("PUT", path, body, requestOptions),
  };
}

export function createInvalidResponseError(detail: string): ApiError {
  return {
    kind: "invalid-response",
    status: 0,
    title: "Invalid API response",
    detail,
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("/")) {
    throw new Error("API baseUrl must be an origin only, not a path");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API baseUrl must use http or https");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("API baseUrl must be an origin only, not a versioned API path");
  }

  return url.origin;
}

function normalizeApiPath(path: string): { ok: true; path: string } | { ok: false; error: ApiError } {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || hasUrlScheme(trimmed) || hasUnsafeUrlCharacters(trimmed)) {
    return {
      ok: false,
      error: createInvalidResponseError("API client only accepts same-origin relative paths"),
    };
  }

  return { ok: true, path: trimmed };
}

function hasUrlScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function hasUnsafeUrlCharacters(value: string): boolean {
  return /[\\\u0000-\u001F\u007F]/.test(value);
}

function readApiResponse<T>(response: AxiosResponse<string>): ApiResult<T> {
  const parsed = readJsonValue(response.data);
  if (response.status < 200 || response.status >= 300) {
    return { ok: false, error: normalizeHttpError(response, parsed.ok ? parsed.value : undefined) };
  }
  if (!parsed.ok) {
    return { ok: false, error: createInvalidResponseError("Expected JSON response from API") };
  }
  return { ok: true, data: parsed.value as T };
}

function readJsonValue(text: string): { ok: true; value: unknown } | { ok: false } {
  if (!text) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function normalizeHttpError(response: AxiosResponse<string>, value: unknown): ApiError {
  if (isRecord(value)) {
    const title = (readString(value.title) ?? response.statusText) || "HTTP error";
    const errors = readValidationErrors(value.errors);

    return {
      kind: "http",
      status: response.status,
      title,
      type: readString(value.type),
      detail: readString(value.detail),
      instance: readString(value.instance),
      traceId: readString(value.traceId),
      errors,
      fieldErrors: readFieldErrors(errors) ?? readFieldErrors(value.fieldErrors) ?? readFieldErrors(value.errors),
    };
  }

  return {
    kind: "http",
    status: response.status,
    title: response.statusText || "HTTP error",
  };
}

function readValidationErrors(value: unknown): ValidationError[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const errors = value.filter((entry): entry is ValidationError =>
    isRecord(entry) && typeof entry.field === "string" && typeof entry.message === "string");
  return errors.length > 0 ? errors : undefined;
}

function readFieldErrors(value: unknown): FieldErrors | undefined {
  if (Array.isArray(value)) {
    const result = new Map<string, string[]>();
    for (const { field, message } of readValidationErrors(value) ?? []) {
      result.set(field, [...(result.get(field) ?? []), message]);
    }
    return result.size > 0 ? Object.fromEntries(result) : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const result = new Map<string, string[]>();

  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const strings = messages.filter((message): message is string => typeof message === "string");
      if (strings.length > 0) {
        result.set(field, strings);
      }
      continue;
    }

    if (typeof messages === "string") {
      result.set(field, [messages]);
    }
  }

  return result.size > 0 ? Object.fromEntries(result) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error.name === "AbortError";
}
