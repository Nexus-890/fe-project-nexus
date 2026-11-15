/** Generated from the proposed #210 seller contract, not a delivered API. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/sellers/applications/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the authenticated buyer’s own application
         * @description Select solely by validated JWT subject. No userId/id query or path parameter. Return 200 data:null when the caller never applied, otherwise the full persisted current record including reason. Do not return 404 for the empty state; missing endpoint errors remain errors. Requires no Admin list permission.
         */
        get: operations["getOwnSellerApplication"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sellers/applications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Submit or resubmit the buyer’s seller application
         * @description Issue-defined BUYER operation. Persist by JWT subject; if current record is REJECTED, update that record with the supplied values, set PENDING, clear reason and retain id. PENDING or ACTIVE returns SELLER_APPLICATION_EXISTS (409). Successful response uses the same full DTO as the own read. Admin list/approve/reject remain defined by issue #210 and #227.
         */
        post: operations["submitSellerApplication"];
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
        SellerApplicationInput: {
            companyName: string;
            phone: string;
            note: string;
        };
        SellerApplication: {
            id: string;
            companyName: string;
            phone: string;
            note: string;
            /** @enum {string} */
            status: "PENDING" | "ACTIVE" | "REJECTED";
            /** @description Required nonblank text when REJECTED. Null when PENDING/ACTIVE; clear it on resubmission. */
            reason: string | null;
        };
        OwnSellerApplicationResponse: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["SellerApplication"] | (never | null);
        };
        SellerApplicationResponse: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["SellerApplication"];
        };
        Problem: {
            status: number;
            code: string;
            title: string;
            detail?: string;
        } & {
            [key: string]: unknown;
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
    getOwnSellerApplication: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Own record or explicit null; Cache-Control: no-store */
            200: {
                headers: {
                    "Cache-Control"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnSellerApplicationResponse"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description INTERNAL_ERROR */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description SERVICE_UNAVAILABLE */
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
    submitSellerApplication: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerApplicationInput"];
            };
        };
        responses: {
            /** @description Persisted current application */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerApplicationResponse"];
                };
            };
            /** @description VALIDATION_FAILED */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description UNAUTHENTICATED */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description FORBIDDEN */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description SELLER_APPLICATION_EXISTS */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description SERVICE_UNAVAILABLE */
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
