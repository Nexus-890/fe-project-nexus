import axios, { type CreateAxiosDefaults } from "axios";

/** Set the common backend origin in env; empty means same-origin browser requests. */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
