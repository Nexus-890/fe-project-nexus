/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/system/configs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List all 57 SRS configuration keys
         * @description List all 57 SRS configuration keys. Reads Config Server sources and persistent overrides, and reads the four KEYCLOAK_MANAGED values from the current realm. SESSION_TIMEOUT_MINUTES is the realm SSO idle timeout and ACCESS_TOKEN_EXPIRY_MINUTES is the realm access-token lifespan, converted from seconds without truncating fractional minutes. MAX_LOGIN_ATTEMPTS is zero when brute-force protection is disabled; otherwise it is the realm failureFactor. PASSWORD_POLICY is the exact realm policy string. Historical SRS defaults and configuredValue are returned separately. An unavailable or invalid realm response fails the request with 503. Consumer refresh behavior is described in docs/testing/admin-user-management.md.
         */
        get: operations["listSystemConfigs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/configs/{key}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update a typed key in its owning service configuration
         * @description Update a typed key in its owning service configuration. Reads the per-service Config Server source and persistent overrides. Historical SRS defaults are returned separately. Consumer refresh behavior is described in docs/testing/admin-user-management.md.
         */
        put: operations["updateSystemConfig"];
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
        SystemConfig: {
            key: string;
            value: string | number | boolean | null;
            defaultValue: string | number | boolean | null;
            description: string;
            service: string;
            configuredValue: string | number | boolean;
            /**
             * @description RUNTIME is live retry policy. CONFIG_SOURCE follows its consumer refresh/restart behavior. KEYCLOAK_MANAGED reads value from the current realm, exposes the separate Config Server source as configuredValue and rejects PUT. No realm values are cached between requests.
             * @enum {string}
             */
            applyMode: "RUNTIME" | "CONFIG_SOURCE" | "KEYCLOAK_MANAGED";
        };
        ConfigListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["SystemConfig"][];
            page: components["schemas"]["PageInfo"];
        };
        ConfigUpdate: {
            value: string | number | boolean | null;
        };
        ConfigUpdatedResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: {
                key: string;
                value: string | number | boolean | null;
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
    listSystemConfigs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": [
                     *         {
                     *           "key": "NOTIFICATION_RETRY_LIMIT",
                     *           "value": 3,
                     *           "defaultValue": 3,
                     *           "description": "Notification retry attempts",
                     *           "service": "notification-service",
                     *           "applyMode": "RUNTIME",
                     *           "configuredValue": 3
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 57,
                     *         "totalElements": 57,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ConfigListResponse"];
                };
            };
            /** @description Codes: UNAUTHENTICATED */
            401: {
                headers: {
                    /** @description Bearer challenge. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: CONFIG_IDENTITY_PROVIDER_UNAVAILABLE */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    updateSystemConfig: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example NOTIFICATION_RETRY_LIMIT */
                key: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "value": 4
                 *     }
                 */
                "application/json": components["schemas"]["ConfigUpdate"];
            };
        };
        responses: {
            /** @description Success. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": {
                     *         "key": "NOTIFICATION_RETRY_LIMIT",
                     *         "value": 4
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ConfigUpdatedResponse"];
                };
            };
            /** @description Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, CONFIG_KEY_UNKNOWN, CONFIG_VALUE_INVALID, CONFIG_KEY_EXTERNALLY_MANAGED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: UNAUTHENTICATED */
            401: {
                headers: {
                    /** @description Bearer challenge. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Codes: CONFIG_UPDATE_FAILED */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
