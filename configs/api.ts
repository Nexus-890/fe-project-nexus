import axios, { type CreateAxiosDefaults } from "axios";

const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Browsers use the Next proxy when the public URL is empty; SSR calls its target directly. */
export const API_BASE_URL = publicApiUrl.trim()
  || (typeof window === "undefined" ? process.env.API_PROXY_TARGET?.trim() ?? "" : "");

/** Anonymous by default. AuthProvider creates its own token-scoped transport. */
export function createAxiosClient(config: CreateAxiosDefaults = {}) {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000,
    headers: { Accept: "application/json" },
    ...config,
  });
}

export default createAxiosClient();
