import axios, { AxiosHeaders, type AxiosRequestConfig } from "axios";
import type {
  ApiError,
  ApiResponse,
  PageInfo,
  ValidationError,
} from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { getCatalogMockFetch } from "../mocks/catalogStub";
import { getCartMockFetch } from "../mocks/cart";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (typeof window === "undefined" ? process.env.API_PROXY_TARGET?.trim() : "") || "";
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: "application/json" },
});
export default api;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const createInvalidResponseError = (detail: string): ApiError => ({
  kind: "invalid-response",
  status: 0,
  title: "Invalid API response",
  detail,
});
export const createCanceledError = (): ApiError => ({
  kind: "aborted",
  status: 0,
  title: "The request was canceled or superseded.",
});
export const isApiError = (value: unknown): value is ApiError =>
  isRecord(value) &&
  ["http", "network", "invalid-response", "aborted"].includes(
    String(value.kind),
  ) &&
  typeof value.status === "number" &&
  typeof value.title === "string";
export const resolveApiUrl = (url: string, pathParams?: object): string =>
  url.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value =
      pathParams && Object.hasOwn(pathParams, key)
        ? (pathParams as Record<string, unknown>)[key]
        : undefined;
    if (value === undefined || value === null)
      throw createInvalidResponseError(`Missing path parameter: ${key}`);
    return encodeURIComponent(String(value));
  });
const normalizeBaseUrl = (baseUrl: string): string => {
  const value = baseUrl.trim().replace(/\/+$/, "");
  if (!value) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw createInvalidResponseError("API baseUrl must be an http(s) origin");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw createInvalidResponseError(
      "API baseUrl must be an http(s) origin without a path or credentials",
    );
  }
  return url.origin;
};
const isPageInfo = (value: unknown): value is PageInfo =>
  isRecord(value) &&
  Number.isSafeInteger(value.number) &&
  Number(value.number) >= 0 &&
  Number.isSafeInteger(value.size) &&
  Number(value.size) > 0 &&
  Number.isSafeInteger(value.totalElements) &&
  Number(value.totalElements) >= 0 &&
  Number.isSafeInteger(value.totalPages) &&
  Number(value.totalPages) >= 0;
const normalizeHttpError = (
  status: number,
  statusText: string,
  body: unknown,
): ApiError => {
  const value = isRecord(body) ? body : {};
  const string = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string) : undefined;
  const errors = Array.isArray(value.errors)
    ? value.errors.filter(
        (entry): entry is ValidationError =>
          isRecord(entry) &&
          typeof entry.field === "string" &&
          typeof entry.code === "string" &&
          typeof entry.detail === "string",
      )
    : [];
  const fields = new Map<string, string[]>();
  for (const { field, detail } of errors)
    fields.set(field, [...(fields.get(field) ?? []), detail]);
  const standardProperties = new Set([
    "type", "title", "status", "code", "detail", "instance", "traceId", "errors",
  ]);
  const extensions = Object.fromEntries(
    Object.entries(value).filter(([key]) => !standardProperties.has(key)),
  );
  return {
    kind: "http",
    status,
    title: string("title") || statusText || "HTTP error",
    code: string("code"),
    type: string("type"),
    detail: string("detail"),
    instance: string("instance"),
    traceId: string("traceId"),
    errors: errors.length ? errors : undefined,
    fieldErrors: fields.size ? Object.fromEntries(fields) : undefined,
    extensions: Object.keys(extensions).length ? extensions : undefined,
  };
};

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException("Request canceled", "AbortError");
};

// Cancel only this request's wait; other callers can still share the renewal.
const abortable = <T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return pending;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException("Request canceled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    pending.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
};

/** One HTTP boundary for browser and server services; preserves page metadata. */
export const requestApi = async <T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  options: ServiceRequestOptions = {},
): Promise<ApiResponse<T>> => {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(path)
  ) {
    throw createInvalidResponseError(
      "API requests require a safe relative path",
    );
  }
  const context = options.context ?? {};
  const baseURL = normalizeBaseUrl(context.baseUrl ?? API_BASE_URL);
  const headers = new AxiosHeaders(options.config?.headers);
  const multipart = typeof FormData !== "undefined" && body instanceof FormData;
  headers.set("Accept", "application/json");
  headers.delete("Authorization");
  // The transport must generate the boundary for this exact FormData body.
  if (multipart) headers.delete("Content-Type");
  else if (method !== "GET" && body !== undefined)
    headers.set("Content-Type", "application/json");
  const sentToken = options.auth !== false ? context.getAccessToken?.() : null;
  const sessionId = sentToken ? context.getSessionId?.() : undefined;
  if (sentToken) headers.set("Authorization", `Bearer ${sentToken}`);
  const isCurrentSession = () =>
    !sentToken || sessionId === undefined || context.getSessionId?.() === sessionId;
  const ensureCurrent = () => {
    throwIfAborted(options.signal);
    if (!isCurrentSession()) throw createCanceledError();
  };
  const fetch = getCartMockFetch(path, context.mockUser) ?? getCatalogMockFetch(path) ?? context.fetch;
  const config: AxiosRequestConfig = {
    timeout: options.config?.timeout ?? api.defaults.timeout,
    paramsSerializer: options.config?.paramsSerializer,
    withCredentials: options.config?.withCredentials,
    baseURL,
    url: path,
    method,
    params: options.params,
    headers,
    auth: undefined,
    signal: options.signal,
    data: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    adapter: fetch ? "fetch" : api.defaults.adapter,
    env: fetch
      ? ({
          fetch,
          Request: null,
          Response: null,
        } as unknown as AxiosRequestConfig["env"])
      : api.defaults.env,
    transformRequest: [],
    transformResponse: [],
    responseType: "text",
    validateStatus: () => true,
  };
  try {
    let response = await api.request<string>(config);
    throwIfAborted(options.signal);
    // A sibling renewal may already have cleared this session. Its late 401
    // remains an API failure, but must not start renewal for a newer session.
    if (response.status !== 401) ensureCurrent();
    if (response.status === 401 && isCurrentSession() && sentToken && context.renewAccessToken && context.getAccessToken?.()) {
      let replacement: string | null = null;
      try {
        replacement = await abortable(
          Promise.resolve().then(() => context.renewAccessToken!(sentToken)),
          options.signal,
        );
      } catch (error) {
        // Provider exceptions can contain credentials. Retain the API's error.
        throwIfAborted(options.signal);
        // GIA HẠN LỖI TẠM THỜI (503/504/MẤT MẠNG): BÁO LỖI ĐÓ, KHÔNG TRẢ 401 KẺO GIAO DIỆN ĐĂNG XUẤT
        if (isApiError(error) && (error.kind === "network" || error.status >= 500)) {
          ensureCurrent();
          throw { kind: error.kind, status: error.status, title: error.title } satisfies ApiError;
        }
      }
      throwIfAborted(options.signal);
      if (replacement) {
        ensureCurrent();
        if (context.getAccessToken?.() === replacement) {
          const retryHeaders = new AxiosHeaders(headers);
          retryHeaders.set("Authorization", `Bearer ${replacement}`);
          // Replay this captured request once; a second 401 cannot renew again.
          response = await api.request<string>({ ...config, headers: retryHeaders });
          ensureCurrent();
        }
      }
      // A failed renewal can clear the session and advance its generation.
      // Preserve the original 401; no stale success or replay is possible here.
    }
    let value: unknown;
    try {
      value = response.data
        ? (JSON.parse(response.data) as unknown)
        : undefined;
    } catch {
      value = undefined;
    }
    if (response.status < 200 || response.status >= 300)
      throw normalizeHttpError(response.status, response.statusText, value);
    if (response.status === 204)
      return { code: 0, message: "response success", data: undefined as T };
    if (
      !isRecord(value) ||
      !Object.hasOwn(value, "data") ||
      typeof value.code !== "number" ||
      typeof value.message !== "string" ||
      (value.page !== undefined && !isPageInfo(value.page))
    ) {
      throw createInvalidResponseError(
        "Expected API envelope {code,message,data,page?}",
      );
    }
    return value as ApiResponse<T>;
  } catch (error) {
    if (
      axios.isCancel(error) ||
      (isRecord(error) && error.name === "AbortError")
    )
      throw new DOMException("Request canceled", "AbortError");
    if (isApiError(error)) throw error;
    throw {
      kind: "network",
      status: 0,
      title: "Network request failed",
      detail: error instanceof Error ? error.message : undefined,
    } satisfies ApiError;
  }
};
