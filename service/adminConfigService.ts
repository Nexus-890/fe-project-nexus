import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { components } from "../types/configGeneratedType";

export type SystemConfig = components["schemas"]["SystemConfig"];
export type ConfigValue = SystemConfig["value"];
export type ConfigUpdateResult = components["schemas"]["ConfigUpdatedResponse"]["data"];
const scalar = (value: unknown): value is ConfigValue => value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
const configuredValue = (value: unknown): value is Exclude<ConfigValue, null> => typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
const applyMode = (value: unknown): value is SystemConfig["applyMode"] => value === "RUNTIME" || value === "CONFIG_SOURCE" || value === "KEYCLOAK_MANAGED";
const parseConfig = (value: unknown): SystemConfig => {
  if (!isRecord(value) || typeof value.key !== "string" || !value.key || !scalar(value.value) || !scalar(value.defaultValue) ||
    typeof value.description !== "string" || typeof value.service !== "string" || !configuredValue(value.configuredValue) ||
    !applyMode(value.applyMode))
    throw createInvalidResponseError("Invalid system configuration.");
  return { key: value.key, value: value.value, defaultValue: value.defaultValue, description: value.description,
    service: value.service, applyMode: value.applyMode, configuredValue: value.configuredValue };
};
export const getSystemConfigs = async (options: ServiceRequestOptions = {}): Promise<SystemConfig[]> => {
  const response = await requestApi<unknown>("GET", "/api/v1/system/configs", undefined, { ...options, auth: true });
  if (!Array.isArray(response.data) || !response.page || response.page.number !== 0 || response.page.totalElements < response.data.length)
    throw createInvalidResponseError("Invalid configuration list.");
  const rows = response.data.map(parseConfig);
  if (new Set(rows.map((row) => row.key)).size !== rows.length) throw createInvalidResponseError("Duplicate configuration keys.");
  return rows;
};
export const updateSystemConfig = async (key: string, value: ConfigValue, options: ServiceRequestOptions = {}): Promise<ConfigUpdateResult> => {
  if (!key || !scalar(value)) throw createInvalidResponseError("Invalid configuration value.");
  const { data } = await requestApi("PUT", `/api/v1/system/configs/${encodeURIComponent(key)}`, { value }, { ...options, auth: true });
  if (!isRecord(data) || data.key !== key || !scalar(data.value)) throw createInvalidResponseError("Invalid system configuration update.");
  return { key: data.key, value: data.value };
};
