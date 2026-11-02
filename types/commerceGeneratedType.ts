/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/carts/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get or create the current active cart
         * @description Returns200 even when first access creates the cart. One active cart per user is protected by a database unique index. Gateway primary privilege is CART.VIEW; downstream additionally checks CART.CREATE. Access: requires CART.VIEW AND CART.CREATE. Ownership/business restriction: JWT subject only; guest carts are not supported.
         */
        get: operations["getOwnCart"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a SKU to the current cart
         * @description Fetches current SKU from catalog, then atomically inserts or increases existing quantity and refreshes unitPrice. Both a new line and an increased line return201. A missing/invisible or invisible catalog SKU returns404. A malformed catalog envelope/data is502 COMMERCE_INVALID_CATALOG_RESPONSE. Other Feign failures return503 COMMERCE_CATALOG_UNAVAILABLE. No inventory/stock check is introduced. Access: requires CART.UPDATE. Ownership/business restriction: JWT subject active cart only; caller cannot choose userId/cartId.
         */
        post: operations["addCartItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List own orders
         * @description Requires ORDER.LIST. Returns only orders whose buyer is the JWT subject, including for ADMIN, newest first by createdAt then orderNumber. status optionally filters by order status. page is zero-based; size defaults to 10 and must be 1 to 100. A page beyond the end returns 200 with an empty array and the actual totals.
         */
        get: operations["listOwnOrders"];
        put?: never;
        /**
         * Place an order from the current cart
         * @description Requires CHECKOUT.START AND ORDER.CREATE. Splits the active cart by seller, snapshots current catalog prices and reserves inventory. A matching replay of the same Idempotency-Key, buyer and shipping/payment payload returns the original group with 200; a new order returns 201. Unsupported promotion, unavailable item, changed payload/key ownership and unrepresentable money fail before checkout completes. Payment method is SEPAY; the current reservation implementation may reject unavailable inventory. Gateway checks ORDER.CREATE; downstream additionally checks CHECKOUT.START.
         */
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read one order
         * @description Requires ORDER.VIEW and ownership by the JWT subject; ADMIN may read another buyer's order. Returns the order with its items, the unit and line prices stored when the order was placed, the total and the current status.
         */
        get: operations["getOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{id}/status": {
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
         * Change an order status
         * @description ADMIN role required at the service. Allowed transitions: PENDING -> PAID/CANCELED; PAID -> CANCELED/SHIPPED; SHIPPED -> DELIVERED; DELIVERED -> COMPLETED; CANCELED -> REFUND_REQUESTED; REFUND_REQUESTED -> REFUNDED. Concurrent or illegal moves return 409. Every successful change appends status history.
         */
        patch: operations["changeOrderStatus"];
        trace?: never;
    };
    "/api/v1/orders/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read order status history
         * @description Requires ORDER.VIEW and ownership by the JWT subject; ADMIN may read another buyer's order. Returns the complete chronological history as one logical page, sorted by createdAt then id. No request pagination parameters.
         */
        get: operations["getOrderStatusHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/order-references/products/{productId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check whether a product is referenced by orders
         * @description Direct service-to-service endpoint for catalog product deletion. Requires PRODUCT.DELETE. The public gateway does not route /internal; call commerce-service directly with the forwarded bearer token. Returns whether any order references the product.
         */
        get: operations["getProductOrderReferences"];
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
        Cart: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
            /**
             * @description Both delivered operations return the current active cart.
             * @enum {string}
             */
            status: "ACTIVE";
            items: components["schemas"]["CartItem"][];
        };
        CartItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            productId: string;
            /** Format: uuid */
            skuId: string;
            /** Format: int32 */
            quantity: number;
            /** @description Existing BigDecimal JSON number; this migration preserves the delivered numeric wire format. */
            unitPrice: number;
        };
        AddCartItem: {
            /** Format: uuid */
            skuId: string;
            /** Format: int32 */
            quantity: number;
        };
        GetOwnCartResponse: {
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
            data: components["schemas"]["Cart"];
        };
        AddCartItemResponse: {
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
            data: components["schemas"]["Cart"];
        };
        /** @enum {string} */
        OrderStatus: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELED" | "REFUND_REQUESTED" | "REFUNDED";
        ShippingAddress: {
            recipientName: string;
            phoneNumber: string;
            addressLine: string;
            ward: string;
            district: string;
            city: string;
            /**
             * @description Trimmed and uppercased before validation.
             * @enum {string}
             */
            countryCode: "VN";
        };
        CreateOrder: {
            shippingAddress: components["schemas"]["ShippingAddress"];
            /**
             * @description Trimmed before validation.
             * @enum {string}
             */
            paymentMethod: "SEPAY";
        };
        ChangeOrderStatus: {
            status: components["schemas"]["OrderStatus"];
            reason: string;
        };
        OrderItem: {
            /** Format: uuid */
            orderItemId: string;
            /** Format: uuid */
            productId: string;
            /** Format: uuid */
            skuId: string;
            productName: string;
            skuCode: string;
            imageUrl: string | null;
            quantity: number;
            /** @description BigDecimal JSON number; no decimal-string conversion. */
            unitPrice: number;
            /** @description BigDecimal JSON number; no decimal-string conversion. */
            totalPrice: number;
        };
        Order: {
            /** Format: uuid */
            orderId: string;
            orderNumber: string;
            /** Format: uuid */
            sellerId: string;
            status: components["schemas"]["OrderStatus"];
            /** @description BigDecimal JSON number; no decimal-string conversion. */
            totalAmount: number;
            items: components["schemas"]["OrderItem"][];
        };
        OrderGroup: {
            /** Format: uuid */
            orderGroupId: string;
            status: string;
            /** @description BigDecimal JSON number; no decimal-string conversion. */
            totalAmount: number;
            /** @example VND */
            currency: string;
            /** Format: date-time */
            dueAt: string;
            orders: components["schemas"]["Order"][];
        };
        OrderStatusHistory: {
            /** Format: uuid */
            id: string;
            /** @enum {string|null} */
            previousStatus: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELED" | "REFUND_REQUESTED" | "REFUNDED" | null;
            newStatus: components["schemas"]["OrderStatus"];
            reason: string;
            /** Format: uuid */
            changedBy: string;
            /** Format: date-time */
            createdAt: string;
        };
        PageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        CreateOrderResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["OrderGroup"];
        };
        GetOrderResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Order"];
        };
        OrderListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Order"][];
            page: components["schemas"]["PageInfo"];
        };
        ChangeOrderStatusResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["Order"];
        };
        OrderStatusHistoryListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["OrderStatusHistory"][];
            page: components["schemas"]["PageInfo"];
        };
        ProductOrderReferencesResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: {
                hasOrders: boolean;
            };
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
    getOwnCart: {
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
                    "application/json": components["schemas"]["GetOwnCartResponse"];
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. A domain login error does not promise this header. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
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
    addCartItem: {
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
                 *       "skuId": "c8000000-0000-4000-8000-000000000003",
                 *       "quantity": 1
                 *     }
                 */
                "application/json": components["schemas"]["AddCartItem"];
            };
        };
        responses: {
            /** @description Created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AddCartItemResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `COMMERCE_INVALID_QUANTITY`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "COMMERCE_INVALID_QUANTITY";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge is present for security-layer authentication failure. A domain login error does not promise this header. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
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
            /** @description Not Found. Codes: `COMMERCE_SKU_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_SKU_NOT_FOUND";
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR";
                    };
                };
            };
            /** @description Bad Gateway. Codes: `COMMERCE_INVALID_CATALOG_RESPONSE`. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 502;
                        /** @enum {string} */
                        code?: "COMMERCE_INVALID_CATALOG_RESPONSE";
                    };
                };
            };
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `COMMERCE_CATALOG_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "COMMERCE_CATALOG_UNAVAILABLE";
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
    listOwnOrders: {
        parameters: {
            query?: {
                /** @description Only orders in this status. */
                status?: components["schemas"]["OrderStatus"];
                /** @description Zero-based page. */
                page?: number;
                /** @description Page size from 1 to 100. */
                size?: number;
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
                    "application/json": components["schemas"]["OrderListResponse"];
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
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
                    /** @description Present when supplied by the limiter. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
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
    createOrder: {
        parameters: {
            query?: never;
            header: {
                /** @description 1 to 100 visible ASCII characters. Reuse only for the same buyer and shipping/payment payload. */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "paymentMethod": "SEPAY",
                 *       "shippingAddress": {
                 *         "recipientName": "Nguyen Van A",
                 *         "phoneNumber": "0901234567",
                 *         "addressLine": "123 Le Loi",
                 *         "ward": "Ben Thanh",
                 *         "district": "1",
                 *         "city": "Ho Chi Minh",
                 *         "countryCode": "VN"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["CreateOrder"];
            };
        };
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrderResponse"];
                };
            };
            /** @description Successful response. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrderResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `COMMERCE_INVALID_ORDER_REQUEST`, `COMMERCE_INVALID_QUANTITY`, `COMMERCE_CART_EMPTY`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "COMMERCE_INVALID_ORDER_REQUEST" | "COMMERCE_INVALID_QUANTITY" | "COMMERCE_CART_EMPTY";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_FORBIDDEN";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
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
            /** @description Conflict. Codes: `COMMERCE_IDEMPOTENCY_CONFLICT`, `COMMERCE_PROMOTION_NOT_SUPPORTED`, `COMMERCE_ITEM_UNAVAILABLE`, `COMMERCE_INVALID_ORDER_AMOUNT`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_IDEMPOTENCY_CONFLICT" | "COMMERCE_PROMOTION_NOT_SUPPORTED" | "COMMERCE_ITEM_UNAVAILABLE" | "COMMERCE_INVALID_ORDER_AMOUNT";
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
                    /** @description Present when supplied by the limiter. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `COMMERCE_CATALOG_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "COMMERCE_CATALOG_UNAVAILABLE";
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
    getOrder: {
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
                    "application/json": components["schemas"]["GetOrderResponse"];
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_FORBIDDEN";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_ORDER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_ORDER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
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
                    /** @description Present when supplied by the limiter. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
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
    changeOrderStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Resource UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "PAID",
                 *       "reason": "Payment verified"
                 *     }
                 */
                "application/json": components["schemas"]["ChangeOrderStatus"];
            };
        };
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChangeOrderStatusResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_FORBIDDEN";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_ORDER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_ORDER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
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
            /** @description Conflict. Codes: `COMMERCE_ILLEGAL_TRANSITION`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_ILLEGAL_TRANSITION";
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
                    /** @description Present when supplied by the limiter. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
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
    getOrderStatusHistory: {
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
                    "application/json": components["schemas"]["OrderStatusHistoryListResponse"];
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
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 401;
                        /** @enum {string} */
                        code?: "UNAUTHENTICATED" | "COMMERCE_UNAUTHENTICATED";
                    };
                };
            };
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_FORBIDDEN";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_ORDER_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_ORDER_NOT_FOUND";
                    };
                };
            };
            /** @description Method Not Allowed. Codes: `METHOD_NOT_ALLOWED`. */
            405: {
                headers: {
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
                    /** @description Present when supplied by the limiter. */
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE";
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
    getProductOrderReferences: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Resource UUID. */
                productId: string;
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
                    "application/json": components["schemas"]["ProductOrderReferencesResponse"];
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
                    /** @description Bearer challenge for security failures; domain failures may omit it. */
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
        };
    };
}
