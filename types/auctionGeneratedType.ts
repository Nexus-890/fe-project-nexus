/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/auctions/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the seller's own auctions in any status
         * @description Reads the JWT seller only, including CREATED, CANCELLED and RESTRICTED auctions. Soft-deleted rows are excluded. Omitting status returns every status. Sorts by createdAt descending then id descending.
         */
        get: operations["listMyAuctions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/manage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List every auction for the back office
         * @description Back-office list for ADMIN and SUPPORT_STAFF including CREATED, CANCELLED and RESTRICTED auctions of every seller. Soft-deleted rows are excluded. Omitting status returns every status. Sorts by createdAt descending then id descending. The public list is unchanged.
         */
        get: operations["listManagedAuctions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/manage/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read any auction for the back office
         * @description Reads the stored snapshot regardless of status or visibility. Soft-deleted or unknown auctions return 404.
         */
        get: operations["getManagedAuction"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/manage/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the live state of any auction for the back office
         * @description Same shape as the public state read, regardless of visibility. Not cached.
         */
        get: operations["getManagedAuctionState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/manage/{id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the bid history of any auction for the back office
         * @description Same order and masked names as the public history, regardless of visibility. Bidder identities are never returned.
         */
        get: operations["listManagedAuctionBids"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/bids/mine": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List each auction the authenticated buyer has bid on once
         * @description Reads only bids belonging to the JWT subject. Groups by auction before pagination, including restricted auctions and cancelled bid history but excluding soft-deleted auctions. amount and placedAt come from the same latest personal bid (placedAt DESC, id DESC). Results use that same stable order. leading is true only for ACTIVE/ENDED auctions where the caller is leader_bidder_id and holds a non-CANCELLED bid matching current_price. won is true only for WON/SETTLED/PAYMENT_TIMEOUT with winner_id equal to the caller; a current leader is not assumed to have won. Counts and rows share a repeatable-read snapshot.
         */
        get: operations["listMyBids"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List public auctions, ending soonest first
         * @description Reads only auction-service tables. Excludes RESTRICTED and soft-deleted rows. CREATED and CANCELLED are hidden even when explicitly requested by status. When status is omitted only ACTIVE public non-deleted auctions are included. Sorts by endAt ascending, then id ascending for ties; client sort overrides are not supported. A page beyond the end returns an empty data array with the actual totals.
         */
        get: operations["listAuctions"];
        put?: never;
        /**
         * Create an auction as a seller
         * @description Creates an auction in CREATED status. sellerId comes from the authenticated JWT subject. The selected product must belong to that seller and contain the selected SKU. The auction stores the catalog product name and its first image URL at creation. The duration must be between the configured minimum and maximum, inclusive. Defaults are 60 minutes and 168 hours. startingPrice must be greater than zero. startAt must not be in the past, allowing up to 5 seconds of clock skew against server time. A non-deleted auction in CREATED, SCHEDULED or ACTIVE is live. A SKU can have one live auction, and each seller can have up to the configured limit (default 5). With FEATURE_REPUTATION_ENFORCEMENT enabled, the seller must pass the direct rating-service SELL eligibility check before the auction is written. A score below MIN_REPUTATION_TO_SELL (default 50) returns 403 AUCTION_REPUTATION_TOO_LOW with the policy reason. When the flag is off, this check and its dependency calls are skipped. With enforcement on, unavailable rating-service, malformed decisions, machine-token failures or an open circuit return 503 AUCTION_REPUTATION_UNAVAILABLE. Refusal writes no auction or creation outbox event.
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
        /**
         * Configure an auction before it starts
         * @description A SELLER must own the auction; an ADMIN may edit any auction and the sellerId is kept. For both, only CREATED/SCHEDULED before the stored startAt and without valid bids; updates startingPrice/currentPrice, bidIncrement, startAt, endAt and the originalEndAt baseline atomically.
         */
        put: operations["updateAuction"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/state": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the live state of a public auction
         * @description Auction data is cached for one second. Server time is read on every request.
         */
        get: operations["getAuctionState"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the paginated bid history of a public auction
         * @description Bids are ordered by amount descending, then newest first for equal amounts. Names are masked.
         */
        get: operations["listAuctionBids"];
        put?: never;
        /**
         * Accept a bid request for asynchronous processing
         * @description Validates amount format, ACTIVE/time window and seller exclusion without locking the auction price. Persists a QUEUED request and BidRequested outbox command atomically, then returns 202. Minimum-price validation and anti-sniping run in the consumer using requestedAt, including requests consumed after endAt. Reusing the same UUID Idempotency-Key for the same auction, bidder and numeric amount returns the original 202 receipt even after processing. A different payload returns 409. Follow the private bid-status URL until PLACED or REJECTED. With FEATURE_REPUTATION_ENFORCEMENT enabled, each new bid request must pass rating-service BID eligibility before any queued bid or outbox write. A score below MIN_REPUTATION_TO_BID (default 40) returns 403 AUCTION_REPUTATION_TOO_LOW with the policy reason. When the flag is off, the reputation check and its dependency calls are skipped. When on, rating-service unavailability, malformed decisions, machine-token failures or an open circuit fail closed with 503 AUCTION_REPUTATION_UNAVAILABLE. A replay of an already accepted key still returns its original 202 queued receipt even when reputation is now denied or rating-service is down; the request and command are not written again.
         */
        post: operations["placeBid"];
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
    "/api/v1/auctions/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an auction as its seller
         * @description Only the owning Seller may cancel a non-final auction with no valid bids. PLACED/OUTBID/WON bids count as valid; CANCELLED bids do not. Records actor/reason/time and AuctionCancelled in one transaction.
         */
        post: operations["cancelAuction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/admin-cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel a non-final auction as an admin
         * @description Any auction in CREATED/SCHEDULED/ACTIVE/ENDED/WON, including auctions with bids. Final SETTLED/FAILED/PAYMENT_TIMEOUT/CANCELLED cannot be cancelled. Emits one AuctionCancelled; repeated calls return 409 without another event.
         */
        post: operations["adminCancelAuction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/bids/{bidId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the authenticated bidder’s queued or final result */
        get: operations["getBidStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auctions/{id}/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream public auction snapshots over Server-Sent Events
         * @description The first named state event is the current public state. Subsequent committed auction events coalesce for 200 ms and invalidate the one-second state cache. data is exactly GET /state data, without ApiResponse; id is the auction version. heartbeat events arrive every 15 seconds. Reconnect always receives the current snapshot, including when Last-Event-ID was supplied; this is not an event-history replay. The stream closes on ENDED, WON, SETTLED, FAILED, CANCELLED or PAYMENT_TIMEOUT. On failure/refusal the frontend retains its two-second polling fallback. Timeout is 30 minutes; each instance enforces its own configured connection cap.
         */
        get: operations["streamAuctionState"];
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
        AuctionState: {
            /** Format: uuid */
            auctionId: string;
            currentPrice: number;
            bidCount: number;
            bidIncrement: number;
            /**
             * @description Masked name, or null when there is no leader.
             * @example N***A
             */
            leaderBidderName: string | null;
            /** Format: date-time */
            endAt: string;
            status: components["schemas"]["AuctionStatus"];
            /** Format: date-time */
            serverTime: string;
        };
        GetAuctionStateResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["AuctionState"];
        };
        PublicBid: {
            amount: number;
            /**
             * @description Masked display name
             * @example N***A
             */
            bidderName: string;
            /** Format: date-time */
            placedAt: string;
        };
        ListAuctionBidsResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["PublicBid"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        MyBid: {
            /** Format: uuid */
            auctionId: string;
            title: string;
            /** @description Latest personal bid amount as a JSON number. */
            amount: number;
            /** Format: date-time */
            placedAt: string;
            auctionStatus: components["schemas"]["AuctionStatus"];
            leading: boolean;
            won: boolean;
            /**
             * Format: uuid
             * @description Recorded settlement order id, returned only to the recorded winner in WON/SETTLED/PAYMENT_TIMEOUT. Null before the OrderCreated projection is stored, for other bidders and for other statuses. Never inferred from a product or bid.
             */
            orderId?: string | null;
            /**
             * Format: date-time
             * @description Stored auction payment deadline, returned only to the recorded winner in WON/SETTLED/PAYMENT_TIMEOUT; otherwise null. This read never creates or extends the deadline.
             */
            paymentDueAt?: string | null;
            /** @description Stored final auction price as a JSON number, returned only to the recorded winner in WON/SETTLED/PAYMENT_TIMEOUT; otherwise null. Distinct from the caller's latest personal bid amount. */
            finalPrice?: number | null;
        };
        ListMyBidsResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["MyBid"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
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
            /**
             * @deprecated
             * @description Accepted for existing clients. The stored title comes from the catalog product name.
             */
            title?: string | null;
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
        UpdateAuctionRequest: {
            startingPrice: components["schemas"]["CreateAuctionRequest"]["startingPrice"];
            /** @description Required, positive; at most 17 integer digits and two fractional digits. */
            bidIncrement: number;
            /**
             * Format: date-time
             * @description Must not precede server time by more than 5 seconds.
             */
            startAt: string;
            /**
             * Format: date-time
             * @description After startAt, with AUCTION_MIN_DURATION_MINUTES and AUCTION_MAX_DURATION_HOURS enforced.
             */
            endAt: string;
        };
        CancelAuctionRequest: {
            /** @description Must contain non-whitespace; surrounding whitespace is stripped when stored. */
            reason: string;
        };
        CreateAuctionResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Auction"];
        };
        PlaceBidRequest: {
            /** @description Bid amount with at most 17 integer digits and two fractional digits. */
            amount: number;
        };
        PlaceBidResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["BidResponse"];
        };
        BidResponse: {
            /** Format: uuid */
            bidId: string;
            /** @enum {string} */
            status: "QUEUED";
            /** Format: date-time */
            requestedAt: string;
        };
        BidAcceptedResponse: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["BidResponse"];
        };
        BidStatusEnvelope: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["BidStatus"];
        };
        BidStatus: {
            /** Format: uuid */
            bidId: string;
            /** @enum {string} */
            status: "QUEUED" | "PLACED" | "REJECTED" | "OUTBID" | "WON" | "CANCELLED";
            /** Format: date-time */
            requestedAt: string;
            amount: number;
            /** @description Accepted price at the time this request was processed. */
            currentPrice?: number;
            /** Format: uuid */
            leaderBidderId?: string;
            /** @enum {string} */
            reason?: "AUCTION_BID_TOO_LOW" | "AUCTION_NOT_ACTIVE" | "AUCTION_SELLER_CANNOT_BID";
            /** @description Minimum accepted price when a too-low request was rejected. */
            minimum?: number;
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
            /** @enum {string|null} */
            cancelledBy?: "SELLER" | "ADMIN" | "SYSTEM" | null;
            cancelledReason?: string | null;
            /** Format: uuid */
            cancelledActorId?: string | null;
            /** Format: date-time */
            cancelledAt?: string | null;
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
        /** @description AUCTION_NOT_FOUND. The auction is missing or soft-deleted. */
        ManagedAuctionNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description AUCTION_NOT_FOUND. The auction is missing, deleted or restricted. */
        PublicAuctionNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description INVALID_PARAMETER, VALIDATION_FAILED or INVALID_REQUEST_BODY; malformed query or paging bounds. */
        MineInvalidQuery: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description UNAUTHENTICATED; valid bearer token required. */
        MineUnauthorized: {
            headers: {
                /** @description Bearer challenge. */
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description FORBIDDEN; caller lacks the endpoint role or privilege. */
        MineForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
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
    parameters: {
        /** @description Zero-based page number. */
        MinePage: number;
        /** @description Number of distinct result rows per page. */
        MineSize: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listMyAuctions: {
        parameters: {
            query?: {
                /** @description Optional exact status filter; omitted means all statuses. */
                status?: components["schemas"]["AuctionStatus"];
                /** @description Zero-based page number. */
                page?: components["parameters"]["MinePage"];
                /** @description Number of distinct result rows per page. */
                size?: components["parameters"]["MineSize"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Own auction snapshots with page metadata; empty/out-of-range pages retain the actual totals. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListAuctionsResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    listManagedAuctions: {
        parameters: {
            query?: {
                /** @description Optional exact status filter; omitted means all statuses. */
                status?: components["schemas"]["AuctionStatus"];
                /** @description Zero-based page number. */
                page?: components["parameters"]["MinePage"];
                /** @description Number of distinct result rows per page. */
                size?: components["parameters"]["MineSize"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Auction snapshots with page metadata; empty/out-of-range pages retain the actual totals. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListAuctionsResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getManagedAuction: {
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
            /** @description Stored auction snapshot */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            404: components["responses"]["ManagedAuctionNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    getManagedAuctionState: {
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
            /** @description Current auction state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionStateResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            404: components["responses"]["ManagedAuctionNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    listManagedAuctionBids: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["MinePage"];
                /** @description Number of distinct result rows per page. */
                size?: components["parameters"]["MineSize"];
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bid history page, empty when the auction has no bids */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListAuctionBidsResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            404: components["responses"]["ManagedAuctionNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    listMyBids: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["MinePage"];
                /** @description Number of distinct result rows per page. */
                size?: components["parameters"]["MineSize"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One latest personal bid per auction; totals count distinct auctions. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListMyBidsResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["MineUnauthorized"];
            403: components["responses"]["MineForbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
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
                     *         "imageUrl": "https://example.com/images/vintage-film-camera.jpg",
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
            /** @description The caller lacks SELLER or AUCTION.CREATE, the product belongs to another seller, or enabled reputation enforcement denies SELL eligibility. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        code?: "FORBIDDEN" | "AUCTION_FORBIDDEN" | "AUCTION_REPUTATION_TOO_LOW";
                        /** @description Policy explanation included for AUCTION_REPUTATION_TOO_LOW. */
                        reason?: string;
                    };
                };
            };
            /** @description The product is unavailable in the catalog or the selected SKU does not belong to it. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        code?: "AUCTION_PRODUCT_NOT_FOUND" | "AUCTION_SKU_NOT_FOUND";
                    };
                };
            };
            /** @description The product lacks a valid image, the SKU is out of stock or has a live auction, or the seller has reached the live auction limit. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 409;
                        /** @enum {unknown} */
                        code?: "AUCTION_IMAGE_REQUIRED" | "AUCTION_SKU_ALREADY_LIVE" | "AUCTION_SELLER_LIMIT_REACHED" | "AUCTION_STOCK_UNAVAILABLE";
                    };
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
            /** @description Catalog or inventory is unavailable, an enabled reputation check cannot obtain a valid decision, or the gateway cannot reach auction-service. Reputation token/timeout/transport/malformed-response/circuit failures fail closed before any auction write. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        code?: "AUCTION_CATALOG_UNAVAILABLE" | "AUCTION_INVENTORY_UNAVAILABLE" | "AUCTION_REPUTATION_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
                    };
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
    updateAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Auction UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateAuctionRequest"];
            };
        };
        responses: {
            /** @description Updated auction snapshot; status is preserved. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            /** @description VALIDATION_FAILED, INVALID_PARAMETER, INVALID_REQUEST_BODY, AUCTION_START_IN_PAST, AUCTION_INVALID_TIME_WINDOW, AUCTION_DURATION_TOO_SHORT, AUCTION_DURATION_TOO_LONG. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["InvalidBearer"];
            /** @description FORBIDDEN for missing role or privilege; AUCTION_FORBIDDEN when a SELLER does not own the auction. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_NOT_FOUND — Missing or soft-deleted auction. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_NOT_EDITABLE or AUCTION_HAS_BIDS. No changes are committed. */
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
    getAuctionState: {
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
            /** @description Current auction state */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionStateResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["InvalidBearer"];
            404: components["responses"]["PublicAuctionNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    listAuctionBids: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["MinePage"];
                /** @description Number of distinct result rows per page. */
                size?: components["parameters"]["MineSize"];
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Bid history page, empty when the auction has no bids */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListAuctionBidsResponse"];
                };
            };
            400: components["responses"]["MineInvalidQuery"];
            401: components["responses"]["InvalidBearer"];
            404: components["responses"]["PublicAuctionNotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
            503: components["responses"]["ServiceUnavailable"];
        };
    };
    placeBid: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description UUID identifying one bid attempt. Retry with the same key after a timeout. Uppercase and lowercase UUID letters identify the same key. Use a new key for a new bid.
                 * @example 68000000-0000-4000-8000-000000000004
                 */
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "amount": 1200000
                 *     }
                 */
                "application/json": components["schemas"]["PlaceBidRequest"];
            };
        };
        responses: {
            /** @description Durable queued receipt, also returned for a matching idempotent replay. */
            202: {
                headers: {
                    /** @description Private result resource for the authenticated bidder. */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": {
                     *         "bidId": "019a5509-abcd-7111-8111-111111111113",
                     *         "status": "QUEUED",
                     *         "requestedAt": "2026-11-16T10:00:00Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["BidAcceptedResponse"];
                };
            };
            /** @description Invalid amount, missing/malformed UUID Idempotency-Key or invalid request/parameter. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": (components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 400;
                        /** @enum {unknown} */
                        code?: never;
                        /** @description The minimum amount accepted at the time of the failed bid. */
                        minimum: number;
                    }) | (components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 400;
                        /** @enum {unknown} */
                        code?: "AUCTION_IDEMPOTENCY_KEY_REQUIRED" | "AUCTION_INVALID_IDEMPOTENCY_KEY" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "INVALID_PARAMETER";
                    });
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
            /** @description FORBIDDEN for a missing BUYER role or AUCTION.BID privilege; AUCTION_REPUTATION_TOO_LOW when enabled enforcement denies BID eligibility. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Forbidden",
                     *       "status": 403,
                     *       "detail": "Reputation score 39 is below 40 required for BID",
                     *       "instance": "/api/v1/auctions/019afe64-9800-7000-8000-000000000001/bids",
                     *       "code": "AUCTION_REPUTATION_TOO_LOW",
                     *       "reason": "Reputation score 39 is below 40 required for BID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        code?: "FORBIDDEN" | "AUCTION_REPUTATION_TOO_LOW";
                        /** @description Policy explanation included for AUCTION_REPUTATION_TOO_LOW. */
                        reason?: string;
                    };
                };
            };
            /** @description Auction not found. */
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
                     *       "instance": "/api/v1/auctions/019a5509-abcd-7111-8111-111111111111/bids",
                     *       "code": "AUCTION_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 404;
                        /** @enum {unknown} */
                        code?: "AUCTION_NOT_FOUND";
                    };
                };
            };
            /** @description Auction is outside its bid window, is not ACTIVE, the bidder is the auction seller, or the key was already accepted for another auction, bidder or amount. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        status?: 409;
                        /** @enum {unknown} */
                        code?: "AUCTION_NOT_ACTIVE" | "AUCTION_SELLER_CANNOT_BID" | "AUCTION_IDEMPOTENCY_KEY_CONFLICT";
                    };
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
            /** @description AUCTION_REPUTATION_UNAVAILABLE when an enabled check has token, timeout, transport, circuit or malformed-decision failure; SERVICE_UNAVAILABLE when the gateway cannot reach auction-service. No bid, price, deadline or outbox write occurs. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Service Unavailable",
                     *       "status": 503,
                     *       "detail": "Reputation eligibility is temporarily unavailable",
                     *       "instance": "/api/v1/auctions/019afe64-9800-7000-8000-000000000001/bids",
                     *       "code": "AUCTION_REPUTATION_UNAVAILABLE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {unknown} */
                        code?: "AUCTION_REPUTATION_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
                    };
                };
            };
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
    cancelAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Auction UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelAuctionRequest"];
            };
        };
        responses: {
            /** @description CANCELLED snapshot with cancellation audit. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            /** @description VALIDATION_FAILED, INVALID_PARAMETER, INVALID_REQUEST_BODY. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["InvalidBearer"];
            /** @description FORBIDDEN for missing role or privilege; AUCTION_FORBIDDEN for ownership failure. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_NOT_FOUND — Missing or soft-deleted auction. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_HAS_BIDS or AUCTION_ILLEGAL_TRANSITION. Final states are SETTLED, FAILED, PAYMENT_TIMEOUT and CANCELLED. */
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
    adminCancelAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Auction UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelAuctionRequest"];
            };
        };
        responses: {
            /** @description CANCELLED snapshot with cancelledBy ADMIN. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetAuctionResponse"];
                };
            };
            /** @description VALIDATION_FAILED, INVALID_PARAMETER, INVALID_REQUEST_BODY. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["InvalidBearer"];
            /** @description FORBIDDEN for missing role or privilege; AUCTION_FORBIDDEN for ownership failure. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_NOT_FOUND — Missing or soft-deleted auction. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description AUCTION_ILLEGAL_TRANSITION — The auction is already final. */
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
    getBidStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
                bidId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description QUEUED while waiting, PLACED with the price/leader snapshot, or REJECTED with reason and optional minimum. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidStatusEnvelope"];
                };
            };
            /** @description Invalid UUID path. */
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
            /** @description FORBIDDEN — The caller lacks the BUYER role or the AUCTION.BID privilege. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unknown request, wrong auction or another bidder. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "AUCTION_BID_NOT_FOUND";
                    };
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["UnexpectedError"];
        };
    };
    streamAuctionState: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional browser reconnection cursor; a fresh current state is always sent. */
                "Last-Event-ID"?: string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A long-lived SSE protocol response, without an ApiResponse wrapper. */
            200: {
                headers: {
                    "X-Accel-Buffering"?: "no";
                    "Cache-Control"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example id: 12
                     *     event: state
                     *     data: {"auctionId":"019a5509-abcd-7111-8111-111111111111","currentPrice":1200000,"bidCount":2,"bidIncrement":50000,"leaderBidderName":"N***","endAt":"2026-11-16T11:05:00Z","status":"ACTIVE","serverTime":"2026-11-16T11:00:00Z"}
                     *
                     *     event: heartbeat
                     *     data: 2026-11-16T11:00:15Z
                     */
                    "text/event-stream": string;
                };
            };
            /** @description Invalid auction UUID. */
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
            /** @description Unknown, restricted or soft-deleted auction; stream has not opened. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "AUCTION_NOT_FOUND";
                    };
                };
            };
            500: components["responses"]["UnexpectedError"];
            /** @description Instance connection cap reached or shutting down; use polling. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "AUCTION_STREAM_BUSY";
                    };
                };
            };
        };
    };
}
