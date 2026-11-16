/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/ratings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List ratings received by a user
         * @description Requires REPUTATION.VIEW. Newest first by createdAt then id descending. Empty or out-of-range pages return an empty data array with actual totals. userId identifies the recipient, not the author. Caller identity is never selected with request parameters.
         */
        get: operations["listRatings"];
        put?: never;
        /**
         * Rate the seller of one completed order once
         * @description Requires REPUTATION.RATE. The JWT subject must match the buyer in the local OrderCompleted eligibility projection, and toUserId must match its seller. Missing eligibility returns 409, including while the completion event is in transit. The eligibility row lock serializes concurrent requests; the database also enforces one rating per buyer and order. A duplicate returns 409 without a second UserRated event. The rating and UserRated outbox row commit together. Reputation policy recalculation is owned by the event consumer and is not performed by this endpoint.
         */
        post: operations["createRating"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reputations/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a persisted user reputation aggregate
         * @description Requires REPUTATION.VIEW. Returns the persisted policy aggregate. A user with no aggregate returns 404 REPUTATION_NOT_FOUND, never a fabricated score. Rating submission emits UserRated for the owning reputation projection; it does not claim synchronous policy recalculation.
         */
        get: operations["getReputation"];
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
        CreateRatingRequest: {
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            toUserId: string;
            score: number;
            comment?: string | null;
        };
        Rating: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            fromUserId: string;
            /** Format: uuid */
            toUserId: string;
            /** Format: uuid */
            orderId: string;
            score: number;
            comment: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        RatingEnvelope: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["Rating"];
        };
        Reputation: {
            /** Format: uuid */
            userId: string;
            score: number;
            /** @enum {string} */
            trustLevel: "NEW" | "BASIC" | "TRUSTED" | "TOP";
            totalTransaction: number;
            successfulTransaction: number;
            failedTransaction: number;
        };
        PageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        ProblemDetails: {
            type?: string;
            title: string;
            status: number;
            code: string;
            detail?: string;
            instance?: string;
            traceId?: string;
            errors?: {
                field: string;
                code: string;
                detail: string;
            }[];
        };
    };
    responses: {
        /** @description RFC 9457 Problem Details. Stable codes include RATING_NOT_ELIGIBLE, RATING_FORBIDDEN, RATING_ALREADY_EXISTS, RATING_INVALID_RECIPIENT, RATING_INVALID_QUERY and REPUTATION_NOT_FOUND. Validation uses VALIDATION_FAILED with errors[]. */
        Problem: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["ProblemDetails"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listRatings: {
        parameters: {
            query: {
                userId: string;
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ratings and sibling page metadata */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 0 */
                        code: number;
                        /** @example response success */
                        message: string;
                        data: components["schemas"]["Rating"][];
                        page: components["schemas"]["PageInfo"];
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
        };
    };
    createRating: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRatingRequest"];
            };
        };
        responses: {
            /** @description Persisted rating */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RatingEnvelope"];
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            409: components["responses"]["Problem"];
        };
    };
    getReputation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                userId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Existing reputation aggregate */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @example 0 */
                        code: number;
                        /** @example response success */
                        message: string;
                        data: components["schemas"]["Reputation"];
                    };
                };
            };
            400: components["responses"]["Problem"];
            401: components["responses"]["Problem"];
            403: components["responses"]["Problem"];
            404: components["responses"]["Problem"];
        };
    };
}
