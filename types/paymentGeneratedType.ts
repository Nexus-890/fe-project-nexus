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
        get?: never;
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
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
            instance: string;
            code: string;
            traceId?: string;
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
}
