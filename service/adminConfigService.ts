import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { components } from "../types/systemConfig217GeneratedType";

// Pending #217: paths are proposed in ADR-009; DTOs are an explicit FE proposal.
export type SystemConfig = components["schemas"]["SystemConfig"];
export type ConfigValue = components["schemas"]["ConfigValue"];
const scalar = (value: unknown): value is ConfigValue => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
const parseConfig = (value: unknown): SystemConfig => {
  if (!isRecord(value) || typeof value.key !== "string" || !value.key || !scalar(value.value) || !scalar(value.defaultValue) ||
    typeof value.description !== "string" || typeof value.group !== "string") throw createInvalidResponseError("Invalid system configuration.");
  return { key: value.key, value: value.value, defaultValue: value.defaultValue, description: value.description, group: value.group };
};
export const getSystemConfigs = async (options: ServiceRequestOptions = {}): Promise<SystemConfig[]> => {
  const { data } = await requestApi("GET", "/api/v1/system/configs", undefined, { ...options, auth: true });
  if (!Array.isArray(data)) throw createInvalidResponseError("Invalid configuration list.");
  const rows = data.map(parseConfig);
  if (new Set(rows.map((row) => row.key)).size !== rows.length) throw createInvalidResponseError("Duplicate configuration keys.");
  return rows;
};
export const updateSystemConfig = async (key: string, value: ConfigValue, options: ServiceRequestOptions = {}): Promise<SystemConfig> => {
  if (!key || !scalar(value)) throw createInvalidResponseError("Invalid configuration value.");
  const { data } = await requestApi("PUT", `/api/v1/system/configs/${encodeURIComponent(key)}`, { value }, { ...options, auth: true });
  const row = parseConfig(data);
  if (row.key !== key) throw createInvalidResponseError("Configuration key does not match.");
  return row;
};
