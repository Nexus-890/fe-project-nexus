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
         * Đọc danh sách shipment có phân trang
         * @description Yêu cầu SHIPPING.VIEW_SHIPMENT. ADMIN và SUPPORT_STAFF đọc mọi shipment; các actor khác chỉ đọc shipment có buyerId bằng sub của JWT. Điều kiện chủ sở hữu và bộ lọc được áp dụng trước khi phân trang và đếm tổng, nên tổng không tiết lộ shipment của người khác. Sắp xếp createdAt giảm dần, sau đó id. Trang vượt cuối trả 200 với data=[] và tổng thực tế. Không có bộ lọc buyerId cho client.
         */
        get: operations["listShipments"];
        put?: never;
        /**
         * Tạo shipment thủ công từ snapshot đơn đã thanh toán
         * @description Yêu cầu SHIPPING.CREATE_SHIPMENT và một trong hai vai trò ADMIN hoặc SUPPORT_STAFF. Buyer có privilege tạo nhưng thiếu vai trò vận hành vẫn bị từ chối 403. Nguồn buyerId, shippingFee và shippingInfo lấy từ đơn đã thanh toán, không nhận các trường này từ client và không đọc commerce_db. Khi chưa có shipment, gọi trực tiếp GET /internal/v1/orders/{id}/shipping-snapshot của commerce bằng bearer của caller, có timeout và circuit breaker. Chỉ đơn PAID có snapshot hợp lệ được tạo. Đơn không tồn tại trả 404 SHIPMENT_ORDER_NOT_FOUND; chưa PAID trả 409 SHIPMENT_ORDER_NOT_PAID; upstream không khả dụng trả 503 SHIPMENT_COMMERCE_UNAVAILABLE; snapshot sai trả 502 SHIPMENT_INVALID_ORDER_SNAPSHOT. warehouseId, carrier và serviceType tùy chọn được dùng để chọn dispatch cho shipment mới. Kho và pickup phải có nguồn tin cậy; không dùng pickup cũ cho kho khác. Bỏ trống carrier dùng SHIPPING_BOOKING_CARRIER (fallback về SHIPPING_CARRIER khi chưa cấu hình), độc lập với carrier báo phí đã lưu trong snapshot. Các lựa chọn còn lại dùng snapshot tin cậy hoặc cấu hình shipping. Khi shipment đã tồn tại, các giá trị nếu gửi phải khớp lựa chọn đã lưu; không thay carrier/service/kho đã có sau khi có request identity. Service còn trống của GHN/FAKE được suy ra từ parcel đã chốt; pickup còn trống chỉ bổ sung bằng cấu hình của đúng warehouse. Khác lựa chọn đã lưu trả 409 SHIPMENT_IDEMPOTENCY_CONFLICT. OrderCancelled đến trước shipment được lưu thành tombstone bền vững; yêu cầu tạo thủ công sau đó trả 409 SHIPMENT_ORDER_NOT_PAID và OrderPaid giao muộn không tạo/book shipment cho đơn đã hủy. Mỗi order chỉ có một shipment. Cùng Idempotency-Key và cùng yêu cầu trả lại shipment đã tạo; tái dùng khóa cho yêu cầu khác hoặc lựa chọn xung đột với shipment hiện có trả 409. Key đầu tiên được lưu trên shipment cùng fingerprint nội dung request; một key khác cho shipment đã gắn key cũng trả 409 SHIPMENT_IDEMPOTENCY_CONFLICT. Phản hồi thành công luôn là 201 với Location của shipment. Carrier tạm lỗi hoặc thiếu dữ liệu chuẩn bị giữ shipment PENDING_TRACKING với trackingCode=null; job retry dùng shipment.id làm request identity ổn định. Manual transaction ghi shipment/history/outbox trước khi gọi carrier; consumer OrderPaid còn ghi processed marker trong cùng transaction. Hai đường tạo dùng cùng khóa order và unique order_id, nên chạy đồng thời vẫn chỉ có một shipment và một creation event. ShipmentCreated ghi nhận creation PENDING_TRACKING, trackingCode=null; GET phản ánh tracking được bổ sung sau, không ghi thêm ShipmentCreated. SHIPPING_BOOKING_CARRIER=NONE giữ shipment PENDING_TRACKING với trackingCode=null và không lên lịch booking. GHN quote cùng FAKE booking tạo tracking FAKE- mà vẫn giữ shippingFee từ snapshot đã thanh toán. GHN booking chỉ dùng sandbox, dùng shipment.id làm client_order_code và đối soát mã này trước khi retry để tránh tạo vận đơn trùng sau timeout. TO_ADDRESS_CONFLICT thử lại một lần với phường và tỉnh; lịch sử shipment ghi nhận lần dùng địa chỉ dự phòng. expected_delivery_time được lưu khi GHN trả về. Khi tạo và khi retry, GHN/FAKE có thể điền serviceType còn trống từ parcel đã chốt và pickupAddress còn trống từ cấu hình của đúng warehouse. Default pickup chỉ dùng khi warehouse khớp default-warehouse-id. Không thay request identity hoặc lựa chọn đã lưu, không bịa parcel/người nhận/mã địa giới; thiếu parcel, địa chỉ người nhận hợp lệ hoặc cấu hình pickup tin cậy vẫn giữ PENDING_TRACKING.
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
         * Đọc chi tiết shipment
         * @description Yêu cầu SHIPPING.VIEW_SHIPMENT. ADMIN và SUPPORT_STAFF đọc mọi shipment; các actor khác chỉ đọc shipment có buyerId bằng sub của JWT. Shipment không tồn tại hoặc thuộc buyer khác đều trả cùng 404 SHIPMENT_NOT_FOUND. Không gọi commerce để quyết định quyền sở hữu.
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
         * Đọc tracking và lịch sử trạng thái shipment
         * @description Yêu cầu SHIPPING.VIEW_SHIPMENT. ADMIN và SUPPORT_STAFF đọc mọi shipment; các actor khác chỉ đọc shipment có buyerId bằng sub của JWT. Shipment không tồn tại hoặc thuộc buyer khác đều trả cùng 404 SHIPMENT_NOT_FOUND. Quyền sở hữu được kiểm tra trước khi đọc lịch sử. Chỉ đọc shipment và shipment_history đã lưu, không gọi carrier hoặc tạo sự kiện giả. history tăng dần theo createdAt, sau đó id; history=[] là hợp lệ với shipment chưa có lịch sử. trackingCode=null khi chưa được cấp. Để tìm shipment của order, dùng GET /api/v1/shipments?orderId={orderId}; data=[] nghĩa là chưa có shipment và giao diện có thể ẩn khối tracking.
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
         * Lấy danh sách nhà vận chuyển
         * @description Yêu cầu JWT hợp lệ và quyền SHIPPING.QUOTE; ADMIN không tự bỏ qua quyền này. Đọc metadata và trạng thái circuit breaker của adapter báo phí được chọn, không gọi thử nhà vận chuyển hoặc đọc/ghi cơ sở dữ liệu. SHIPPING_QUOTE_CARRIER chọn adapter này, fallback về SHIPPING_CARRIER khi chưa cấu hình. Carrier chỉ dùng để booking không xuất hiện trong danh sách. isDefault xác định adapter báo phí mặc định. available phản ánh trạng thái breaker hiện tại: false khi OPEN/FORCED_OPEN, true khi CLOSED/HALF_OPEN hoặc chưa có breaker. HALF_OPEN cho phép một lượt thử theo chính sách breaker; available không giữ chỗ và không bảo đảm GHN đang hoạt động. GHN được báo phí bằng SHIPPING_QUOTE_CARRIER=GHN, FAKE chỉ bật tường minh cho local/test; quote carrier NONE trả danh sách rỗng kể cả khi SHIPPING_BOOKING_CARRIER đã bật. GHN quote cùng FAKE booking chỉ trả GHN trong danh sách. Không tự chuyển sang FAKE khi GHN lỗi. Trả toàn bộ danh sách trong một trang logic.
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
    "/api/v1/shipping/provinces": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Lấy tỉnh/thành phố theo danh mục mới
         * @description Đọc /shiip/public-api/v3/master-data/province/all; parent_id=1 xác định tỉnh/thành phố thuộc Việt Nam. Không yêu cầu JWT tại gateway hoặc shipment-service; token được gửi kèm nhưng không hợp lệ vẫn bị từ chối. Dữ liệu đọc qua CarrierAdapter theo danh mục GHN v3 hai cấp sau sáp nhập: tỉnh/thành phố → phường/xã. Chỉ trả bản ghi status=1 và đúng parent_id. Code là _id của danh mục v3 được biểu diễn bằng chuỗi số nguyên dương chuẩn, tối đa 9 chữ số; không có số 0 ở đầu. Chế độ FAKE dùng fixture riêng. Trả toàn bộ danh sách trong một trang logic; không có tham số phân trang. Thông tin xác thực nhà vận chuyển chỉ được dùng ở backend. Danh mục hợp lệ được cache trong shipment-service theo GHN_MASTER_DATA_CACHE_TTL_MS, mặc định 300000ms. Chỉ cache kết quả đã validate/lọc active; hết TTL tải lại, lỗi không được cache và không dùng lại bản đã hết hạn.
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
         * Lấy phường/xã thuộc một tỉnh/thành phố
         * @description Đọc /shiip/public-api/v3/master-data/ward/all-by-province-id; chỉ trả phường/xã có parent_id trùng provinceCode. Tên chuẩn của địa giới được dùng nguyên văn khi báo giá. Không yêu cầu JWT tại gateway hoặc shipment-service; token được gửi kèm nhưng không hợp lệ vẫn bị từ chối. Dữ liệu đọc qua CarrierAdapter theo danh mục GHN v3 hai cấp sau sáp nhập: tỉnh/thành phố → phường/xã. Chỉ trả bản ghi status=1 và đúng parent_id. Code là _id của danh mục v3 được biểu diễn bằng chuỗi số nguyên dương chuẩn, tối đa 9 chữ số; không có số 0 ở đầu. Chế độ FAKE dùng fixture riêng. Trả toàn bộ danh sách trong một trang logic; không có tham số phân trang. Thông tin xác thực nhà vận chuyển chỉ được dùng ở backend. Danh mục hợp lệ được cache theo provinceCode trong GHN_MASTER_DATA_CACHE_TTL_MS, mặc định300000ms. Hết TTL tải lại; lỗi không cache và không fallback sang danh sách đã hết hạn.
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
         * Báo giá vận chuyển và ngày giao hàng dự kiến
         * @description Yêu cầu JWT hợp lệ và quyền SHIPPING.QUOTE; ADMIN không tự bỏ qua quyền. Địa chỉ nhận và pickup dùng mã _id GHN v3 hai cấp, được kiểm tra tỉnh → phường đang hoạt động. Tên chuẩn được resolve từ danh mục v3 rồi gửi POST /shiip/public-api/v2/shipping-order/preview với is_new_to_address=true và is_new_from_address=true; endpoint preview hiện do GHN công bố tại path v2 nhưng hỗ trợ mô hình địa chỉ mới. Người nhận phải có tên, số điện thoại và địa chỉ thật; pickup phải có địa chỉ cụ thể đã xác minh. Preview chỉ chạy thử, không tạo vận đơn: order_code phải rỗng; fee lấy từ total_fee, ETA từ expected_delivery_time. GHN_PAYMENT_TYPE_ID cấu hình bên trả phí, mặc định 1 là shop trả trong luồng trả trước SEPAY; GHN_REQUIRED_NOTE cấu hình chính sách kiểm hàng, mặc định KHONGCHOXEMHANG. cod_amount gửi bằng 0 vì luồng hiện tại không thu hộ. Tên và số điện thoại người gửi không gửi riêng sẽ theo hồ sơ ShopId được GHN công bố. Items cung cấp số lượng đơn vị và số SKU để tóm tắt nội dung; parcel là một kiện đã đóng gói. Khi GHN cần items theo kiện, quantity=1 là số kiện, không phải số đơn vị SKU. InsuranceValue là giá trị khai bảo hiểm tùy chọn: VND nguyên từ 0 đến 5.000.000, bỏ trống hoặc null gửi 0; không tự lấy subtotal, không cắt ngưỡng hoặc làm tròn. WarehouseId ánh xạ tới pickup được cấu hình; bỏ trống dùng defaultWarehouseId cho WH_001. Subtotal miễn phí lấy toàn bộ giá SKU hiện tại nhân số lượng từ catalog, độc lập insuranceValue. Subtotal lớn hơn hoặc bằng FREE_SHIPPING_THRESHOLD cho fee=0 sau khi có preview và ETA hợp lệ, trừ khi applyFreeShipping=false. Cờ tùy chọn này mặc định true khi bỏ trống hoặc null. Commerce gửi false cho đơn đấu giá để nhận phí carrier gốc rồi xét miễn phí theo giá đấu thắng bất biến; request không được cung cấp giá hay subtotal thay thế. SHIPPING_API_TIMEOUT_MS là ngân sách toàn bộ thao tác gồm lookup và retries. SHIPPING_RETRY_LIMIT là số retry tối đa sau lần đầu, chỉ dành cho lỗi tạm thời. Mỗi HTTP attempt GHN dùng min(GHN_HTTP_TIMEOUT_MS, deadline còn lại), mặc định GHN_HTTP_TIMEOUT_MS là1500ms; không chia deadline tổng theo số retries và không bảo đảm mọi retry đều được chạy. Danh mục province/wards hợp lệ có cache TTL mặc định5phút; phí preview, ETA và giá catalog không cache. Breaker theo carrier từ chối nhanh bằng 503 khi mở. Không tạo order, reservation hoặc dữ liệu shipment và không fallback sang FAKE.
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
         * Đọc lịch sử trạng thái shipment
         * @description Yêu cầu SHIPPING.VIEW_SHIPMENT. ADMIN/SUPPORT_STAFF đọc mọi shipment; actor khác chỉ đọc shipment có buyerId bằng sub, hoặc role SELLER với sellerId tin cậy bằng sub. Không có quyền sở hữu trả 404 SHIPMENT_NOT_FOUND. Đọc history đã lưu, không gọi carrier theo mỗi request. Sắp xếp changedAt giảm dần, sau đó id giảm dần. Trang vượt cuối trả 200, data=[] và tổng thực tế.
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
         * Cập nhật trạng thái shipment
         * @description Yêu cầu privilege tương ứng và một trong hai vai trò ADMIN hoặc SUPPORT_STAFF. Mọi nguồn cập nhật dùng chung quy tắc chuyển trạng thái và khóa shipment. Cho phép bỏ qua bước khi tiến về phía trước; DELIVERY_FAILED có thể trở lại OUT_FOR_DELIVERY để giao lại. DELIVERED, CANCELLED và RETURNED là trạng thái kết thúc; kể cả override cũng không cho DELIVERED -> IN_TRANSIT. Cùng trạng thái là no-op, trả 200 và không thêm history/event. Mỗi thay đổi được chấp nhận ghi status/version, đúng một history và một Shipment* outbox trong cùng transaction; event phát lên nexus.shipment.events. actor lấy từ JWT, source=MANUAL; reason được chuẩn hóa để audit. reason tùy chọn. Khi đích là CANCELLED trước pickup, hủy booking qua CarrierAdapter trước khi chốt trạng thái; carrier từ chối hoặc lỗi thì không ghi local cancellation. Khi chưa có trackingCode, thao tác thủ công chỉ được giữ nguyên trạng thái hoặc chuyển CANCELLED. Mọi thay đổi thủ công khác trả 409 SHIPMENT_INVALID_TRANSITION để giữ nguyên luồng retry booking PENDING_TRACKING.
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
         * Điều chỉnh trạng thái shipment có lý do
         * @description Yêu cầu privilege tương ứng và một trong hai vai trò ADMIN hoặc SUPPORT_STAFF. Mọi nguồn cập nhật dùng chung quy tắc chuyển trạng thái và khóa shipment. Cho phép bỏ qua bước khi tiến về phía trước; DELIVERY_FAILED có thể trở lại OUT_FOR_DELIVERY để giao lại. DELIVERED, CANCELLED và RETURNED là trạng thái kết thúc; kể cả override cũng không cho DELIVERED -> IN_TRANSIT. Cùng trạng thái là no-op, trả 200 và không thêm history/event. Mỗi thay đổi được chấp nhận ghi status/version, đúng một history và một Shipment* outbox trong cùng transaction; event phát lên nexus.shipment.events. actor lấy từ JWT, source=MANUAL; reason được chuẩn hóa để audit. Override bắt buộc reason có nội dung; đây là điều chỉnh có audit, vẫn tuân thủ quy tắc chuyển trạng thái. Khi đích là CANCELLED trước pickup, hủy booking qua CarrierAdapter trước khi chốt trạng thái; carrier từ chối hoặc lỗi thì không ghi local cancellation. Khi chưa có trackingCode, thao tác thủ công chỉ được giữ nguyên trạng thái hoặc chuyển CANCELLED. Mọi thay đổi thủ công khác trả 409 SHIPMENT_INVALID_TRANSITION để giữ nguyên luồng retry booking PENDING_TRACKING.
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
         * Nhận callback trạng thái carrier
         * @description Endpoint giao thức carrier được đánh dấu @ProtocolResponse; HTTP 200 giữ body xác nhận riêng, không bọc ApiResponse. GHN hỗ trợ cấu hình custom header ở portal; cấu hình X-Carrier-Signature bằng callback secret của adapter. Giá trị được so sánh constant-time trước khi parse payload và trước mọi ghi dữ liệu. Đây là token xác thực callback qua header, không phải khẳng định GHN tạo HMAC cho body. Thiếu/sai token hoặc chưa cấu hình secret trả 401 Problem Details và không đổi dữ liệu. Mỗi webhook trùng được chấp nhận 200, không lặp history/event; sự kiện cũ không được đảo ngược trạng thái. GHN OrderCode xác định shipment theo carrier/trackingCode; danh tính callback được tạo ổn định bằng hash của OrderCode, Type, Status và Time. Cùng status là no-op. Mỗi thay đổi hợp lệ ghi đúng một history và một Shipment* outbox. GHN dùng GHN_WEBHOOK_SECRET. Fake dùng FAKE_WEBHOOK_SECRET, cùng dạng callback nhưng không cần ShopID và Status là enum nội bộ. Status nằm trong danh tính để hai trạng thái khác nhau cùng timestamp vẫn được phân biệt; thay đổi Reason hoặc định dạng JSON không tạo danh tính mới.
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
             * @description Loại callback GHN.
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
            /** @description Lý do được chuẩn hóa và lưu cùng lịch sử. */
            reason?: string | null;
        };
        OverrideShipmentStatusRequest: {
            status: components["schemas"]["ShipmentStatus"];
            /** @description Lý do bắt buộc; chuỗi chỉ có khoảng trắng không hợp lệ. */
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
            /** @description Shop GHN gửi callback; phải khớp shopId đã cấu hình trong adapter. */
            ShopID: number;
            OrderCode: string;
            /**
             * @description Loại callback GHN.
             * @enum {string}
             */
            Type: "create" | "switch_status" | "update_weight" | "update_cod" | "update_fee" | "update_payment_type" | "cod" | "update_partial_return";
            /** @description Trạng thái GHN được ánh xạ sang đúng một ShipmentStatus nội bộ. */
            Status: string;
            /** Format: date-time */
            Time: string;
            /** @description Lý do carrier nếu có; được chuẩn hóa trước khi lưu. */
            Reason?: string | null;
            /** @description Mô tả carrier nếu không có Reason; được chuẩn hóa trước khi lưu. */
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
             * @description UUID seller order PAID tại commerce; không cần OrderPaid đã được giao tới shipment-service.
             */
            orderId: string;
            /**
             * Format: uuid
             * @description Chọn kho cho shipment mới. Bỏ trống dùng kho tin cậy trong snapshot hoặc kho mặc định đã cấu hình. Đổi sang kho khác cần pickup tin cậy cấu hình cho kho đó; thiếu kho/pickup trả 404 SHIPMENT_WAREHOUSE_NOT_FOUND. Nếu shipment đã tồn tại, giá trị gửi phải khớp kho đã lưu, nếu không trả 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
             */
            warehouseId?: string | null;
            /**
             * @description Chọn carrier đã đăng ký cho shipment mới; bỏ trống dùng lựa chọn từ snapshot hoặc cấu hình shipping. Carrier chưa đăng ký trả 400 SHIPMENT_INVALID_PARAMETER. Nếu shipment đã tồn tại, giá trị gửi phải bằng carrier đã lưu; khác lựa chọn trả 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
             * @example FAKE
             */
            carrier?: string | null;
            /**
             * @description Chọn dịch vụ hợp lệ cho shipment mới; bỏ trống dùng lựa chọn tin cậy hoặc mặc định của adapter. Dịch vụ không được hỗ trợ trả 422 SHIPMENT_NO_SERVICE. Nếu shipment đã tồn tại, giá trị gửi phải khớp lựa chọn đã lưu; khác lựa chọn trả 409 SHIPMENT_IDEMPOTENCY_CONFLICT.
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
            /** @description Null khi carrier chưa cấp mã; fake cấp mã ổn định theo shipment.id đã lưu. */
            trackingCode: string | null;
            status: components["schemas"]["ShipmentStatus"];
            /** @description Phí VND đóng băng từ snapshot OrderPaid hoặc snapshot PAID của commerce; API serialize thành JSON number. */
            shippingFee: number;
            /** @description Snapshot recipient, items, parcel và pickupAddress từ OrderPaid hoặc snapshot PAID của commerce. Đây là snapshot của đơn, độc lập với DTO quote #201; không tự đổi mã legacy thành mã GHN v3. Parcel có thể null; thiếu parcel hoặc địa chỉ người nhận hợp lệ vẫn chờ chuẩn bị ở PENDING_TRACKING. PickupAddress còn trống có thể bổ sung từ cấu hình của đúng warehouse khi tạo hoặc retry; default pickup chỉ dùng cho default-warehouse-id. GHN/FAKE suy ra serviceType còn trống từ parcel đã chốt; không tự tạo parcel/người nhận hoặc thay các lựa chọn dispatch đã lưu. */
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
            /** @description Các trạng thái đã lưu theo createdAt tăng dần, sau đó id; không tạo mốc giả khi rỗng. */
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
            /** @description Adapter mặc định do registry chọn. */
            isDefault: boolean;
            /** @description Trạng thái đủ điều kiện thử gọi theo circuit breaker; false khi OPEN/FORCED_OPEN. Không thực hiện probe mạng và không bảo đảm sức khỏe GHN tại thời điểm đọc. */
            available: boolean;
        };
        LocalityResponse: {
            /**
             * @description Mã _id của danh mục GHN v3 hai cấp, biểu diễn bằng chuỗi số nguyên dương chuẩn; không dùng ProvinceID/WardCode của hệ cũ.
             * @example 1003646
             */
            code: string;
            name: string;
        };
        /**
         * @description STANDARD cho kiện dưới 20.000 gram, ánh xạ GHN service_type_id=2. HEAVY cho kiện từ 20.000 gram, ánh xạ GHN service_type_id=5. Fake dùng cùng ngưỡng. ID số của GHN chỉ dùng nội bộ adapter.
         * @example STANDARD
         * @enum {string}
         */
        ShippingServiceType: "STANDARD" | "HEAVY";
        ShippingQuoteResponse: {
            /** @enum {string} */
            carrier: "GHN" | "FAKE";
            serviceType: components["schemas"]["ShippingServiceType"];
            /**
             * @description Phí khách phải trả sau khi áp dụng FREE_SHIPPING_THRESHOLD, đơn vị VND.
             * @example 35000
             */
            fee: number;
            /**
             * Format: date-time
             * @description Thời điểm dự kiến giao hàng có múi giờ, từ expected_delivery_time của preview hợp lệ.
             * @example 2026-11-13T16:59:59Z
             */
            estimatedDeliveryAt: string;
        };
        ShippingQuoteRequest: {
            toAddress: components["schemas"]["ShippingAddressRequest"];
            items: components["schemas"]["ShippingItemRequest"][];
            parcel: components["schemas"]["ParcelRequest"];
            /**
             * Format: uuid
             * @description UUID kho có mapping lấy hàng đã cấu hình; bỏ trống hoặc null dùng kho mặc định.
             */
            warehouseId?: string | null;
            /**
             * @description Giá trị khai bảo hiểm, đơn vị VND nguyên; bỏ trống hoặc null gửi 0. Không tự dùng subtotal, không tự cắt ngưỡng hoặc làm tròn. Giá trị âm, có phần lẻ hoặc vượt 5.000.000 trả 400 SHIPMENT_VALIDATION_FAILED.
             * @default 0
             * @example 200000
             */
            insuranceValue: number | null;
            /**
             * @description Bỏ trống, null hoặc true giữ chính sách miễn phí theo subtotal Catalog. False trả phí carrier gốc đã kiểm tra; Commerce dùng cho đơn đấu giá rồi áp dụng ngưỡng theo giá đấu thắng. Cờ này chỉ bỏ trợ phí, không nhận giá hoặc subtotal do client khai và không bỏ qua kiểm tra carrier/ETA.
             * @default true
             */
            applyFreeShipping: boolean | null;
        };
        ShippingAddressRequest: {
            /** @description Mã _id tỉnh/thành phố trong danh mục GHN v3. */
            provinceCode: string;
            /** @description Mã _id phường/xã đang hoạt động, thuộc provinceCode trong danh mục GHN v3. */
            wardCode: string;
            /** @description Dòng địa chỉ giao hàng; dùng tên line1 trong public request. */
            line1: string;
            recipientName: string;
            /**
             * @description Số điện thoại người nhận thật; số nội địa bắt đầu bằng 0 hoặc dạng +84.
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
            /** @description Khối lượng kiện đã đóng gói, đơn vị gram. */
            weightGrams: number;
            /** @description Chiều dài kiện, đơn vị cm. */
            lengthCm: number;
            /** @description Chiều rộng kiện, đơn vị cm. */
            widthCm: number;
            /** @description Chiều cao kiện, đơn vị cm. */
            heightCm: number;
        };
        PageInfo: {
            /** @enum {integer} */
            number: 0;
            /** @description max(1, số phần tử). */
            size: number;
            /** Format: int64 */
            totalElements: number;
            /**
             * @description Bằng 0 khi danh sách rỗng, ngược lại bằng 1.
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
            /** @description Chỉ xuất hiện khi yêu cầu có trace đang hoạt động. */
            traceId?: string;
            errors?: {
                field: string;
                code: string;
                detail: string;
            }[];
        };
    };
    responses: {
        /** @description Chuyển trạng thái không hợp lệ hoặc carrier từ chối hủy booking trước pickup. */
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
        /** @description Trạng thái đích xung đột quy tắc chuyển trạng thái hiện tại. */
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
        /** @description Callback token thiếu, sai hoặc adapter chưa cấu hình secret; không ghi dữ liệu. */
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
        /** @description Trạng thái carrier chưa có trong bảng ánh xạ nội bộ. */
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
        /** @description Carrier chưa đăng ký hoặc nội dung callback không hợp lệ. */
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
        /** @description Khóa idempotency, body, UUID/enum, carrier chưa đăng ký hoặc phân trang không hợp lệ. */
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
        /** @description Đơn không tồn tại tại commerce, hoặc kho/pickup cần chọn chưa được cấu hình. */
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
                 *       "detail": "Không tìm thấy đơn hàng",
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
        /** @description Commerce trả snapshot thiếu/sai hoặc không khớp orderId; không ghi shipment. */
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
                 *       "detail": "Snapshot đơn hàng không hợp lệ",
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
        /** @description Commerce timeout, circuit mở, lỗi kết nối hoặc lỗi upstream khác; gateway routing cũng có thể trả SERVICE_UNAVAILABLE. */
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
                 *       "detail": "Dịch vụ đơn hàng hiện không khả dụng",
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
        /** @description Khóa idempotency đã dùng cho yêu cầu khác, shipment đã gắn key khác, lựa chọn khác với shipment hiện có, hoặc commerce xác nhận đơn chưa PAID. Không tạo shipment bằng dữ liệu buyer/address do client tự khai. */
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
        /** @description Shipment không tồn tại hoặc không thuộc buyer đang truy cập. */
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
                 *       "detail": "Không tìm thấy tài nguyên được yêu cầu",
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
        /** @description Dữ liệu, địa chỉ, mã địa giới hoặc cấu trúc JSON không hợp lệ. Mỗi field lỗi có field, code và detail. */
        InvalidRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/problem+json": components["schemas"]["Problem"] & {
                    /** @enum {integer} */
                    status?: 400;
                    /** @enum {string} */
                    code?: "SHIPMENT_INVALID_REQUEST" | "SHIPMENT_VALIDATION_FAILED" | "SHIPMENT_INVALID_REQUEST_BODY" | "SHIPMENT_INVALID_PARAMETER" | "SHIPMENT_INVALID_ADDRESS";
                };
            };
        };
        /** @description Thiếu JWT hoặc JWT không hợp lệ; public endpoint chỉ trả 401 khi có token không hợp lệ được gửi kèm. Dịch vụ dùng SHIPMENT_UNAUTHENTICATED; gateway có thể trả UNAUTHENTICATED. */
        Unauthenticated: {
            headers: {
                /** @description Yêu cầu Bearer token hợp lệ. */
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
        /** @description JWT thiếu quyền yêu cầu của operation; vai trò ADMIN không thay thế quyền này. */
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
        /** @description WarehouseId không có trong cấu hình lấy hàng, hoặc SKU không tồn tại. */
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
        /** @description Phương thức HTTP không được hỗ trợ tại đường dẫn này. */
        MethodNotAllowed: {
            headers: {
                /** @description Các phương thức được hỗ trợ. */
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
        /** @description Không thể trả nội dung theo định dạng Accept được yêu cầu. */
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
        /** @description Nội dung POST không dùng định dạng JSON được hỗ trợ. */
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
        /** @description Nhà vận chuyển không cung cấp dịch vụ phù hợp cho tuyến hoặc kiện hàng. */
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
        /** @description Gateway giới hạn số yêu cầu; giữ Retry-After khi có. */
        RateLimited: {
            headers: {
                /** @description Thời gian chờ khi gateway cung cấp. */
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
        /** @description Lỗi xử lý bất ngờ; không trả stack trace hoặc thông tin bí mật. */
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
        /** @description Carrier hoặc catalog trả dữ liệu không hợp lệ, thiếu fee/ETA hoặc sai envelope. */
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
        /** @description Nhà vận chuyển trả danh sách địa giới không hợp lệ hoặc sai envelope. */
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
        /** @description Gateway chưa tìm thấy hoặc không kết nối được shipment-service. */
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
        /** @description Nhà vận chuyển không khả dụng, hết deadline, breaker mở hoặc cấu hình carrier thiếu/sai. Gateway có thể trả SERVICE_UNAVAILABLE trước khi tới dịch vụ. */
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
        /** @description Nhà vận chuyển/catalog không khả dụng, hết deadline, breaker mở hoặc cấu hình carrier thiếu/sai. Gateway có thể trả SERVICE_UNAVAILABLE trước khi tới dịch vụ. */
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
        /** @description Gateway không nhận được phản hồi từ dịch vụ trong thời gian cho phép. */
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
                /** @description Chỉ số trang bắt đầu từ 0. */
                page?: number;
                /** @description Số phần tử tối đa mỗi trang. */
                size?: number;
                /** @description Lọc theo UUID đơn; vẫn áp dụng quyền sở hữu. */
                orderId?: string;
                /** @description Lọc theo trạng thái shipment nội bộ. */
                status?: components["schemas"]["ShipmentStatus"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Shipment nhìn thấy được và thông tin phân trang. */
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
                 * @description Khóa ổn định cho cùng yêu cầu tạo; không tái dùng cho nội dung khác.
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
            /** @description Shipment mới hoặc kết quả của yêu cầu idempotent đã xử lý. */
            201: {
                headers: {
                    /**
                     * @description Đường dẫn đọc shipment đã tạo.
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
                /** @description UUID shipment, không phải UUID order. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Shipment nhìn thấy được. */
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
                /** @description UUID shipment, không phải UUID order. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Tracking hiện tại và lịch sử trạng thái theo thời gian. */
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
            /** @description Danh sách kết quả và thông tin một trang logic. */
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
    getShippingProvinces: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Danh sách kết quả và thông tin một trang logic. */
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
                 * @description Mã _id tỉnh/thành phố từ danh mục GHN v3; không dùng mã tỉnh của hệ ba cấp.
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
            /** @description Danh sách kết quả và thông tin một trang logic. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LocalityListResponse"];
                };
            };
            /** @description Thiếu, rỗng, sai định dạng hoặc không tồn tại provinceCode. GHN trả data=null cho province_id không hợp lệ cũng được đổi thành lỗi địa giới 400. */
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
                 *         "line1": "Địa chỉ giao hàng đã xác minh",
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
            /** @description Danh sách kết quả và thông tin một trang logic. */
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
                /** @description Chỉ số trang bắt đầu từ 0. */
                page?: number;
                /** @description Số dòng lịch sử tối đa mỗi trang. */
                size?: number;
            };
            header?: never;
            path: {
                /** @description UUID của shipment. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Lịch sử đã lưu và thông tin phân trang. */
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
                     *           "description": "Carrier xác nhận đang vận chuyển",
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
                /** @description UUID của shipment. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "IN_TRANSIT",
                 *       "reason": "Đã đối chiếu carrier"
                 *     }
                 */
                "application/json": components["schemas"]["UpdateShipmentStatusRequest"];
            };
        };
        responses: {
            /** @description Shipment sau thay đổi hoặc kết quả no-op. */
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
                /** @description UUID của shipment. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "status": "IN_TRANSIT",
                 *       "reason": "Support xác nhận kiện hàng đang vận chuyển"
                 *     }
                 */
                "application/json": components["schemas"]["OverrideShipmentStatusRequest"];
            };
        };
        responses: {
            /** @description Shipment sau thay đổi hoặc kết quả no-op. */
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
                 * @description Namespace carrier; GHN nhận callback OrderCode/Status/Type/Time.
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
            /** @description Callback đã xử lý, cùng trạng thái hoặc bản giao lại đã được nhận trước đó. */
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
