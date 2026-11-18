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
         * @description ADMIN only; SELLER and SUPPORT_STAFF receive 403. Optional filters are combined with AND before counting and pagination. Active UNVERIFIED accounts come first, oldest createdAt first, then id ascending for ties; remaining accounts follow in the same chronological order. Only accountLast4 is returned, never the full number or ciphertext. This read does not verify accounts, release held payouts or create transfers. Own seller reads remain at /me. Verification uses the displayed version as expectedVersion.
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
    "/api/v1/payments/manual-payouts/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read executor capabilities and rollout state
         * @description Reports server time, authorized platform source-account aliases, immutable-mode rollout settings and role-scoped actions. Does not enable manual processing.
         */
        get: operations["getManualPayoutCapabilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the manual execution and review queue
         * @description Returns a lightweight MANUAL queue projection, with filters applied before count/paging. Repeated status values use OR; other filters use AND. Inclusive createdAt bounds, createdAt DESC and id DESC. Each row includes masked payout/recipient data, current attempt/receipt state, versions, readiness and allowedActions. Cases contain current-attempt summaries only, with explanation empty; history and evidence are empty arrays and must be loaded from the detail endpoint when authorized. Open cases on SUCCEEDED rows remain in needsReview; hasOpenDispute means unresolved OPEN/UNDER_REVIEW/WAITING_SELLER seller disputes. REVIEW_DISPUTE is offered only for an open SELLER_DISPUTE on the current attempt, not for a STAFF_EXCEPTION alone. Reads never claim, release, issue QR or settle money.
         */
        get: operations["listManualPayouts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read masked manual payout detail
         * @description Returns independent payout, attempt, receipt and dispute state plus current versions and allowedActions. Unlike the lightweight queue, detail includes history and the evidence metadata visible to this actor. A role does not bypass live QR/proof ownership. REVIEW_DISPUTE requires an open SELLER_DISPUTE on the current attempt; a staff exception alone does not grant that action.
         */
        get: operations["getManualPayout"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/readiness-check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Explicitly recheck an on-hold or pending manual payout
         * @description Rechecks full funding/refund/bank/amount readiness for ON_HOLD/PENDING. Releases an eligible ON_HOLD payout to PENDING, or safely holds a PENDING payout whose readiness was lost. Creates no attempt, QR or payment; works without the automatic reconciliation sweep. GET may report a newly blocked reason and suppress CLAIM but never performs this write. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["checkManualPayoutReadiness"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/claims": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Exclusively claim one manual payout
         * @description ADMIN/SUPPORT_STAFF can claim another seller payout once while manual intake is enabled. Default unissued lease is five minutes. Concurrent competing claims conflict; the owner and frozen bank/amount snapshot are durable. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["claimManualPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/qr-issuances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Commit one frozen QR issuance
         * @description Owning executor only. Rechecks current full reviewed bank and funding/refund state, commits one immutable reference/snapshot and exposes server deadline (default ten minutes). An issued QR may remain payable after the platform deadline; expiry never authorizes a second transfer. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["issueManualPayoutQr"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/qr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the issued private receiving-bank QR
         * @description Owning ADMIN/SUPPORT_STAFF executor only; even another Admin cannot use this endpoint to bypass ownership. PNG generated locally from the previously committed VietQR NAPAS account-transfer instruction. Browser clients fetch with Authorization Bearer, check the status, read blob(), and display an object URL that is revoked on replacement or screen cleanup; a direct API img src cannot attach the required Bearer header. No account, payload or token in public URLs or external QR services; reads never issue or refresh transfer instructions.
         */
        get: operations["getManualPayoutQr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Release an unissued claim safely
         * @description Owner may release CLAIMED before QR issuance. Explicit ADMIN intervention requires a reason. Requeues/holds according to current readiness with NOT_SENT audit; issued/uncertain attempts cannot be released for another transfer. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["releaseManualPayoutClaim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Upload private transfer evidence
         * @description Bound to payout/attempt/uploader; private JPEG/PNG/PDF only. Browser clients send FormData with file and expectedAttemptVersion, Authorization Bearer and UUID Idempotency-Key; the browser supplies the multipart boundary. FE needs no Supabase key or bucket URL. Backend validates signature, MIME, 10 MiB per file and three files per attempt, uploads to private storage and returns authoritative payout detail without a storage URL. Upload alone never settles money; orphan files are cleaned on DB failure. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["uploadManualPayoutEvidence"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/evidence/{evidenceId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Download private evidence through Payment
         * @description Owning executor or authorized ADMIN reconciliation access only. Staff queue access grants no right to another executor proof. Payment validates matching resource IDs and streams bytes from private storage; no public/signed Supabase URL or server key is exposed. Browser clients fetch with Authorization Bearer, check the status, read blob() and use URL.createObjectURL; revoke the object URL when replaced or the view closes/unmounts. Direct API img src does not attach the required Bearer header.
         */
        get: operations["downloadManualPayoutEvidence"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/confirmation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Record an external transfer attestation
         * @description Owning executor with valid QR_ISSUED attempt only. Requires exact frozen amount, configured source account, bank reference/time and bound proof. Atomically records one PAYOUT, history and outbox event, SUCCEEDED and AWAITING_CONFIRMATION. Confirmation source is MANUAL_STAFF_CONFIRMED, never BANK_VERIFIED. Bank-reference uniqueness is scoped by source account, bank business date and bank reference. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["confirmManualPayoutTransfer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/problems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report uncertainty or an external payment problem
         * @description Owning executor supplies reason/evidence. An uncertain issued attempt becomes UNKNOWN with no ordinary retry. One successful new report creates one STAFF_EXCEPTION and one MANUAL_PROBLEM audit linked to that case, including the original financial status; an exact replay adds neither. A suspected wrong/duplicate external payment after SUCCEEDED opens an audited exception without erasing success or authorizing another payment. If the staff report was mistaken, ADMIN may close that specific STAFF_EXCEPTION with CONFIRMED_SENT while retaining the successful payout and its accounting. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["reportManualPayoutProblem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/resolution": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Resolve a manual exception or dismiss a mistaken staff report
         * @description ADMIN only, including when the reporting executor is SUPPORT_STAFF; self-seller reconciliation denied. CONFIRMED_SENT has two guarded effects: for UNKNOWN it settles once with the required transfer facts; when both payout and attempt are already SUCCEEDED and the selected open case is STAFF_EXCEPTION, it only resolves that specific mistaken staff report and appends audit. The latter preserves payout/attempt success, original PAYOUT, receipt state and any other case, including seller disputes; it creates no movement or success outbox event and needs no new transfer facts. A SUCCEEDED seller dispute alone cannot use this nonfinancial closure. CONFIRMED_NOT_SENT leaves FAILED pending explicit retry, and CONFIRMED_RETURNED adds a genuine PAYOUT_RETURN. CONFIRMATION_RECORDED_IN_ERROR requires an open reviewed case and non-execution proof, links one PAYOUT_CORRECTION and corrective event, preserves the original history and leaves the same payout FAILED. Seller acknowledgement/correction/retry serialize; a closed case needs a new explicit review. Every resolution still requires reason, bound evidence, UUID Idempotency-Key and the relevant expected versions. Exact replay returns 200 with the original result and creates no duplicate audit or financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["resolveManualPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/attempts/{attemptId}/receipt-disputes/{disputeId}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Review a seller dispute without certifying receipt
         * @description ADMIN-only REQUEST_INFORMATION or TRANSFER_EVIDENCE_PROVIDED with audit. Evidence may move a case to WAITING_SELLER but never confirms seller receipt or creates/requeues a payment. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["reviewManualPayoutReceiptDispute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/manual-payouts/{payoutId}/retries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Explicitly requeue a reconciled manual payout
         * @description ADMIN only after reconciled FAILED/RETURNED; UNKNOWN/PROCESSING/SUCCEEDED never ordinary-retry. Rechecks funding/refund/bank/amount and keeps the same payout/order, requeuing it as PENDING or ON_HOLD. The subsequent exclusive claim assigns the actual executor and creates the next attempt with a new reference/QR and NOT_REQUESTED receipt state. The retry command itself does not issue a transfer instruction. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["retryManualPayout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/{payoutId}/manual-attempts/{attemptId}/receipt-confirmations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Acknowledge actual receipt as the owning seller
         * @description SELLER identity and payout ownership required, including mixed-role owners using this seller operation. Server records acknowledgement time; no caller sellerId, bank verification, order change or financial posting. Applies only to the current settled MANUAL attempt; superseded/corrected attempts conflict. May close a live non-receipt case before a correction supersedes it. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["confirmSellerPayoutReceipt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/payments/payouts/{payoutId}/manual-attempts/{attemptId}/receipt-disputes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report non-receipt or a receipt mistake
         * @description Owning SELLER only. Accepts NOT_RECEIVED, INCORRECT_AMOUNT or CONFIRMATION_MISTAKE plus trimmed 1–1000 explanation. Creates/reuses one active case per attempt and preserves audit. Does not send money, reset SUCCEEDED, refund a buyer or requeue/issue another QR. Seller projection omits staff-private proof and notes. Requires a UUID Idempotency-Key and the relevant expected version. Exact replay returns 200 with the original result and creates no duplicate financial movement; changed context conflicts. GET never performs this operation.
         */
        post: operations["disputeSellerPayoutReceipt"];
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
            /** @enum {string} */
            executionMode: "AUTO" | "MANUAL";
            /** @description MANUAL_STAFF_CONFIRMED records staff attestation, not bank credit. */
            confirmationSource: string | null;
            /** @description Sanitized current manual attempt receipt/dispute actions; null for AUTO payouts. */
            manual?: {
                /** Format: uuid */
                attemptId: string;
                attemptState: components["schemas"]["ManualPayoutAttemptState"];
                receiptStatus: components["schemas"]["PayoutReceiptStatus"];
                /** Format: int64 */
                receiptVersion: number;
                hasOpenDispute: boolean;
                allowedActions: ("CONFIRM_RECEIPT" | "OPEN_DISPUTE")[];
                /** @description Sanitized current seller dispute summary; active case preferred, otherwise latest resolved case. Contains no staff exception notes or private proof. */
                dispute?: {
                    /** Format: uuid */
                    id: string;
                    status: components["schemas"]["PayoutReviewStatus"];
                    reason: string;
                } | null;
            } | null;
        };
        PayoutHistory: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            event: "CREATED" | "HELD" | "RELEASED" | "SENT" | "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "RECONCILED" | "RETRIED" | "RETURNED" | "MANUAL_CLAIMED" | "QR_ISSUED" | "CLAIM_RELEASED" | "MANUAL_CONFIRMED" | "MANUAL_PROBLEM" | "MANUAL_RESOLVED" | "RECEIPT_CONFIRMED" | "RECEIPT_DISPUTED" | "DISPUTE_REVIEWED" | "CONFIRMATION_CORRECTED" | "READINESS_CHECKED" | "EVIDENCE_UPLOADED";
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
        /**
         * @description Authoritative current-actor/current-attempt actions. REVIEW_DISPUTE requires an unresolved SELLER_DISPUTE on the current attempt; STAFF_EXCEPTION alone can allow ADMIN RESOLVE but never REVIEW_DISPUTE.
         * @enum {string}
         */
        ManualPayoutAction: "CLAIM" | "ISSUE_QR" | "READ_QR" | "RELEASE" | "UPLOAD_EVIDENCE" | "CONFIRM_TRANSFER" | "REPORT_PROBLEM" | "RESOLVE" | "RETRY" | "REVIEW_DISPUTE" | "READINESS_CHECK" | "CONFIRM_RECEIPT" | "OPEN_DISPUTE";
        /** @enum {string} */
        ManualPayoutAttemptState: "CLAIMED" | "QR_ISSUED" | "SUCCEEDED" | "NOT_SENT" | "UNKNOWN" | "RETURNED" | "CONFIRMATION_CORRECTED";
        /** @enum {string} */
        PayoutReceiptStatus: "NOT_REQUESTED" | "AWAITING_CONFIRMATION" | "CONFIRMED" | "DISPUTED";
        /** @enum {string} */
        PayoutReviewStatus: "OPEN" | "UNDER_REVIEW" | "WAITING_SELLER" | "RESOLVED";
        ManualPayoutAttemptView: {
            /** Format: uuid */
            id: string;
            attemptNo: number;
            state: components["schemas"]["ManualPayoutAttemptState"];
            /** Format: int64 */
            version: number;
            /** Format: uuid */
            claimedBy: string;
            /** Format: date-time */
            claimExpiresAt: string;
            /** Format: date-time */
            qrExpiresAt: string | null;
            reference: string | null;
            receiptStatus: components["schemas"]["PayoutReceiptStatus"];
            /** Format: int64 */
            receiptVersion: number;
            /** Format: date-time */
            sellerConfirmedAt: string | null;
        } | null;
        /** @description Sanitized private-file metadata. No public URL, signed URL, storage object key, bank account or secret is returned. */
        ManualPayoutEvidenceView: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            contentType: "image/jpeg" | "image/png" | "application/pdf";
            /** Format: int64 */
            size: number;
            /** Format: date-time */
            createdAt: string;
        };
        ManualPayoutCaseView: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "SELLER_DISPUTE" | "STAFF_EXCEPTION";
            status: components["schemas"]["PayoutReviewStatus"];
            reason: string;
            /** @description Empty in queue summaries; detail applies actor-specific access to the private explanation. */
            explanation: string | null;
            /** Format: int64 */
            version: number;
            /** Format: date-time */
            createdAt: string;
        };
        ManualPayoutHistoryView: {
            /** Format: uuid */
            id: string;
            event: string;
            /** Format: uuid */
            attemptId: string | null;
            /** Format: uuid */
            caseId: string | null;
            /** Format: uuid */
            actorId: string;
            actorRole: string | null;
            reason: string | null;
            /** Format: date-time */
            occurredAt: string;
        };
        /** @description Authoritative MANUAL state. Payout, attempt and seller receipt/dispute states are independent. A staff attestation does not certify bank credit. All ordinary bank data stays masked. */
        ManualPayoutView: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            sellerId: string;
            status: components["schemas"]["PayoutStatus"];
            /** @enum {string} */
            executionMode: "MANUAL";
            /** @enum {string|null} */
            confirmationSource: "MANUAL_STAFF_CONFIRMED" | null;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            orderAmount: string;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            shippingFee: string;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            platformFee: string;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            netAmount: string;
            /** @description Only VND is executable. Any unsupported currency remains blocked without changing the original liability. */
            currency: string;
            /** Format: int64 */
            version: number;
            blockedReason: string | null;
            allowedActions: components["schemas"]["ManualPayoutAction"][];
            /** Format: date-time */
            serverTime: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            currentAttempt: components["schemas"]["ManualPayoutAttemptView"];
            /** @description Empty in queue rows. Detail returns only the private-file metadata the actor may access. */
            evidence: components["schemas"]["ManualPayoutEvidenceView"][];
            /** @description Queue rows contain current-attempt summaries with empty explanations; detail returns the permitted case history and notes. */
            cases: components["schemas"]["ManualPayoutCaseView"][];
            /** @description Empty in queue rows; immutable history is loaded by the detail endpoint and filtered for the current actor. */
            history: components["schemas"]["ManualPayoutHistoryView"][];
            /** @description Masked recipient: current attempt frozen destination when an attempt exists; otherwise the currently reviewed bank, or null. Bank changes do not silently replace an issued destination. No full account number or ciphertext. */
            recipient?: {
                bankCode: string;
                accountLast4: string;
                holderName: string;
            } | null;
        };
        ManualPayoutCapabilities: {
            enabled: boolean;
            /** @enum {string} */
            executionMode: "AUTO" | "MANUAL";
            automaticJobsEnabled: boolean;
            /** Format: date-time */
            serverTime: string;
            sourceAccounts: {
                id: string;
                alias: string;
            }[];
            allowedActions: ("EXECUTE" | "RECONCILE")[];
        };
        ManualReceiptView: {
            /** Format: uuid */
            attemptId: string;
            attemptState: components["schemas"]["ManualPayoutAttemptState"];
            receiptStatus: components["schemas"]["PayoutReceiptStatus"];
            /** Format: int64 */
            receiptVersion: number;
            hasOpenDispute: boolean;
            allowedActions: ("CONFIRM_RECEIPT" | "OPEN_DISPUTE")[];
            /** @description Sanitized current seller dispute summary; active case preferred, otherwise latest resolved case. Contains no staff exception notes or private proof. */
            dispute?: {
                /** Format: uuid */
                id: string;
                status: components["schemas"]["PayoutReviewStatus"];
                reason: string;
            } | null;
        };
        ManualPayoutClaimRequest: {
            /** Format: int64 */
            expectedPayoutVersion: number;
        };
        ManualPayoutVersionRequest: {
            /** Format: int64 */
            expectedAttemptVersion: number;
            reason?: string | null;
        };
        ManualPayoutReadinessRequest: {
            /** Format: int64 */
            expectedPayoutVersion: number;
            reason?: string | null;
        };
        ManualPayoutConfirmationRequest: {
            /** Format: int64 */
            expectedAttemptVersion: number;
            sourceAccountId: string;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            amount: string;
            bankTransferReference: string;
            /** Format: date-time */
            transferredAt: string;
            evidenceIds: string[];
        };
        ManualPayoutProblemRequest: {
            /** Format: int64 */
            expectedAttemptVersion: number;
            reason: string;
            evidenceIds?: string[];
        };
        ManualPayoutResolutionRequest: {
            /** Format: int64 */
            expectedPayoutVersion: number;
            /** Format: int64 */
            expectedAttemptVersion: number;
            /** Format: int64 */
            expectedCaseVersion: number;
            /** Format: uuid */
            caseId: string;
            /**
             * @description CONFIRMED_SENT settles UNKNOWN with transfer facts, or only closes the selected open STAFF_EXCEPTION when payout and attempt are already SUCCEEDED. That nonfinancial closure does not close seller disputes or change accounting/receipt state.
             * @enum {string}
             */
            outcome: "CONFIRMED_SENT" | "CONFIRMED_NOT_SENT" | "CONFIRMED_RETURNED" | "CONFIRMATION_RECORDED_IN_ERROR";
            reason: string;
            evidenceIds: string[];
            /** @description Required for CONFIRMED_SENT settlement of UNKNOWN; omitted when merely closing a STAFF_EXCEPTION on an already successful attempt. */
            sourceAccountId?: string | null;
            /**
             * @description Exact fixed-two-decimal string. Execution requires a positive whole-VND amount within the configured supported limit; never rounded.
             * @example 95000.00
             */
            amount?: string | null;
            /** @description Required for CONFIRMED_SENT settlement of UNKNOWN; do not replace the original reference for nonfinancial closure on SUCCEEDED. */
            bankTransferReference?: string | null;
            /** Format: date-time */
            transferredAt?: string | null;
        };
        ManualPayoutReviewRequest: {
            /** Format: int64 */
            expectedAttemptVersion: number;
            /** Format: int64 */
            expectedCaseVersion: number;
            /** @enum {string} */
            action: "REQUEST_INFORMATION" | "TRANSFER_EVIDENCE_PROVIDED";
            reason: string;
            evidenceIds?: string[];
        };
        SellerPayoutReceiptRequest: {
            /** Format: int64 */
            expectedReceiptVersion: number;
        };
        /** @description Explanation is trimmed and must contain 1–1000 characters. Seller identity is exclusively derived from JWT ownership. */
        SellerPayoutDisputeRequest: {
            /** Format: int64 */
            expectedReceiptVersion: number;
            /** @enum {string} */
            reason: "NOT_RECEIVED" | "INCORRECT_AMOUNT" | "CONFIRMATION_MISTAKE";
            explanation: string;
        };
        ManualPayoutApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ManualPayoutView"];
        };
        ManualPayoutCapabilitiesApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ManualPayoutCapabilities"];
        };
        ManualReceiptApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ManualReceiptView"];
        };
        /** @description Lightweight queue page: bounded summary reads, no full history or evidence fetch per row. Rows retain the ManualPayoutView wire shape with history/evidence empty and current-attempt case explanations empty. */
        ManualPayoutPageApiResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ManualPayoutView"][];
            page: {
                number: number;
                size: number;
                /** Format: int64 */
                totalElements: number;
                totalPages: number;
            };
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
        /** @description Malformed parameter, JSON body, bean-validation input, missing/negative version or invalid command maps to PAYMENT_MANUAL_PAYOUT_INVALID_REQUEST at the manual controller boundary. Invalid uploaded evidence content uses PAYMENT_MANUAL_PAYOUT_EVIDENCE_INVALID. */
        ManualInvalidRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Bad Request",
                 *       "status": 400,
                 *       "detail": "Manual payout request is invalid",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_INVALID_REQUEST"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Missing, invalid or expired bearer JWT; no protected operation executes. */
        ManualUnauthorized: {
            headers: {
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Unauthorized",
                 *       "status": 401,
                 *       "detail": "Missing, invalid or expired bearer JWT; no protected operation executes.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "UNAUTHENTICATED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Missing required role, executor authority or forbidden self-seller execution/reconciliation; a privilege alone does not supply a missing role. */
        ManualForbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Forbidden",
                 *       "status": 403,
                 *       "detail": "Missing required role, executor authority or forbidden self-seller execution/reconciliation; a privilege alone does not supply a missing role.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_FORBIDDEN"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Payout, attempt, case or evidence does not exist or IDs/owning seller do not match. */
        ManualNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Not Found",
                 *       "status": 404,
                 *       "detail": "Payout, attempt, case or evidence does not exist or IDs/owning seller do not match.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_NOT_FOUND"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Ownership, expected version, immutable state or bank reference conflicts. Unsupported encoder data is PAYMENT_MANUAL_PAYOUT_INVALID_QR_DATA. Changed idempotency actor/operation/resource/payload returns PAYMENT_MANUAL_PAYOUT_IDEMPOTENCY_CONFLICT. Reload authorized state/allowedActions before a new command. */
        ManualConflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Conflict",
                 *       "status": 409,
                 *       "detail": "Ownership, expected version, immutable state or bank reference conflicts. Unsupported encoder data is PAYMENT_MANUAL_PAYOUT_INVALID_QR_DATA. Changed idempotency actor/operation/resource/payload returns PAYMENT_MANUAL_PAYOUT_IDEMPOTENCY_CONFLICT. Reload authorized state/allowedActions before a new command.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_CONFLICT"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Evidence exceeds 10 MiB; multipart ingress limits can also reject oversized requests. */
        ManualEvidenceTooLarge: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Content Too Large",
                 *       "status": 413,
                 *       "detail": "Evidence exceeds 10 MiB; multipart ingress limits can also reject oversized requests.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_EVIDENCE_TOO_LARGE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Evidence is not a signature-validated JPEG, PNG or PDF. */
        ManualEvidenceUnsupported: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Unsupported Media Type",
                 *       "status": 415,
                 *       "detail": "Evidence is not a signature-validated JPEG, PNG or PDF.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_EVIDENCE_UNSUPPORTED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Manual dependency is unavailable. QR/rendering and private evidence storage use PAYMENT_MANUAL_PAYOUT_QR_UNAVAILABLE and PAYMENT_MANUAL_PAYOUT_EVIDENCE_UNAVAILABLE respectively. No provider transfer or partial accounting is committed. */
        ManualUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Service Unavailable",
                 *       "status": 503,
                 *       "detail": "Manual dependency is unavailable. QR/rendering and private evidence storage use PAYMENT_MANUAL_PAYOUT_QR_UNAVAILABLE and PAYMENT_MANUAL_PAYOUT_EVIDENCE_UNAVAILABLE respectively. No provider transfer or partial accounting is committed.",
                 *       "instance": "/api/v1/payments/manual-payouts",
                 *       "code": "PAYMENT_MANUAL_PAYOUT_UNAVAILABLE"
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
        ManualPayoutId: string;
        ManualAttemptId: string;
        ManualEvidenceId: string;
        ManualDisputeId: string;
        /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
        ManualIdempotencyKey: string;
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
            /** @description Masked bank-account page with active unverified accounts first, then creation time and ID ascending */
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
                     *           "executionMode": "AUTO",
                     *           "confirmationSource": null,
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
                     *           "executionMode": "AUTO",
                     *           "confirmationSource": null,
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
    getManualPayoutCapabilities: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutCapabilitiesApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    listManualPayouts: {
        parameters: {
            query?: {
                sellerId?: string;
                status?: components["schemas"]["PayoutStatus"][];
                /** @description Executor UUID or literal me. */
                claimedBy?: string;
                receiptStatus?: components["schemas"]["PayoutReceiptStatus"];
                hasOpenDispute?: boolean;
                needsReview?: boolean;
                from?: string;
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
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutPageApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    getManualPayout: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    checkManualPayoutReadiness: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutReadinessRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    claimManualPayout: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutClaimRequest"];
            };
        };
        responses: {
            /** @description Exact replay of the original successful command */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            /** @description Resource or issuance created for the first time */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    issueManualPayoutQr: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutVersionRequest"];
            };
        };
        responses: {
            /** @description Exact replay of the original successful command */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            /** @description Resource or issuance created for the first time */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    getManualPayoutQr: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authenticated read-only PNG of the frozen instruction */
            200: {
                headers: {
                    "Cache-Control"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/png": string;
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    releaseManualPayoutClaim: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutVersionRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    uploadManualPayoutEvidence: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": {
                    /** Format: int64 */
                    expectedAttemptVersion: number;
                    /**
                     * Format: binary
                     * @description Signature-validated JPEG/PNG/PDF, max 10485760 bytes; at most three files per attempt.
                     */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Exact replay of the original successful command */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            /** @description Resource or issuance created for the first time */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            413: components["responses"]["ManualEvidenceTooLarge"];
            415: components["responses"]["ManualEvidenceUnsupported"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    downloadManualPayoutEvidence: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
                evidenceId: components["parameters"]["ManualEvidenceId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Private evidence bytes streamed by Payment after authorization */
            200: {
                headers: {
                    "Cache-Control"?: string;
                    "Content-Disposition"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "image/jpeg": string;
                    "image/png": string;
                    "application/pdf": string;
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    confirmManualPayoutTransfer: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutConfirmationRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    reportManualPayoutProblem: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutProblemRequest"];
            };
        };
        responses: {
            /** @description Exact replay of the original problem report */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            /** @description One staff exception and its problem audit created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    resolveManualPayout: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutResolutionRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    reviewManualPayoutReceiptDispute: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
                disputeId: components["parameters"]["ManualDisputeId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutReviewRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    retryManualPayout: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualPayoutReadinessRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualPayoutApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    confirmSellerPayoutReceipt: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerPayoutReceiptRequest"];
            };
        };
        responses: {
            /** @description Authoritative result */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualReceiptApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
    disputeSellerPayoutReceipt: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID bound to authenticated actor, operation, resource and canonical payload. Exact replay returns the originally committed result with 200 before rejecting its old version; a changed context returns 409. */
                "Idempotency-Key": components["parameters"]["ManualIdempotencyKey"];
            };
            path: {
                payoutId: components["parameters"]["ManualPayoutId"];
                attemptId: components["parameters"]["ManualAttemptId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SellerPayoutDisputeRequest"];
            };
        };
        responses: {
            /** @description Exact replay of the original successful command */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualReceiptApiResponse"];
                };
            };
            /** @description Resource or issuance created for the first time */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManualReceiptApiResponse"];
                };
            };
            400: components["responses"]["ManualInvalidRequest"];
            401: components["responses"]["ManualUnauthorized"];
            403: components["responses"]["ManualForbidden"];
            404: components["responses"]["ManualNotFound"];
            409: components["responses"]["ManualConflict"];
            503: components["responses"]["ManualUnavailable"];
        };
    };
}
