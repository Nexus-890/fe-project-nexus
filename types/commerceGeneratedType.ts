/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/internal/v1/orders/{id}/shipping-snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the trusted shipping snapshot of a paid order
         * @description Direct commerce-service endpoint used by shipment-service for manual creation. The gateway does not route /internal/v1. Requires SHIPPING.CREATE_SHIPMENT AND ADMIN or SUPPORT_STAFF; the caller's bearer is forwarded and checked here. Reads one repeatable-read commerce transaction and accepts only status PAID with a persisted paidAt. Returns persisted buyer/fee/recipient and items built from order_items, not a caller-supplied address or price. Missing parcel/pickup data and legacy addresses without verified locality codes may be returned for preparation; locality names are never promoted to codes. No inventory/shipment/payment database is read. The response represents state at the read and does not establish an atomic cross-service cancellation boundary.
         */
        get: operations["getOrderShippingSnapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get or create the current active cart
         * @description With a valid bearer token, use the JWT subject cart and require the listed privileges; X-Guest-Token is ignored. Without bearer authentication, use an enabled guest cart identified by X-Guest-Token. Invalid bearer tokens return 401 without guest fallback. Guest tokens are signed opaque owner capabilities and expire after configured inactivity (7 days by default); viewing does not extend inactivity. Quantities are integers 1..999; add sums duplicates and rejects totals above 999. Cart operations do not reserve stock. Authenticated reads get or create an active cart; guest reads never create a cart.
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
         * @description With a valid bearer token, use the JWT subject cart and require the listed privileges; X-Guest-Token is ignored. Without bearer authentication, use an enabled guest cart identified by X-Guest-Token. Invalid bearer tokens return 401 without guest fallback. Guest tokens are signed opaque owner capabilities and expire after configured inactivity (7 days by default); viewing does not extend inactivity. Quantities are integers 1..999; add sums duplicates and rejects totals above 999. Cart operations do not reserve stock. Items must belong to the resolved active cart.
         */
        post: operations["addCartItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Replace the quantity of an item in the current cart
         * @description With a valid bearer token, use the JWT subject cart and require the listed privileges; X-Guest-Token is ignored. Without bearer authentication, use an enabled guest cart identified by X-Guest-Token. Invalid bearer tokens return 401 without guest fallback. Guest tokens are signed opaque owner capabilities and expire after configured inactivity (7 days by default); viewing does not extend inactivity. Quantities are integers 1..999; add sums duplicates and rejects totals above 999. Cart operations do not reserve stock. Items must belong to the resolved active cart. Replaces the quantity rather than incrementing it; existing unitPrice is preserved. Missing or inactive carts and missing or foreign items return the documented 404 cart error. No ADMIN ownership bypass.
         */
        put: operations["updateOwnCartItem"];
        post?: never;
        /**
         * Remove an item from the current cart
         * @description With a valid bearer token, use the JWT subject cart and require the listed privileges; X-Guest-Token is ignored. Without bearer authentication, use an enabled guest cart identified by X-Guest-Token. Invalid bearer tokens return 401 without guest fallback. Guest tokens are signed opaque owner capabilities and expire after configured inactivity (7 days by default); viewing does not extend inactivity. Quantities are integers 1..999; add sums duplicates and rejects totals above 999. Cart operations do not reserve stock. Items must belong to the resolved active cart. Missing or inactive carts and missing or foreign items return the documented 404 cart error. No ADMIN ownership bypass. Success has no response body.
         */
        delete: operations["removeOwnCartItem"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me/pricing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Calculate current cart pricing (CRT-05)
         * @description Read-only: never creates a cart, touches activity/audit timestamps, updates cart prices, reserves inventory, creates orders or publishes events. Reads only the JWT subject's active cart, even for ADMIN. Uses current SKU prices and compares them numerically with saved prices. Catalog 404 means PRODUCT_INACTIVE; unavailable SKU lines remain visible at their last saved price and cannot be treated as a valid checkout. Catalog transport failures return a named error, never a valid result. Tax-inclusive prices give taxAmount=0; D01 gives discountAmount=0 and promoCode is ignored. Shipping is null without a delivery address and total excludes unknown shipping; FREE_SHIPPING_THRESHOLD cannot manufacture a carrier quote. INV-03 stock check is skipped until that endpoint exists. CHECKOUT_PRICE_REVALIDATION must remain true (BR-103), enforced at configuration binding. Empty or missing active cart returns zero amounts or valid=true with issues=[] without inserting a cart.
         */
        get: operations["getCartPricing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Validate the current cart (CRT-06)
         * @description Read-only: never creates a cart, touches activity/audit timestamps, updates cart prices, reserves inventory, creates orders or publishes events. Reads only the JWT subject's active cart, even for ADMIN. Uses current SKU prices and compares them numerically with saved prices. Catalog 404 means PRODUCT_INACTIVE; unavailable SKU lines remain visible at their last saved price and cannot be treated as a valid checkout. Catalog transport failures return a named error, never a valid result. Tax-inclusive prices give taxAmount=0; D01 gives discountAmount=0 and promoCode is ignored. Shipping is null without a delivery address and total excludes unknown shipping; FREE_SHIPPING_THRESHOLD cannot manufacture a carrier quote. INV-03 stock check is skipped until that endpoint exists. CHECKOUT_PRICE_REVALIDATION must remain true (BR-103), enforced at configuration binding. Empty or missing active cart returns zero amounts or valid=true with issues=[] without inserting a cart.
         */
        post: operations["validateCart"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/checkout/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Preview checkout without creating an order (ORD-02)
         * @description Read-only checkout for the JWT buyer: never creates a cart, touches activity timestamps, changes saved cart prices, reserves stock, creates orders or publishes events. Uses current catalog prices and returns item issues for review. A valid cart is grouped by seller; backend packs each seller parcel from catalog-owned per-unit shippingParcel metadata and calls shipment-service once per seller with the two-level recipient address. shippingFee is the sum of those quotes and total includes it. Missing metadata or an oversized parcel returns 409; carrier transport failure returns 503 instead of a zero fee. Client fees or parcel measurements are never trusted. Empty active cart returns 400 COMMERCE_CART_EMPTY. Promo code remains ignored under D01. Inactive/missing product issues leave shipping unknown; PRICE_CHANGED still quotes current catalog data for buyer review.
         */
        post: operations["previewCheckout"];
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
         * @description Requires CHECKOUT.START AND ORDER.CREATE and a UUID Idempotency-Key. Splits the active cart by seller and checks current SKU availability before checkout. With nexus.order.idempotency-enabled=true (ORDER_IDEMPOTENCY_ENABLED, default true), a matching replay of the same key, buyer and shipping/payment payload returns the original order group and seller order IDs with 200 before price validation and creates no new rows; a fresh key returns 201. UUID letter case is normalized, so uppercase and lowercase forms are the same key. Concurrent successful requests for one key leave one group and one order per seller; the losing request returns the committed winner's group. A missing or invalid key returns 400 COMMERCE_INVALID_ORDER_REQUEST. A key owned by another buyer returns 400 COMMERCE_IDEMPOTENCY_KEY_NOT_OWNED without that buyer's order data. The same buyer reusing a key with changed shipping/payment data returns 409 COMMERCE_IDEMPOTENCY_CONFLICT. When idempotency is disabled, the UUID header remains required but each successful checkout uses a fresh internal key and does not replay the supplied key. With nexus.checkout.price-revalidation=true (CHECKOUT_PRICE_REVALIDATION, default true), current SKU prices are compared with the cart prices using exact long minor units. A changed price returns 409 COMMERCE_PRICE_CHANGED with top-level skuId, oldPrice and newPrice in the original currency units. Only the reported cart item's price is updated and committed; no order or inventory reservation is created. A confirmed retry with a new Idempotency-Key returns 201 at the updated cart price if prices have not changed again. If several prices changed, each 409 reports and updates one item, leaving the other changed prices for subsequent confirmation. With price-revalidation=false, orders use the saved cart prices while SKU and product availability checks still apply. Cart ownership and checkout guards still apply. Unsupported promotion, unavailable item and unrepresentable money fail before checkout completes. Payment method is SEPAY. Quote every seller order before reserving anything using catalog-owned shippingParcel metadata; client shipping fees are never used. Shipping failure leaves no order or reservation. Save the group and child orders in the commerce transaction, then make one inventory reservation call with all seller order items. Inventory 409 becomes COMMERCE_INSUFFICIENT_STOCK with skuId, available and requested; all commerce group/order rows roll back. Timeout or open inventory circuit returns COMMERCE_INVENTORY_UNAVAILABLE within the configured bounded inventory-call deadline below 3 seconds, with no committed commerce order. Every child paymentDueAt and group dueAt come from reservation expiresAt. Saved shipping_info holds recipient{name,phone,address{line1,wardCode,provinceCode}}, warehouseId from the reservation and the backend-computed parcel. Failure after a successful remote hold may leave inventory for the expiry job; this path sends no compensating release. Gateway checks ORDER.CREATE; downstream additionally checks CHECKOUT.START.
         */
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/manage": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List all orders for administration and support
         * @description Requires ORDER.LIST and either ADMIN or SUPPORT_STAFF. Lists every stored order when filters are omitted. userId identifies the buyer. Supplied userId, sellerId, status, orderType, from and to filters combine with AND. BUYER and SELLER without an allowed management role receive 403 even with ORDER.LIST. from/to filter createdAt using ISO-8601 timestamps with an offset, inclusive at both bounds; from after to returns 400 COMMERCE_INVALID_ORDER_FILTER. Percent-encode a positive offset + as %2B, or use UTC Z. page is zero-based and defaults to 0; size defaults to 10 and must be 1 to 100. Invalid paging returns 400 COMMERCE_INVALID_ORDER_FILTER. Results sort by createdAt DESC then orderNumber DESC. Empty results and pages beyond the end return 200 with empty data and actual page totals.
         */
        get: operations["listManagedOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/sales": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List orders sold by the current seller
         * @description Requires ORDER.LIST and SELLER. Lists only orders whose persisted seller_id equals the validated JWT subject. Supplied status, from and to filters combine with AND; no userId, sellerId or orderType selector is supported. BUYER receives 403 even with ORDER.LIST. from/to filter createdAt using ISO-8601 timestamps with an offset, inclusive at both bounds; from after to returns 400 COMMERCE_INVALID_ORDER_FILTER. Percent-encode a positive offset + as %2B, or use UTC Z. page is zero-based and defaults to 0; size defaults to 10 and must be 1 to 100. Invalid paging returns 400 COMMERCE_INVALID_ORDER_FILTER. Results sort by createdAt DESC then orderNumber DESC. Empty results and pages beyond the end return 200 with empty data and actual page totals.
         */
        get: operations["listSalesOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/groups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the complete order group
         * @description Requires ORDER.VIEW and the group buyer owner or ADMIN. Includes every seller order, stored price/shipping breakdown, current status and the common reservation deadline. Another buyer receives 403; a missing group returns 404 COMMERCE_ORDER_NOT_FOUND.
         */
        get: operations["getOrderGroup"];
        put?: never;
        post?: never;
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
    "/api/v1/orders/{id}/invoice": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the completed order HTML receipt
         * @description Requires ORDER.VIEW and buyer ownership by the JWT subject, including for ADMIN and SUPPORT_STAFF. Ownership is checked before completion, so another user receives 403 for every order status. Only COMPLETED orders return a document; other statuses return 409 COMMERCE_ORDER_NOT_COMPLETED. The HTML receipt uses stored seller-order item and price snapshots. The 200 response is a protocol document marked @ProtocolResponse, without a JSON envelope; errors remain Problem Details.
         */
        get: operations["getInvoice"];
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
         * @description ADMIN role required at the service. Allowed administrative transitions: PENDING -> PAID/CANCELED; PAID -> CANCELED/SHIPPED; SHIPPED -> DELIVERED; CANCELED -> REFUND_REQUESTED; REFUND_REQUESTED -> REFUNDED. DELIVERED -> COMPLETED is reserved for buyer confirmation or the automatic completion job and returns 409 here. Delivery persists the confirmation window. Concurrent or illegal moves return 409. Every successful change appends status history.
         */
        patch: operations["changeOrderStatus"];
        trace?: never;
    };
    "/api/v1/orders/{id}/confirm-receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Confirm receipt of a delivered order
         * @description Requires BUYER and ORDER.VIEW plus buyer ownership, including for callers who also have ADMIN. ShipmentDelivered leaves the order DELIVERED and persists deliveredAt/autoCompleteAt. Confirming locks the order row and moves DELIVERED to COMPLETED, inserts one history row and one OrderCompleted outbox event in the same transaction. Repeating confirmation of an owned COMPLETED order returns it without another history/event. Other statuses return 409 COMMERCE_ORDER_NOT_DELIVERED; another buyer receives 403 before the status check. The automatic job uses the same lock and completion transaction when autoCompleteAt is due. Receipt email, rating and payout consumers remain gated on OrderCompleted. No request body.
         */
        post: operations["confirmReceipt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{id}/receipt-issue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Report a receipt issue and pause completion
         * @description Requires BUYER and ORDER.VIEW plus buyer ownership. While the order is DELIVERED, persist the first trimmed reason and reported timestamp under the same row lock used by completion. Repeated reports retain that original report. An open report prevents both buyer and automatic completion. If completion wins a concurrent race, reporting returns 409 COMMERCE_ORDER_NOT_DELIVERED. D11 owns resolution; this operation does not issue a refund or clear the hold.
         */
        post: operations["reportReceiptIssue"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/orders/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an order
         * @description Requires ORDER.CANCEL. The buyer who owns the order, ADMIN or SUPPORT_STAFF may cancel it. A PENDING order cancels its whole unpaid order group in one transaction: the group and every still-PENDING order become CANCELED, each with a history row, and the outbox gets one OrderGroupCancelled and one OrderCancelled per order. The items of the other orders go back to the buyer's ACTIVE cart, added to the same SKU if it is already there, so the buyer can place them again as a new group; the items of the cancelled order are not returned. A PAID order is cancelled on its own: its OrderCancelled carries the amount paid, and the other orders and the group stay PAID. Any other status returns 409. PAYMENT_DEADLINE_EXPIRED is reserved for payment expiry.
         */
        post: operations["cancelOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
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
    "/api/v1/carts/guest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create an anonymous guest cart
         * @description Create an empty ACTIVE guest cart with userId null. Requires ALLOW_GUEST_CART=true and a configured shared signing key. Returns a fresh signed opaque guestToken; retain it and send X-Guest-Token on the four cart read/item operations. Tokens expire with cart inactivity and cannot be reused after merge. Does not create a login session or reserve inventory.
         */
        post: operations["createGuestCart"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carts/me/merge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Merge a guest cart into the authenticated buyer cart once
         * @description After the Keycloak callback, the frontend submits its stored guestToken. Requires ALLOW_GUEST_CART and CART_MERGE_ON_LOGIN. Atomically lock the guest source and buyer destination, create destination if absent, sum duplicate SKU quantities and cap at 999 with QUANTITY_CAPPED in issues. SKU identity canonically determines its seller; no caller seller ID is accepted. Existing buyer line prices are retained; new lines keep guest prices. Retain missing/inactive catalog lines with PRODUCT_INACTIVE, self-purchase lines with SELF_PURCHASE and changed prices with PRICE_CHANGED. Catalog outages/malformed responses roll back all effects and allow retry. Retire source as MERGED; replay, expired and unknown tokens return the same 404. Cart quantity does not reserve stock or clamp to available inventory; actual stock checks await inventory integration and remain mandatory at checkout. Empty guest carts may merge. Concurrent guest writes and merges serialize on the same owner row.
         */
        post: operations["mergeGuestCart"];
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
        OrderShippingSnapshotEnvelope: {
            /** @example 0 */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["OrderShippingSnapshotResponse"];
        };
        OrderShippingSnapshotResponse: {
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            buyerId: string;
            /**
             * Format: uuid
             * @description Trusted orders.seller_id used by shipment-service for seller ownership; never taken from shippingInfo or the caller.
             */
            sellerId: string;
            /** Format: int64 */
            orderVersion: number;
            /** @enum {string} */
            status: "PAID";
            /** Format: date-time */
            paidAt: string;
            /**
             * Format: uuid
             * @description Trusted persisted warehouse selection when available. Manual creation can otherwise select a configured warehouse.
             */
            warehouseId: string | null;
            /** @description This seller order's persisted VND fee, never the order-group total or a caller override. */
            shippingFee: number;
            /** @description Stored recipient and optional parcel/pickup data, normalized without fabricating locality codes. The items array is built from this order's persisted SKU IDs, product-name snapshots and quantities. */
            shippingInfo: {
                [key: string]: unknown;
            };
        };
        UpdateCartItem: {
            /** Format: int32 */
            quantity: number;
        };
        CartPricing: {
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            subtotal: number;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            taxAmount: number;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            discountAmount: number;
            /** @description Null because this endpoint has no delivery address; use checkout preview for an address-aware quote, including above FREE_SHIPPING_THRESHOLD. */
            estimatedShippingFee: number | null;
            /** @description subtotal + taxAmount - discountAmount. Unknown shipping is excluded from this address-free estimate. */
            total: number;
        };
        CartIssue: {
            /** Format: uuid */
            itemId: string;
            /** Format: uuid */
            skuId: string;
            /**
             * @description QUANTITY_CAPPED: merged quantity limited to 999. SELF_PURCHASE: retained seller-owned line. PRODUCT_INACTIVE covers catalog 404 or inactive SKU/product. PRICE_CHANGED requires review. OUT_OF_STOCK is reserved for real inventory integration; merge does not claim stock availability.
             * @enum {string}
             */
            code: "OUT_OF_STOCK" | "PRICE_CHANGED" | "PRODUCT_INACTIVE" | "QUANTITY_CAPPED" | "SELF_PURCHASE";
        };
        CartValidation: {
            valid: boolean;
            issues: components["schemas"]["CartIssue"][];
        };
        CheckoutPreviewItem: {
            /** Format: uuid */
            itemId: string;
            /** Format: uuid */
            productId: string;
            /** Format: uuid */
            skuId: string;
            quantity: number;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            unitPrice: number;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            lineTotal: number;
        };
        CheckoutPreview: {
            items: components["schemas"]["CheckoutPreviewItem"][];
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            subtotal: number;
            /** @description Sum of backend shipping quotes for each seller order; null while inactive/missing product issues prevent quotation. */
            shippingFee: number | null;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            taxAmount: number;
            /** @description Numeric VND amount; BigDecimal preserves the existing cart money contract. */
            discountAmount: number;
            /** @description subtotal - discountAmount + taxAmount + shippingFee. A null shippingFee counts as 0 until #201. */
            total: number;
            issues: components["schemas"]["CartIssue"][];
        };
        CheckoutPreviewRequest: {
            shippingAddress: components["schemas"]["ShippingAddress"];
            /**
             * @description Trimmed before validation; uses the supported order payment method.
             * @enum {string}
             */
            paymentMethod: "SEPAY";
            /** @description Optional; accepted and ignored under D01. No promotion is applied or persisted. */
            promoCode?: string;
        };
        CartPricingEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["CartPricing"];
        };
        CartValidationEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["CartValidation"];
        };
        CheckoutPreviewEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["CheckoutPreview"];
        };
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
        InsufficientStockProblem: components["schemas"]["Problem"] & {
            /** @enum {integer} */
            status?: 409;
            /** @enum {string} */
            code?: "COMMERCE_INSUFFICIENT_STOCK";
            /** Format: uuid */
            skuId: string;
            available: number;
            requested: number;
        };
        PriceChangedProblem: components["schemas"]["Problem"] & {
            /** @enum {integer} */
            status?: 409;
            /** @enum {string} */
            code?: "COMMERCE_PRICE_CHANGED";
            /** Format: uuid */
            skuId: string;
            /**
             * @description The price saved in the cart before this response, in the original currency units.
             * @example 150000
             */
            oldPrice: number;
            /**
             * @description The current SKU price saved to the reported cart item, in the original currency units.
             * @example 180000
             */
            newPrice: number;
        };
        ValidationError: {
            /** @description Failed request field; an object-level failure uses the object name. */
            field: string;
            /** @description Constraint identifier, for example VALIDATION_NOT_BLANK, VALIDATION_EMAIL, VALIDATION_SIZE or INVALID_PARAMETER. */
            code: string;
            detail: string;
        };
        MergeGuestCart: {
            guestToken: string;
        };
        GuestCart: {
            /** @description Signed opaque owner token; treat as a secret. */
            guestToken: string;
            cart: components["schemas"]["Cart"];
        };
        GuestCartEnvelope: {
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
            data: components["schemas"]["GuestCart"];
        };
        Cart: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string | null;
            /**
             * @description The resolved or merged destination cart is ACTIVE; retired guest source is not returned.
             * @enum {string}
             */
            status: "ACTIVE";
            items: components["schemas"]["CartItem"][];
            /** @description Merge findings; empty for ordinary cart operations. Revalidate at checkout. */
            issues?: components["schemas"]["CartIssue"][];
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
        /** @description GHN v3 two-level recipient address. Use active province/ward codes from the shipping locality API; the ward must belong to the province. */
        ShippingAddress: {
            recipientName: string;
            /** @description Vietnamese carrier-compatible phone; trimmed before validation. */
            phoneNumber: string;
            addressLine: string;
            /** @description Active GHN v3 ward _id as a string; no district is accepted. */
            wardCode: string;
            /** @description Active GHN v3 province _id as a string. */
            provinceCode: string;
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
        CancelOrder: {
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
            /**
             * Format: uuid
             * @description Group containing this seller order; returned on all detail/list reads.
             */
            orderGroupId: string;
            orderNumber: string;
            /**
             * Format: uuid
             * @description Buyer who placed the order.
             */
            userId: string;
            /** @description Recipient name from the order shippingAddress snapshot; unavailable for historical orders without a valid name. This is not a current profile lookup. */
            recipientName?: string | null;
            /** @description Recipient phone from the order shippingAddress snapshot; unavailable for historical orders without a valid phone. */
            phoneNumber?: string | null;
            /** Format: uuid */
            sellerId: string;
            /** @enum {string} */
            orderType: "STANDARD" | "AUCTION";
            status: components["schemas"]["OrderStatus"];
            /** @description Cancellation eligibility for the current caller: ORDER.CANCEL and ownership (or ADMIN/SUPPORT_STAFF), and either PAID or PENDING in a PENDING group. This is a read-time snapshot; cancellation rechecks locked state and can return 409. Missing on older backends must be treated as false. */
            canCancel: boolean;
            /** @description First receipt issue reported by the buyer; retained until D11 resolves it. */
            receiptIssueReason?: string | null;
            /**
             * Format: date-time
             * @description An open report pauses buyer and automatic completion while this timestamp is present.
             */
            receiptIssueReportedAt?: string | null;
            /**
             * Format: date-time
             * @description First committed DELIVERED transition time. Duplicate shipment events do not reset it.
             */
            deliveredAt?: string | null;
            /**
             * Format: date-time
             * @description Persisted deliveredAt plus nexus.order.auto-complete-days (default 7); the scheduler completes due DELIVERED orders. Existing COMPLETED orders are not reopened.
             */
            autoCompleteAt?: string | null;
            /** @description Buyer-readable reason set from PaymentUnreconciled (#157) when a transfer for this order's checkout could not be applied, for example a payment after the deadline. It never changes status. Null when there is nothing to report. */
            paymentNote?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** @description Sum of stored item line totals. */
            subtotal: number;
            /** @description Backend shipping quote for this seller order. */
            shippingFee: number;
            discountAmount: number;
            taxAmount: number;
            /** @description subtotal - discountAmount + taxAmount + shippingFee, recomputed by the backend and enforced by the database CHECK; BigDecimal JSON number. */
            totalAmount: number;
            items: components["schemas"]["OrderItem"][];
        };
        OrderGroup: {
            /** Format: uuid */
            orderGroupId: string;
            status: string;
            /** @description Sum of all child order totalAmount values, including their shipping fees. */
            totalAmount: number;
            /** @example VND */
            currency: string;
            /**
             * Format: date-time
             * @description Reservation expiresAt; every child paymentDueAt has this same deadline.
             */
            dueAt: string;
            orders: components["schemas"]["Order"][];
        };
        OrderStatusHistory: {
            /** Format: uuid */
            id: string;
            /** @enum {string|null} */
            previousStatus: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELED" | "REFUND_REQUESTED" | "REFUNDED" | null;
            newStatus: components["schemas"]["OrderStatus"];
            /** @description May be unavailable for historical or system-generated history. */
            reason: string | null;
            /**
             * Format: uuid
             * @description May be unavailable for historical or system-generated history.
             */
            changedBy: string | null;
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
        CancelOrderResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["OrderGroup"];
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
    getOrderShippingSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Canonical seller order UUID, not the order-group UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authoritative paid-order snapshot for shipment creation. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderShippingSnapshotEnvelope"];
                };
            };
            /** @description Invalid UUID path parameter; INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer; UNAUTHENTICATED. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Caller lacks the required privilege or operational role; FORBIDDEN. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Order does not exist; COMMERCE_ORDER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Order is not PAID or its stored snapshot cannot support shipment creation. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unexpected internal failure; INTERNAL_ERROR. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getOwnCart: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required when no bearer token is supplied. Obtain from POST /api/v1/carts/guest. Never log or expose this owner capability. */
                "X-Guest-Token"?: string;
            };
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_GUEST_CART_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_GUEST_CART_NOT_FOUND";
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`, `COMMERCE_INVALID_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION" | "COMMERCE_INVALID_CONFIGURATION";
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
            header?: {
                /** @description Required when no bearer token is supplied. Obtain from POST /api/v1/carts/guest. Never log or expose this owner capability. */
                "X-Guest-Token"?: string;
            };
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_SKU_NOT_FOUND`, `COMMERCE_GUEST_CART_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_SKU_NOT_FOUND" | "COMMERCE_GUEST_CART_NOT_FOUND";
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`, `COMMERCE_INVALID_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION" | "COMMERCE_INVALID_CONFIGURATION";
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
    updateOwnCartItem: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required when no bearer token is supplied. Obtain from POST /api/v1/carts/guest. Never log or expose this owner capability. */
                "X-Guest-Token"?: string;
            };
            path: {
                /** @description Cart item ID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "quantity": 2
                 *     }
                 */
                "application/json": components["schemas"]["UpdateCartItem"];
            };
        };
        responses: {
            /** @description Current cart with the replaced item quantity. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetOwnCartResponse"];
                };
            };
            /** @description INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED, COMMERCE_INVALID_QUANTITY. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED" | "COMMERCE_INVALID_QUANTITY";
                    };
                };
            };
            /** @description UNAUTHENTICATED, COMMERCE_UNAUTHENTICATED. */
            401: {
                headers: {
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_GUEST_CART_NOT_FOUND`, `COMMERCE_CART_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_GUEST_CART_NOT_FOUND" | "COMMERCE_CART_NOT_FOUND";
                    };
                };
            };
            /** @description METHOD_NOT_ALLOWED. */
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
            /** @description NOT_ACCEPTABLE. */
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
            /** @description UNSUPPORTED_MEDIA_TYPE. */
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
            /** @description RATE_LIMITED. */
            429: {
                headers: {
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`, `COMMERCE_INVALID_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION" | "COMMERCE_INVALID_CONFIGURATION";
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
    removeOwnCartItem: {
        parameters: {
            query?: never;
            header?: {
                /** @description Required when no bearer token is supplied. Obtain from POST /api/v1/carts/guest. Never log or expose this owner capability. */
                "X-Guest-Token"?: string;
            };
            path: {
                /** @description Cart item ID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Item removed; no response body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description INVALID_PARAMETER, INVALID_REQUEST_BODY, VALIDATION_FAILED. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "INVALID_REQUEST_BODY" | "VALIDATION_FAILED";
                    };
                };
            };
            /** @description UNAUTHENTICATED, COMMERCE_UNAUTHENTICATED. */
            401: {
                headers: {
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_GUEST_CART_NOT_FOUND`, `COMMERCE_CART_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_GUEST_CART_NOT_FOUND" | "COMMERCE_CART_NOT_FOUND";
                    };
                };
            };
            /** @description METHOD_NOT_ALLOWED. */
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
            /** @description NOT_ACCEPTABLE. */
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
            /** @description RATE_LIMITED. */
            429: {
                headers: {
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`, `COMMERCE_INVALID_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION" | "COMMERCE_INVALID_CONFIGURATION";
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
    getCartPricing: {
        parameters: {
            query?: {
                /** @description Accepted and ignored (D01). */
                promoCode?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current calculated result; nested items/issues are part of one resource, with no page metadata. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartPricingEnvelope"];
                };
            };
            /** @description Bad Request. Codes: `COMMERCE_INVALID_QUANTITY`, `INVALID_PARAMETER`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "COMMERCE_INVALID_QUANTITY" | "INVALID_PARAMETER";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security-layer authentication failures. */
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
                    /** @description Supported methods when known. */
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
                    /** @description Seconds to wait when supplied by the gateway. */
                    "Retry-After"?: number;
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_INVALID_PRICING_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_INVALID_PRICING_CONFIGURATION";
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
    validateCart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current calculated result; nested items/issues are part of one resource, with no page metadata. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CartValidationEnvelope"];
                };
            };
            /** @description Bad Request. Codes: `COMMERCE_INVALID_QUANTITY`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "COMMERCE_INVALID_QUANTITY";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security-layer authentication failures. */
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
                    /** @description Supported methods when known. */
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
                    /** @description Seconds to wait when supplied by the gateway. */
                    "Retry-After"?: number;
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_INVALID_PRICING_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_INVALID_PRICING_CONFIGURATION";
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
    previewCheckout: {
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
                 *       "shippingAddress": {
                 *         "recipientName": "Buyer",
                 *         "phoneNumber": "0901234567",
                 *         "addressLine": "123 Street",
                 *         "wardCode": "1003646",
                 *         "provinceCode": "1000001",
                 *         "countryCode": "VN"
                 *       },
                 *       "paymentMethod": "SEPAY",
                 *       "promoCode": "IGNORED-D01"
                 *     }
                 */
                "application/json": components["schemas"]["CheckoutPreviewRequest"];
            };
        };
        responses: {
            /** @description Current calculated result; nested items/issues are part of one resource, with no page metadata. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CheckoutPreviewEnvelope"];
                };
            };
            /** @description Bad Request. Codes: `COMMERCE_INVALID_QUANTITY`, `COMMERCE_CART_EMPTY`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`. Additional codes: `COMMERCE_INVALID_SHIPPING_ADDRESS`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "COMMERCE_INVALID_QUANTITY" | "COMMERCE_CART_EMPTY" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "COMMERCE_INVALID_SHIPPING_ADDRESS";
                    };
                };
            };
            /** @description Unauthorized. Codes: `UNAUTHENTICATED`, `COMMERCE_UNAUTHENTICATED`. */
            401: {
                headers: {
                    /** @description Bearer challenge for security-layer authentication failures. */
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
                    /** @description Supported methods when known. */
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
            /** @description Codes: `COMMERCE_SHIPPING_METADATA_REQUIRED`, `COMMERCE_INVALID_PARCEL`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_SHIPPING_METADATA_REQUIRED" | "COMMERCE_INVALID_PARCEL";
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
            /** @description Codes: `COMMERCE_SHIPPING_NOT_AVAILABLE`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 422;
                        /** @enum {string} */
                        code?: "COMMERCE_SHIPPING_NOT_AVAILABLE";
                    };
                };
            };
            /** @description Too Many Requests. Codes: `RATE_LIMITED`. */
            429: {
                headers: {
                    /** @description Seconds to wait when supplied by the gateway. */
                    "Retry-After"?: number;
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_INVALID_PRICING_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_INVALID_PRICING_CONFIGURATION";
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `COMMERCE_CATALOG_UNAVAILABLE`. Additional codes: `COMMERCE_SHIPPING_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "COMMERCE_CATALOG_UNAVAILABLE" | "COMMERCE_SHIPPING_UNAVAILABLE";
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
                /** @description Required UUID in 8-4-4-4-12 form. UUID letter case is normalized to lowercase. Reuse only for the same buyer and shipping/payment payload. Missing or malformed values return 400 COMMERCE_INVALID_ORDER_REQUEST. The header remains required when ORDER_IDEMPOTENCY_ENABLED=false. */
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
                 *         "wardCode": "1003646",
                 *         "provinceCode": "1000001",
                 *         "countryCode": "VN"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["CreateOrder"];
            };
        };
        responses: {
            /** @description Idempotent replay: the original order group and seller order IDs, with no new order rows. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrderResponse"];
                };
            };
            /** @description A new group and one order per seller were committed with backend shipping fees and one atomic reservation request. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateOrderResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `COMMERCE_INVALID_ORDER_REQUEST`, `COMMERCE_IDEMPOTENCY_KEY_NOT_OWNED`, `COMMERCE_INVALID_QUANTITY`, `COMMERCE_CART_EMPTY`. Missing or invalid Idempotency-Key writes no order. A key owned by another buyer returns no order data. Additional codes: `COMMERCE_INVALID_SHIPPING_ADDRESS`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "COMMERCE_INVALID_ORDER_REQUEST" | "COMMERCE_IDEMPOTENCY_KEY_NOT_OWNED" | "COMMERCE_INVALID_QUANTITY" | "COMMERCE_CART_EMPTY" | "COMMERCE_INVALID_SHIPPING_ADDRESS";
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
            /** @description Conflict. Codes: `COMMERCE_INSUFFICIENT_STOCK`, `COMMERCE_IDEMPOTENCY_CONFLICT`, `COMMERCE_PROMOTION_NOT_SUPPORTED`, `COMMERCE_ITEM_UNAVAILABLE`, `COMMERCE_INVALID_ORDER_AMOUNT`, `COMMERCE_PRICE_CHANGED`. IDEMPOTENCY_CONFLICT applies when the same buyer reuses a key with changed shipping/payment data; a key belonging to another buyer returns 400 instead. PRICE_CHANGED includes skuId, oldPrice and newPrice; the reported cart price is saved, but no order or inventory reservation is created. Additional codes: `COMMERCE_SHIPPING_METADATA_REQUIRED`, `COMMERCE_INVALID_PARCEL`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["InsufficientStockProblem"] | components["schemas"]["PriceChangedProblem"] | (components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_IDEMPOTENCY_CONFLICT" | "COMMERCE_PROMOTION_NOT_SUPPORTED" | "COMMERCE_ITEM_UNAVAILABLE" | "COMMERCE_INVALID_ORDER_AMOUNT" | "COMMERCE_SHIPPING_METADATA_REQUIRED" | "COMMERCE_INVALID_PARCEL";
                    });
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
            /** @description Codes: `COMMERCE_SHIPPING_NOT_AVAILABLE`. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 422;
                        /** @enum {string} */
                        code?: "COMMERCE_SHIPPING_NOT_AVAILABLE";
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
            /** @description Service Unavailable. Codes: `SERVICE_UNAVAILABLE`, `COMMERCE_CATALOG_UNAVAILABLE`. Additional codes: `COMMERCE_SHIPPING_UNAVAILABLE`, `COMMERCE_INVENTORY_UNAVAILABLE`. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 503;
                        /** @enum {string} */
                        code?: "SERVICE_UNAVAILABLE" | "COMMERCE_CATALOG_UNAVAILABLE" | "COMMERCE_SHIPPING_UNAVAILABLE" | "COMMERCE_INVENTORY_UNAVAILABLE";
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
    listManagedOrders: {
        parameters: {
            query?: {
                /**
                 * @description Optional buyer UUID.
                 * @example 68000000-0000-4000-8000-000000000002
                 */
                userId?: string;
                /**
                 * @description Optional seller UUID.
                 * @example 68000000-0000-4000-8000-000000000003
                 */
                sellerId?: string;
                /**
                 * @description Optional exact order status.
                 * @example PENDING
                 */
                status?: components["schemas"]["OrderStatus"];
                /**
                 * @description Optional exact order type.
                 * @example STANDARD
                 */
                orderType?: "STANDARD" | "AUCTION";
                /**
                 * @description Inclusive lower bound on createdAt; timestamp must include an offset.
                 * @example 2026-11-03T00:00:00Z
                 */
                from?: string;
                /**
                 * @description Inclusive upper bound on createdAt; must not precede from.
                 * @example 2026-11-03T23:59:59Z
                 */
                to?: string;
                /**
                 * @description Zero-based page number.
                 * @example 0
                 */
                page?: number;
                /**
                 * @description Page size, from 1 to 100.
                 * @example 10
                 */
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Matching orders with pagination metadata. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderListResponse"];
                };
            };
            /** @description INVALID_PARAMETER, COMMERCE_INVALID_ORDER_FILTER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "COMMERCE_INVALID_ORDER_FILTER";
                    };
                };
            };
            /** @description UNAUTHENTICATED, COMMERCE_UNAUTHENTICATED. */
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
            /** @description FORBIDDEN, COMMERCE_FORBIDDEN. */
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
            /** @description METHOD_NOT_ALLOWED. */
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
            /** @description NOT_ACCEPTABLE. */
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
            /** @description RATE_LIMITED. */
            429: {
                headers: {
                    /** @description Present when supplied by the gateway limiter. */
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
            /** @description INTERNAL_ERROR. */
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
            /** @description SERVICE_UNAVAILABLE. */
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
            /** @description GATEWAY_TIMEOUT. */
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
    listSalesOrders: {
        parameters: {
            query?: {
                /**
                 * @description Optional exact order status.
                 * @example PENDING
                 */
                status?: components["schemas"]["OrderStatus"];
                /**
                 * @description Inclusive lower bound on createdAt; timestamp must include an offset.
                 * @example 2026-11-03T00:00:00Z
                 */
                from?: string;
                /**
                 * @description Inclusive upper bound on createdAt; must not precede from.
                 * @example 2026-11-03T23:59:59Z
                 */
                to?: string;
                /**
                 * @description Zero-based page number.
                 * @example 0
                 */
                page?: number;
                /**
                 * @description Page size, from 1 to 100.
                 * @example 10
                 */
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Matching orders with pagination metadata. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderListResponse"];
                };
            };
            /** @description INVALID_PARAMETER, COMMERCE_INVALID_ORDER_FILTER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "COMMERCE_INVALID_ORDER_FILTER";
                    };
                };
            };
            /** @description UNAUTHENTICATED, COMMERCE_UNAUTHENTICATED. */
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
            /** @description FORBIDDEN, COMMERCE_FORBIDDEN. */
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
            /** @description METHOD_NOT_ALLOWED. */
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
            /** @description NOT_ACCEPTABLE. */
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
            /** @description RATE_LIMITED. */
            429: {
                headers: {
                    /** @description Present when supplied by the gateway limiter. */
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
            /** @description INTERNAL_ERROR. */
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
            /** @description SERVICE_UNAVAILABLE. */
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
            /** @description GATEWAY_TIMEOUT. */
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
    getOrderGroup: {
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
            /** @description The complete buyer order group. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 0,
                     *       "message": "response success",
                     *       "data": {
                     *         "orderGroupId": "c8000000-0000-4000-8000-000000000006",
                     *         "status": "PENDING",
                     *         "totalAmount": 330000,
                     *         "currency": "VND",
                     *         "dueAt": "2026-11-11T08:30:00Z",
                     *         "orders": [
                     *           {
                     *             "orderId": "c8000000-0000-4000-8000-000000000005",
                     *             "orderGroupId": "c8000000-0000-4000-8000-000000000006",
                     *             "orderNumber": "NX-20261111-00000001",
                     *             "userId": "68000000-0000-4000-8000-000000000001",
                     *             "sellerId": "68000000-0000-4000-8000-000000000003",
                     *             "orderType": "STANDARD",
                     *             "status": "PENDING",
                     *             "canCancel": true,
                     *             "createdAt": "2026-11-11T08:00:00Z",
                     *             "subtotal": 300000,
                     *             "shippingFee": 30000,
                     *             "discountAmount": 0,
                     *             "taxAmount": 0,
                     *             "totalAmount": 330000,
                     *             "items": []
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["CreateOrderResponse"];
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
    getInvoice: {
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
            /** @description HTML receipt for the caller's completed seller order. */
            200: {
                headers: {
                    /** @description Keep the private receipt out of shared and browser caches. */
                    "Cache-Control"?: "no-store";
                    "X-Content-Type-Options"?: "nosniff";
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
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
            /** @description Conflict. Codes: `COMMERCE_ORDER_NOT_COMPLETED`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_ORDER_NOT_COMPLETED";
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
    confirmReceipt: {
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
            /** @description Completed order, including an idempotent replay. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetOrderResponse"];
                };
            };
            /** @description Authentication is required. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description BUYER, ORDER.VIEW or ownership is missing. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description COMMERCE_ORDER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description COMMERCE_ORDER_NOT_DELIVERED or COMMERCE_RECEIPT_ISSUE_OPEN. */
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
    reportReceiptIssue: {
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
                "application/json": {
                    reason: string;
                };
            };
        };
        responses: {
            /** @description Delivered order with the original persisted receipt issue. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetOrderResponse"];
                };
            };
            /** @description Invalid or missing receipt issue reason. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Authentication required. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description BUYER, ORDER.VIEW or ownership missing. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description COMMERCE_ORDER_NOT_FOUND. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description COMMERCE_ORDER_NOT_DELIVERED. */
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
    cancelOrder: {
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
                 *       "reason": "Changed my mind"
                 *     }
                 */
                "application/json": components["schemas"]["CancelOrder"];
            };
        };
        responses: {
            /** @description Successful response. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CancelOrderResponse"];
                };
            };
            /** @description Bad Request. Codes: `INVALID_PARAMETER`, `VALIDATION_FAILED`, `INVALID_REQUEST_BODY`, `COMMERCE_RESERVED_CANCEL_REASON`. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 400;
                        /** @enum {string} */
                        code?: "INVALID_PARAMETER" | "VALIDATION_FAILED" | "INVALID_REQUEST_BODY" | "COMMERCE_RESERVED_CANCEL_REASON";
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
            /** @description Conflict. Codes: `COMMERCE_ORDER_NOT_CANCELLABLE`, `COMMERCE_ILLEGAL_TRANSITION`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 409;
                        /** @enum {string} */
                        code?: "COMMERCE_ORDER_NOT_CANCELLABLE" | "COMMERCE_ILLEGAL_TRANSITION";
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
    createGuestCart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Guest cart created. */
            201: {
                headers: {
                    /** @description no-store */
                    "Cache-Control"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GuestCartEnvelope"];
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED";
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION";
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
    mergeGuestCart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MergeGuestCart"];
            };
        };
        responses: {
            /** @description Merged buyer cart. Nonblocking issues identify retained lines requiring correction and quantity caps. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GetOwnCartResponse"];
                };
            };
            /** @description Invalid JSON, blank/missing token or token longer than 255 characters. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
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
            /** @description Forbidden. Codes: `FORBIDDEN`, `COMMERCE_GUEST_CART_DISABLED`, `COMMERCE_CART_MERGE_DISABLED`, `COMMERCE_FORBIDDEN`. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 403;
                        /** @enum {string} */
                        code?: "FORBIDDEN" | "COMMERCE_GUEST_CART_DISABLED" | "COMMERCE_CART_MERGE_DISABLED" | "COMMERCE_FORBIDDEN";
                    };
                };
            };
            /** @description Not Found. Codes: `COMMERCE_GUEST_CART_NOT_FOUND`. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 404;
                        /** @enum {string} */
                        code?: "COMMERCE_GUEST_CART_NOT_FOUND";
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
            /** @description The request must use application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
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
            /** @description Internal Server Error. Codes: `INTERNAL_ERROR`, `COMMERCE_DB_ERROR`, `COMMERCE_INVALID_GUEST_CONFIGURATION`, `COMMERCE_INVALID_CONFIGURATION`, `COMMERCE_INVALID_PRICING_CONFIGURATION`. */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"] & {
                        /** @enum {integer} */
                        status?: 500;
                        /** @enum {string} */
                        code?: "INTERNAL_ERROR" | "COMMERCE_DB_ERROR" | "COMMERCE_INVALID_GUEST_CONFIGURATION" | "COMMERCE_INVALID_CONFIGURATION" | "COMMERCE_INVALID_PRICING_CONFIGURATION";
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
}
