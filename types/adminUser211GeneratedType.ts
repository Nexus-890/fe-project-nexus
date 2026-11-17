/** Generated from the unmerged #211 snapshot, not develop. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Register with the configured default role
         * @description Requires self-registration to be enabled. Identity values are normalized before uniqueness checks. Creates the Keycloak account with the password and the configured realm role, then stores the profile under the Keycloak user id; the Keycloak account is removed when the profile cannot be stored. Sign-in goes through Keycloak; user-service issues no tokens. Access: public (a supplied invalid bearer token is rejected). Ownership/business restriction: None.
         */
        post: operations["register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the current user profile
         * @description Access: requires PROFILE.VIEW. Ownership/business restriction: JWT subject only.
         */
        get: operations["getOwnProfile"];
        /**
         * Update editable fields of the current profile
         * @description Preserves existing partial-update behavior even though the delivered method is PUT: omitted/null properties retain stored values. A changed email is also set on the Keycloak account; an email another Keycloak account holds returns 409. Access: requires PROFILE.UPDATE. Ownership/business restriction: JWT subject only.
         */
        put: operations["updateOwnProfile"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a user by id
         * @description Allows USER.VIEW OR a path id equal to the authenticated subject. Gateway requires a token, because it cannot decide subject equality. Access: authenticated bearer token. Ownership/business restriction: Own id OR USER.VIEW; other caller receives 403.
         */
        get: operations["getUser"];
        /**
         * Update permitted profile fields
         * @description Update permitted profile fields. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        put: operations["adminUpdateUser"];
        post?: never;
        /**
         * Delete profile according to USER_SOFT_DELETE and disable Keycloak sign-in
         * @description Delete profile according to USER_SOFT_DELETE and disable Keycloak sign-in. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        delete: operations["adminDeleteUser"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List nondeleted users
         * @description Search q matches existing name/email/phone filters; status and role filter the result. Stable secondary sort is id. Empty/out-of-range pages are 200. Access: requires USER.LIST. Ownership/business restriction: None.
         */
        get: operations["listUsers"];
        put?: never;
        /**
         * Create user with fixed Keycloak roles
         * @description Create user with fixed Keycloak roles. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        post: operations["adminCreateUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Change password under Keycloak password policy
         * @description Change password under Keycloak password policy. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        put: operations["adminChangePassword"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Replace the fixed application role set
         * @description Replace the fixed application role set. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        put: operations["adminAssignRoles"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/{id}/unlock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Clear a current Keycloak brute-force lock
         * @description Clear a current Keycloak brute-force lock. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        post: operations["adminUnlockUser"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List fixed realm roles and their client permissions
         * @description List fixed realm roles and their client permissions. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        get: operations["listRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/roles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a fixed realm role by Keycloak ID
         * @description Read a fixed realm role by Keycloak ID. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        get: operations["getRole"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List nexus-web client role permissions
         * @description List nexus-web client role permissions. Requires the named role and exact privilege. Keycloak owns credentials, realm roles and brute-force state; user_db stores the profile. See docs/testing/admin-user-management.md for compensation and failure boundaries.
         */
        get: operations["listPermissions"];
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
        User: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            phone: string;
            fullName: string;
            /** @enum {string|null} */
            gender: "MALE" | "FEMALE" | "OTHER" | null;
            address: string | null;
            /** Format: date */
            dateOfBirth: string | null;
            roles: string[];
            /** @enum {string} */
            status: "ACTIVE" | "LOCKED" | "DELETED";
            /** Format: date-time */
            createdAt: string;
        };
        Register: {
            /**
             * Format: email
             * @description Trimmed and normalized to lower case.
             */
            email: string;
            /** @description Whitespace, parentheses and hyphens are removed before validation. */
            phone: string;
            /**
             * Format: password
             * @description At least 8 characters. Sent only to Keycloak, which applies the realm password policy; user-service stores no password.
             */
            password: string;
            fullName: string;
            identityNumber: string;
            /** @enum {string} */
            gender: "MALE" | "FEMALE" | "OTHER";
            address: string;
            /**
             * Format: date
             * @description Valid yyyy-MM-dd date; must not be in the future in the service clock.
             */
            dateOfBirth: string;
        };
        /** @description Only listed editable fields are consumed. Unknown properties are ignored; callers cannot change roles, status, phone or identity number through this API. */
        UpdateProfile: {
            /** @description Trimmed. Omitted/null retains current value. */
            fullName?: string | null;
            /**
             * Format: date
             * @description Not in the future; omitted/null retains current value.
             */
            dateOfBirth?: string | null;
            /** @enum {string|null} */
            gender?: "MALE" | "FEMALE" | "OTHER" | null;
            /** @description Trimmed. Omitted/null retains current value. */
            address?: string | null;
            /**
             * Format: email
             * @description Trimmed and lowercased. Omitted/null retains current value.
             */
            email?: string | null;
        };
        RegisterResponse: {
            /**
             * @description Numeric success code; omitted or null values default to 0 during response construction. Explicit values are preserved.
             * @default 0
             */
            code: number;
            /**
             * @description Omitted or null values default to response success during response construction. Explicit messages are preserved.
             * @default response success
             */
            message: string;
            data: components["schemas"]["User"];
        };
        GetOwnProfileResponse: {
            /**
             * @description Numeric success code; omitted or null values default to 0 during response construction. Explicit values are preserved.
             * @default 0
             */
            code: number;
            /**
             * @description Omitted or null values default to response success during response construction. Explicit messages are preserved.
             * @default response success
             */
            message: string;
            data: components["schemas"]["User"];
        };
        UpdateOwnProfileResponse: {
            /**
             * @description Numeric success code; omitted or null values default to 0 during response construction. Explicit values are preserved.
             * @default 0
             */
            code: number;
            /**
             * @description Omitted or null values default to response success during response construction. Explicit messages are preserved.
             * @default response success
             */
            message: string;
            data: components["schemas"]["User"];
        };
        GetUserResponse: {
            /**
             * @description Numeric success code; omitted or null values default to 0 during response construction. Explicit values are preserved.
             * @default 0
             */
            code: number;
            /**
             * @description Omitted or null values default to response success during response construction. Explicit messages are preserved.
             * @default response success
             */
            message: string;
            data: components["schemas"]["User"];
        };
        ListUsersResponse: {
            /**
             * @description Numeric success code; omitted or null values default to 0 during response construction. Explicit values are preserved.
             * @default 0
             */
            code: number;
            /**
             * @description Omitted or null values default to response success during response construction. Explicit messages are preserved.
             * @default response success
             */
            message: string;
            data: components["schemas"]["User"][];
            page: components["schemas"]["PageInfo"];
        };
        AdminCreateUser: {
            /**
             * Format: email
             * @description Trimmed and normalized to lower case.
             */
            email: string;
            /** @description Whitespace, parentheses and hyphens are removed before validation. */
            phone: string;
            /**
             * Format: password
             * @description At least 8 characters. Sent only to Keycloak, which applies the realm password policy; user-service stores no password.
             */
            password: string;
            fullName: string;
            identityNumber: string;
            /** @enum {string} */
            gender: "MALE" | "FEMALE" | "OTHER";
            address: string;
            /**
             * Format: date
             * @description Valid yyyy-MM-dd date; must not be in the future in the service clock.
             */
            dateOfBirth: string;
            roleCodes: ("ADMIN" | "SUPPORT_STAFF" | "BUYER" | "SELLER")[];
        };
        AssignRoles: {
            roleCodes: ("ADMIN" | "SUPPORT_STAFF" | "BUYER" | "SELLER")[];
        };
        AdminPassword: {
            newPassword: string;
        };
        Permission: {
            code: string;
            name: string;
            description?: string | null;
        };
        Role: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            description?: string | null;
            privileges: components["schemas"]["Permission"][];
        };
        RoleListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Role"][];
            page: components["schemas"]["PageInfo"];
        };
        RoleDetailResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Role"];
        };
        PermissionListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Permission"][];
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
    register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "email": "new-buyer@example.com",
                 *       "phone": "+84901234567",
                 *       "password": "example-password",
                 *       "fullName": "New Buyer",
                 *       "identityNumber": "012345678901",
                 *       "gender": "OTHER",
                 *       "address": "Ho Chi Minh City",
                 *       "dateOfBirth": "1995-01-01"
                 *     }
                 */
                "application/json": components["schemas"]["Register"];
            };
        };
        responses: {
            /** @description Created. */
            201: {
                headers: {
                    /** @description Profile data must not be cached. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegisterResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `USER_IDENTITY_REJECTED`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "USER_IDENTITY_REJECTED";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. */
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
            /** @description Forbidden. Codes: `USER_REGISTRATION_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "USER_REGISTRATION_DISABLED";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    /** @description Methods supported by this resource when known. */
                    Allow?: string;
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
            /** @description Conflict. Codes: `USER_EMAIL_ALREADY_USED`, `USER_PHONE_ALREADY_USED`, `USER_IDENTITY_NUMBER_ALREADY_USED`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_EMAIL_ALREADY_USED" | "USER_PHONE_ALREADY_USED" | "USER_IDENTITY_NUMBER_ALREADY_USED";
                    };
                };
            };
            /** @description Unsupported Media Type. Codes: `UNSUPPORTED_MEDIA_TYPE`. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 415;
                        /** @enum {string} */
                        code?: "UNSUPPORTED_MEDIA_TYPE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description When provided by the gateway limiter, delay in seconds before retrying. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `USER_REGISTRATION_ROLE_UNAVAILABLE`, `USER_IDENTITY_PROVIDER_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "USER_REGISTRATION_ROLE_UNAVAILABLE" | "USER_IDENTITY_PROVIDER_UNAVAILABLE";
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
    getOwnProfile: {
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
                    "application/json": components["schemas"]["GetOwnProfileResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`. */
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. */
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
            /** @description Not Found. Codes: `USER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    /** @description Methods supported by this resource when known. */
                    Allow?: string;
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
                    /** @description When provided by the gateway limiter, delay in seconds before retrying. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `USER_IDENTITY_PROVIDER_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "USER_IDENTITY_PROVIDER_UNAVAILABLE";
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
    updateOwnProfile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "fullName": "Updated Seller"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateProfile"];
            };
        };
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UpdateOwnProfileResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `USER_IDENTITY_REJECTED`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "USER_IDENTITY_REJECTED";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. */
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
            /** @description Not Found. Codes: `USER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    /** @description Methods supported by this resource when known. */
                    Allow?: string;
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
            /** @description Conflict. Codes: `USER_EMAIL_ALREADY_USED`, `USER_PHONE_ALREADY_USED`, `USER_IDENTITY_NUMBER_ALREADY_USED`, `USER_PROFILE_CONFLICT`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_EMAIL_ALREADY_USED" | "USER_PHONE_ALREADY_USED" | "USER_IDENTITY_NUMBER_ALREADY_USED" | "USER_PROFILE_CONFLICT";
                    };
                };
            };
            /** @description Unsupported Media Type. Codes: `UNSUPPORTED_MEDIA_TYPE`. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 415;
                        /** @enum {string} */
                        code?: "UNSUPPORTED_MEDIA_TYPE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description When provided by the gateway limiter, delay in seconds before retrying. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `USER_IDENTITY_PROVIDER_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "USER_IDENTITY_PROVIDER_UNAVAILABLE";
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
    getUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Resource UUID. */
                id: string;
            };
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
                    "application/json": components["schemas"]["GetUserResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`. */
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. */
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
            /** @description Not Found. Codes: `USER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
                    /** @description Methods supported by this resource when known. */
                    Allow?: string;
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
                    /** @description When provided by the gateway limiter, delay in seconds before retrying. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `USER_IDENTITY_PROVIDER_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "USER_IDENTITY_PROVIDER_UNAVAILABLE";
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
    adminUpdateUser: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProfile"];
            };
        };
        responses: {
            /** @description Success. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetUserResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED, USER_IDENTITY_REJECTED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "USER_IDENTITY_REJECTED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Conflict. Codes: USER_EMAIL_ALREADY_USED, USER_PROFILE_CONFLICT, USER_IDENTITY_NOT_FOUND. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_EMAIL_ALREADY_USED" | "USER_PROFILE_CONFLICT" | "USER_IDENTITY_NOT_FOUND";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    adminDeleteUser: {
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
            /** @description No content; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Conflict. Codes: USER_IDENTITY_NOT_FOUND. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_NOT_FOUND";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    listUsers: {
        parameters: {
            query?: {
                /** @description Optional search text. */
                q?: string;
                /** @description Optional user status. */
                status?: "ACTIVE" | "LOCKED" | "DELETED";
                /** @description Keycloak realm role name, trimmed and uppercased before filtering. */
                role?: string;
                /** @description Zero-based page. */
                page?: number;
                /** @description Page size. */
                size?: number;
                /** @description Sort property. */
                sort?: "fullName" | "email" | "createdAt";
                /** @description Sort direction. */
                direction?: "asc" | "desc";
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
                    "application/json": components["schemas"]["ListUsersResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. */
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
                    /** @description Methods supported by this resource when known. */
                    Allow?: string;
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
                    /** @description When provided by the gateway limiter, delay in seconds before retrying. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `USER_IDENTITY_PROVIDER_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "USER_IDENTITY_PROVIDER_UNAVAILABLE";
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
    adminCreateUser: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdminCreateUser"];
            };
        };
        responses: {
            /** @description Success. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetUserResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED, USER_ROLE_INVALID, USER_IDENTITY_REJECTED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "USER_ROLE_INVALID" | "USER_IDENTITY_REJECTED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Conflict. Codes: USER_EMAIL_ALREADY_USED, USER_PHONE_ALREADY_USED, USER_IDENTITY_NUMBER_ALREADY_USED. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_EMAIL_ALREADY_USED" | "USER_PHONE_ALREADY_USED" | "USER_IDENTITY_NUMBER_ALREADY_USED";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    adminChangePassword: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AdminPassword"];
            };
        };
        responses: {
            /** @description No content; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED, USER_IDENTITY_REJECTED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "USER_IDENTITY_REJECTED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Conflict. Codes: USER_IDENTITY_NOT_FOUND. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_NOT_FOUND";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    adminAssignRoles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssignRoles"];
            };
        };
        responses: {
            /** @description Success. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetUserResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED, USER_ROLE_INVALID. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "USER_ROLE_INVALID";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Conflict. Codes: USER_IDENTITY_NOT_FOUND. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_NOT_FOUND";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    adminUnlockUser: {
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
            /** @description No content; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_NOT_FOUND";
                    };
                };
            };
            /** @description Conflict. Codes: USER_IDENTITY_NOT_FOUND, USER_ACCOUNT_NOT_LOCKED. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_NOT_FOUND" | "USER_ACCOUNT_NOT_LOCKED";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    listRoles: {
        parameters: {
            query?: {
                q?: string;
                sort?: "name,asc" | "name,desc";
                page?: number;
                size?: number;
            };
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
                    "application/json": components["schemas"]["RoleListResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, VALIDATION_FAILED, USER_ROLE_INVALID. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "USER_ROLE_INVALID";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    getRole: {
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
            /** @description Success. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoleDetailResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Not Found. Codes: USER_ROLE_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "USER_ROLE_NOT_FOUND";
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
    listPermissions: {
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
                    "application/json": components["schemas"]["PermissionListResponse"];
                };
            };
            /** @description Bad Request. Codes: INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description Unauthorized. Codes: UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer challenge. */
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
            /** @description Service Unavailable. Codes: USER_IDENTITY_PROVIDER_UNAVAILABLE. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "USER_IDENTITY_PROVIDER_UNAVAILABLE";
                    };
                };
            };
        };
    };
}
