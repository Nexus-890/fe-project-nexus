/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/api/v1/shipments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List shipments with pagination
         * @description Requires SHIPPING.VIEW_SHIPMENT. ADMIN and SUPPORT_STAFF read every shipment; other actors read only shipments whose buyerId equals the JWT sub. Ownership and filters are applied before pagination and counting, so the total does not reveal other users' shipments. Sorted by createdAt descending, then id. A page past the end returns 200 with data=[] and the real total. Clients have no buyerId filter.
         */
        get: operations["listShipments"];
        put?: never;
        /**
         * Create a shipment manually from a paid order snapshot
         * @description Requires SHIPPING.CREATE_SHIPMENT and one of the roles ADMIN or SUPPORT_STAFF. A buyer with the create privilege but no operations role is still rejected with 403. buyerId, shippingFee and shippingInfo come from the paid order; these fields are not accepted from the client and commerce_db is not read. When no shipment exists, GET /internal/v1/orders/{id}/shipping-snapshot on commerce is called directly with the caller's bearer token, with a timeout and a circuit breaker. Only a PAID order with a valid snapshot is created. A missing order returns 404 SHIPMENT_ORDER_NOT_FOUND; an order that is not PAID returns 409 SHIPMENT_ORDER_NOT_PAID; an unavailable upstream returns 503 SHIPMENT_COMMERCE_UNAVAILABLE; an invalid snapshot returns 502 SHIPMENT_INVALID_ORDER_SNAPSHOT. The optional warehouseId, carrier and serviceType choose the dispatch for a new shipment. The warehouse and pickup must come from a trusted source; an old pickup is never used for another warehouse. An empty carrier uses SHIPPING_BOOKING_CARRIER (falling back to SHIPPING_CARRIER when it is not configured), independent of the quoting carrier stored in the snapshot. The other choices use the trusted snapshot or the shipping configuration. When the shipment already exists, any value sent must match the stored choice; an existing carrier/service/warehouse is not replaced once a request identity exists. An empty service for GHN/FAKE is derived from the final parcel; an empty pickup is filled only from the configuration of the same warehouse. A choice that differs from the stored one returns 409 SHIPMENT_IDEMPOTENCY_CONFLICT. An OrderCancelled that arrives before the shipment is stored as a durable tombstone; a later manual create returns 409 SHIPMENT_ORDER_NOT_PAID, and a late OrderPaid does not create or book a shipment for the cancelled order. Each order has one shipment. The same Idempotency-Key with the same request returns the created shipment; reusing the key for another request, or a choice that conflicts with the existing shipment, returns 409. The first key is stored on the shipment with a fingerprint of the request body; a different key for a shipment that already has one also returns 409 SHIPMENT_IDEMPOTENCY_CONFLICT. A successful response is always 201 with the shipment's Location. A temporary carrier error or missing preparation data keeps the shipment PENDING_TRACKING with trackingCode=null; the retry job uses shipment.id as a stable request identity. The manual transaction writes shipment/history/outbox before calling the carrier; the OrderPaid consumer also writes its processed marker in the same transaction. Both creation paths use the same order lock and the unique order_id, so concurrent runs still produce one shipment and one creation event. ShipmentCreated records the PENDING_TRACKING creation with trackingCode=null; GET reflects tracking added later and no further ShipmentCreated is written. SHIPPING_BOOKING_CARRIER=NONE keeps the shipment PENDING_TRACKING with trackingCode=null and schedules no booking. A GHN quote with FAKE booking creates a FAKE- tracking code and keeps shippingFee from the paid snapshot. GHN booking uses the sandbox only, uses shipment.id as client_order_code and reconciles that code before a retry so a timeout does not create a duplicate order. TO_ADDRESS_CONFLICT is retried once with the ward and province; the shipment history records the fallback address. expected_delivery_time is stored when GHN returns it. On creation and on retry, GHN/FAKE can fill an empty serviceType from the final parcel and an empty pickupAddress from the configuration of the same warehouse. The default pickup is used only when the warehouse matches default-warehouse-id. The request identity and stored choices are never replaced, and parcel, recipient and locality codes are never invented; a missing parcel, valid recipient address or trusted pickup configuration keeps PENDING_TRACKING.
         */
        post: operations["createShipment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get shipment details
         * @description Requires SHIPPING.VIEW_SHIPMENT. ADMIN and SUPPORT_STAFF read every shipment; other actors read only shipments whose buyerId equals the JWT sub. A missing shipment and one owned by another buyer both return the same 404 SHIPMENT_NOT_FOUND. Commerce is not called to decide ownership.
         */
        get: operations["getShipment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipments/{id}/tracking": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get shipment tracking and status history
         * @description Requires SHIPPING.VIEW_SHIPMENT. ADMIN and SUPPORT_STAFF read every shipment; other actors read only shipments whose buyerId equals the JWT sub. A missing shipment and one owned by another buyer both return the same 404 SHIPMENT_NOT_FOUND. Ownership is checked before the history is read. Only the stored shipment and shipment_history are read; the carrier is not called and no fake events are created. history is ordered by createdAt ascending, then id; history=[] is valid for a shipment without history. trackingCode=null until one is assigned. To find an order's shipment, use GET /api/v1/shipments?orderId={orderId}; data=[] means there is no shipment yet and the UI can hide the tracking block.
         */
        get: operations["getShipmentTracking"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carriers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List carriers
         * @description Requires a valid JWT and SHIPPING.QUOTE; ADMIN does not bypass this privilege. Reads the metadata and circuit breaker state of the selected quoting adapter; the carrier is not probed and the database is not read or written. SHIPPING_QUOTE_CARRIER selects this adapter, falling back to SHIPPING_CARRIER when it is not configured. A carrier used only for booking is not listed. isDefault marks the default quoting adapter. available reflects the current breaker state: false when OPEN/FORCED_OPEN, true when CLOSED/HALF_OPEN or when there is no breaker. HALF_OPEN allows a trial call under the breaker policy; available reserves nothing and does not guarantee that GHN is up. GHN quotes with SHIPPING_QUOTE_CARRIER=GHN; FAKE is enabled explicitly for local/test only; quote carrier NONE returns an empty list even when SHIPPING_BOOKING_CARRIER is set. A GHN quote with FAKE booking lists only GHN. There is no automatic switch to FAKE when GHN fails. The whole list is returned in one logical page.
         */
        get: operations["getCarriers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/carriers/performance": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Measure the performance of each carrier
         * @description Requires SHIPPING.VIEW_SHIPMENT and the role ADMIN or SUPPORT_STAFF. Groups the shipments created in [from, to), at most 366 days, by carrier. delivered counts shipments now DELIVERED; failed counts DELIVERY_FAILED, RETURNING or RETURNED; cancelled counts CANCELLED; inProgress is the rest. successRate = delivered / (delivered + failed), null when no shipment has finished. averageDeliveryHours runs from handover (handed_over_at, or created_at when no handover was recorded) to the first DELIVERED history row. onTimeRate is the share of DELIVERED shipments delivered no later than estimated_delivery_at, among shipments that have an estimate. A configured carrier with no shipments still appears with zeros. Sorted by shipment count descending, then carrier code. The whole list is returned in one logical page.
         */
        get: operations["getCarrierPerformance"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipping/provinces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List provinces and cities from the new catalog
         * @description Reads /shiip/public-api/v3/master-data/province/all; parent_id=1 marks provinces and cities in Vietnam. No JWT is required at the gateway or shipment-service; a token that is sent but invalid is still rejected. Data is read through the CarrierAdapter from the two-level GHN v3 catalog after the administrative merger: province/city → ward/commune. Only records with status=1 and the right parent_id are returned. The code is the v3 catalog _id as a canonical positive integer string of at most 9 digits, without leading zeros. FAKE mode uses its own fixture. The whole list is returned in one logical page; there are no pagination parameters. Carrier credentials are used only in the backend. The valid catalog is cached in shipment-service for GHN_MASTER_DATA_CACHE_TTL_MS, 300000ms by default. Only validated, active results are cached; after the TTL the list is reloaded, errors are not cached and an expired copy is never reused.
         */
        get: operations["getShippingProvinces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipping/wards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the wards of a province or city
         * @description Reads /shiip/public-api/v3/master-data/ward/all-by-province-id; returns only wards whose parent_id equals provinceCode. The canonical locality name is used as is in quotes. No JWT is required at the gateway or shipment-service; a token that is sent but invalid is still rejected. Data is read through the CarrierAdapter from the two-level GHN v3 catalog after the administrative merger: province/city → ward/commune. Only records with status=1 and the right parent_id are returned. The code is the v3 catalog _id as a canonical positive integer string of at most 9 digits, without leading zeros. FAKE mode uses its own fixture. The whole list is returned in one logical page; there are no pagination parameters. Carrier credentials are used only in the backend. The valid catalog is cached per provinceCode for GHN_MASTER_DATA_CACHE_TTL_MS, 300000ms by default. After the TTL the list is reloaded; errors are not cached and there is no fallback to an expired list.
         */
        get: operations["getShippingWards"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipping/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Shipping quotes and estimated delivery dates
         * @description Requires a valid JWT and SHIPPING.QUOTE; ADMIN does not bypass the privilege. The delivery and pickup addresses use two-level GHN v3 _id codes and are checked as an active province → ward. Canonical names are resolved from the v3 catalog, then POST /shiip/public-api/v2/shipping-order/preview is sent with is_new_to_address=true and is_new_from_address=true; GHN publishes the preview endpoint under the v2 path, but it supports the new address model. The recipient needs a real name, phone number and address; the pickup needs a verified street address. Preview is a dry run and creates no order: order_code must be empty; the fee comes from total_fee and the ETA from expected_delivery_time. GHN_PAYMENT_TYPE_ID sets who pays the fee, default 1 meaning the shop pays in the SEPAY prepaid flow; GHN_REQUIRED_NOTE sets the inspection policy, default KHONGCHOXEMHANG. cod_amount is sent as 0 because the current flow collects no cash on delivery. A sender name and phone that are not sent follow the ShopId profile published by GHN. Items give the unit count and the SKU count for the content summary; parcel is one packed parcel. When GHN needs items per parcel, quantity=1 is the parcel count, not the SKU unit count. When SHIPPING_CHECKOUT_CARRIERS is set (for example FAKE), each enabled carrier (the quote carrier first, then the listed carriers) is quoted separately; a failing carrier is skipped, and an error is returned only when every carrier fails. The list is sorted by SHIPPING_CARRIER_STRATEGY (CHEAPEST: fee then delivery date; FASTEST: delivery date then fee) and the first item has recommended=true. Without this variable only the quote carrier answers. InsuranceValue is the optional declared insurance value: whole VND from 0 to 5,000,000; empty or null sends 0; the subtotal is never used in its place and the value is never capped or rounded. WarehouseId maps to a configured pickup; empty uses defaultWarehouseId for WH_001. The free-shipping subtotal is the current SKU price times quantity from the catalog, independent of insuranceValue. A subtotal greater than or equal to FREE_SHIPPING_THRESHOLD gives fee=0 once the preview and ETA are valid, unless applyFreeShipping=false. This optional flag defaults to true when empty or null. Commerce sends false for auction orders to get the raw carrier fee, then applies free shipping on the fixed winning bid; the request cannot supply a replacement price or subtotal. SHIPPING_API_TIMEOUT_MS is the budget for the whole operation, including lookups and retries. SHIPPING_RETRY_LIMIT is the maximum number of retries after the first attempt, for transient errors only. Each GHN HTTP attempt uses min(GHN_HTTP_TIMEOUT_MS, remaining deadline), with GHN_HTTP_TIMEOUT_MS 1500ms by default; the total deadline is not split by the retry count and every retry is not guaranteed to run. The valid province/ward catalog is cached for 5 minutes by default; the preview fee, ETA and catalog prices are not cached. The per-carrier breaker fails fast with 503 when open. No order, reservation or shipment data is created and there is no fallback to FAKE.
         */
        post: operations["getShippingQuotes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipments/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get shipment status history
         * @description Requires SHIPPING.VIEW_SHIPMENT. ADMIN/SUPPORT_STAFF read every shipment; other actors read only shipments whose buyerId equals sub, or the SELLER role with a trusted sellerId equal to sub. Without ownership the response is 404 SHIPMENT_NOT_FOUND. The stored history is read; the carrier is not called per request. Sorted by changedAt descending, then id descending. A page past the end returns 200, data=[] and the real total.
         */
        get: operations["getShipmentHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/shipments/{id}/status": {
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
         * Update shipment status
         * @description Requires the matching privilege and one of the roles ADMIN or SUPPORT_STAFF. Every update source uses the same transition rules and shipment lock. Skipping steps forward is allowed; DELIVERY_FAILED can go back to OUT_FOR_DELIVERY for another attempt. DELIVERED, CANCELLED and RETURNED are terminal; even an override cannot move DELIVERED -> IN_TRANSIT. The same status is a no-op that returns 200 and adds no history or event. Each accepted change writes status/version, exactly one history row and one Shipment* outbox event in the same transaction; the event is published to nexus.shipment.events. The actor comes from the JWT, source=MANUAL; reason is normalized for audit. reason is optional. When the target is CANCELLED before pickup, the booking is cancelled through the CarrierAdapter before the status is committed; if the carrier rejects it or fails, no local cancellation is written. Without a trackingCode, a manual change can only keep the status or move to CANCELLED. Every other manual change returns 409 SHIPMENT_INVALID_TRANSITION so the PENDING_TRACKING booking retry flow stays intact.
         */
        patch: operations["updateShipmentStatus"];
        trace?: never;
    };
    "/api/v1/shipments/{id}/override": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Adjust shipment status with a reason
         * @description Requires the matching privilege and one of the roles ADMIN or SUPPORT_STAFF. Every update source uses the same transition rules and shipment lock. Skipping steps forward is allowed; DELIVERY_FAILED can go back to OUT_FOR_DELIVERY for another attempt. DELIVERED, CANCELLED and RETURNED are terminal; even an override cannot move DELIVERED -> IN_TRANSIT. The same status is a no-op that returns 200 and adds no history or event. Each accepted change writes status/version, exactly one history row and one Shipment* outbox event in the same transaction; the event is published to nexus.shipment.events. The actor comes from the JWT, source=MANUAL; reason is normalized for audit. An override requires a non-blank reason; it is an audited adjustment that still follows the transition rules. When the target is CANCELLED before pickup, the booking is cancelled through the CarrierAdapter before the status is committed; if the carrier rejects it or fails, no local cancellation is written. Without a trackingCode, a manual change can only keep the status or move to CANCELLED. Every other manual change returns 409 SHIPMENT_INVALID_TRANSITION so the PENDING_TRACKING booking retry flow stays intact.
         */
        post: operations["overrideShipmentStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/webhooks/carriers/{carrier}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Receive a carrier status callback
         * @description A carrier protocol endpoint marked @ProtocolResponse; HTTP 200 keeps its own acknowledgement body and is not wrapped in ApiResponse. GHN supports a custom header in its portal; set X-Carrier-Signature to the adapter's callback secret. The value is compared in constant time before the payload is parsed and before any write. This is a callback token sent in a header, not a claim that GHN signs the body with an HMAC. A missing or wrong token, or a secret that is not configured, returns 401 Problem Details and changes nothing. A duplicate webhook is accepted with 200 without repeating history or events; an older event never reverses the status. GHN OrderCode identifies the shipment by carrier/trackingCode; the callback identity is a stable hash of OrderCode, Type, Status and Time. The same status is a no-op. Each valid change writes exactly one history row and one Shipment* outbox event. GHN uses GHN_WEBHOOK_SECRET. Fake uses FAKE_WEBHOOK_SECRET with the same callback shape, but needs no ShopID and its Status is the internal enum. Status is part of the identity so two different statuses with the same timestamp stay distinct; a change to Reason or to the JSON formatting does not create a new identity.
         */
        post: operations["receiveCarrierWebhook"];
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
        FakeStatusWebhook: {
            OrderCode: string;
            /**
             * @description GHN callback type.
             * @enum {string}
             */
            Type: "create" | "switch_status" | "update_weight" | "update_cod" | "update_fee" | "update_payment_type" | "cod" | "update_partial_return";
            Status: components["schemas"]["ShipmentStatus"];
            /** Format: date-time */
            Time: string;
            Reason?: string | null;
            Description?: string | null;
        } & {
            [key: string]: unknown;
        };
        UpdateShipmentStatusRequest: {
            status: components["schemas"]["ShipmentStatus"];
            /** @description Reason, normalized and stored with the history. */
            reason?: string | null;
        };
        OverrideShipmentStatusRequest: {
            status: components["schemas"]["ShipmentStatus"];
            /** @description Required reason; a whitespace-only string is invalid. */
            reason: string;
        };
        ShipmentTrackingEntryResponse: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["ShipmentStatus"];
            description: string | null;
            /** @enum {string} */
            source: "SYSTEM" | "CARRIER_WEBHOOK" | "POLLER" | "MANUAL";
            carrierEventId: string | null;
            /** Format: uuid */
            changedBy: string | null;
            /** Format: date-time */
            changedAt: string;
        };
        ShipmentTrackingListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ShipmentTrackingEntryResponse"][];
            page: components["schemas"]["ShipmentPageInfo"];
        };
        GhnStatusWebhook: {
            /** @description GHN shop that sends the callback; must match the shopId configured in the adapter. */
            ShopID: number;
            OrderCode: string;
            /**
             * @description GHN callback type.
             * @enum {string}
             */
            Type: "create" | "switch_status" | "update_weight" | "update_cod" | "update_fee" | "update_payment_type" | "cod" | "update_partial_return";
            /** @description GHN status, mapped to exactly one internal ShipmentStatus. */
            Status: string;
            /** Format: date-time */
            Time: string;
            /** @description Carrier reason, if any; normalized before it is stored. */
            Reason?: string | null;
            /** @description Carrier description when there is no Reason; normalized before it is stored. */
            Description?: string | null;
        } & {
            [key: string]: unknown;
        };
        CarrierWebhookAcknowledgement: {
            /** @enum {integer} */
            code: 200;
            /** @enum {string} */
            message: "Success";
        };
        CreateShipmentRequest: {
            /**
             * Format: uuid
             * @description UUID of a seller order that is PAID in commerce; OrderPaid does not need to have reached shipment-service.
             */
            orderId: string;
            /**
             * Format: uuid
             * @description Chooses the warehouse for a new shipment. Empty uses the trusted warehouse in the snapshot or the configured default warehouse. Switching to another warehouse needs a trusted pickup configured for it; a missing warehouse or pickup returns 404 SHIPMENT_WAREHOUSE_NOT_FOUND. If the shipment already exists, the value sent must match the stored warehouse, otherwise 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
             */
            warehouseId?: string | null;
            /**
             * @description Chooses a registered carrier for a new shipment; empty uses the choice from the snapshot or the shipping configuration. An unregistered carrier returns 400 SHIPMENT_INVALID_PARAMETER. If the shipment already exists, the value sent must equal the stored carrier; a different choice returns 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
             * @example FAKE
             */
            carrier?: string | null;
            /**
             * @description Chooses a valid service for a new shipment; empty uses the trusted choice or the adapter default. An unsupported service returns 422 SHIPMENT_NO_SERVICE. If the shipment already exists, the value sent must match the stored choice; a different choice returns 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
             * @example STANDARD
             */
            serviceType?: string | null;
        };
        /** @enum {string} */
        ShipmentStatus: "CREATED" | "PENDING_TRACKING" | "PICKING" | "PACKED" | "READY_TO_SHIP" | "SHIPPED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNING" | "RETURNED" | "CANCELLED";
        ShipmentResponse: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            warehouseId: string;
            /** Format: uuid */
            buyerId: string;
            carrier: string;
            serviceType: string | null;
            /** @description Null until the carrier assigns a code; fake assigns a stable code from the stored shipment.id. */
            trackingCode: string | null;
            status: components["schemas"]["ShipmentStatus"];
            /** @description VND fee frozen from the OrderPaid snapshot or the commerce PAID snapshot; serialized as a JSON number. */
            shippingFee: number;
            /** @description Snapshot of recipient, items, parcel and pickupAddress from OrderPaid or the commerce PAID snapshot. It is the order's snapshot, independent of the #201 quote DTO; legacy codes are not converted to GHN v3 codes. Parcel can be null; a missing parcel or valid recipient address keeps waiting for preparation in PENDING_TRACKING. An empty PickupAddress can be filled from the configuration of the same warehouse on creation or retry; the default pickup is used only for default-warehouse-id. GHN/FAKE derive an empty serviceType from the final parcel; parcel and recipient data are never invented and stored dispatch choices are never replaced. */
            shippingInfo: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: int64 */
            version: number;
        };
        ShipmentHistoryResponse: {
            /** Format: uuid */
            id: string;
            status: components["schemas"]["ShipmentStatus"];
            description: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        ShipmentTrackingResponse: {
            /** Format: uuid */
            shipmentId: string;
            /** Format: uuid */
            orderId: string;
            carrier: string;
            trackingCode: string | null;
            status: components["schemas"]["ShipmentStatus"];
            /** @description Stored statuses by createdAt ascending, then id; no fake entries when empty. */
            history: components["schemas"]["ShipmentHistoryResponse"][];
        };
        ShipmentTrackingEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ShipmentTrackingResponse"];
        };
        ShipmentEnvelope: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ShipmentResponse"];
        };
        ShipmentListResponse: {
            /** @default 0 */
            code: number;
            /** @default response success */
            message: string;
            data: components["schemas"]["ShipmentResponse"][];
            page: components["schemas"]["ShipmentPageInfo"];
        };
        ShipmentPageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        CarrierListResponse: {
            /**
             * @default 0
             * @enum {integer}
             */
            code: 0;
            /** @default response success */
            message: string;
            data: components["schemas"]["CarrierResponse"][];
            page: components["schemas"]["PageInfo"];
        };
        CarrierPerformance: {
            /** @example GHN */
            carrier: string;
            /** @example Giao Hàng Nhanh */
            name: string;
            /** Format: int64 */
            shipments: number;
            /** Format: int64 */
            delivered: number;
            /** Format: int64 */
            failed: number;
            /** Format: int64 */
            inProgress: number;
            /** Format: int64 */
            cancelled: number;
            /**
             * @description Fraction 0..1, 4 decimal places
             * @example 0.9231
             */
            successRate: number | null;
            /**
             * @description Average hours, 1 decimal place
             * @example 52.4
             */
            averageDeliveryHours: number | null;
            /** @example 0.875 */
            onTimeRate: number | null;
        };
        CarrierPerformanceListResponse: {
            /**
             * @default 0
             * @enum {integer}
             */
            code: 0;
            /** @default response success */
            message: string;
            data: components["schemas"]["CarrierPerformance"][];
            page: components["schemas"]["PageInfo"];
        };
        LocalityListResponse: {
            /**
             * @default 0
             * @enum {integer}
             */
            code: 0;
            /** @default response success */
            message: string;
            data: components["schemas"]["LocalityResponse"][];
            page: components["schemas"]["PageInfo"];
        };
        ShippingQuoteListResponse: {
            /**
             * @default 0
             * @enum {integer}
             */
            code: 0;
            /** @default response success */
            message: string;
            data: components["schemas"]["ShippingQuoteResponse"][];
            page: components["schemas"]["PageInfo"];
        };
        CarrierResponse: {
            /** @enum {string} */
            code: "GHN" | "FAKE";
            name: string;
            /** @description Default adapter chosen by the registry. */
            isDefault: boolean;
            /** @description Whether the circuit breaker allows a trial call; false when OPEN/FORCED_OPEN. No network probe is made and GHN's health at read time is not guaranteed. */
            available: boolean;
        };
        LocalityResponse: {
            /**
             * @description The two-level GHN v3 catalog _id as a canonical positive integer string; the legacy ProvinceID/WardCode is not used.
             * @example 1003646
             */
            code: string;
            name: string;
        };
        /**
         * @description STANDARD for parcels under 20,000 grams, mapped to GHN service_type_id=2. HEAVY for parcels from 20,000 grams, mapped to GHN service_type_id=5. Fake uses the same threshold. GHN's numeric IDs are used only inside the adapter.
         * @example STANDARD
         * @enum {string}
         */
        ShippingServiceType: "STANDARD" | "HEAVY";
        ShippingQuoteResponse: {
            /** @enum {string} */
            carrier: "GHN" | "FAKE";
            serviceType: components["schemas"]["ShippingServiceType"];
            /**
             * @description Fee the customer pays after FREE_SHIPPING_THRESHOLD, in VND.
             * @example 35000
             */
            fee: number;
            /**
             * Format: date-time
             * @description Estimated delivery time with a time zone, from expected_delivery_time of a valid preview.
             * @example 2026-11-13T16:59:59Z
             */
            estimatedDeliveryAt: string;
            /**
             * @description Display name of the carrier.
             * @example Giao Hàng Nhanh
             */
            carrierName?: string;
            /** @description true for the first option under SHIPPING_CARRIER_STRATEGY. */
            recommended?: boolean;
        };
        ShippingQuoteRequest: {
            toAddress: components["schemas"]["ShippingAddressRequest"];
            items: components["schemas"]["ShippingItemRequest"][];
            parcel: components["schemas"]["ParcelRequest"];
            /**
             * Format: uuid
             * @description UUID of a warehouse with a configured pickup mapping; empty or null uses the default warehouse.
             */
            warehouseId?: string | null;
            /** @description Pickup address of the seller's own warehouse, which Commerce reads from Inventory. When set, it replaces the warehouseId mapping and the platform pickup address; empty keeps the previous selection. */
            pickupAddress?: {
                provinceCode: string;
                wardCode: string;
                line1: string;
            } | null;
            /**
             * @description Declared insurance value in whole VND; empty or null sends 0. The subtotal is never used in its place, and the value is never capped or rounded. A negative, fractional or above 5,000,000 value returns 400 SHIPMENT_VALIDATION_FAILED.
             * @default 0
             * @example 200000
             */
            insuranceValue: number | null;
            /**
             * @description Empty, null or true keeps the free-shipping policy based on the Catalog subtotal. False returns the checked raw carrier fee; Commerce uses it for auction orders and then applies the threshold to the winning bid. This flag only drops the subsidy; it accepts no client-declared price or subtotal and does not skip the carrier/ETA checks.
             * @default true
             */
            applyFreeShipping: boolean | null;
        };
        ShippingAddressRequest: {
            /** @description Province/city _id in the GHN v3 catalog. */
            provinceCode: string;
            /** @description _id of an active ward that belongs to provinceCode in the GHN v3 catalog. */
            wardCode: string;
            /** @description Delivery address line; named line1 in the public request. */
            line1: string;
            recipientName: string;
            /**
             * @description Real recipient phone number; domestic numbers start with 0 or +84.
             * @example 0901234567
             */
            recipientPhone: string;
        };
        ShippingItemRequest: {
            /** Format: uuid */
            skuId: string;
            quantity: number;
        };
        ParcelRequest: {
            /** @description Packed parcel weight in grams. */
            weightGrams: number;
            /** @description Parcel length in cm. */
            lengthCm: number;
            /** @description Parcel width in cm. */
            widthCm: number;
            /** @description Parcel height in cm. */
            heightCm: number;
        };
        PageInfo: {
            /** @enum {integer} */
            number: 0;
            /** @description max(1, number of items). */
            size: number;
            /** Format: int64 */
            totalElements: number;
            /**
             * @description 0 when the list is empty, otherwise 1.
             * @enum {integer}
             */
            totalPages: 0 | 1;
        };
        Problem: {
            /** Format: uri */
            type: string;
            title: string;
            status: number;
            detail: string;
            /** Format: uri-reference */
            instance: string;
            /** @enum {string} */
            code: "SHIPMENT_INVALID_SIGNATURE" | "SHIPMENT_INVALID_TRANSITION" | "SHIPMENT_UNSUPPORTED_CARRIER" | "SHIPMENT_INVALID_WEBHOOK" | "SHIPMENT_CARRIER_CANCELLATION_REJECTED" | "SHIPMENT_INVALID_CARRIER_STATUS" | "SHIPMENT_INVALID_REQUEST" | "SHIPMENT_VALIDATION_FAILED" | "SHIPMENT_INVALID_REQUEST_BODY" | "SHIPMENT_INVALID_PARAMETER" | "SHIPMENT_IDEMPOTENCY_KEY_REQUIRED" | "SHIPMENT_IDEMPOTENCY_CONFLICT" | "SHIPMENT_ORDER_NOT_FOUND" | "SHIPMENT_ORDER_NOT_PAID" | "SHIPMENT_INVALID_ORDER_SNAPSHOT" | "SHIPMENT_COMMERCE_UNAVAILABLE" | "SHIPMENT_NOT_FOUND" | "SHIPMENT_INVALID_ADDRESS" | "SHIPMENT_UNAUTHENTICATED" | "UNAUTHENTICATED" | "SHIPMENT_FORBIDDEN" | "FORBIDDEN" | "SHIPMENT_WAREHOUSE_NOT_FOUND" | "SHIPMENT_SKU_NOT_FOUND" | "SHIPMENT_METHOD_NOT_ALLOWED" | "SHIPMENT_NOT_ACCEPTABLE" | "SHIPMENT_UNSUPPORTED_MEDIA_TYPE" | "SHIPMENT_NO_SERVICE" | "RATE_LIMITED" | "SHIPMENT_INTERNAL_ERROR" | "INTERNAL_ERROR" | "SHIPMENT_INVALID_CARRIER_RESPONSE" | "SHIPMENT_INVALID_CATALOG_RESPONSE" | "SHIPMENT_CARRIER_UNAVAILABLE" | "SHIPMENT_CIRCUIT_OPEN" | "SHIPMENT_CARRIER_CONFIGURATION_ERROR" | "SHIPMENT_CATALOG_UNAVAILABLE" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT";
            /** @description Present only when the request has an active trace. */
            traceId?: string;
            errors?: {
                field: string;
                code: string;
                detail: string;
            }[];
        };
    };
    responses: {
        /** @description Invalid transition, or the carrier rejected cancelling the booking before pickup. */
        ShipmentMutationConflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 409;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_TRANSITION" | "SHIPMENT_CARRIER_CANCELLATION_REJECTED";
                };
            };
        };
        /** @description The target status conflicts with the current transition rules. */
        InvalidShipmentTransition: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 409;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_TRANSITION";
                };
            };
        };
        /** @description Callback token missing or wrong, or the adapter has no secret configured; nothing is written. */
        InvalidCarrierSignature: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 401;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_SIGNATURE";
                };
            };
        };
        /** @description The carrier status is not in the internal mapping table. */
        InvalidCarrierStatus: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 422;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_CARRIER_STATUS";
                };
            };
        };
        /** @description Unregistered carrier or invalid callback body. */
        CarrierWebhookBadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 400;
                    /** @enum {string} */
                    code?: "SHIPMENT_UNSUPPORTED_CARRIER" | "SHIPMENT_INVALID_WEBHOOK" | "SHIPMENT_INVALID_REQUEST_BODY" | "SHIPMENT_INVALID_PARAMETER";
                };
            };
        };
        /** @description Invalid idempotency key, body, UUID/enum, unregistered carrier or pagination. */
        ShipmentBadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 400;
                    /** @enum {string} */
                    code?: "SHIPMENT_IDEMPOTENCY_KEY_REQUIRED" | "SHIPMENT_VALIDATION_FAILED" | "SHIPMENT_INVALID_REQUEST_BODY" | "SHIPMENT_INVALID_PARAMETER";
                };
            };
        };
        /** @description The order does not exist in commerce, or the chosen warehouse/pickup is not configured. */
        ManualOrderNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Not Found",
                 *       "status": 404,
                 *       "detail": "Order not found",
                 *       "instance": "/api/v1/shipments",
                 *       "code": "SHIPMENT_ORDER_NOT_FOUND"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 404;
                    /** @enum {string} */
                    code?: "SHIPMENT_ORDER_NOT_FOUND" | "SHIPMENT_WAREHOUSE_NOT_FOUND";
                };
            };
        };
        /** @description Commerce returned a missing, invalid or mismatched snapshot for orderId; no shipment is written. */
        InvalidOrderSnapshot: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Bad Gateway",
                 *       "status": 502,
                 *       "detail": "Invalid order snapshot",
                 *       "instance": "/api/v1/shipments",
                 *       "code": "SHIPMENT_INVALID_ORDER_SNAPSHOT"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 502;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_ORDER_SNAPSHOT";
                };
            };
        };
        /** @description Commerce timeout, open circuit, connection error or another upstream error; gateway routing can also return SERVICE_UNAVAILABLE. */
        CommerceUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Service Unavailable",
                 *       "status": 503,
                 *       "detail": "The order service is unavailable",
                 *       "instance": "/api/v1/shipments",
                 *       "code": "SHIPMENT_COMMERCE_UNAVAILABLE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 503;
                    /** @enum {string} */
                    code?: "SHIPMENT_COMMERCE_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
                };
            };
        };
        /** @description The idempotency key was used for another request, the shipment already has another key, a choice differs from the existing shipment, or commerce confirms the order is not PAID. A shipment is never created from buyer or address data the client declares. */
        ShipmentConflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 409;
                    /** @enum {string} */
                    code?: "SHIPMENT_IDEMPOTENCY_CONFLICT" | "SHIPMENT_ORDER_NOT_PAID";
                };
            };
        };
        /** @description The shipment does not exist or does not belong to the current buyer. */
        ShipmentNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Not Found",
                 *       "status": 404,
                 *       "detail": "The requested resource was not found",
                 *       "instance": "/api/v1/shipments/00000000-0000-4000-8000-000000000040",
                 *       "code": "SHIPMENT_NOT_FOUND"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 404;
                    /** @enum {string} */
                    code?: "SHIPMENT_NOT_FOUND";
                };
            };
        };
        /** @description Invalid data, address, locality code or JSON structure. Each failing field has field, code and detail. */
        InvalidRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 400;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_REQUEST" | "SHIPMENT_VALIDATION_FAILED" | "SHIPMENT_INVALID_REQUEST_BODY" | "SHIPMENT_INVALID_PARAMETER" | "SHIPMENT_INVALID_ADDRESS" | "SHIPMENT_PICKUP_ADDRESS_CONFLICT" | "SHIPMENT_INVALID_PERIOD";
                };
            };
        };
        /** @description The JWT is missing or invalid; a public endpoint returns 401 only when an invalid token is sent. The service uses SHIPMENT_UNAUTHENTICATED; the gateway can return UNAUTHENTICATED. */
        Unauthenticated: {
            headers: {
                /** @description Requires a valid bearer token. */
                "WWW-Authenticate"?: "Bearer";
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 401;
                    /** @enum {string} */
                    code?: "SHIPMENT_UNAUTHENTICATED" | "UNAUTHENTICATED";
                };
            };
        };
        /** @description The JWT lacks the privilege the operation requires; the ADMIN role does not replace it. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 403;
                    /** @enum {string} */
                    code?: "SHIPMENT_FORBIDDEN" | "FORBIDDEN";
                };
            };
        };
        /** @description WarehouseId is not in the pickup configuration, or the SKU does not exist. */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 404;
                    /** @enum {string} */
                    code?: "SHIPMENT_WAREHOUSE_NOT_FOUND" | "SHIPMENT_SKU_NOT_FOUND";
                };
            };
        };
        /** @description HTTP method not supported on this path. */
        MethodNotAllowed: {
            headers: {
                /** @description Supported methods. */
                Allow?: string;
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 405;
                    /** @enum {string} */
                    code?: "SHIPMENT_METHOD_NOT_ALLOWED";
                };
            };
        };
        /** @description The response cannot be returned in the requested Accept format. */
        NotAcceptable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 406;
                    /** @enum {string} */
                    code?: "SHIPMENT_NOT_ACCEPTABLE";
                };
            };
        };
        /** @description The POST body is not in a supported JSON format. */
        UnsupportedMediaType: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 415;
                    /** @enum {string} */
                    code?: "SHIPMENT_UNSUPPORTED_MEDIA_TYPE";
                };
            };
        };
        /** @description The carrier offers no suitable service for the route or parcel. */
        NoService: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 422;
                    /** @enum {string} */
                    code?: "SHIPMENT_NO_SERVICE";
                };
            };
        };
        /** @description The gateway rate limits requests; keeps Retry-After when present. */
        RateLimited: {
            headers: {
                /** @description Wait time when the gateway provides it. */
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
        /** @description Unexpected processing error; no stack trace or secrets are returned. */
        InternalError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 500;
                    /** @enum {string} */
                    code?: "SHIPMENT_INTERNAL_ERROR" | "INTERNAL_ERROR";
                };
            };
        };
        /** @description The carrier or catalog returned invalid data, a missing fee/ETA or a wrong envelope. */
        BadUpstream: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 502;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_CARRIER_RESPONSE" | "SHIPMENT_INVALID_CATALOG_RESPONSE";
                };
            };
        };
        /** @description The carrier returned an invalid locality list or a wrong envelope. */
        CarrierBadUpstream: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 502;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_CARRIER_RESPONSE";
                };
            };
        };
        /** @description The gateway has not found or cannot reach shipment-service. */
        RoutingUnavailable: {
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
        /** @description The carrier is unavailable, the deadline passed, the breaker is open, or the carrier configuration is missing or wrong. The gateway can return SERVICE_UNAVAILABLE before reaching the service. */
        CarrierUnavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 503;
                    /** @enum {string} */
                    code?: "SHIPMENT_CARRIER_UNAVAILABLE" | "SHIPMENT_CIRCUIT_OPEN" | "SHIPMENT_CARRIER_CONFIGURATION_ERROR" | "SERVICE_UNAVAILABLE";
                };
            };
        };
        /** @description The carrier or catalog is unavailable, the deadline passed, the breaker is open, or the carrier configuration is missing or wrong. The gateway can return SERVICE_UNAVAILABLE before reaching the service. */
        Unavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 503;
                    /** @enum {string} */
                    code?: "SHIPMENT_CARRIER_UNAVAILABLE" | "SHIPMENT_CIRCUIT_OPEN" | "SHIPMENT_CARRIER_CONFIGURATION_ERROR" | "SHIPMENT_CATALOG_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
                };
            };
        };
        /** @description The gateway got no response from the service in time. */
        GatewayTimeout: {
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
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listShipments: {
        parameters: {
            query?: {
                /** @description Page index starting at 0. */
                page?: number;
                /** @description Maximum items per page. */
                size?: number;
                /** @description Filter by order UUID; ownership still applies. */
                orderId?: string;
                /** @description Filter by internal shipment status. */
                status?: components["schemas"]["ShipmentStatus"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Visible shipments and pagination details. */
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
                    "application/json": components["schemas"]["ShipmentListResponse"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    createShipment: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Stable key for the same create request; do not reuse it for a different body.
                 * @example manual-order-0001
                 */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "orderId": "00000000-0000-4000-8000-000000000001"
                 *     }
                 */
                "application/json": components["schemas"]["CreateShipmentRequest"];
            };
        };
        responses: {
            /** @description The new shipment, or the result of an idempotent request that was already processed. */
            201: {
                headers: {
                    /**
                     * @description Path to read the created shipment.
                     * @example /api/v1/shipments/00000000-0000-4000-8000-000000000040
                     */
                    Location?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShipmentEnvelope"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ManualOrderNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            409: components["responses"]["ShipmentConflict"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["NoService"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["InvalidOrderSnapshot"];
            503: components["responses"]["CommerceUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getShipment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Shipment UUID, not the order UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The visible shipment. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShipmentEnvelope"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getShipmentTracking: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Shipment UUID, not the order UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Current tracking and status history over time. */
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
                     *         "shipmentId": "00000000-0000-4000-8000-000000000040",
                     *         "orderId": "00000000-0000-4000-8000-000000000001",
                     *         "carrier": "GHN",
                     *         "trackingCode": "GHN123456",
                     *         "status": "IN_TRANSIT",
                     *         "history": [
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000041",
                     *             "status": "SHIPPED",
                     *             "description": "Shipment handed to carrier",
                     *             "createdAt": "2026-11-12T08:00:00Z"
                     *           },
                     *           {
                     *             "id": "00000000-0000-4000-8000-000000000042",
                     *             "status": "IN_TRANSIT",
                     *             "description": null,
                     *             "createdAt": "2026-11-12T09:00:00Z"
                     *           }
                     *         ]
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ShipmentTrackingEnvelope"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getCarriers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Results and details of one logical page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CarrierListResponse"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getCarrierPerformance: {
        parameters: {
            query: {
                /** @description Start time, ISO-8601 with offset, inclusive */
                from: string;
                /** @description End time, ISO-8601 with offset, exclusive */
                to: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One row per carrier. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CarrierPerformanceListResponse"];
                };
            };
            400: components["responses"]["InvalidRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getShippingProvinces: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Results and details of one logical page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalityListResponse"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["CarrierBadUpstream"];
            503: components["responses"]["CarrierUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getShippingWards: {
        parameters: {
            query: {
                /**
                 * @description GHN v3 province/city _id; the three-level province code is not used.
                 * @example 1000001
                 */
                provinceCode: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Results and details of one logical page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalityListResponse"];
                };
            };
            /** @description provinceCode is missing, empty, malformed or unknown. data=null from GHN for an invalid province_id is also turned into a 400 locality error. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["CarrierBadUpstream"];
            503: components["responses"]["CarrierUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getShippingQuotes: {
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
                 *       "toAddress": {
                 *         "provinceCode": "1000001",
                 *         "wardCode": "1003646",
                 *         "line1": "Verified delivery address",
                 *         "recipientName": "Nguyễn Văn A",
                 *         "recipientPhone": "0901234567"
                 *       },
                 *       "items": [
                 *         {
                 *           "skuId": "11111111-1111-4111-8111-111111111111",
                 *           "quantity": 1
                 *         }
                 *       ],
                 *       "parcel": {
                 *         "weightGrams": 1200,
                 *         "lengthCm": 30,
                 *         "widthCm": 20,
                 *         "heightCm": 15
                 *       },
                 *       "warehouseId": "22222222-2222-4222-8222-222222222222",
                 *       "insuranceValue": 200000
                 *     }
                 */
                "application/json": components["schemas"]["ShippingQuoteRequest"];
            };
        };
        responses: {
            /** @description Results and details of one logical page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShippingQuoteListResponse"];
                };
            };
            400: components["responses"]["InvalidRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["NoService"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["BadUpstream"];
            503: components["responses"]["Unavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    getShipmentHistory: {
        parameters: {
            query?: {
                /** @description Page index starting at 0. */
                page?: number;
                /** @description Maximum history rows per page. */
                size?: number;
            };
            header?: never;
            path: {
                /** @description Shipment UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stored history and pagination details. */
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
                     *           "id": "00000000-0000-4000-8000-000000000041",
                     *           "status": "IN_TRANSIT",
                     *           "description": "Carrier confirmed the parcel is in transit",
                     *           "source": "CARRIER_WEBHOOK",
                     *           "carrierEventId": "GHN:GHN-12345:switch_status:2026-11-11T10:00:00Z",
                     *           "changedBy": "00000000-0000-0000-0000-000000000000",
                     *           "changedAt": "2026-11-11T10:00:00Z"
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
                    "application/json": components["schemas"]["ShipmentTrackingListResponse"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    updateShipmentStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Shipment UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "IN_TRANSIT",
                 *       "reason": "Checked with the carrier"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateShipmentStatusRequest"];
            };
        };
        responses: {
            /** @description The shipment after the change, or the no-op result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShipmentEnvelope"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            409: components["responses"]["ShipmentMutationConflict"];
            415: components["responses"]["UnsupportedMediaType"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["CarrierBadUpstream"];
            503: components["responses"]["CarrierUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    overrideShipmentStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Shipment UUID. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "IN_TRANSIT",
                 *       "reason": "Support confirmed the parcel is in transit"
                 *     }
                 */
                "application/json": components["schemas"]["OverrideShipmentStatusRequest"];
            };
        };
        responses: {
            /** @description The shipment after the change, or the no-op result. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ShipmentEnvelope"];
                };
            };
            400: components["responses"]["ShipmentBadRequest"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            409: components["responses"]["ShipmentMutationConflict"];
            415: components["responses"]["UnsupportedMediaType"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            502: components["responses"]["CarrierBadUpstream"];
            503: components["responses"]["CarrierUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
    receiveCarrierWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /**
                 * @description Carrier namespace; GHN sends OrderCode/Status/Type/Time callbacks.
                 * @example ghn
                 */
                carrier: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GhnStatusWebhook"] | components["schemas"]["FakeStatusWebhook"];
            };
        };
        responses: {
            /** @description Callback processed, same status, or a redelivery that was already received. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "code": 200,
                     *       "message": "Success"
                     *     }
                     */
                    "application/json": components["schemas"]["CarrierWebhookAcknowledgement"];
                };
            };
            400: components["responses"]["CarrierWebhookBadRequest"];
            401: components["responses"]["InvalidCarrierSignature"];
            404: components["responses"]["ShipmentNotFound"];
            405: components["responses"]["MethodNotAllowed"];
            406: components["responses"]["NotAcceptable"];
            409: components["responses"]["InvalidShipmentTransition"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["InvalidCarrierStatus"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
            503: components["responses"]["RoutingUnavailable"];
            504: components["responses"]["GatewayTimeout"];
        };
    };
}
