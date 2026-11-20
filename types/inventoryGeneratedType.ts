/** Generated from delivered OpenAPI. Run npm run generate:types; do not edit. */
export interface paths {
    "/internal/v1/inventory/reservations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the winner's linked auction hold
         * @description Internal service endpoint for Commerce shipping confirmation. Commerce relays the buyer's bearer token. Only the winning buyer can see the linked hold. Returns an empty data array before AuctionSettled links the order, for an unknown order, or when the buyer does not own it.
         */
        get: operations["getLinkedAuctionReservation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/v1/inventory/warehouses/pickup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read where carriers collect a seller's parcels
         * @description Internal service endpoint for Commerce shipping quotes and order creation. Commerce relays the buyer's bearer token. data is null when the seller has no warehouse, the warehouse is not ACTIVE, or it has no complete pickup (province, ward and a street address of at most 255 characters), or when skuIds is sent and none of those SKUs is stocked in the seller warehouse, or some are stocked in another seller's warehouse (the order is then held in a platform warehouse or refused, so the parcel does not leave from this pickup); Commerce then quotes from the platform pickup. When at least one SKU is stocked in the seller warehouse, the reservation gathers the other SKUs there, so this pickup is returned.
         */
        get: operations["getSellerPickup"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/{skuId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read how much of one SKU is available
         * @description Public, no token needed. Reads the default warehouse (nexus.inventory.default-warehouse-code). Returns skuId and available only, never total or reserved. A SKU with no balance row returns available 0, not 404.
         */
        get: operations["getAvailability"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read how much of several SKUs is available
         * @description Public, no token needed. Used by the cart page to read every line at once. All ids are read from the default warehouse in one query. The result keeps the request order, a repeated id appears once, and an id with no balance row reads as available 0. At most 100 ids per request.
         */
        get: operations["listAvailability"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/intake": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Receive stock into a warehouse
         * @description Raises total and available by the quantity in one statement and creates the balance row on the first intake of a SKU in that warehouse. Each seller has one warehouse (code SELLER- plus the seller id), created on the seller's first intake. A seller's intake always goes to that warehouse and cannot name another one. An admin intake without warehouseId goes to the warehouse of the SKU's seller; when catalog knows no seller, it goes to the warehouse already holding the SKU, else to the one whose code is nexus.inventory.default-warehouse-code. An explicit warehouseId that is not the SKU's warehouse, or a seller warehouse of a seller who does not own the SKU (also on the SKU's first intake), returns 409 INVENTORY_WAREHOUSE_NOT_SKU_HOME. When stock lands in a seller warehouse, available stock of the SKU still held in platform warehouses moves there with a pair of TRANSFER movements. Only ACTIVE warehouses accept intake: INACTIVE or MAINTENANCE returns 409 for both an explicit warehouseId and the configured default, without changing balances or writing a movement. The status check and writes share a transaction and coordinate with warehouse updates. The gateway only requires a valid token; the service requires ADMIN or a SELLER who owns the SKU.
         */
        post: operations["intakeStock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List reservations for support
         * @description Every filter is optional and they combine with AND. Newest first (createdAt, then id, descending). expiresAt and releasedAt are in UTC; releasedAt is null while the reservation is HELD. The gateway only requires a valid token; the service requires ADMIN or SUPPORT_STAFF.
         */
        get: operations["listReservations"];
        put?: never;
        /**
         * Hold stock for the orders of one order group
         * @description Sent by commerce-service with the buyer's token while it creates the orders; the frontend does not call it. Each SKU is reserved by one UPDATE whose WHERE clause requires available_quantity to cover the quantity, in SKU order, all in one transaction: one shortage reserves nothing. Items of the same SKU are checked against their sum. All SKUs of one order are held in one warehouse: when one of them is stocked in its seller's warehouse, available stock of the order's other SKUs of that seller still in platform warehouses moves there first with TRANSFER movements; otherwise each SKU is held where it is stocked, else in the warehouse whose code is nexus.inventory.default-warehouse-code. Each reservation keeps its item's orderId and writes one RESERVE ledger row. orderGroupId is not stored. Sending the same items again returns the reservations already held. The gateway only requires a valid token; the service requires the BUYER role.
         */
        post: operations["reserveStock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations/fulfillment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the pick and pack steps of one seller order
         * @description Every reservation of the order, by SKU, with pickedAt and shippedAt. A seller sees the order only when they own every SKU in it. The gateway only requires a valid token; the service requires ADMIN or SELLER.
         */
        get: operations["getOrderFulfillment"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations/{id}/pick": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark paid stock as picked from the shelf
         * @description Sets pickedAt on a CONFIRMED reservation and writes one PICK ledger row with the reservation quantity and the reservation id as referenceId. Balances do not change: the stock already left on-hand at COMMIT. Repeating returns the reservation without a second row. The gateway only requires a valid token; the service requires ADMIN, or SELLER owning the SKU (checked with catalog-service).
         */
        post: operations["pickReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations/{id}/ship": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark picked stock as packed for the carrier
         * @description Sets shippedAt on a picked CONFIRMED reservation and writes one SHIP ledger row with the reservation quantity. Balances do not change. Repeating returns the reservation without a second row. The gateway only requires a valid token; the service requires ADMIN, or SELLER owning the SKU (checked with catalog-service).
         */
        post: operations["shipReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/adjustments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Correct a balance by a signed quantity
         * @description Adds quantityDelta to total and available in one UPDATE whose WHERE clause requires available plus the delta to stay at 0 or more, then writes one ADJUSTMENT ledger row with the delta, the reason and the balance id as referenceId. Reserved and unavailable do not change. The balance must already exist; new stock goes through intake. When warehouseId is left out, the warehouse is the one whose code is nexus.inventory.default-warehouse-code. The gateway only requires a valid token; the service requires the ADMIN role.
         */
        post: operations["adjustStock"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/balances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List stock balances
         * @description ADMIN may combine the filters freely or leave them out. SELLER must pass skuId, and the SKU must belong to one of the caller's products: the service asks catalog-service for the SKU and its product and compares the product's sellerId with the caller. A SKU whose product catalog does not show publicly counts as not owned. Sorted by skuId, then warehouseId. The gateway only requires a valid token; the service requires ADMIN or SELLER.
         */
        get: operations["listBalances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/movements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the stock ledger
         * @description Every filter is optional and they combine with AND. from is inclusive and to is exclusive; both are ISO 8601 date-times with an offset, and from must be before to. Newest first (createdAt, then id, descending). createdAt is in UTC. reason is set on ADJUSTMENT rows only. The gateway only requires a valid token; the service requires ADMIN or SUPPORT_STAFF.
         */
        get: operations["listMovements"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Move a held reservation out of stock for good
         * @description Paid: reserved goes down and unavailable goes up by the reservation's quantity, the status becomes CONFIRMED and one COMMIT ledger row is written, in one transaction. The status change is conditional on HELD inside the UPDATE, so a repeat, or two calls at once, change the stock once. Not routed from the gateway: a call from outside gets 404 there and never reaches inventory-service. The service requires the ADMIN role; the event consumers of the later issues call the same service method in-process.
         */
        post: operations["confirmReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inventory/reservations/{id}/release": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Put a held reservation back on the shelf
         * @description Not paid: reserved goes down and available goes up by the reservation's quantity, the status becomes RELEASED with released_at set and one RELEASE ledger row is written, in one transaction. The status change is conditional on HELD inside the UPDATE, so a repeat changes the stock once; an EXPIRED reservation already returned its stock and also gives 204. Not routed from the gateway: a call from outside gets 404 there and never reaches inventory-service. The service requires the ADMIN role; the event consumers of the later issues call the same service method in-process.
         */
        post: operations["releaseReservation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/warehouses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List warehouses
         * @description Returns all matching warehouses sorted by code in ascending database order. The optional status filter accepts ACTIVE, INACTIVE or MAINTENANCE. There are no page or size request parameters. The result forms one logical page: number is 0, size is max(1, result count), totalElements is the result count and totalPages is 1 for a nonempty result or 0 for an empty result. The gateway requires a valid token; the service requires ADMIN or SUPPORT_STAFF.
         */
        get: operations["listWarehouses"];
        put?: never;
        /**
         * Create a warehouse
         * @description Creates an ACTIVE warehouse. Code and name must not be blank; their length limits apply to the supplied strings before surrounding ASCII whitespace is trimmed for storage. Code uniqueness is case-sensitive and enforced by the database, including simultaneous creates. Address is optional and may be null. The initial status is always ACTIVE and is not a request field. The gateway requires a valid token; the service requires the ADMIN role.
         */
        post: operations["createWarehouse"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/warehouses/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read the seller's own warehouse
         * @description Returns the caller's warehouse. It exists after the seller's first stock intake or first save; before that the answer is 404. The gateway requires a valid token; the service requires the SELLER role.
         */
        get: operations["getOwnWarehouse"];
        /**
         * Create or rename the seller's own warehouse
         * @description Creates the caller's warehouse when it does not exist yet, then stores the name, address and pickup area. Code, status and owner are not request fields. A blank address is stored as null. With provinceCode and wardCode the address is the house number and street carriers collect from; without them orders ship from the platform pickup. The gateway requires a valid token; the service requires the SELLER role.
         */
        put: operations["updateOwnWarehouse"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/warehouses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Warehouse identifier */
                id: components["parameters"]["WarehouseId"];
            };
            cookie?: never;
        };
        /**
         * Read a warehouse
         * @description Returns a warehouse in any status. The gateway requires a valid token; the service requires ADMIN or SUPPORT_STAFF.
         */
        get: operations["getWarehouse"];
        /**
         * Update a warehouse
         * @description Replaces the warehouse name, address and status. Name and status are required; name must not be blank or exceed 150 characters before surrounding ASCII whitespace is trimmed. Omitted or null address clears the address. Code and id are immutable and are not request fields. An INACTIVE or MAINTENANCE warehouse rejects subsequent intake with INVENTORY_WAREHOUSE_UNAVAILABLE; setting ACTIVE allows intake again. The update and intake coordinate on the same warehouse row so status changes do not race with stock writes. The gateway requires a valid token; the service requires the ADMIN role.
         */
        put: operations["updateWarehouse"];
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
        LinkedAuctionReservationApiResponse: {
            /** @enum {integer} */
            code: 0;
            message: string;
            data: {
                /** Format: uuid */
                reservationId: string;
                /** Format: uuid */
                warehouseId: string;
                /** @enum {string} */
                status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
            }[];
        };
        IntakeRequest: {
            /** Format: uuid */
            skuId: string;
            /**
             * Format: uuid
             * @description Defaults to the warehouse with code nexus.inventory.default-warehouse-code
             */
            warehouseId?: string;
            /** Format: int32 */
            quantity: number;
        };
        BalanceApiResponse: {
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
            data: components["schemas"]["Balance"];
        };
        Balance: {
            /** Format: uuid */
            skuId: string;
            /** Format: uuid */
            warehouseId: string;
            /** Format: int32 */
            total: number;
            /** Format: int32 */
            available: number;
            /** Format: int32 */
            reserved: number;
            /** Format: int32 */
            unavailable: number;
        };
        ReserveRequest: {
            /**
             * Format: uuid
             * @description Identifies the request; not stored
             */
            orderGroupId: string;
            items: components["schemas"]["ReserveItem"][];
        };
        ReserveItem: {
            /**
             * Format: uuid
             * @description The seller order that owns the item; stored on its reservation
             */
            orderId: string;
            /** Format: uuid */
            skuId: string;
            /** Format: int32 */
            quantity: number;
        };
        ReservationApiResponse: {
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
            data: components["schemas"]["Reservation"];
        };
        Reservation: {
            /** @description One per item, in request order */
            reservationIds: string[];
            /**
             * Format: uuid
             * @description Warehouse of the first order; each order's own warehouse is in orders
             */
            warehouseId: string;
            /** @description One entry per order, in request order. Each SKU is held in the warehouse that stocks it (its seller's warehouse), so orders of different sellers name different warehouses. */
            orders?: {
                /** Format: uuid */
                orderId: string;
                /** Format: uuid */
                warehouseId: string;
            }[];
            /**
             * Format: date-time
             * @description In UTC with a Z offset; the same for every item of the request. The time of the request plus nexus.inventory.reservation-timeout-minutes from Config Server (30 by default), read again on /actuator/refresh.
             */
            expiresAt: string;
        };
        AdjustmentRequest: {
            /** Format: uuid */
            skuId: string;
            /**
             * Format: uuid
             * @description Defaults to the warehouse with code nexus.inventory.default-warehouse-code
             */
            warehouseId?: string;
            /**
             * Format: int32
             * @description Not 0; negative removes stock, positive adds it
             */
            quantityDelta: number;
            /** @description Stored on the ADJUSTMENT ledger row without leading or trailing spaces */
            reason: string;
        };
        InsufficientStockProblem: components["schemas"]["Problem"] & {
            /** Format: uuid */
            skuId: string;
            /** Format: int32 */
            available: number;
            /** Format: int32 */
            requested: number;
        };
        Problem: {
            type: string;
            title: string;
            status: number;
            detail: string;
            instance: string;
            code: string;
            traceId?: string;
            errors?: components["schemas"]["ValidationError"][];
        };
        ValidationError: {
            field: string;
            code: string;
            detail: string;
        };
        StockApiResponse: {
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
            data: components["schemas"]["Stock"];
        };
        StockListApiResponse: {
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
            data: components["schemas"]["Stock"][];
            page: components["schemas"]["PageInfo"];
        };
        Stock: {
            /** Format: uuid */
            skuId: string;
            /**
             * Format: int32
             * @description 0 when the SKU has no balance row in the default warehouse
             */
            available: number;
        };
        PageInfo: {
            number: number;
            size: number;
            /** Format: int64 */
            totalElements: number;
            totalPages: number;
        };
        BalancePageApiResponse: {
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
            data: components["schemas"]["Balance"][];
            page: components["schemas"]["PageInfo"];
        };
        ReservationView: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            skuId: string;
            /** Format: uuid */
            warehouseId: string;
            /** Format: uuid */
            orderId: string;
            /** Format: int32 */
            quantity: number;
            /** @enum {string} */
            status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
            /**
             * Format: date-time
             * @description In UTC
             */
            expiresAt: string;
            /**
             * Format: date-time
             * @description In UTC; null while HELD
             */
            releasedAt: string | null;
            /**
             * Format: date-time
             * @description In UTC; set when the seller marks the items picked
             */
            pickedAt: string | null;
            /**
             * Format: date-time
             * @description In UTC; set when the seller marks the picked items packed for the carrier
             */
            shippedAt: string | null;
        };
        ReservationViewApiResponse: {
            /**
             * @default 0
             * @example 0
             */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["ReservationView"];
        };
        ReservationViewListApiResponse: {
            /**
             * @default 0
             * @example 0
             */
            code: number;
            /** @example response success */
            message: string;
            data: components["schemas"]["ReservationView"][];
        };
        ReservationPageApiResponse: {
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
            data: components["schemas"]["ReservationView"][];
            page: components["schemas"]["PageInfo"];
        };
        /** @enum {string} */
        MovementType: "INTAKE" | "RESERVE" | "RELEASE" | "COMMIT" | "ADJUSTMENT" | "RETURN" | "PICK" | "SHIP" | "TRANSFER";
        Movement: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            skuId: string;
            /** Format: uuid */
            warehouseId: string;
            movementType: components["schemas"]["MovementType"];
            /**
             * Format: int32
             * @description Signed for ADJUSTMENT; otherwise the units moved
             */
            quantity: number;
            /** Format: uuid */
            referenceId: string | null;
            /** @description Set on ADJUSTMENT rows only */
            reason: string | null;
            /**
             * Format: date-time
             * @description In UTC
             */
            createdAt: string;
        };
        MovementPageApiResponse: {
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
            data: components["schemas"]["Movement"][];
            page: components["schemas"]["PageInfo"];
        };
        CreateWarehouseRequest: {
            /**
             * @description Nonblank, case-sensitive unique code; surrounding ASCII whitespace is trimmed before storage
             * @example WH_HCM_02
             */
            code: string;
            /**
             * @description Nonblank name; surrounding ASCII whitespace is trimmed before storage
             * @example Ho Chi Minh warehouse
             */
            name: string;
            /**
             * @description Optional warehouse address
             * @example 1 Nguyen Hue, District 1, Ho Chi Minh City
             */
            address?: string | null;
        };
        WarehouseApiResponse: {
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
            data: components["schemas"]["Warehouse"];
        };
        UpdateOwnWarehouseRequest: {
            /** @description Nonblank name; surrounding whitespace is trimmed before storage */
            name: string;
            /** @description Omit, null or blank clears the address. With a pickup area it is the house number and street, at most 255 characters. */
            address?: string | null;
            /** @description Province code from the public shipping localities; send together with wardCode, or omit both to clear the pickup area */
            provinceCode?: string | null;
            /** @description Ward code inside provinceCode */
            wardCode?: string | null;
        };
        UpdateWarehouseRequest: {
            /** @description Nonblank name; surrounding ASCII whitespace is trimmed before storage */
            name: string;
            /** @description Omit or set null to clear the warehouse address */
            address?: string | null;
            /** @enum {string} */
            status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
        };
        WarehouseListApiResponse: {
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
            data: components["schemas"]["Warehouse"][];
            page: components["schemas"]["WarehousePageInfo"];
        };
        Warehouse: {
            /** Format: uuid */
            id: string;
            code: string;
            name: string;
            address?: string | null;
            /**
             * @description Newly created warehouses are always ACTIVE
             * @enum {string}
             */
            status: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
            /**
             * Format: uuid
             * @description Owner of a seller warehouse; null for a platform warehouse
             */
            sellerId?: string | null;
            /** @description Pickup province code; null when no pickup area is set */
            provinceCode?: string | null;
            /** @description Pickup ward code; null when no pickup area is set */
            wardCode?: string | null;
        };
        SellerPickupApiResponse: {
            /** @enum {integer} */
            code: 0;
            message: string;
            data: {
                /** Format: uuid */
                warehouseId: string;
                /** Format: uuid */
                sellerId: string;
                provinceCode: string;
                wardCode: string;
                line1: string;
            } | null;
        };
        WarehousePageInfo: {
            /** @description Complete warehouse lists always use page number 0 */
            number: number;
            /** @description max(1, result count) */
            size: number;
            /**
             * Format: int64
             * @description Number of warehouses matching the optional filter
             */
            totalElements: number;
            /** @description 0 for an empty result or 1 otherwise */
            totalPages: number;
        };
    };
    responses: {
        /** @description Warehouse details */
        WarehouseRead: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "code": 0,
                 *       "message": "response success",
                 *       "data": {
                 *         "id": "0195f0a1-0000-7000-8000-000000000002",
                 *         "code": "WH_HCM_02",
                 *         "name": "Ho Chi Minh warehouse",
                 *         "address": "1 Nguyen Hue, District 1, Ho Chi Minh City",
                 *         "status": "ACTIVE"
                 *       }
                 *     }
                 */
                "application/json": components["schemas"]["WarehouseApiResponse"];
            };
        };
        /** @description id is not a UUID. Code INVALID_PARAMETER. */
        InvalidWarehouseId: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:invalid-parameter",
                 *       "title": "Bad Request",
                 *       "status": 400,
                 *       "detail": "A request parameter is invalid",
                 *       "instance": "/api/v1/warehouses/not-a-uuid",
                 *       "code": "INVALID_PARAMETER",
                 *       "errors": [
                 *         {
                 *           "field": "id",
                 *           "code": "INVALID_PARAMETER",
                 *           "detail": "A valid value is required"
                 *         }
                 *       ]
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Missing or invalid bearer token. Code UNAUTHENTICATED. */
        Unauthenticated: {
            headers: {
                /** @description Bearer authentication challenge */
                "WWW-Authenticate"?: string;
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:unauthorized",
                 *       "title": "Unauthorized",
                 *       "status": 401,
                 *       "detail": "A valid access token is required to access this resource",
                 *       "instance": "/api/v1/warehouses",
                 *       "code": "UNAUTHENTICATED"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The caller does not have a role allowed by this operation. Code FORBIDDEN. */
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
                 *       "detail": "You do not have permission to access this resource",
                 *       "instance": "/api/v1/warehouses",
                 *       "code": "FORBIDDEN"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description The warehouse does not exist. Code INVENTORY_WAREHOUSE_NOT_FOUND. */
        WarehouseNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                /**
                 * @example {
                 *       "type": "urn:problem:domain-error",
                 *       "title": "Not Found",
                 *       "status": 404,
                 *       "detail": "Warehouse not found",
                 *       "instance": "/api/v1/warehouses/0195f0a1-0000-7000-8000-000000000002",
                 *       "code": "INVENTORY_WAREHOUSE_NOT_FOUND"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unsupported Accept header. Code NOT_ACCEPTABLE. */
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
                 *       "detail": "The requested response format is not supported",
                 *       "instance": "/api/v1/warehouses",
                 *       "code": "NOT_ACCEPTABLE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unsupported Content-Type header. Code UNSUPPORTED_MEDIA_TYPE. */
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
                 *       "detail": "The request content type is not supported",
                 *       "instance": "/api/v1/warehouses",
                 *       "code": "UNSUPPORTED_MEDIA_TYPE"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
        /** @description Unexpected service failure. Code INTERNAL_ERROR. */
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
                 *       "detail": "An unexpected error occurred",
                 *       "instance": "/api/v1/warehouses",
                 *       "code": "INTERNAL_ERROR"
                 *     }
                 */
                "application/problem+json": components["schemas"]["Problem"];
            };
        };
    };
    parameters: {
        /** @description Warehouse identifier */
        WarehouseId: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getLinkedAuctionReservation: {
        parameters: {
            query: {
                /** @description Auction order UUID */
                orderId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Linked hold visible to the winning buyer */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LinkedAuctionReservationApiResponse"];
                };
            };
            /** @description orderId is missing or invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Caller lacks the BUYER role */
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
    getSellerPickup: {
        parameters: {
            query: {
                /** @description Seller UUID */
                sellerId: string;
                /** @description SKUs of the parcel; repeat the parameter for each SKU. Commerce always sends them. */
                skuIds?: string[];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The seller warehouse pickup, or null data */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SellerPickupApiResponse"];
                };
            };
            /** @description sellerId is missing or invalid */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Caller lacks the BUYER role */
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
    getAvailability: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description SKU id */
                skuId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Available quantity of the SKU */
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
                     *         "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *         "available": 97
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["StockApiResponse"];
                };
            };
            /** @description skuId is not a UUID */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:invalid-parameter",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "A request parameter is invalid",
                     *       "instance": "/api/v1/inventory/not-a-uuid",
                     *       "code": "INVALID_PARAMETER"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The configured default warehouse does not exist */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Internal Server Error",
                     *       "status": 500,
                     *       "detail": "The configured default warehouse does not exist",
                     *       "instance": "/api/v1/inventory/0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *       "code": "INVENTORY_DEFAULT_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listAvailability: {
        parameters: {
            query: {
                /** @description Comma-separated SKU ids, 1 to 100 */
                skuIds: string[];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One entry per distinct requested SKU, in request order */
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
                     *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *           "available": 97
                     *         },
                     *         {
                     *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a82",
                     *           "available": 0
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 2,
                     *         "totalElements": 2,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["StockListApiResponse"];
                };
            };
            /** @description skuIds is missing or not a list of UUIDs (INVALID_PARAMETER), empty (VALIDATION_FAILED), or holds more than 100 ids (INVENTORY_TOO_MANY_SKUS) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The configured default warehouse does not exist */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Internal Server Error",
                     *       "status": 500,
                     *       "detail": "The configured default warehouse does not exist",
                     *       "instance": "/api/v1/inventory",
                     *       "code": "INVENTORY_DEFAULT_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    intakeStock: {
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
                 *       "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                 *       "quantity": 100
                 *     }
                 */
                "application/json": components["schemas"]["IntakeRequest"];
            };
        };
        responses: {
            /** @description Balance after the intake */
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
                     *         "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *         "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *         "total": 100,
                     *         "available": 100,
                     *         "reserved": 0,
                     *         "unavailable": 0
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["BalanceApiResponse"];
                };
            };
            /** @description Missing skuId or quantity, quantity 0 or less, or a malformed body */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:validation-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "The request data is invalid",
                     *       "instance": "/api/v1/inventory/intake",
                     *       "code": "VALIDATION_FAILED",
                     *       "errors": [
                     *         {
                     *           "field": "quantity",
                     *           "code": "VALIDATION_POSITIVE",
                     *           "detail": "must be greater than 0"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the ADMIN role */
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
                     *       "instance": "/api/v1/inventory/intake",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The given warehouseId does not exist */
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
                     *       "detail": "Warehouse not found",
                     *       "instance": "/api/v1/inventory/intake",
                     *       "code": "INVENTORY_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description INVENTORY_WAREHOUSE_UNAVAILABLE when the target warehouse is INACTIVE or MAINTENANCE; INVENTORY_WAREHOUSE_NOT_SKU_HOME when an admin names a warehouse other than the one holding the SKU, or another seller's warehouse. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The configured default warehouse code matches no warehouse */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Internal Server Error",
                     *       "status": 500,
                     *       "detail": "The configured default warehouse does not exist",
                     *       "instance": "/api/v1/inventory/intake",
                     *       "code": "INVENTORY_DEFAULT_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listReservations: {
        parameters: {
            query?: {
                /** @description The seller order that holds the reservation */
                orderId?: string;
                /** @description Only reservations of this SKU */
                skuId?: string;
                status?: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of reservations */
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
                     *           "id": "0195f0a3-3333-7333-8333-333333333333",
                     *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *           "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *           "orderId": "0195f0a3-2222-7222-8222-222222222222",
                     *           "quantity": 2,
                     *           "status": "HELD",
                     *           "expiresAt": "2026-11-10T08:30:00Z",
                     *           "releasedAt": null
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 10,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ReservationPageApiResponse"];
                };
            };
            /** @description A filter of the wrong type or an unknown enum value (INVALID_PARAMETER), or page below 0 or size outside 1 to 100 (VALIDATION_FAILED) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller has neither ADMIN nor SUPPORT_STAFF */
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
                     *       "instance": "/api/v1/inventory/reservations",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    reserveStock: {
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
                 *       "orderGroupId": "0195f0a3-1111-7111-8111-111111111111",
                 *       "items": [
                 *         {
                 *           "orderId": "0195f0a3-2222-7222-8222-222222222222",
                 *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                 *           "quantity": 2
                 *         }
                 *       ]
                 *     }
                 */
                "application/json": components["schemas"]["ReserveRequest"];
            };
        };
        responses: {
            /** @description The reservations held for the items, in request order */
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
                     *         "reservationIds": [
                     *           "0195f0a3-3333-7333-8333-333333333333"
                     *         ],
                     *         "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *         "expiresAt": "2026-11-05T10:15:00Z"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["ReservationApiResponse"];
                };
            };
            /** @description A missing orderGroupId, no items or more than 100, a missing field or a quantity outside 1 to 999 (VALIDATION_FAILED), or the same orderId and skuId twice (INVENTORY_DUPLICATE_RESERVATION_ITEM) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the BUYER role */
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
                     *       "instance": "/api/v1/inventory/reservations",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not enough stock for a SKU (INVENTORY_INSUFFICIENT_STOCK, with skuId, available and requested), these orders already hold reservations that differ from the request (INVENTORY_RESERVATION_CONFLICT), or one order mixes SKUs stocked by different sellers (INVENTORY_SKUS_FROM_DIFFERENT_SELLERS). Nothing is reserved. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["InsufficientStockProblem"] | components["schemas"]["Problem"];
                };
            };
            /** @description The configured default warehouse code matches no warehouse */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Internal Server Error",
                     *       "status": 500,
                     *       "detail": "The configured default warehouse does not exist",
                     *       "instance": "/api/v1/inventory/reservations",
                     *       "code": "INVENTORY_DEFAULT_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getOrderFulfillment: {
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
            /** @description The reservations of the order; empty when nothing was reserved */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReservationViewListApiResponse"];
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
            /** @description Not ADMIN or SELLER, or a SKU of the order belongs to another seller (FORBIDDEN) */
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
    pickReservation: {
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
            /** @description The reservation with its fulfilment steps */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReservationViewApiResponse"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not ADMIN and not the seller of the SKU (FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unknown reservation (INVENTORY_RESERVATION_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not CONFIRMED (INVENTORY_NOT_PICKABLE) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description catalog-service could not confirm the SKU owner (INVENTORY_CATALOG_UNAVAILABLE) */
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
    shipReservation: {
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
            /** @description The reservation with its fulfilment steps */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReservationViewApiResponse"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not ADMIN and not the seller of the SKU (FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unknown reservation (INVENTORY_RESERVATION_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Not CONFIRMED (INVENTORY_NOT_PICKABLE) or not picked yet (INVENTORY_NOT_PICKED) */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description catalog-service could not confirm the SKU owner (INVENTORY_CATALOG_UNAVAILABLE) */
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
    adjustStock: {
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
                 *       "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                 *       "quantityDelta": -2,
                 *       "reason": "Two units damaged in the warehouse"
                 *     }
                 */
                "application/json": components["schemas"]["AdjustmentRequest"];
            };
        };
        responses: {
            /** @description Balance after the adjustment */
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
                     *         "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *         "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *         "total": 98,
                     *         "available": 98,
                     *         "reserved": 0,
                     *         "unavailable": 0
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["BalanceApiResponse"];
                };
            };
            /** @description Missing skuId, quantityDelta or reason, a quantityDelta of 0 or beyond plus or minus 1000000, a blank reason or one longer than 500 characters, or a malformed body */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:validation-error",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "The request data is invalid",
                     *       "instance": "/api/v1/inventory/adjustments",
                     *       "code": "VALIDATION_FAILED",
                     *       "errors": [
                     *         {
                     *           "field": "quantityDelta",
                     *           "code": "VALIDATION_NON_ZERO",
                     *           "detail": "must not be 0"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the ADMIN role */
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
                     *       "instance": "/api/v1/inventory/adjustments",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The given warehouseId does not exist (INVENTORY_WAREHOUSE_NOT_FOUND), or the SKU has no balance in that warehouse (INVENTORY_BALANCE_NOT_FOUND) */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The delta would make available negative; nothing is changed */
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
                     *       "detail": "The adjustment would make a quantity negative",
                     *       "instance": "/api/v1/inventory/adjustments",
                     *       "code": "INVENTORY_NEGATIVE_QUANTITY"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The configured default warehouse code matches no warehouse */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:domain-error",
                     *       "title": "Internal Server Error",
                     *       "status": 500,
                     *       "detail": "The configured default warehouse does not exist",
                     *       "instance": "/api/v1/inventory/adjustments",
                     *       "code": "INVENTORY_DEFAULT_WAREHOUSE_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listBalances: {
        parameters: {
            query?: {
                /** @description Required for SELLER */
                skuId?: string;
                /** @description Only balances in this warehouse */
                warehouseId?: string;
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of balances */
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
                     *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *           "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *           "total": 98,
                     *           "available": 96,
                     *           "reserved": 2,
                     *           "unavailable": 0
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 10,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["BalancePageApiResponse"];
                };
            };
            /** @description A filter of the wrong type or an unknown enum value (INVALID_PARAMETER), or page below 0 or size outside 1 to 100 (VALIDATION_FAILED), or a SELLER without skuId (INVALID_PARAMETER as a domain error) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller has neither ADMIN nor SELLER (FORBIDDEN), or a SELLER asked for a SKU that is not theirs (INVENTORY_FORBIDDEN) */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description catalog-service could not be reached to check who owns the SKU (SELLER only) */
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
                     *       "detail": "The catalog could not confirm who owns this SKU",
                     *       "instance": "/api/v1/inventory/balances",
                     *       "code": "INVENTORY_CATALOG_UNAVAILABLE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listMovements: {
        parameters: {
            query?: {
                /** @description Only movements of this SKU */
                skuId?: string;
                /** @description Only movements in this warehouse */
                warehouseId?: string;
                type?: components["schemas"]["MovementType"];
                /** @description A reservation id, or the balance id for INTAKE and ADJUSTMENT rows */
                referenceId?: string;
                /** @example 2026-11-10T15:00:00+07:00 */
                from?: string;
                to?: string;
                page?: number;
                size?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description One page of ledger rows */
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
                     *           "id": "0195f0a4-4444-7444-8444-444444444444",
                     *           "skuId": "0195f0a2-7c1e-7d2a-9b3f-2c4d5e6f7a81",
                     *           "warehouseId": "0195f0a1-0000-7000-8000-000000000001",
                     *           "movementType": "ADJUSTMENT",
                     *           "quantity": -2,
                     *           "referenceId": "0195f0a4-5555-7555-8555-555555555555",
                     *           "reason": "Two units damaged in the warehouse",
                     *           "createdAt": "2026-11-10T08:02:00Z"
                     *         }
                     *       ],
                     *       "page": {
                     *         "number": 0,
                     *         "size": 10,
                     *         "totalElements": 1,
                     *         "totalPages": 1
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["MovementPageApiResponse"];
                };
            };
            /** @description A filter of the wrong type or an unknown enum value (INVALID_PARAMETER), or page below 0 or size outside 1 to 100 (VALIDATION_FAILED), or from not before to (INVALID_PARAMETER as a domain error) */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller has neither ADMIN nor SUPPORT_STAFF */
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
                     *       "instance": "/api/v1/inventory/movements",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    confirmReservation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The reservation id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done, or already done by an earlier call. No body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The id is not a UUID */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:invalid-parameter",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "A request parameter is invalid",
                     *       "instance": "/api/v1/inventory/reservations/not-a-uuid/confirm",
                     *       "code": "INVALID_PARAMETER",
                     *       "errors": [
                     *         {
                     *           "field": "id",
                     *           "code": "INVALID_PARAMETER",
                     *           "detail": "A valid value is required"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the ADMIN role */
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
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/confirm",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No reservation has this id */
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
                     *       "detail": "Reservation not found",
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/confirm",
                     *       "code": "INVENTORY_RESERVATION_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The reservation is RELEASED or EXPIRED, so its stock is no longer held (INVENTORY_ILLEGAL_TRANSITION). Nothing changes. */
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
                     *       "detail": "The reservation is not HELD",
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/confirm",
                     *       "code": "INVENTORY_ILLEGAL_TRANSITION"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    releaseReservation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description The reservation id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Done, or already done by an earlier call. No body. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The id is not a UUID */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:invalid-parameter",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "A request parameter is invalid",
                     *       "instance": "/api/v1/inventory/reservations/not-a-uuid/release",
                     *       "code": "INVALID_PARAMETER",
                     *       "errors": [
                     *         {
                     *           "field": "id",
                     *           "code": "INVALID_PARAMETER",
                     *           "detail": "A valid value is required"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the ADMIN role */
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
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/release",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description No reservation has this id */
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
                     *       "detail": "Reservation not found",
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/release",
                     *       "code": "INVENTORY_RESERVATION_NOT_FOUND"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The reservation is CONFIRMED, so its stock has left (INVENTORY_ILLEGAL_TRANSITION). Nothing changes. */
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
                     *       "detail": "The reservation is not HELD",
                     *       "instance": "/api/v1/inventory/reservations/0195f0a3-3333-7333-8333-333333333333/release",
                     *       "code": "INVENTORY_ILLEGAL_TRANSITION"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    listWarehouses: {
        parameters: {
            query?: {
                /** @description Filter by warehouse status; omit or leave empty to include all statuses */
                status?: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Warehouses matching the optional filter */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WarehouseListApiResponse"];
                };
            };
            /** @description An unknown status value was supplied. Code INVALID_PARAMETER. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:invalid-parameter",
                     *       "title": "Bad Request",
                     *       "status": 400,
                     *       "detail": "A request parameter is invalid",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "INVALID_PARAMETER",
                     *       "errors": [
                     *         {
                     *           "field": "status",
                     *           "code": "INVALID_PARAMETER",
                     *           "detail": "A valid value is required"
                     *         }
                     *       ]
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
        };
    };
    createWarehouse: {
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
                 *       "code": "WH_HCM_02",
                 *       "name": "Ho Chi Minh warehouse",
                 *       "address": "1 Nguyen Hue, District 1, Ho Chi Minh City"
                 *     }
                 */
                "application/json": components["schemas"]["CreateWarehouseRequest"];
            };
        };
        responses: {
            /** @description Warehouse created */
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
                     *         "id": "0195f0a1-0000-7000-8000-000000000002",
                     *         "code": "WH_HCM_02",
                     *         "name": "Ho Chi Minh warehouse",
                     *         "address": "1 Nguyen Hue, District 1, Ho Chi Minh City",
                     *         "status": "ACTIVE"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["WarehouseApiResponse"];
                };
            };
            /** @description Codes VALIDATION_FAILED (missing, blank or overlong code/name), INVALID_REQUEST_BODY (missing or malformed JSON body). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Missing or invalid bearer token. Code UNAUTHENTICATED. */
            401: {
                headers: {
                    /** @description Bearer authentication challenge */
                    "WWW-Authenticate"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:unauthorized",
                     *       "title": "Unauthorized",
                     *       "status": 401,
                     *       "detail": "A valid access token is required to access this resource",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "UNAUTHENTICATED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The caller does not have the ADMIN role. Code FORBIDDEN. */
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
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "FORBIDDEN"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unsupported method. Code METHOD_NOT_ALLOWED. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this resource */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:method-not-allowed",
                     *       "title": "Method Not Allowed",
                     *       "status": 405,
                     *       "detail": "The HTTP method is not supported for this endpoint",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "METHOD_NOT_ALLOWED"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unsupported Accept header. Code NOT_ACCEPTABLE. */
            406: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "type": "urn:problem:not-acceptable",
                     *       "title": "Not Acceptable",
                     *       "status": 406,
                     *       "detail": "The requested response format is not supported",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "NOT_ACCEPTABLE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description The warehouse code already exists. Code INVENTORY_DUPLICATE_WAREHOUSE_CODE. */
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
                     *       "detail": "Warehouse code already exists",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "INVENTORY_DUPLICATE_WAREHOUSE_CODE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unsupported Content-Type header. Code UNSUPPORTED_MEDIA_TYPE. */
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
                     *       "detail": "The request content type is not supported",
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "UNSUPPORTED_MEDIA_TYPE"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            /** @description Unexpected service failure. Code INTERNAL_ERROR. */
            500: {
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
                     *       "instance": "/api/v1/warehouses",
                     *       "code": "INTERNAL_ERROR"
                     *     }
                     */
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
        };
    };
    getOwnWarehouse: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["WarehouseRead"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["WarehouseNotFound"];
            500: components["responses"]["InternalError"];
        };
    };
    updateOwnWarehouse: {
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
                 *       "name": "District 7 warehouse",
                 *       "address": "12 Nguyen Thi Thap, District 7, Ho Chi Minh City"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateOwnWarehouseRequest"];
            };
        };
        responses: {
            200: components["responses"]["WarehouseRead"];
            /** @description VALIDATION_FAILED (missing, blank or overlong name, overlong address, only one of provinceCode and wardCode, a malformed code, or a pickup area without a street address of at most 255 characters) or INVALID_REQUEST_BODY. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            500: components["responses"]["InternalError"];
        };
    };
    getWarehouse: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Warehouse identifier */
                id: components["parameters"]["WarehouseId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: components["responses"]["WarehouseRead"];
            400: components["responses"]["InvalidWarehouseId"];
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["WarehouseNotFound"];
            406: components["responses"]["NotAcceptable"];
            500: components["responses"]["InternalError"];
        };
    };
    updateWarehouse: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Warehouse identifier */
                id: components["parameters"]["WarehouseId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "Ho Chi Minh warehouse",
                 *       "address": "1 Nguyen Hue, District 1, Ho Chi Minh City",
                 *       "status": "MAINTENANCE"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateWarehouseRequest"];
            };
        };
        responses: {
            /** @description Warehouse after the update */
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
                     *         "id": "0195f0a1-0000-7000-8000-000000000002",
                     *         "code": "WH_HCM_02",
                     *         "name": "Ho Chi Minh warehouse",
                     *         "address": "1 Nguyen Hue, District 1, Ho Chi Minh City",
                     *         "status": "MAINTENANCE"
                     *       }
                     *     }
                     */
                    "application/json": components["schemas"]["WarehouseApiResponse"];
                };
            };
            /** @description Codes VALIDATION_FAILED (missing, blank or overlong name, or missing status), INVALID_REQUEST_BODY (missing or malformed JSON, including an unknown status), INVALID_PARAMETER (id is not a UUID). */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/problem+json": components["schemas"]["Problem"];
                };
            };
            401: components["responses"]["Unauthenticated"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["WarehouseNotFound"];
            406: components["responses"]["NotAcceptable"];
            415: components["responses"]["UnsupportedMediaType"];
            500: components["responses"]["InternalError"];
        };
    };
}
