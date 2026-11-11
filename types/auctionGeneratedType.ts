/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/auctions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List public auctions, ending soonest first
         * @description Reads only auction-service tables. Excludes RESTRICTED and soft-deleted rows. When status is omitted only ACTIVE public non-deleted auctions are included. Sorts by endAt ascending, then id ascending for ties; client sort overrides are not supported. A page beyond the end returns an empty data array with the actual totals.
         */
        get: operations["listAuctions"];
        put?: never;
        /**
         * Create an auction as a seller
         * @description Creates an auction in CREATED status. sellerId comes from the authenticated JWT subject. The duration must be between the configured minimum and maximum, inclusive. Defaults are 60 minutes and 168 hours. startingPrice must be greater than zero. startAt must not be in the past, allowing up to 5 seconds of clock skew against server time.
         */
        post: operations["createAuction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read a public auction snapshot
         * @description No token is required. Reads title and nullable imageUrl from auction-service's own row, without calling Catalog. RESTRICTED, soft-deleted and unknown auctions return the same 404. The response contains no winner or leader bidder identity.
         */
        get: operations["getAuction"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish an auction as its seller
         * @description Changes an owned auction from CREATED to SCHEDULED using its existing time window.
         */
        post: operations["scheduleAuction"];
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
        /** @enum {string} */
        AuctionStatus: "CREATED" | "SCHEDULED" | "ACTIVE" | "ENDED" | "WON" | "SETTLED" | "FAILED" | "PAYMENT_TIMEOUT" | "CANCELLED";
        GetAuctionResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Auction"];
        };
        ListAuctionsResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Auction"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        CreateAuctionRequest: {
            /** Format: uuid */
            productId: string;
            /** Format: uuid */
            skuId: string;
            title: string;
            /** @description At most 17 integer digits and two fractional digits. */
            startingPrice: number;
            /** @description Uses nexus.auction.default-bid-increment when omitted or null. At most 17 integer digits and two fractional digits. */
            bidIncrement?: number | null;
            /**
             * Format: date-time
             * @description Must not precede server time by more than 5 seconds.
             */
            startAt: string;
            /** Format: date-time */
            endAt: string;
        };
        CreateAuctionResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Auction"];
        };
        Auction: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            productId: string;
            /** Format: uuid */
            skuId: string;
            /** Format: uuid */
            sellerId: string;
            title: string;
            imageUrl?: string | null;
            startingPrice: number;
            bidIncrement: number;
            currentPrice: number;
            bidCount: number;
            /** @enum {string} */
            currency: "VND";
            /** Format: date-time */
            startAt: string;
            /** Format: date-time */
            endAt: string;
            /** Format: date-time */
            originalEndAt: string;
            extensionCount: number;
            status: components["schemas"]["AuctionStatus"];
        };
        Problem: {
            /** Format: uri */
            type: string;
            title: string;
            status: number;
            detail: string;
            instance: string;
            code: string;
            traceId?: string;
            errors?: {
                field: string;
                code: string;
                detail: string;
            }[];
        };
    };
    responses: {
        /** @description UNAUTHENTICATED — No token is needed, but an invalid supplied token is rejected. */
        InvalidBearer: {
            headers: {
                /** @description Bearer challenge. */
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description RATE_LIMITED — Gateway request limit exceeded. */
        RateLimited: {
            headers: {
                /** @description Seconds until the request can be retried. */
                "Retry-After"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description INTERNAL_ERROR — Unexpected server error. */
        UnexpectedError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description SERVICE_UNAVAILABLE — The gateway could not reach auction-service. */
        ServiceUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
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
    listAuctions: {
        parameters: {
            query?: {
                /** @description Exact uppercase status filter. Defaults to ACTIVE when omitted. */
                status?: components["schemas"]["AuctionStatus"];
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
            /** @description A page of auction snapshots; title and imageUrl are read from the local row. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": [],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 10,
                     *         "totalElements": 0,
                     *         "totalPages": 0
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ListAuctionsResponse"];
                };
            };
            /** @description INVALID_PARAMETER for conversion failures; VALIDATION_FAILED for page/size bounds. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["InvalidBearer"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    createAuction: {
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
                 *       "productId": "00000002-1111-4111-8111-111111111111",
                 *       "skuId": "00000003-1111-4111-8111-111111111111",
                 *       "title": "Vintage film camera",
                 *       "startingPrice": 1000000.25,
                 *       "startAt": "2026-11-05T10:00:00Z",
                 *       "endAt": "2026-11-05T12:00:00Z"
                 *     }
                 */
                "application/json": components["schemas"]["CreateAuctionRequest"];
            };
        };
        responses: {
            /** @description Auction saved with currentPrice equal to startingPrice and originalEndAt equal to endAt. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": {
                     *         "id": "019a5509-abcd-7111-8111-111111111111",
                     *         "productId": "00000002-1111-4111-8111-111111111111",
                     *         "skuId": "00000003-1111-4111-8111-111111111111",
                     *         "sellerId": "68000000-0000-4000-8000-000000000002",
                     *         "title": "Vintage film camera",
                     *         "imageUrl": null,
                     *         "startingPrice": 1000000.25,
                     *         "bidIncrement": 10,
                     *         "currentPrice": 1000000.25,
                     *         "bidCount": 0,
                     *         "currency": "VND",
                     *         "startAt": "2026-11-05T10:00:00Z",
                     *         "endAt": "2026-11-05T12:00:00Z",
                     *         "originalEndAt": "2026-11-05T12:00:00Z",
                     *         "extensionCount": 0,
                     *         "status": "CREATED"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["CreateAuctionResponse"];
                };
            };
            /** @description Invalid input or duration. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 400;
                        /** @enum {unknown} */
                        code?: "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "AUCTION_START_IN_PAST" | "AUCTION_INVALID_TIME_WINDOW" | "AUCTION_DURATION_TOO_SHORT" | "AUCTION_DURATION_TOO_LONG";
                    };
                };
            };
            /** @description UNAUTHENTICATED — A valid bearer token is required. */
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
            /** @description FORBIDDEN — The caller lacks the SELLER role or the AUCTION.CREATE privilege. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description RATE_LIMITED — Gateway request limit exceeded. */
            429: {
                headers: {
                    /** @description Seconds until the request can be retried. */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description INTERNAL_ERROR — Unexpected server error. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description SERVICE_UNAVAILABLE — The gateway could not reach auction-service. */
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
    getAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Auction UUID. The gateway public matcher accepts UUID-shaped paths only. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stored auction snapshot. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            /** @description INVALID_PARAMETER — Invalid UUID when calling the service directly. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["InvalidBearer"];
            /** @description AUCTION_NOT_FOUND — No public, non-deleted auction matches this UUID. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Not Found",
                     *       "status": 404,
                     *       "detail": "Auction not found",
                     *       "instance": "/api/v1/auctions/00000051-1111-4111-8111-111111111111",
                     *       "code": "AUCTION_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    scheduleAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Auction UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The auction snapshot with status SCHEDULED. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            /** @description INVALID_PARAMETER — Invalid auction UUID. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description UNAUTHENTICATED — A valid bearer token is required. */
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
            /** @description FORBIDDEN for missing role or privilege, or AUCTION_FORBIDDEN when the seller does not own the auction. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_NOT_FOUND — The auction does not exist or was soft-deleted. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_ILLEGAL_TRANSITION — The owned auction is no longer CREATED. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
}
