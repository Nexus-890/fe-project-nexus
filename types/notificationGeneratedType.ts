/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
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
}
