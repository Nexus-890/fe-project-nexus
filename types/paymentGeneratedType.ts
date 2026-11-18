/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/webhooks/sepay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm a payable checkout from a verified SePay callback
         * @description Public at the gateway and payment service; no bearer token is required. Before parsing JSON or querying payment_db, verifies HMAC-SHA256 over the ASCII timestamp, one dot byte and the original request body bytes. Missing, malformed, stale or invalid signature/timestamp headers return 401. The absolute timestamp skew must be at most 300 seconds. A nonempty normalized code takes precedence over content, even if that code has no matching session. Otherwise content is normalized and looked up exactly first; only if that fails is one configured leading bank prefix (for example SEVQR) removed for another exact lookup. Normalization trims, uppercases using Locale.ROOT and removes Unicode whitespace. The remaining memo must be 1-32 uppercase ASCII letters/digits for an exact payment_sessions.memo_code lookup. There is no arbitrary substring matching. Missing, invalid or unknown memos are accepted with one WARN naming the normalized memo. Unmatched memos return 200 without financial effects. Outgoing transfers are acknowledged without funding a checkout. Matched incoming transfers require a positive provider transaction id and a nonnegative transferAmount within numeric(19,2) bounds. The provider id is stored as txnReference and globally deduplicated by a durable sepay:{id} identity. A duplicate returns 200 and creates no further transaction or event, including concurrent deliveries. When the amount equals the still-payable session total and the complete instruction plan is payable, one transaction atomically stores a NORMAL/SUCCESS receipt, marks the session and instructions PAID, links funded_transaction_id, writes one CheckoutPaymentConfirmed and applies pending paid-order cancellation refunds. Otherwise a valid incoming receipt is UNRECONCILED with a WARN and no CheckoutPaymentConfirmed. The payment outbox relay keys CheckoutPaymentConfirmed by orderGroupId while retaining sessionId as the envelope aggregate. Commerce validates the complete plan and commits group/order PAID, history and one OrderPaid per eligible order asynchronously. Neither service changes inventory in this flow. HTTP 200 acknowledges receipt; it does not await commerce processing. The native SePay acknowledgement is exempt from ApiResponse using @ProtocolResponse.
         */
        post: operations["receiveSepayWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List payment attempts for support or for one order
         * @description With orderId, returns every payment attempt of the order's payment group, oldest first, without paging; the buyer who owns the order, Admin and Support Staff may read it. Without orderId, returns a page of all payment attempts, newest first, optionally filtered by status (for example UNRECONCILED); this needs ORDER.REFUND. The provider reference is masked to its last four characters; idempotency keys and raw provider payloads are never returned.
         */
        get: operations["listPayments"];
        put?: never;
        /**
         * Read the buyer's existing group payment instructions
         * @description Requires CHECKOUT.START and ownership of the session. Data comes only from payment_db, populated from the complete checkout event. A canceled, paid or expired session never gets a replacement QR. Unknown/not-yet-consumed groups return 404. ExpiresAt controls server acceptance; the bank-transfer QR itself does not enforce the Nexus deadline at the bank. ServerNow is sampled from the payment service clock on every response so clients can calculate the remaining time without relying on their device clock. For manual bank transfers copy transferContent, which matches the QR description including any bank-required prefix; memoCode remains the immutable session reference.
         */
        post: operations["initiateGroupPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/refunds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the refund of one order
         * @description Requires ORDER.REFUND. R1 has at most one refund per order.
         */
        get: operations["listRefunds"];
        put?: never;
        /**
         * Request the refund of a cancelled, paid seller order
         * @description Requires ORDER.REFUND (Admin, Support Staff). One refund per order. The same Idempotency-Key with the same orderId, reason and amount returns the stored refund, even after it is completed; an omitted amount is compared as the full amount paid. Payment-side funding evidence decides whether the order was paid; the order must already be cancelled on the payment side. OrderCancelled already creates the full refund for a paid order, so this endpoint serves cancelled, paid orders that have no refund yet (for example data recovery). An order that already has a refund returns 409 PAYMENT_REFUND_EXISTS; Support completes the existing refund with /complete. Omitted amount means the full amount paid for this order.
         */
        post: operations["requestRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/refunds/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record that the manual transfer back to the buyer is done
         * @description Requires ORDER.REFUND. Records one REFUND payment transaction (MANUAL_TRANSFER) and emits OrderRefundCompleted. Calling it again on a completed refund returns the stored refund without a second transaction or event.
         */
        post: operations["completeRefund"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/seller-bank-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List seller bank accounts for administrator review
         * @description ADMIN only; SELLER and SUPPORT_STAFF receive 403. Optional filters are combined with AND before counting and pagination. UNVERIFIED accounts come first, oldest createdAt first, then id ascending for ties; remaining accounts follow in the same chronological order. Only accountLast4 is returned, never the full number or ciphertext. This read does not verify accounts, release held payouts or create transfers. Own seller reads remain at /me. Verification uses the displayed version as expectedVersion.
         */
        get: operations["listAdminSellerBankAccounts"];
        put?: never;
        /**
         * Create an encrypted seller bank account
         * @description Seller ID comes from the authenticated JWT. Account numbers retain leading zeroes and are encrypted with AES-GCM. Responses expose only accountLast4. Accounts start UNVERIFIED; verification does not transfer money.
         */
        post: operations["createSellerBankAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/seller-bank-accounts/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the authenticated seller bank accounts */
        get: operations["listOwnSellerBankAccounts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/seller-bank-accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Update an owned bank account
         * @description Changing bank code, account number or holder resets verification to UNVERIFIED and clears previous verification/rejection metadata. Omitted isDefault/active preserve their stored values. A sent payout retains its recipient snapshot. active=false deactivates the account.
         */
        put: operations["updateSellerBankAccount"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/seller-bank-accounts/{id}/default": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Choose the seller active default bank account
         * @description At most one active default account per seller. Selecting a default does not verify it. An account must also be active and VERIFIED before a payout can be sent.
         */
        post: operations["setDefaultSellerBankAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/seller-bank-accounts/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify or reject a bank account
         * @description Administrator verification only. expectedVersion must match the account version displayed during review; a changed account returns 409 and must be reviewed again. Rejecting requires a nonblank reason. Verifying an active default account releases eligible ON_HOLD payouts automatically; no manual payout creation endpoint exists.
         */
        post: operations["verifySellerBankAccount"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List automatic seller payouts for administrators
         * @description ADMIN only; SELLER and SUPPORT_STAFF receive 403. Combines sellerId, any selected status, and inclusive createdAt bounds before counting and pagination. Newest createdAt first, id descending for ties. Send repeated status parameters for needs action: ON_HOLD, UNKNOWN, FAILED, RETURNED. Lists existing #257 payouts without recalculating amounts, consuming completion events, creating payouts or retrying transfers. Each row includes the orderId, sellerId, frozen netAmount, attemptCount and updatedAt. Payout eligibility and the fee rule remain owned by #257; only eligible funded COMPLETED orders without refunds create payouts.
         */
        get: operations["listAdminPayouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the authenticated seller automatic payouts
         * @description One payout per completed, funded seller order. PAID buyer state is distinct from payout state. simulated=true identifies sandbox evidence; provider acceptance alone does not mean seller funds have arrived.
         */
        get: operations["listOwnPayouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read payout state and immutable history
         * @description The owning seller or an administrator can read the payout, with history newest first. History exposes last four account digits and sanitized provider outcomes; recipient ciphertext and credentials are never returned.
         */
        get: operations["getPayout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retry a definitively failed or returned payout
         * @description Only FAILED or RETURNED can be retried. Requires an Idempotency-Key of 1 to 100 letters, digits, dots, underscores, colons or hyphens. Repeating the same authorized request does not enqueue another attempt. PROCESSING or UNKNOWN must be reconciled before retry. The next send uses a fresh attempt key and the verified active default bank account.
         */
        post: operations["retryPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/callbacks/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Accept a signed payout provider outcome
         * @description Public to JWT authentication; authenticates the raw bytes using X-Payout-Timestamp and X-Payout-Signature. HMAC-SHA256 signs epoch seconds, one dot and the exact UTF-8 request body; maximum clock skew is 300 seconds. The payout, provider, attempt and idempotency key must match the persisted send. Duplicate callbacks create no additional money movement. ACCEPTED is PROCESSING; only confirmed SUCCEEDED writes PAYOUT evidence. Provider acknowledgement uses @ProtocolResponse, outside ApiResponse.
         */
        post: operations["receivePayoutCallback"];
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
        /** @description Provider wire object. Fields remain optional and nullable during parsing and memo matching. A matched incoming receipt requires a positive id, transferType=in and a nonnegative amount fitting numeric(19,2). Outgoing transfers are acknowledged without settlement. Provider timestamp text is preserved; signature freshness uses the signed HTTP timestamp header. Unknown fields are ignored. A missing memo produces an accepted no-match. */
        SepayWebhookRequest: {
            /**
             * Format: int64
             * @description Positive provider receipt identity required for matched incoming settlement; retained as txnReference
             */
            id?: number | null;
            gateway?: string | null;
            /** @description Provider timestamp text, preserved without date-format validation */
            transactionDate?: string | null;
            /** @description Receiving account text; preserve leading zeros */
            accountNumber?: string | null;
            /** @description Provider-extracted memo; takes precedence when nonempty after normalization */
            code?: string | null;
            /** @description Fallback memo source; exact normalized lookup precedes a retry with one configured leading prefix removed */
            content?: string | null;
            /** @description Incoming settlement requires in (case insensitive); out is acknowledged without funding */
            transferType?: string | null;
            /** @description Matched incoming receipts require a nonnegative numeric(19,2) value; only the exact payable-session total funds the checkout */
            transferAmount?: number | null;
            accumulated?: number | null;
            subAccount?: string | null;
            referenceCode?: string | null;
            description?: string | null;
        } & {
            [key: string]: unknown;
        };
        SepayWebhookAcknowledgement: {
            /** @enum {boolean} */
            success: true;
        };
        PaymentInitApiResponse: {
            /**
             * @default 0
             * @example 0
             */
            code: number;
            /**
             * @default response success
             * @example response success
             */
            message: string;
            data: components["schemas"]["PaymentInitResponse"];
        };
        PaymentInitResponse: {
            /** Format: uuid */
            sessionId: string;
            /**
             * Format: uri
             * @description SePay vietqr.app/img URL using the session amount and memo, plus any host-configured bank transfer prefix
             */
            qrImageUrl: string;
            /** @description Host-configured receiving account; preserve leading zeros */
            bankAccount: string;
            /** @example 350000 */
            amount: number;
            /** @description Immutable session reference; use transferContent when copying bank transfer instructions */
            memoCode: string;
            /**
             * @description Exact bank transfer content encoded in the QR description, including any configured bank-required prefix such as SEVQR
             * @example SEVQR NX20261105001
             */
            transferContent: string;
            /** Format: date-time */
            expiresAt: string;
            /**
             * Format: date-time
             * @description Current payment-service time sampled on this response; compare with expiresAt for the countdown
             */
            serverNow: string;
        };
        RefundRequest: {
            /** Format: uuid */
            orderId: string;
            /** @description Optional; at most the amount paid for this order. Omitted means the full paid amount. */
            amount?: number;
            reason: string;
        };
        RefundResultApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: {
                /** Format: uuid */
                refundId: string;
                status: components["schemas"]["RefundStatus"];
            };
        };
        /** @enum {string} */
        RefundStatus: "REQUESTED" | "COMPLETED";
        Refund: {
            /** Format: uuid */
            refundId: string;
            /** Format: uuid */
            orderId: string;
            /** @example 300000 */
            amount: number;
            /** @example VND */
            currency: string;
            status: components["schemas"]["RefundStatus"];
            reason: string;
            /** Format: date-time */
            requestedAt: string;
            /** Format: date-time */
            completedAt: string | null;
        };
        RefundApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Refund"];
        };
        RefundListApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Refund"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        /** @enum {string} */
        PaymentTransactionStatus: "PENDING" | "SUCCESS" | "FAILED" | "UNRECONCILED";
        PaymentView: {
            /** Format: uuid */
            transactionId: string;
            /** Format: uuid */
            orderGroupId: string;
            /** @example SEPAY */
            provider: string;
            /**
             * @description Provider transaction reference masked to its last four characters
             * @example ****8877
             */
            providerReference: string | null;
            /** @example 500000 */
            amount: number;
            /** @example VND */
            currency: string;
            /** @enum {string} */
            type: "NORMAL" | "REFUND";
            status: components["schemas"]["PaymentTransactionStatus"];
            /** Format: date-time */
            receivedAt: string;
        };
        PaymentListApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["PaymentView"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
            instance: string;
            code: string;
            traceId?: string;
        };
        SellerBankAccountRequest: {
            /** @description NAPAS bank BIN. */
            bankCode: string;
            /** @description Keep leading zeroes. Encrypted at rest; never included in responses or logs. */
            accountNumber: string;
            accountHolderName: string;
            /** @description Optional; false on create, preserve existing value on update. */
            isDefault?: boolean;
            /** @description Optional; true on create, preserve existing value on update. */
            active?: boolean;
        };
        SellerBankVerificationRequest: {
            /** @enum {string} */
            verificationStatus: "VERIFIED" | "REJECTED";
            /** @description Required and nonblank when REJECTED. */
            reason?: string;
            /**
             * Format: int64
             * @description Version from the exact bank-account snapshot the administrator reviewed. Missing or negative is 400; stale is 409.
             */
            expectedVersion: number;
        };
        /** @enum {string} */
        BankVerificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
        SellerBankAccount: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            sellerId: string;
            bankCode: string;
            accountLast4: string;
            accountHolderName: string;
            verificationStatus: components["schemas"]["BankVerificationStatus"];
            isDefault: boolean;
            active: boolean;
            rejectionReason: string | null;
            /** Format: uuid */
            verifiedBy: string | null;
            /** Format: date-time */
            verifiedAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: int64 */
            version: number;
        };
        SellerBankAccountApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["SellerBankAccount"];
        };
        SellerBankAccountListApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["SellerBankAccount"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        /** @enum {string} */
        PayoutStatus: "ON_HOLD" | "PENDING" | "PROCESSING" | "UNKNOWN" | "SUCCEEDED" | "FAILED" | "RETURNED";
        Payout: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            sellerId: string;
            /** @description Decimal monetary value, persisted as numeric(19,2). */
            orderAmount: number;
            /** @description Decimal monetary value, persisted as numeric(19,2). */
            shippingFee: number;
            /** @description Rate frozen at payout creation; configuration changes affect only later payouts. */
            platformFeeRate: number;
            /** @description Decimal monetary value, persisted as numeric(19,2). */
            platformFee: number;
            /** @description Decimal monetary value, persisted as numeric(19,2). */
            netAmount: number;
            /** @example VND */
            currency: string;
            status: components["schemas"]["PayoutStatus"];
            attemptCount: number;
            recipientAccountLast4: string | null;
            providerReference: string | null;
            /** @description true means simulated sandbox evidence, not a real bank transfer. */
            simulated: boolean;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: date-time
             * @description Last persisted payout update, including automatic dispatch, reconciliation or retry.
             */
            updatedAt: string;
        };
        PayoutHistory: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            event: "CREATED" | "HELD" | "RELEASED" | "SENT" | "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "RECONCILED" | "RETRIED" | "RETURNED";
            /** Format: int64 */
            eventSeq: number;
            /** @enum {string|null} */
            fromStatus: "ON_HOLD" | "PENDING" | "PROCESSING" | "UNKNOWN" | "SUCCEEDED" | "FAILED" | "RETURNED" | null;
            toStatus: components["schemas"]["PayoutStatus"];
            attemptNo: number;
            /** @description Decimal monetary value, persisted as numeric(19,2). */
            amount: number;
            /** Format: uuid */
            sellerBankId: string | null;
            recipientAccountLast4: string | null;
            provider: string | null;
            providerReference: string | null;
            providerStatus: string | null;
            errorCode: string | null;
            errorMessage: string | null;
            simulated: boolean;
            /** Format: uuid */
            actorId: string;
            /** Format: date-time */
            occurredAt: string;
            /** Format: uuid */
            transactionId: string | null;
        };
        PayoutDetail: components["schemas"]["Payout"] & {
            /** @description Newest first; eventSeq orders the immutable lifecycle. */
            history: components["schemas"]["PayoutHistory"][];
        };
        PayoutDetailApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["PayoutDetail"];
        };
        PayoutListApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Payout"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
        };
        PayoutProviderCallback: {
            /** Format: uuid */
            payoutId: string;
            attempt: number;
            idempotencyKey: string;
            /** @enum {string} */
            state: "ACCEPTED" | "SUCCEEDED" | "FAILED" | "UNKNOWN" | "RETURNED";
            reference?: string | null;
            providerStatus?: string | null;
        };
        PayoutCallbackAcknowledgement: {
            /** @enum {string} */
            status: "ok";
        };
    };
    responses: {
        /** @description Invalid UUID, enum, ISO-8601 timestamp or pagination (VALIDATION_FAILED, INVALID_PARAMETER). A reversed payout time range returns PAYMENT_PAYOUT_INVALID_REQUEST. Invalid bank pagination is PAYMENT_SELLER_BANK_ACCOUNT_INVALID when validated at the service boundary. */
        AdminListBadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Bad Request",
                 *       "status": 400,
                 *       "detail": "Invalid pagination or payout creation-time range",
                 *       "instance": "/api/v1/payments/payouts",
                 *       "code": "PAYMENT_PAYOUT_INVALID_REQUEST"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Authentication is missing, invalid or expired (UNAUTHENTICATED). */
        AdminListUnauthorized: {
            headers: {
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "https://nexus/errors/unauthenticated",
                 *       "title": "Unauthorized",
                 *       "status": 401,
                 *       "detail": "A valid bearer token is required",
                 *       "instance": "/api/v1/payments/payouts",
                 *       "code": "UNAUTHENTICATED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The authenticated user lacks the ADMIN realm role (FORBIDDEN). */
        AdminListForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "https://nexus/errors/forbidden",
                 *       "title": "Forbidden",
                 *       "status": 403,
                 *       "detail": "You do not have permission to access this resource",
                 *       "instance": "/api/v1/payments/payouts",
                 *       "code": "FORBIDDEN"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unexpected server error; no stack traces or sensitive details (INTERNAL_ERROR). */
        AdminListInternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:internal-server-error",
                 *       "title": "Internal Server Error",
                 *       "status": 500,
                 *       "detail": "An unexpected error occurred",
                 *       "instance": "/api/v1/payments/payouts",
                 *       "code": "INTERNAL_ERROR"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Restrict the administrator list to one seller UUID. */
        AdminSellerId: string;
        /** @description Zero-based page number; an out-of-range page returns an empty data array. */
        AdminPage: number;
        /** @description Maximum rows per page. */
        AdminSize: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    receiveSepayWebhook: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for authentication; omission is handled as 401 rather than request binding failure. HMAC-SHA256 digest of the timestamp and exact raw body, using the server-configured webhook secret. */
                "X-SePay-Signature"?: string;
                /** @description Required for authentication; omission is handled as 401. Original Unix seconds used as the signed prefix, within 300 seconds of the server clock. */
                "X-SePay-Timestamp"?: string;
            };
            path?: never;
            cookie?: never;
        };
        /** @description SePay sends JSON. The controller reads original bytes before JSON parsing; an absent body fails signature verification with 401. Unknown object properties are ignored. A matched incoming transfer requires id, transferType=in and transferAmount. An unmatched memo is acknowledged without settlement validation. A signed body that cannot be parsed into this object or an invalid matched incoming receipt returns 400. The example is copied from docs/api/sepay-webhook-sample.json, captured during the earlier provider spike; it is not a matching payment receipt or a claim that payment settlement was executed. */
        requestBody?: {
            content: {
                /**
                 * @example {
                 *       "gateway": "ACB",
                 *       "transactionDate": "2026-10-18 16:51:32",
                 *       "accountNumber": "0000000002",
                 *       "subAccount": "",
                 *       "code": "",
                 *       "content": "Giao dich thu nghiem 16h51m20s",
                 *       "transferType": "in",
                 *       "description": "Giao dich thu nghiem 16h51m20s",
                 *       "transferAmount": 10000,
                 *       "referenceCode": "SB4D116E4198F4",
                 *       "accumulated": 0,
                 *       "id": 39442
                 *     }
                 */
                "application/json": components["schemas"]["SepayWebhookRequest"];
            };
        };
        responses: {
            /** @description Verified callback accepted, including duplicate deliveries, unmatched memos, outgoing transfers and UNRECONCILED receipts. Native SePay protocol response, without code/message/data or session information. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "success": true
                     *     }
                     */
                    "application/json": components["schemas"]["SepayWebhookAcknowledgement"];
                };
            };
            /** @description Signature verified, but the JSON is malformed, null, not an object or contains a value incompatible with the DTO, or a matched incoming receipt has an invalid id, direction or amount (PAYMENT_INVALID_WEBHOOK_REQUEST). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "The webhook body must be a valid SePay JSON object",
                     *       "instance": "/api/v1/webhooks/sepay",
                     *       "code": "PAYMENT_INVALID_WEBHOOK_REQUEST"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing body/headers, malformed signature or timestamp, expired timestamp, or a signature mismatch (PAYMENT_UNAUTHENTICATED). No parsing, lookup or business change occurs. If an invalid bearer token is supplied despite this public route, shared security can reject it with UNAUTHENTICATED. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "The webhook signature is invalid",
                     *       "instance": "/api/v1/webhooks/sepay",
                     *       "code": "PAYMENT_UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listPayments: {
        parameters: {
            query?: {
                orderId?: string;
                status?: components["schemas"]["PaymentTransactionStatus"];
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Payment attempts; with orderId all attempts come in a single page */
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
                     *           "transactionId": "4f0c8a52-55d5-4c2e-9a39-0b3f8b1b2a10",
                     *           "orderGroupId": "9a7d1c3e-1f2b-4c5d-8e9f-0a1b2c3d4e5f",
                     *           "provider": "SEPAY",
                     *           "providerReference": "****8877",
                     *           "amount": 500000,
                     *           "currency": "VND",
                     *           "type": "NORMAL",
                     *           "status": "UNRECONCILED",
                     *           "receivedAt": "2026-11-14T03:20:00Z"
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 20,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PaymentListApiResponse"];
                };
            };
            /** @description Malformed orderId or status, or page/size out of range (INVALID_PARAMETER) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing/invalid bearer token (UNAUTHENTICATED) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description List without ORDER.REFUND (PAYMENT_REFUND_PRIVILEGE_REQUIRED), or the order belongs to another buyer (PAYMENT_ACCESS_DENIED) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No payment exists for this order (PAYMENT_ORDER_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    initiateGroupPayment: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** Format: uuid */
                    orderGroupId: string;
                };
            };
        };
        responses: {
            /** @description Existing immutable instructions with fresh serverNow; payment fields stay the same on repeat with stable bank configuration */
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
                     *         "sessionId": "ec2a083f-868b-4d3e-9dda-1904a9c7bbdd",
                     *         "qrImageUrl": "https://vietqr.app/img?acc=0000000002&bank=970416&amount=350000&des=NX20261105001&template=compact&showinfo=true&holder=DO%20VAN%20A",
                     *         "bankAccount": "0000000002",
                     *         "amount": 350000,
                     *         "memoCode": "NX20261105001",
                     *         "transferContent": "NX20261105001",
                     *         "expiresAt": "2026-11-05T10:15:00Z",
                     *         "serverNow": "2026-11-05T10:00:00Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PaymentInitApiResponse"];
                };
            };
            /** @description Missing/invalid orderGroupId or malformed request body */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing/invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing CHECKOUT.START or session owned by another buyer */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payment session is not available */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Session is not payable, instructions are inconsistent, or amount cannot be represented as VietQR */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listRefunds: {
        parameters: {
            query: {
                orderId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Zero or one refund for the order */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundListApiResponse"];
                };
            };
            /** @description Missing or malformed orderId (INVALID_PARAMETER) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing/invalid bearer token (UNAUTHENTICATED) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing ORDER.REFUND (FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    requestRefund: {
        parameters: {
            query?: never;
            header: {
                /** @description Client key, printable ASCII; keys starting with system are reserved. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefundRequest"];
            };
        };
        responses: {
            /** @description Refund requested, or the stored refund for a repeated key */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": {
                     *         "refundId": "01a1a602-0a8c-7c96-b2bb-1208b9900b76",
                     *         "status": "REQUESTED"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["RefundResultApiResponse"];
                };
            };
            /** @description Missing/invalid Idempotency-Key (PAYMENT_INVALID_REFUND_REQUEST), validation error, or amount above the paid amount (PAYMENT_REFUND_AMOUNT_EXCEEDED) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing/invalid bearer token (UNAUTHENTICATED) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing ORDER.REFUND (FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No payment exists for this order (PAYMENT_ORDER_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Order not cancelled or not paid (PAYMENT_ORDER_NOT_REFUNDABLE), order already refunded under another key (PAYMENT_REFUND_EXISTS), or key reused with another body (PAYMENT_REFUND_IDEMPOTENCY_CONFLICT) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    completeRefund: {
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
            /** @description Refund completed, or already completed */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundApiResponse"];
                };
            };
            /** @description Malformed refund id (INVALID_PARAMETER) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing/invalid bearer token (UNAUTHENTICATED) */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing ORDER.REFUND (FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unknown refund (PAYMENT_REFUND_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Refund changed by a concurrent request (PAYMENT_REFUND_CONFLICT) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listAdminSellerBankAccounts: {
        parameters: {
            query?: {
                /** @description Restrict the administrator list to one seller UUID. */
                sellerId?: components["parameters"]["AdminSellerId"];
                /** @description Omit to include every verification state. */
                verificationStatus?: components["schemas"]["BankVerificationStatus"];
                /** @description Zero-based page number; an out-of-range page returns an empty data array. */
                page?: components["parameters"]["AdminPage"];
                /** @description Maximum rows per page. */
                size?: components["parameters"]["AdminSize"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Masked bank-account page with unverified accounts first */
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
                     *         "size": 20,
                     *         "totalElements": 0,
                     *         "totalPages": 0
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["SellerBankAccountListApiResponse"];
                };
            };
            400: components["responses"]["AdminListBadRequest"];
            401: components["responses"]["AdminListUnauthorized"];
            403: components["responses"]["AdminListForbidden"];
            500: components["responses"]["AdminListInternalError"];
        };
    };
    createSellerBankAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerBankAccountRequest"];
            };
        };
        responses: {
            /** @description Created unverified bank account */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerBankAccountApiResponse"];
                };
            };
            /** @description Bank details or verification request are invalid (PAYMENT_SELLER_BANK_ACCOUNT_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Bank details or verification request are invalid",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listOwnSellerBankAccounts: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Own accounts, including verification state; account numbers are masked */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerBankAccountListApiResponse"];
                };
            };
            /** @description Invalid pagination parameters (PAYMENT_SELLER_BANK_ACCOUNT_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Invalid pagination parameters",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    updateSellerBankAccount: {
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
                "application/json": components["schemas"]["SellerBankAccountRequest"];
            };
        };
        responses: {
            /** @description Updated bank account */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerBankAccountApiResponse"];
                };
            };
            /** @description Bank details or verification request are invalid (PAYMENT_SELLER_BANK_ACCOUNT_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Bank details or verification request are invalid",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Bank account not found, including an account owned by another seller (PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND). */
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
                     *       "detail": "Bank account not found, including an account owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    setDefaultSellerBankAccount: {
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
            /** @description Selected default account */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerBankAccountApiResponse"];
                };
            };
            /** @description Bank details or verification request are invalid (PAYMENT_SELLER_BANK_ACCOUNT_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Bank details or verification request are invalid",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Bank account not found, including an account owned by another seller (PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND). */
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
                     *       "detail": "Bank account not found, including an account owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    verifySellerBankAccount: {
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
                "application/json": components["schemas"]["SellerBankVerificationRequest"];
            };
        };
        responses: {
            /** @description Recorded administrator verification result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerBankAccountApiResponse"];
                };
            };
            /** @description Bank details or verification request are invalid (PAYMENT_SELLER_BANK_ACCOUNT_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Bank details or verification request are invalid",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Bank account not found, including an account owned by another seller (PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND). */
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
                     *       "detail": "Bank account not found, including an account owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The bank account changed after the administrator reviewed it (PAYMENT_SELLER_BANK_ACCOUNT_CONFLICT). Reload and review the current account before retrying. */
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
                     *       "detail": "Bank account changed since review; reload it before submitting a decision",
                     *       "instance": "/api/v1/payments/seller-bank-accounts/00000000-0000-4000-8000-000000000001/verify",
                     *       "code": "PAYMENT_SELLER_BANK_ACCOUNT_CONFLICT"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listAdminPayouts: {
        parameters: {
            query?: {
                /** @description Restrict the administrator list to one seller UUID. */
                sellerId?: components["parameters"]["AdminSellerId"];
                /**
                 * @description Any of the selected states; repeated query values are supported. Omit to include all seven statuses. Duplicate values do not duplicate rows.
                 * @example [
                 *       "ON_HOLD",
                 *       "UNKNOWN",
                 *       "FAILED",
                 *       "RETURNED"
                 *     ]
                 */
                status?: components["schemas"]["PayoutStatus"][];
                /** @description Inclusive lower bound on payout createdAt; ISO-8601 with a time zone. */
                from?: string;
                /** @description Inclusive upper bound on payout createdAt; must not precede from. */
                to?: string;
                /** @description Zero-based page number; an out-of-range page returns an empty data array. */
                page?: components["parameters"]["AdminPage"];
                /** @description Maximum rows per page. */
                size?: components["parameters"]["AdminSize"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Existing payout page, newest first */
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
                     *           "id": "00000000-0000-4000-8000-000000000257",
                     *           "orderId": "00000000-0000-4000-8000-000000000001",
                     *           "sellerId": "00000000-0000-4000-8000-000000000004",
                     *           "orderAmount": 325000,
                     *           "shippingFee": 25000,
                     *           "platformFeeRate": 0,
                     *           "platformFee": 0,
                     *           "netAmount": 300000,
                     *           "currency": "VND",
                     *           "status": "ON_HOLD",
                     *           "attemptCount": 0,
                     *           "recipientAccountLast4": null,
                     *           "providerReference": null,
                     *           "simulated": true,
                     *           "createdAt": "2026-11-16T05:00:00Z",
                     *           "updatedAt": "2026-11-16T05:00:00Z"
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 20,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PayoutListApiResponse"];
                };
            };
            400: components["responses"]["AdminListBadRequest"];
            401: components["responses"]["AdminListUnauthorized"];
            403: components["responses"]["AdminListForbidden"];
            500: components["responses"]["AdminListInternalError"];
        };
    };
    listOwnPayouts: {
        parameters: {
            query?: {
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Own payouts newest first */
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
                     *           "id": "00000000-0000-4000-8000-000000000257",
                     *           "orderId": "00000000-0000-4000-8000-000000000001",
                     *           "sellerId": "00000000-0000-4000-8000-000000000004",
                     *           "orderAmount": 325000,
                     *           "shippingFee": 25000,
                     *           "platformFeeRate": 0,
                     *           "platformFee": 0,
                     *           "netAmount": 300000,
                     *           "currency": "VND",
                     *           "status": "ON_HOLD",
                     *           "attemptCount": 0,
                     *           "recipientAccountLast4": null,
                     *           "providerReference": null,
                     *           "simulated": true,
                     *           "createdAt": "2026-11-16T05:00:00Z",
                     *           "updatedAt": "2026-11-16T05:00:00Z"
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 20,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["PayoutListApiResponse"];
                };
            };
            /** @description Invalid pagination parameters (PAYMENT_PAYOUT_INVALID_REQUEST). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Invalid pagination parameters",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_INVALID_REQUEST"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getPayout: {
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
            /** @description Payout including immutable history */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDetailApiResponse"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payout not found, including a payout owned by another seller (PAYMENT_PAYOUT_NOT_FOUND). */
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
                     *       "detail": "Payout not found, including a payout owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    retryPayout: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Payout after the retry request */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PayoutDetailApiResponse"];
                };
            };
            /** @description Missing or invalid Idempotency-Key (PAYMENT_PAYOUT_IDEMPOTENCY_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Missing or invalid Idempotency-Key",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_IDEMPOTENCY_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication is required (UNAUTHENTICATED). */
            401: {
                headers: {
                    /** @description Bearer challenge for JWT authentication failures. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "Authentication is required",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The authenticated user is not allowed to perform this action (FORBIDDEN). */
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
                     *       "detail": "The authenticated user is not allowed to perform this action",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payout not found, including a payout owned by another seller (PAYMENT_PAYOUT_NOT_FOUND). */
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
                     *       "detail": "Payout not found, including a payout owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payout state is not retryable or a verified active default bank account is missing (PAYMENT_PAYOUT_NOT_RETRYABLE). */
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
                     *       "detail": "Payout state is not retryable or a verified active default bank account is missing",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_NOT_RETRYABLE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    receivePayoutCallback: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required for provider authentication; absent or stale headers return 401. */
                "X-Payout-Timestamp"?: string;
                /** @description Hex HMAC-SHA256 digest of timestamp + dot + raw body. */
                "X-Payout-Signature"?: string;
            };
            path: {
                provider: "sandbox" | "http";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PayoutProviderCallback"];
            };
        };
        responses: {
            /** @description Native provider acknowledgement, including duplicate callbacks */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "status": "ok"
                     *     }
                     */
                    "application/json": components["schemas"]["PayoutCallbackAcknowledgement"];
                };
            };
            /** @description Invalid signed callback body (PAYMENT_PAYOUT_CALLBACK_INVALID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "Invalid signed callback body",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_CALLBACK_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The provider callback signature is invalid (PAYMENT_PAYOUT_CALLBACK_SIGNATURE_INVALID). */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "The provider callback signature is invalid",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_CALLBACK_SIGNATURE_INVALID"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Payout not found, including a payout owned by another seller (PAYMENT_PAYOUT_NOT_FOUND). */
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
                     *       "detail": "Payout not found, including a payout owned by another seller",
                     *       "instance": "/api/v1/payments/payouts",
                     *       "code": "PAYMENT_PAYOUT_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Provider reference conflicts with the stored transfer (PAYMENT_PAYOUT_PROVIDER_CONFLICT). */
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
                     *       "detail": "Provider reference conflicts with the stored transfer",
                     *       "instance": "/api/v1/payments/payouts/callbacks/http",
                     *       "code": "PAYMENT_PAYOUT_PROVIDER_CONFLICT"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
}
