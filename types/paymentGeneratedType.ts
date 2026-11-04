/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
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
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
            code?: string;
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
}
