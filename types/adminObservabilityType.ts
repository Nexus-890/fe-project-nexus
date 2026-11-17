import type { components, operations } from "./notificationGeneratedType";
import type { PageInfo } from "./commonResponseType";

export type EventLog = components["schemas"]["EventLogSummary"];
export type EventLogDetail = components["schemas"]["EventLogDetail"];
export type AuditLog = components["schemas"]["AuditLog"];
export type HealthStatus = components["schemas"]["HealthStatus"];
export type ServiceHealth = components["schemas"]["ServiceHealth"];
export type BrokerStatus = components["schemas"]["BrokerStatus"];
export type BrokerHealth = components["schemas"]["BrokerHealth"];
export type SystemHealth = components["schemas"]["SystemHealthResponse"]["data"];
export type EventLogFilters = NonNullable<operations["listEventLogs"]["parameters"]["query"]>;
export type AuditLogFilters = NonNullable<operations["listAuditLogs"]["parameters"]["query"]>;
export type AdminLogPage<T> = { items: T[]; page: PageInfo };
