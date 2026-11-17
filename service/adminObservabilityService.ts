import { createInvalidResponseError, isRecord, requestApi, resolveApiUrl } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiResponse } from "../types/commonResponseType";
import type {
  AdminLogPage, AuditLog, AuditLogFilters, BrokerHealth, BrokerStatus,
  EventLog, EventLogDetail, EventLogFilters, HealthStatus, ServiceHealth, SystemHealth,
} from "../types/adminObservabilityType";

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const isNullableString = (value: unknown): value is string | null | undefined =>
  value == null || typeof value === "string";
const isNullableTime = (value: unknown): value is string | null => value === null || isTimestamp(value);
const isHealthStatus = (value: unknown): value is HealthStatus =>
  value === "UP" || value === "DOWN" || value === "UNKNOWN";

export const parseEventLog = (value: unknown): EventLog => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.eventId !== "string" ||
    typeof value.eventType !== "string" || !isNullableString(value.aggregateType) ||
    typeof value.aggregateId !== "string" || !isNullableString(value.operatorId) ||
    typeof value.traceId !== "string" || !isNullableString(value.topic) ||
    !isTimestamp(value.occurredAt) || !isTimestamp(value.receivedAt))
    throw createInvalidResponseError("Invalid event log entry");
  return {
    id: value.id, eventId: value.eventId, eventType: value.eventType,
    aggregateType: value.aggregateType, aggregateId: value.aggregateId,
    operatorId: value.operatorId, traceId: value.traceId, topic: value.topic,
    occurredAt: value.occurredAt, receivedAt: value.receivedAt,
  };
};

export const parseEventLogDetail = (value: unknown): EventLogDetail => {
  if (!isRecord(value) || !Object.hasOwn(value, "payload") || !isRecord(value.envelope) ||
    !isNullableString(value.rawEnvelope))
    throw createInvalidResponseError("Invalid event log detail");
  return {
    event: parseEventLog(value.event), payload: value.payload,
    envelope: value.envelope, rawEnvelope: value.rawEnvelope,
  };
};

export const parseAuditLog = (value: unknown): AuditLog => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.eventId !== "string" ||
    !isNullableString(value.actorId) || typeof value.action !== "string" ||
    !isNullableString(value.entityType) || typeof value.entityId !== "string" ||
    typeof value.traceId !== "string" || !isTimestamp(value.occurredAt) || !isTimestamp(value.receivedAt))
    throw createInvalidResponseError("Invalid audit log entry");
  return {
    id: value.id, eventId: value.eventId, actorId: value.actorId,
    action: value.action, entityType: value.entityType, entityId: value.entityId,
    traceId: value.traceId, occurredAt: value.occurredAt, receivedAt: value.receivedAt,
  };
};

const parseServiceHealth = (value: unknown): ServiceHealth => {
  if (!isRecord(value) || typeof value.name !== "string" || !isHealthStatus(value.status))
    throw createInvalidResponseError("Invalid service health");
  return { name: value.name, status: value.status };
};
const parseBrokerStatus = (value: unknown): BrokerStatus => {
  if (!isRecord(value) || typeof value.name !== "string" || !isHealthStatus(value.status) || !isNullableTime(value.lastCheckedAt))
    throw createInvalidResponseError("Invalid broker status");
  return { name: value.name, status: value.status, lastCheckedAt: value.lastCheckedAt };
};
const parseBrokerHealth = (value: unknown): BrokerHealth => {
  const status = parseBrokerStatus(value);
  if (!isRecord(value) || !isNullableTime(value.lastFailureAt) || !isNullableTime(value.lastRecoveredAt))
    throw createInvalidResponseError("Invalid broker health timestamps");
  return { ...status, lastFailureAt: value.lastFailureAt, lastRecoveredAt: value.lastRecoveredAt };
};
export const parseSystemHealth = (value: unknown): SystemHealth => {
  if (!isRecord(value) || !Array.isArray(value.services) || !Array.isArray(value.brokers))
    throw createInvalidResponseError("Invalid system health");
  return { services: value.services.map(parseServiceHealth), brokers: value.brokers.map(parseBrokerStatus) };
};

const parseLogPage = <T>(response: ApiResponse<unknown>, parse: (item: unknown) => T): AdminLogPage<T> => {
  if (!Array.isArray(response.data) || !response.page)
    throw createInvalidResponseError("Expected log data[] with page metadata");
  return { items: response.data.map(parse), page: response.page };
};

const validateFilters = ({ page = 0, size = 20, from, to }: EventLogFilters | AuditLogFilters) => {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100 ||
    from !== undefined && !isTimestamp(from) || to !== undefined && !isTimestamp(to) ||
    from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to))
    throw createInvalidResponseError("Invalid log pagination or date range");
  return { page, size };
};

export const getEventLogs = async (
  filters: EventLogFilters = {}, options: ServiceRequestOptions = {},
): Promise<AdminLogPage<EventLog>> => {
  const paging = validateFilters(filters);
  if (filters.sort && !["occurredAt,asc", "occurredAt,desc", "receivedAt,asc", "receivedAt,desc", "eventType,asc", "eventType,desc"].includes(filters.sort))
    throw createInvalidResponseError("Invalid event log sort");
  return parseLogPage(await requestApi<unknown>("GET", "/api/v1/event-logs", undefined, {
    ...options, auth: true, params: { ...filters, ...paging },
  }), parseEventLog);
};
export const getEventLogDetail = async (
  id: string, options: ServiceRequestOptions = {},
): Promise<EventLogDetail> => {
  if (!id.trim()) throw createInvalidResponseError("An event log ID is required");
  const { data } = await requestApi<unknown>("GET", resolveApiUrl("/api/v1/event-logs/:id", { id }), undefined, { ...options, auth: true });
  const detail = parseEventLogDetail(data);
  if (detail.event.id.toLowerCase() !== id.toLowerCase())
    throw createInvalidResponseError("Event log detail does not match the requested event");
  return detail;
};
export const getAuditLogs = async (
  filters: AuditLogFilters = {}, options: ServiceRequestOptions = {},
): Promise<AdminLogPage<AuditLog>> => {
  const paging = validateFilters(filters);
  return parseLogPage(await requestApi<unknown>("GET", "/api/v1/audit-logs", undefined, {
    ...options, auth: true, params: { ...filters, ...paging },
  }), parseAuditLog);
};
export const getSystemHealth = async (options: ServiceRequestOptions = {}): Promise<SystemHealth> => {
  const { data } = await requestApi<unknown>("GET", "/api/v1/system/health", undefined, { ...options, auth: true });
  return parseSystemHealth(data);
};
export const getBrokerHealth = async (options: ServiceRequestOptions = {}): Promise<BrokerHealth[]> => {
  const response = await requestApi<unknown>("GET", "/api/v1/system/health/brokers", undefined, { ...options, auth: true });
  if (!Array.isArray(response.data) || !response.page)
    throw createInvalidResponseError("Expected broker health data[] with page metadata");
  return response.data.map(parseBrokerHealth);
};
