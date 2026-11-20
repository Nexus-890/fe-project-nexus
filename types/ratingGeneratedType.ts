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
         * @description Requires REPUTATION.VIEW and one of ADMIN, SELLER, BUYER or SUPPORT_STAFF. userId identifies the rated user, not the rater. Results are ordered by createdAt descending and id descending for stable ties. Defaults page=0, size=20; size is limited to 100. A user with no ratings or a page beyond the end returns 200 with data:[] and actual page totals. The raterName field contains only the stored masked snapshot, or *** for legacy rows without one. Raw rater IDs and unmasked names are not returned. ratedByMe is computed from the authenticated caller so a buyer can find their own order review without revealing another rater's identity.
         */
        get: operations["listRatings"];
        put?: never;
        /**
         * Rate the other party of a completed order
         * @description Requires REPUTATION.RATE and either BUYER or SELLER. The authenticated subject must be the buyer or seller of the completed canonical order; the target is always the other party and is derived from the local rating_eligibility projection. Neither actor nor target is accepted from the request. Only OrderCompleted creates eligibility; rating-service does not call commerce to authorize the request. An absent completion projection returns 400, including when the completion event has not arrived yet. An auction transaction uses its completed orderId and cannot be rated again through an auctionId. Each party may submit once per order, including concurrent requests; another submission returns 409. Self-rating returns 400. The rating and UserRated outbox event commit together. The rater name is masked from the authenticated display name before storage; missing or unusable names produce ***. Responses never expose the unmasked name or rater identity.
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
         * Read a user's reputation snapshot
         * @description Requires REPUTATION.VIEW and one of ADMIN, SELLER, BUYER or SUPPORT_STAFF. Returns the committed score and trust level with its policy version. A user without an aggregate receives neutral score 50, trust NEW and zero counters. Ratings affect this snapshot after UserRated is consumed; OrderCompleted updates both parties once. No synchronous commerce call is performed.
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
    "/api/v1/reputations/{userId}/adjustments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Apply an audited admin score adjustment
         * @description Requires ADMIN and USER.REPUTATION.ADJUST. The actor comes from the JWT; the target comes from the path. delta is a strict JSON integer in the int32 range, including zero. Decimal tokens, strings, booleans and overflow are rejected instead of coerced. reason must be nonblank and at most 1000 characters. The resulting score must stay in 0..100; an out-of-range result returns 400 without clamping or writing changes. Aggregate, immutable history and resulting outbox events commit together. Idempotency-Key is optional and scoped to the target user. With a key, the same actor, target, delta and stripped reason replay the original operation/result with 200 and no further history/events. Reusing the target's key with another actor, delta or stripped reason returns 409; the same key for a different target is independent. A new operation returns 201. Without a key, each accepted request is a new operation. The reputation field records this operation's result; a later live snapshot can differ. Historical aggregates with unreconciled transaction inputs return 503 and cannot be adjusted to bypass reconciliation.
         */
        post: operations["adjustReputation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reputations/{userId}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read immutable reputation history
         * @description Requires USER.REPUTATION.VIEW and either ADMIN or SUPPORT_STAFF. Ordered by changedAt descending, then id descending for stable ties. Defaults page=0,size=20; maximum size=100. Empty or beyond-end pages return 200 with data:[] and actual page totals. Each entry records actor, reason, source operation/revision and policy version. An accepted input or trust change may have delta=0. Duplicate business effects do not create another entry. History is read-only and append-only.
         */
        get: operations["listReputationHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reputations/{userId}/restrictions": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        /**
         * List current and historical restrictions
         * @description ADMIN with USER.REPUTATION.VIEW may read any target. BUYER or SELLER with REPUTATION.VIEW may read only their own subject. Results include revoked and expired restrictions with a computed active flag.
         */
        get: operations["listReputationRestrictions"];
        put?: never;
        /**
         * Restrict bidding or selling until a future time
         * @description Requires ADMIN and USER.REPUTATION.ADJUST. Expiry must be in the future. Multiple restrictions may overlap; an action stays blocked until every restriction for it has expired or been revoked. Actor, reason and time are recorded in the immutable moderation audit.
         */
        post: operations["createReputationRestriction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reputations/{userId}/restrictions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Revoke a restriction while preserving its audit history
         * @description Requires ADMIN and USER.REPUTATION.ADJUST. Repeating the same revocation by the same actor returns the stored result; a different reason or actor after revocation returns 409. No record is physically deleted.
         */
        delete: operations["revokeReputationRestriction"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ratings/{id}/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Dispute a review received by the authenticated user
         * @description Requires BUYER or SELLER with REPUTATION.RATE. Only the rated recipient may dispute; the original author and other users receive 403. A rating may have only one dispute, including after rejection; duplicates return 409. Pending disputes leave visibility and reputation unchanged.
         */
        post: operations["createRatingDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ratings/disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read disputes for administrative review
         * @description Requires ADMIN and USER.REPUTATION.VIEW. Ordered newest first.
         */
        get: operations["listRatingDisputes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ratings/disputes/{id}": {
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
         * Approve or reject a pending dispute
         * @description Requires ADMIN and USER.REPUTATION.ADJUST. Approval hides the rating from ordinary lists and removes its applied score contribution in the same transaction. Late events, retries and backfills cannot restore it. Rejection preserves the original rating. Actor, reason and time remain audited. Repeating an identical resolution by its actor is idempotent; another resolution of a final dispute returns 409.
         */
        patch: operations["resolveRatingDispute"];
        trace?: never;
    };
    "/api/v1/users/me/reputation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the caller's own reputation
         * @description Requires REPUTATION.VIEW. The gateway routes this path to rating-service. The owner is the JWT subject. Returns the committed score and trust level with transaction and auction counters, the average rating rounded to one decimal (null without ratings) and how many history entries lowered the score. A user without an aggregate receives neutral score 50, trust NEW and zero counters; reading never creates an aggregate.
         */
        get: operations["getOwnReputation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/users/me/penalties": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the caller's own score losses
         * @description Requires REPUTATION.VIEW. The owner is the JWT subject. Returns reputation history entries with delta below zero (payment timeouts, low ratings, admin deductions and approved rating disputes that reduce the score), newest first, then id descending. Defaults page=0, size=10; maximum size=50. The acting admin is not exposed.
         */
        get: operations["listOwnPenalties"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/eligibility/{userId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check reputation eligibility for one action
         * @description Direct service-to-service endpoint, never routed by the public gateway. Requires a valid RS256 bearer with the configured issuer/audience, service_account boolean true, an azp listed in nexus.rating.eligibility.allowed-clients and RATING.ELIGIBILITY.CHECK authority. RATING_ELIGIBILITY_ALLOWED_CLIENTS configures the allowlist; its default clients are nexus-auction-service and nexus-catalog-service. Normal user or ADMIN tokens are denied even if they carry the authority. action is required and selects MIN_REPUTATION_TO_BID (default 40) or MIN_REPUTATION_TO_SELL (default 50). A score equal to the minimum is eligible only when no active restriction applies to that action. restrictedUntil is the latest active restriction expiry, or null. Expired/revoked restrictions do not block. A policy denial returns 200 with eligible=false and its reason, distinct from validation, authentication and availability failures. A user without activity has neutral score 50 and trust NEW. Decisions reflect committed state; asynchronous UserRated effects can arrive after rating submission. Unreconciled historical transaction inputs fail closed with 503 instead of producing an eligibility decision from incomplete evidence.
         */
        get: operations["checkReputationEligibility"];
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
        CreateRestrictionRequest: {
            /** @enum {string} */
            action: "BID" | "SELL";
            reason: string;
            /**
             * Format: date-time
             * @description Must be in the future.
             */
            restrictedUntil: string;
        };
        ReputationRestriction: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            /** @enum {string} */
            action: "BID" | "SELL";
            reason: string;
            /** Format: date-time */
            restrictedUntil: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            createdBy: string;
            /** Format: date-time */
            revokedAt?: string | null;
            /** Format: uuid */
            revokedBy?: string | null;
            revocationReason?: string | null;
            active: boolean;
        };
        CreateDisputeRequest: {
            reason: string;
        };
        ResolveDisputeRequest: {
            /** @enum {string} */
            status: "APPROVED" | "REJECTED";
            reason: string;
        };
        RatingDispute: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            ratingId: string;
            /** Format: uuid */
            userId: string;
            reason: string;
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED";
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            resolvedAt?: string | null;
            /** Format: uuid */
            resolvedBy?: string | null;
            resolutionReason?: string | null;
            ratingScore: number;
            ratingComment?: string | null;
        };
        RestrictionEnvelope: {
            /** @default 0 */
            code: number;
            message: string;
            data: components["schemas"]["ReputationRestriction"];
        };
        RestrictionPageEnvelope: {
            /** @default 0 */
            code: number;
            message: string;
            data: components["schemas"]["ReputationRestriction"][];
            page: components["schemas"]["PageInfo"];
        };
        DisputeEnvelope: {
            /** @default 0 */
            code: number;
            message: string;
            data: components["schemas"]["RatingDispute"];
        };
        DisputePageEnvelope: {
            /** @default 0 */
            code: number;
            message: string;
            data: components["schemas"]["RatingDispute"][];
            page: components["schemas"]["PageInfo"];
        };
        /**
         * @description Level resolved by the versioned runtime reputation policy.
         * @enum {string}
         */
        TrustLevel: "NEW" | "BASIC" | "TRUSTED" | "TOP";
        Reputation: {
            /** Format: uuid */
            userId: string;
            score: number;
            trustLevel: components["schemas"]["TrustLevel"];
            /** Format: int32 */
            totalTransaction: number;
            /** Format: int32 */
            successfulTransaction: number;
            /** Format: int32 */
            failedTransaction: number;
            /** Format: int64 */
            ratingCount: number;
            policyVersion: string;
        };
        ReputationEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Reputation"];
        };
        AdjustmentRequest: {
            /**
             * Format: int32
             * @description Strict JSON integer token. Decimal forms such as 5.0, strings such as "5", booleans and int32 overflow are rejected. Zero is accepted.
             */
            delta: number;
            /** @description Required nonblank explanation. Leading/trailing whitespace is stripped before history and replay comparison. */
            reason: string;
        };
        AdjustmentResult: {
            /** Format: uuid */
            operationId: string;
            reputation: components["schemas"]["Reputation"];
            /** @description False for a new operation, true when returning its original result. */
            replayed: boolean;
        };
        AdjustmentEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["AdjustmentResult"];
        };
        ReputationHistory: {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description Stable business operation identity retained across retries.
             */
            operationId: string;
            /** Format: uuid */
            userId: string;
            /**
             * Format: uuid
             * @description Rating, order or auction source UUID; may be null for an admin adjustment.
             */
            sourceId: string | null;
            /**
             * Format: int64
             * @description Business source revision, not the event schema version; initial ratings use 0.
             */
            sourceVersion: number | null;
            /** @enum {string} */
            changeType: "USER_RATED" | "ORDER_COMPLETED" | "AUCTION_PAYMENT_TIMEOUT" | "ADMIN_ADJUSTMENT" | "RATING_DISPUTE_APPROVED";
            previousScore: number;
            newScore: number;
            /** @description Actual newScore minus previousScore; may be zero after clamping or a counter-only change. */
            delta: number;
            previousLevel: components["schemas"]["TrustLevel"];
            newLevel: components["schemas"]["TrustLevel"];
            /**
             * Format: uuid
             * @description Authenticated admin actor or the fixed system UUID for consumer changes.
             */
            actorId: string;
            reason: string;
            policyVersion: string;
            /**
             * Format: date-time
             * @description Persisted change time normalized to UTC.
             */
            changedAt: string;
        };
        MyReputation: {
            score: number;
            trustLevel: components["schemas"]["TrustLevel"];
            totalTransaction: number;
            successfulTransaction: number;
            failedTransaction: number;
            /** Format: int64 */
            ratingCount: number;
            /** @description Average star rating with one decimal; null without ratings. */
            averageRating: number | null;
            successfulAuctions: number;
            failedAuctions: number;
            /** Format: int64 */
            penaltyCount: number;
            policyVersion: string;
        };
        MyReputationEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["MyReputation"];
        };
        Penalty: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            changeType: "USER_RATED" | "ORDER_COMPLETED" | "AUCTION_PAYMENT_TIMEOUT" | "ADMIN_ADJUSTMENT" | "RATING_DISPUTE_APPROVED";
            /**
             * Format: uuid
             * @description Rating, order or auction behind the change; null for an admin adjustment.
             */
            sourceId: string | null;
            delta: number;
            previousScore: number;
            newScore: number;
            previousLevel: components["schemas"]["TrustLevel"];
            newLevel: components["schemas"]["TrustLevel"];
            reason: string;
            /** Format: date-time */
            changedAt: string;
        };
        PenaltyEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Penalty"][];
            page: components["schemas"]["PageInfo"];
        };
        ReputationHistoryEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ReputationHistory"][];
            page: components["schemas"]["PageInfo"];
        };
        /** @enum {string} */
        EligibilityAction: "BID" | "SELL";
        Eligibility: {
            /** Format: uuid */
            userId: string;
            action: components["schemas"]["EligibilityAction"];
            /** @description True when score meets the selected minimum and no active restriction applies. */
            eligible: boolean;
            score: number;
            trustLevel: components["schemas"]["TrustLevel"];
            /** @description Applied configured threshold for this action. */
            minimumScore: number;
            /** @description Nonblank explanation for both eligible and ineligible results. */
            reason: string;
            policyVersion: string;
            /**
             * Format: date-time
             * @description Latest active restriction expiry for the selected action.
             */
            restrictedUntil?: string | null;
        };
        EligibilityEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Eligibility"];
        };
        CreateRatingRequest: {
            /**
             * Format: uuid
             * @description Completed canonical seller-order UUID.
             */
            orderId: string;
            /** @description Strict JSON integer token, distinct from the 0-100 reputation score. Decimal forms such as 5.0, numeric strings, booleans and overflow are rejected rather than coerced. */
            score: number;
            /** @description Optional review text. Omitted and null values are accepted. */
            comment?: string | null;
        };
        Rating: {
            /** Format: uuid */
            id: string;
            /**
             * Format: uuid
             * @description Required for new ratings; may be null only on legacy rows returned by GET.
             */
            orderId: string | null;
            /**
             * Format: uuid
             * @description Auction context derived from the completed order, null for STANDARD orders.
             */
            auctionId: string | null;
            score: number;
            comment: string | null;
            /**
             * @description Stored masked name. Never the raw name or rater UUID; fallback is ***.
             * @example N***A
             */
            raterName: string;
            /**
             * Format: date-time
             * @description Original submission time in UTC.
             */
            createdAt: string;
            /** @description True only when the authenticated caller submitted this rating; never supplied by the request. */
            ratedByMe: boolean;
            /**
             * @description Existing dispute status; null when the rating has not been disputed.
             * @enum {string|null}
             */
            disputeStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
        };
        RatingEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Rating"];
        };
        RatingPageEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Rating"][];
            page: components["schemas"]["PageInfo"];
        };
        PageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        Problem: {
            /** Format: uri */
            type: string;
            title: string;
            status: number;
            detail: string;
            /** Format: uri-reference */
            instance: string;
            /** @description Stable named code from rating-service's ErrorCode enum. */
            code: string;
            /** @description Present only when an active trace is available. */
            traceId?: string;
            errors?: components["schemas"]["ValidationError"][];
        };
        ValidationError: {
            field: string;
            /** @description Field constraint identifier, such as VALIDATION_NOT_NULL or VALIDATION_MAX. */
            code: string;
            detail: string;
        };
    };
    responses: {
        /** @description Historical reputation evidence must be reconciled before this operation. Code: RATING_RECONCILIATION_REQUIRED. */
        ReconciliationRequired: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Service Unavailable",
                 *       "status": 503,
                 *       "detail": "Historical reputation inputs must be reconciled before this operation",
                 *       "instance": "/internal/v1/eligibility/019afe64-9800-7000-8000-000000000010",
                 *       "code": "RATING_RECONCILIATION_REQUIRED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Invalid UUID, action or pagination. Codes: RATING_INVALID_PARAMETER, RATING_VALIDATION_FAILED. */
        InvalidQuery: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The required role, authority or machine-principal policy is not satisfied. Code: RATING_FORBIDDEN. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:forbidden",
                 *       "title": "Forbidden",
                 *       "status": 403,
                 *       "detail": "Access is denied",
                 *       "instance": "/api/v1/reputations/019afe64-9800-7000-8000-000000000010",
                 *       "code": "RATING_FORBIDDEN"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unsupported request content type. Code: RATING_UNSUPPORTED_MEDIA_TYPE. */
        UnsupportedMediaType: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:unsupported-media-type",
                 *       "title": "Unsupported Media Type",
                 *       "status": 415,
                 *       "detail": "The request media type is not supported",
                 *       "instance": "/api/v1/reputations/019afe64-9800-7000-8000-000000000010/adjustments",
                 *       "code": "RATING_UNSUPPORTED_MEDIA_TYPE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Invalid adjustment. Codes: RATING_ADJUSTMENT_OUT_OF_RANGE, RATING_VALIDATION_FAILED, RATING_INVALID_REQUEST_BODY, RATING_INVALID_PARAMETER. */
        InvalidAdjustment: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Invalid rating request. Codes: RATING_ORDER_NOT_COMPLETED, RATING_SELF_RATING, RATING_VALIDATION_FAILED, RATING_INVALID_REQUEST_BODY, RATING_INVALID_PARAMETER. */
        InvalidRating: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Missing, expired or invalid access token. Code: RATING_UNAUTHENTICATED. */
        Unauthenticated: {
            headers: {
                /** @description Bearer authentication challenge. */
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:unauthorized",
                 *       "title": "Unauthorized",
                 *       "status": 401,
                 *       "detail": "A valid access token is required",
                 *       "instance": "/api/v1/ratings",
                 *       "code": "RATING_UNAUTHENTICATED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Forbidden. Codes: RATING_FORBIDDEN, RATING_NOT_ORDER_PARTICIPANT. */
        RatingForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unsupported HTTP method. Code: RATING_METHOD_NOT_ALLOWED. */
        MethodNotAllowed: {
            headers: {
                /** @description HTTP methods accepted by this resource. */
                Allow?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:method-not-allowed",
                 *       "title": "Method Not Allowed",
                 *       "status": 405,
                 *       "detail": "The HTTP method is not supported",
                 *       "instance": "/api/v1/ratings",
                 *       "code": "RATING_METHOD_NOT_ALLOWED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unsupported response format. Code: RATING_NOT_ACCEPTABLE. */
        NotAcceptable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:not-acceptable",
                 *       "title": "Not Acceptable",
                 *       "status": 406,
                 *       "detail": "The response format is not supported",
                 *       "instance": "/api/v1/ratings",
                 *       "code": "RATING_NOT_ACCEPTABLE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unexpected service failure. Code: RATING_INTERNAL_ERROR. */
        InternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:internal-server-error",
                 *       "title": "Internal Server Error",
                 *       "status": 500,
                 *       "detail": "An unexpected rating service error occurred",
                 *       "instance": "/api/v1/ratings",
                 *       "code": "RATING_INTERNAL_ERROR"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Target user's UUID; external user IDs are logical references. */
        UserId: string;
        /** @description Zero-based page number. */
        Page: number;
        /** @description Requested number of entries per page. */
        Size: number;
        /**
         * @description Optional case-sensitive key scoped to the target user. Only 1..128 visible ASCII characters without spaces are accepted. Reusing it with the same actor, delta and stripped reason replays the original result. Another actor or payload conflicts; the same key for another target is independent.
         * @example adjustment-20261116-001
         */
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listRatings: {
        parameters: {
            query: {
                /** @description UUID of the user receiving the ratings. */
                userId: string;
                /** @description Zero-based page number. */
                page?: number;
                /** @description Requested maximum number of ratings per page. */
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of ratings with masked rater names. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RatingPageEnvelope"];
                };
            };
            /** @description Invalid or missing userId or pagination. Codes: RATING_VALIDATION_FAILED, RATING_INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            /** @description Insufficient role or privilege. Code: RATING_FORBIDDEN. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:forbidden",
                     *       "title": "Forbidden",
                     *       "status": 403,
                     *       "detail": "You do not have permission to access this resource",
                     *       "instance": "/api/v1/ratings",
                     *       "code": "RATING_FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
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
                /**
                 * @example {
                 *       "orderId": "019afe64-9800-7000-8000-000000000001",
                 *       "score": 5,
                 *       "comment": "The item matched its description."
                 *     }
                 */
                "application/json": components["schemas"]["CreateRatingRequest"];
            };
        };
        responses: {
            /** @description Rating created and UserRated written to the local outbox. */
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
                     *         "id": "019afe64-9800-7000-8000-000000000002",
                     *         "orderId": "019afe64-9800-7000-8000-000000000001",
                     *         "auctionId": null,
                     *         "score": 5,
                     *         "comment": "The item matched its description.",
                     *         "raterName": "N***A",
                     *         "createdAt": "2026-11-16T08:00:00Z",
                     *         "ratedByMe": true
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RatingEnvelope"];
                };
            };
            400: components["responses"]["InvalidRating"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["RatingForbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            /** @description Conflict. Code: RATING_ALREADY_EXISTS. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Conflict",
                     *       "status": 409,
                     *       "detail": "This order has already been rated by the current user",
                     *       "instance": "/api/v1/ratings",
                     *       "code": "RATING_ALREADY_EXISTS"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unsupported request content type. Code: RATING_UNSUPPORTED_MEDIA_TYPE. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:unsupported-media-type",
                     *       "title": "Unsupported Media Type",
                     *       "status": 415,
                     *       "detail": "The request media type is not supported",
                     *       "instance": "/api/v1/ratings",
                     *       "code": "RATING_UNSUPPORTED_MEDIA_TYPE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            500: components["responses"]["InternalError"];
        };
    };
    getReputation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Reputation snapshot under its recorded policy version. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReputationEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
        };
    };
    adjustReputation: {
        parameters: {
            query?: never;
            header?: {
                /**
                 * @description Optional case-sensitive key scoped to the target user. Only 1..128 visible ASCII characters without spaces are accepted. Reusing it with the same actor, delta and stripped reason replays the original result. Another actor or payload conflicts; the same key for another target is independent.
                 * @example adjustment-20261116-001
                 */
                "Idempotency-Key"?: components["parameters"]["IdempotencyKey"];
            };
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "delta": -5,
                 *       "reason": "Confirmed administrative correction"
                 *     }
                 */
                "application/json": components["schemas"]["AdjustmentRequest"];
            };
        };
        responses: {
            /** @description Original result replayed; replayed is true. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdjustmentEnvelope"];
                };
            };
            /** @description New adjustment committed; replayed is false. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdjustmentEnvelope"];
                };
            };
            400: components["responses"]["InvalidAdjustment"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            /** @description The target user key was reused with another actor or payload. Code: RATING_IDEMPOTENCY_CONFLICT. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Conflict",
                     *       "status": 409,
                     *       "detail": "The idempotency key has already been used for another adjustment",
                     *       "instance": "/api/v1/reputations/019afe64-9800-7000-8000-000000000010/adjustments",
                     *       "code": "RATING_IDEMPOTENCY_CONFLICT"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            415: components["responses"]["UnsupportedMediaType"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["ReconciliationRequired"];
        };
    };
    listReputationHistory: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Requested number of entries per page. */
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of immutable reputation changes. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReputationHistoryEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
        };
    };
    listReputationRestrictions: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Requested number of entries per page. */
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Restriction history, newest first. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RestrictionPageEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
        };
    };
    createReputationRestriction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRestrictionRequest"];
            };
        };
        responses: {
            /** @description Restriction and audit committed. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RestrictionEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
        };
    };
    revokeReputationRestriction: {
        parameters: {
            query: {
                reason: string;
            };
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Revoked restriction. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RestrictionEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            /** @description Restriction does not belong to the target or does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Restriction was already revoked with another actor or reason. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    createRatingDispute: {
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
                "application/json": components["schemas"]["CreateDisputeRequest"];
            };
        };
        responses: {
            /** @description Pending dispute recorded. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputeEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            /** @description Visible rating does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description A dispute for the rating already exists. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listRatingDisputes: {
        parameters: {
            query?: {
                status?: "PENDING" | "APPROVED" | "REJECTED";
                /** @description Zero-based page number. */
                page?: components["parameters"]["Page"];
                /** @description Requested number of entries per page. */
                size?: components["parameters"]["Size"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Disputes including the original rating score and comment. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputePageEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
        };
    };
    resolveRatingDispute: {
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
                "application/json": components["schemas"]["ResolveDisputeRequest"];
            };
        };
        responses: {
            /** @description Final dispute decision. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DisputeEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            /** @description Dispute does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Dispute was already resolved with different data. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            503: components["responses"]["ReconciliationRequired"];
        };
    };
    getOwnReputation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Own reputation. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MyReputationEnvelope"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            500: components["responses"]["InternalError"];
        };
    };
    listOwnPenalties: {
        parameters: {
            query?: {
                /** @description Zero-based page number. */
                page?: components["parameters"]["Page"];
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A page of own score losses. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PenaltyEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            500: components["responses"]["InternalError"];
        };
    };
    checkReputationEligibility: {
        parameters: {
            query: {
                /** @description Selects the configured bidding or selling threshold. */
                action: components["schemas"]["EligibilityAction"];
            };
            header?: never;
            path: {
                /** @description Target user's UUID; external user IDs are logical references. */
                userId: components["parameters"]["UserId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A valid evaluation; eligible=false is a successful policy decision. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EligibilityEnvelope"];
                };
            };
            400: components["responses"]["InvalidQuery"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["ReconciliationRequired"];
        };
    };
}
