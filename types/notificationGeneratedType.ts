/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/notifications/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get my notification preferences
         * @description Full supported EMAIL and IN_APP matrix for JWT subject; true defaults for old and new users. Mandatory transaction messages cannot be disabled. Preferences apply to future inbox entries; worker rereads optional EMAIL before sending.
         */
        get: operations["getNotificationPreferences"];
        /**
         * Update my preferences atomically
         * @description Sparse matrix update. Only BID_OUTBID optional; unknown type/channel and duplicate cells rejected.
         */
        put: operations["updateNotificationPreferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream my committed inbox state
         * @description Bearer fetch SSE. notifications event JSON is NotificationInboxSnapshot: unreadCount and revision (also event id). Always sends current snapshot on connect/reconnect including Last-Event-ID; refetch inbox and count. Committed DB cursors observe inserts/read changes across instances. heartbeat every 2s. Closes at JWT expiry or 30s. IN_APP is an inbox channel, not browser WebPush: no push permission needed.
         */
        get: operations["streamNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List delivery status across users
         * @description ADMIN plus NOTIFICATION.VIEW. Newest createdAt and id first; from inclusive, to exclusive. errorCode matches any attempt; lastErrorCode is latest attempt. No email address or raw provider error exposed.
         */
        get: operations["listAdminNotificationDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/deliveries/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** View delivery attempts as admin */
        get: operations["getNotificationDelivery"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the current user's notifications
         * @description Requires NOTIFICATION.VIEW. JWT subject only. Zero-based pagination, newest createdAt first then id descending. Defaults page=0, size=10; size must be 1 to 100. An empty/beyond-end page returns data:[] with actual totals.
         */
        get: operations["listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Count the current user's unread notifications
         * @description Requires NOTIFICATION.VIEW. JWT subject only. Counts rows with readAt unset.
         */
        get: operations["getUnreadNotificationCount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Mark one own notification as read
         * @description Requires NOTIFICATION.VIEW and ownership by the JWT subject. Another owner returns 403; absent ID returns 404. Already-read rows are unchanged.
         */
        patch: operations["markNotificationAsRead"];
        trace?: never;
    };
    "/api/v1/notifications/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List delivery attempts of one own notification
         * @description Requires NOTIFICATION.VIEW and ownership by the JWT subject. Returns one delivery per channel with its attempts in order. The recipient address and raw provider error text are never returned; failures expose errorCode and retryable only.
         */
        get: operations["listNotificationDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Mark all of the current user's unread notifications as read
         * @description Requires NOTIFICATION.VIEW. One UPDATE scoped to the JWT subject and readAt IS NULL. Other users and already-read rows remain unchanged. Repeating the request is a no-op.
         */
        patch: operations["markAllNotificationsAsRead"];
        trace?: never;
    };
    "/api/v1/event-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search retained domain events
         * @description Filters combine with AND. Pagination is zero-based; deterministic newest-first ordering uses id as tie-breaker. Event log summary excludes payload; detail requires its own privilege. Audit is a database view of UserUpdated, UserDeleted, UserRoleAssigned, OrderRefundRequested, OrderRefundCompleted and SystemConfigUpdated. Config is recorded through the in-process recorder; cross-service delivery is owned by #217. Password events belong to Keycloak.
         */
        get: operations["listEventLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/event-logs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read full original event envelope
         * @description Filters combine with AND. Pagination is zero-based; deterministic newest-first ordering uses id as tie-breaker. Event log summary excludes payload; detail requires its own privilege. Audit is a database view of UserUpdated, UserDeleted, UserRoleAssigned, OrderRefundRequested, OrderRefundCompleted and SystemConfigUpdated. Config is recorded through the in-process recorder; cross-service delivery is owned by #217. Password events belong to Keycloak.
         */
        get: operations["getEventLog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/audit-logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List critical user, role, refund and config changes
         * @description Filters combine with AND. Pagination is zero-based; deterministic newest-first ordering uses id as tie-breaker. Event log summary excludes payload; detail requires its own privilege. Audit is a database view of UserUpdated, UserDeleted, UserRoleAssigned, OrderRefundRequested, OrderRefundCompleted and SystemConfigUpdated. Config is recorded through the in-process recorder; cross-service delivery is owned by #217. Password events belong to Keycloak.
         */
        get: operations["listAuditLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the health of every service, Keycloak and the message broker
         * @description Requires SYSTEM.HEALTH.VIEW (ADMIN, SUPPORT_STAFF). Every instance of every configured service is looked up in Eureka and its /actuator/health is called in parallel under one shared 2 second deadline; a service is UP as soon as one instance answers 2xx, and DOWN when it is missing from Eureka or no instance answers before the deadline. The response is still 200. Keycloak is UP when its realm discovery document answers. Brokers come from the shared health state in Redis written by BrokerHealthJob; a broker is UNKNOWN with lastCheckedAt null before the first run or while Redis is unreachable.
         */
        get: operations["getSystemHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/health/brokers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List message brokers with their last failure and recovery times
         * @description Requires SYSTEM.HEALTH.VIEW (ADMIN, SUPPORT_STAFF). BrokerHealthJob checks Kafka every 15 seconds and marks it DOWN only when one retry also fails. The state lives in Redis under {environment}:health:{broker}; lastFailureAt is set when a broker goes DOWN and lastRecoveredAt when it comes back UP, and each change to DOWN or back to UP is recorded once in the event log as SystemHealthCheckFailed or SystemHealthCheckRecovered. A broker is UNKNOWN with null times before the first run or while Redis is unreachable. The complete list is one logical page.
         */
        get: operations["listBrokerHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        NotificationPreference: {
            notificationType: string;
            /** @enum {string} */
            channel: "EMAIL" | "IN_APP";
            enabled: boolean;
            mandatory: boolean;
        };
        NotificationPreferences: {
            preferences: components["schemas"]["NotificationPreference"][];
        };
        UpdateNotificationPreferences: {
            preferences: {
                notificationType: string;
                /** @enum {string} */
                channel: "EMAIL" | "IN_APP";
                enabled: boolean;
            }[];
        };
        NotificationPreferencesResponse: {
            code: number;
            message: string;
            data: components["schemas"]["NotificationPreferences"];
        };
        NotificationInboxSnapshot: {
            /** Format: int64 */
            unreadCount: number;
            revision: string;
        };
        NotificationDeliverySummary: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            notificationId: string;
            /** Format: uuid */
            userId: string;
            type: string;
            title: string;
            /** @enum {string} */
            channel: "EMAIL" | "PUSH" | "SMS";
            /** @enum {string} */
            status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
            attemptCount: number;
            /** Format: date-time */
            nextAttemptAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            lastErrorCode: string | null;
        };
        NotificationDeliveryDetail: components["schemas"]["NotificationDeliverySummary"] & {
            attempts: components["schemas"]["NotificationDeliveryAttempt"][];
        };
        AdminNotificationDeliveryListResponse: {
            code: number;
            message: string;
            data: components["schemas"]["NotificationDeliverySummary"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        AdminNotificationDeliveryDetailResponse: {
            code: number;
            message: string;
            data: components["schemas"]["NotificationDeliveryDetail"];
        };
        Problem: {
            /** Format: uri-reference */
            type: string;
            title: string;
            status: number;
            detail: string;
            /** Format: uri-reference */
            instance: string;
            /** @description Stable symbolic identifier. Branch on code and status; tolerate future unknown codes. */
            code: string;
            /** @description Active trace/correlation identifier when available; optional without tracing. */
            traceId?: string;
            errors?: components["schemas"]["ValidationError"][];
        };
        ValidationError: {
            /** @description Failed request field; an object-level failure uses the object name. */
            field: string;
            /** @description Constraint identifier, for example VALIDATION_NOT_BLANK, VALIDATION_EMAIL, VALIDATION_SIZE or INVALID_PARAMETER. */
            code: string;
            detail: string;
        };
        PageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        Notification: {
            /** Format: uuid */
            id: string;
            type: string;
            title: string;
            content: string;
            /** Format: date-time */
            readAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        NotificationListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Notification"][];
            page: components["schemas"]["PageInfo"];
        };
        UnreadNotificationCountResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: {
                /** Format: int64 */
                count: number;
            };
        };
        NotificationDeliveryAttempt: {
            /** Format: uuid */
            id: string;
            attemptNumber: number;
            /** @enum {string} */
            status: "STARTED" | "SUCCEEDED" | "FAILED";
            /** Format: date-time */
            attemptedAt: string;
            /** Format: date-time */
            completedAt: string | null;
            /** @description Symbolic failure code such as SMTP_UNAVAILABLE or RECIPIENT_NOT_FOUND; null on success. */
            errorCode: string | null;
            retryable: boolean;
        };
        NotificationDelivery: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            channel: "EMAIL" | "PUSH" | "SMS";
            /** @enum {string} */
            status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
            attemptCount: number;
            /**
             * Format: date-time
             * @description When the next send is due while PENDING; null once SENT or FAILED.
             */
            nextAttemptAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            attempts: components["schemas"]["NotificationDeliveryAttempt"][];
        };
        NotificationDeliveryListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["NotificationDelivery"][];
        };
        EventLogSummary: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            eventId: string;
            eventType: string;
            aggregateType?: string | null;
            aggregateId: string;
            /** Format: uuid */
            operatorId?: string | null;
            traceId: string;
            topic?: string | null;
            /** Format: date-time */
            occurredAt: string;
            /** Format: date-time */
            receivedAt: string;
        };
        EventLogDetail: {
            event: components["schemas"]["EventLogSummary"];
            /** @description Unchanged domain payload; any JSON value. */
            payload: unknown;
            /** @description Complete original envelope, including unknown fields. */
            envelope: {
                [key: string]: unknown;
            };
            /** @description Original JSON text. Null for historical rows recorded before #192. */
            rawEnvelope?: string | null;
        };
        AuditLog: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            actorId?: string | null;
            action: string;
            entityType?: string | null;
            entityId: string;
            traceId: string;
            /** Format: date-time */
            occurredAt: string;
            /** Format: date-time */
            receivedAt: string;
        };
        EventLogListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["EventLogSummary"][];
            page: components["schemas"]["PageInfo"];
        };
        EventLogDetailResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["EventLogDetail"];
        };
        AuditLogListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["AuditLog"][];
            page: components["schemas"]["PageInfo"];
        };
        /**
         * @description UNKNOWN is only used for brokers: not checked yet, or the Redis health state is unreachable.
         * @enum {string}
         */
        HealthStatus: "UP" | "DOWN" | "UNKNOWN";
        ServiceHealth: {
            /** @description Eureka service id, or keycloak. */
            name: string;
            status: components["schemas"]["HealthStatus"];
        };
        BrokerStatus: {
            name: string;
            status: components["schemas"]["HealthStatus"];
            /** Format: date-time */
            lastCheckedAt: string | null;
        };
        BrokerHealth: {
            name: string;
            status: components["schemas"]["HealthStatus"];
            /** Format: date-time */
            lastCheckedAt: string | null;
            /** Format: date-time */
            lastFailureAt: string | null;
            /** Format: date-time */
            lastRecoveredAt: string | null;
        };
        SystemHealthResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: {
                services: components["schemas"]["ServiceHealth"][];
                brokers: components["schemas"]["BrokerStatus"][];
            };
        };
        BrokerHealthListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["BrokerHealth"][];
            page: components["schemas"]["PageInfo"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getNotificationPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPreferencesResponse"];
                };
            };
            /** @description Invalid filter, unsupported preference, duplicate cell or mandatory notification disabled */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bearer token required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing privilege or ADMIN role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    updateNotificationPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateNotificationPreferences"];
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPreferencesResponse"];
                };
            };
            /** @description Invalid filter, unsupported preference, duplicate cell or mandatory notification disabled */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bearer token required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing privilege or ADMIN role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    streamNotifications: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description notifications snapshot and heartbeat SSE */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description Bearer required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description NOTIFICATION.VIEW required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Capacity reached */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listAdminNotificationDeliveries: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
                status?: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
                channel?: "EMAIL" | "PUSH" | "SMS";
                from?: string;
                to?: string;
                errorCode?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminNotificationDeliveryListResponse"];
                };
            };
            /** @description Invalid filter, unsupported preference, duplicate cell or mandatory notification disabled */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bearer token required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing privilege or ADMIN role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getNotificationDelivery: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminNotificationDeliveryDetailResponse"];
                };
            };
            /** @description Invalid filter, unsupported preference, duplicate cell or mandatory notification disabled */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bearer token required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Missing privilege or ADMIN role */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listNotifications: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: number;
                /** @description Requested page size. */
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationListResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `NOTIFICATION_DATA_INVALID`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "NOTIFICATION_DATA_INVALID";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `NOTIFICATION_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "NOTIFICATION_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: `NOT_ACCEPTABLE`. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Present when supplied by the limiter. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
                    };
                };
            };
            /** @description Gateway Timeout. Codes: `GATEWAY_TIMEOUT`. */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 504;
                        /** @enum {string} */
                        code?: "GATEWAY_TIMEOUT";
                    };
                };
            };
        };
    };
    getUnreadNotificationCount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UnreadNotificationCountResponse"];
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `NOTIFICATION_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "NOTIFICATION_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: `NOT_ACCEPTABLE`. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Present when supplied by the limiter. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
                    };
                };
            };
            /** @description Gateway Timeout. Codes: `GATEWAY_TIMEOUT`. */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 504;
                        /** @enum {string} */
                        code?: "GATEWAY_TIMEOUT";
                    };
                };
            };
        };
    };
    markNotificationAsRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Notification ID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Read state recorded; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED, NOTIFICATION_UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "NOTIFICATION_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: FORBIDDEN, NOTIFICATION_NOT_OWNER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "NOTIFICATION_NOT_OWNER";
                    };
                };
            };
            /** @description Not Found. Codes: NOTIFICATION_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "NOTIFICATION_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: RATE_LIMITED. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
        };
    };
    listNotificationDeliveries: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Notification ID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deliveries of the notification; empty when no channel was used. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationDeliveryListResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED, NOTIFICATION_UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "NOTIFICATION_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: FORBIDDEN, NOTIFICATION_NOT_OWNER. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "NOTIFICATION_NOT_OWNER";
                    };
                };
            };
            /** @description Not Found. Codes: NOTIFICATION_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "NOTIFICATION_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: RATE_LIMITED. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
        };
    };
    markAllNotificationsAsRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Read state recorded; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED, NOTIFICATION_UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "NOTIFICATION_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: FORBIDDEN. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: RATE_LIMITED. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
        };
    };
    listEventLogs: {
        parameters: {
            query?: {
                /** @description Case-insensitive literal substring across event metadata and original envelope. */
                q?: string;
                eventType?: string;
                aggregateType?: string;
                aggregateId?: string;
                operatorId?: string;
                /** @description Inclusive occurredAt bound; from must be <= to. */
                from?: string;
                /** @description Inclusive occurredAt bound; from must be <= to. */
                to?: string;
                sort?: "occurredAt,asc" | "occurredAt,desc" | "receivedAt,asc" | "receivedAt,desc" | "eventType,asc" | "eventType,desc";
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventLogListResponse"];
                };
            };
            /** @description Invalid filters/pagination: NOTIFICATION_DATA_INVALID. Query conversion: INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "NOTIFICATION_DATA_INVALID" | "INVALID_PARAMETER";
                    };
                };
            };
            /** @description A valid bearer token is required. Code: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: `NOT_ACCEPTABLE`. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Present when supplied by the limiter. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
                    };
                };
            };
            /** @description Gateway Timeout. Codes: `GATEWAY_TIMEOUT`. */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 504;
                        /** @enum {string} */
                        code?: "GATEWAY_TIMEOUT";
                    };
                };
            };
        };
    };
    getEventLog: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Log row id returned by list; distinct from eventId. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventLogDetailResponse"];
                };
            };
            /** @description Invalid filters/pagination: NOTIFICATION_DATA_INVALID. Query conversion: INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "NOTIFICATION_DATA_INVALID" | "INVALID_PARAMETER";
                    };
                };
            };
            /** @description A valid bearer token is required. Code: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Event log not found. Code: NOTIFICATION_EVENT_LOG_NOT_FOUND */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "NOTIFICATION_EVENT_LOG_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: `NOT_ACCEPTABLE`. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Present when supplied by the limiter. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
                    };
                };
            };
            /** @description Gateway Timeout. Codes: `GATEWAY_TIMEOUT`. */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 504;
                        /** @enum {string} */
                        code?: "GATEWAY_TIMEOUT";
                    };
                };
            };
        };
    };
    listAuditLogs: {
        parameters: {
            query?: {
                actorId?: string;
                /** @description Exact eventType, e.g. UserRoleAssigned or OrderRefundCompleted. */
                action?: string;
                entityType?: string;
                entityId?: string;
                /** @description Inclusive occurredAt bound; from must be <= to. */
                from?: string;
                /** @description Inclusive occurredAt bound; from must be <= to. */
                to?: string;
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditLogListResponse"];
                };
            };
            /** @description Invalid filters/pagination: NOTIFICATION_DATA_INVALID. Query conversion: INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "NOTIFICATION_DATA_INVALID" | "INVALID_PARAMETER";
                    };
                };
            };
            /** @description A valid bearer token is required. Code: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: `NOT_ACCEPTABLE`. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Present when supplied by the limiter. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
                    };
                };
            };
            /** @description Gateway Timeout. Codes: `GATEWAY_TIMEOUT`. */
            504: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 504;
                        /** @enum {string} */
                        code?: "GATEWAY_TIMEOUT";
                    };
                };
            };
        };
    };
    getSystemHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current status of every service and broker. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SystemHealthResponse"];
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: FORBIDDEN. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: RATE_LIMITED. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
        };
    };
    listBrokerHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Every configured broker, ordered by name. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BrokerHealthListResponse"];
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: FORBIDDEN. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 405;
                        /** @enum {string} */
                        code?: "METHOD_NOT_ALLOWED";
                    };
                };
            };
            /** @description Not Acceptable. Codes: NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 406;
                        /** @enum {string} */
                        code?: "NOT_ACCEPTABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: RATE_LIMITED. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 429;
                        /** @enum {string} */
                        code?: "RATE_LIMITED";
                    };
                };
            };
            /** @description Internal Server Error. Codes: INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR";
                    };
                };
            };
        };
    };
}
