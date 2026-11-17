Triển khai giao diện Admin cho cây danh mục, quản lý kho, nhập tồn, số dư và sổ biến động theo SKU theo style Figma. Bổ sung `description` trong phản hồi danh mục để sửa đúng dữ liệu đã lưu; màn hình cấu hình và xử lý lỗi 400 đã có ở FE, phần tích hợp thật chờ BE #217 theo phạm vi đã thống nhất.

Closes #228

-
  ```php-template
  FE AdminCategoriesPage / adminCatalogService: tạo, sửa, chuyển parent, xóa danh mục; hiển thị lỗi 400/409; xử lý DELETE 204.
  ```
1.
   ```php-template
   FE AdminWarehousesPage / AdminStockPage / AdminStockLedger: quản lý kho, chọn kho theo tên, nhập tồn, xem balances và phân trang movement ledger; không có form adjustment.
   FE AdminConfigurationPage / adminConfigService: nhóm/tìm khóa, sửa từng giá trị, discard, boolean control, hiển thị lỗi sai kiểu và trạng thái API chưa sẵn sàng; DTO là proposal chờ #217.
   BE catalog-service / delivered OpenAPI: trả description đã lưu, không đổi migration hoặc endpoint.
   Tests / generated DTOs / docs: kiểm thử transport và browser; sinh lại DTO, gồm drift commerce/shipment có sẵn trên develop.
   ```

Config keys: none. Dùng lại cấu hình origin FE hiện có (`NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET`).

Validation: lint, typecheck, generated DTO check và production build đạt; 416 unit/transport test, 8 browser Admin, 58 browser regression đạt (71 skip theo môi trường); catalog-service verify đạt 150 test với UTC. Browser sử dụng HTTP simulation, không phải gateway thật.

- [x]
  ```php-template
  Tree with create (name, slug, description, parent), edit, move and delete — browser test tạo/đọc/sửa/chuyển về root/xóa; PostgreSQL test xác nhận lưu và đọc description.
  ```
- [x]
  ```php-template
  The 409 for a category with products or children and the 400 for an invalid move appear as messages — browser HTTP simulation và transport tests xác nhận giữ nguyên thông báo backend.
  ```
- [x]
  ```php-template
  Manage warehouses, intake stock for a SKU, balances and the movement ledger per SKU — browser HTTP simulation xác nhận tạo/sửa/status kho, nhập SKU, balances/ledger refresh và phân trang.
  ```
- [x]
  ```php-template
  No adjustment form (D18) — chỉ đọc lịch sử adjustment; không có form hoặc request POST adjustments.
  ```
- [ ]
  ```
  The keys with their values; editing one shows the backend's 400 for a wrong type — FE và HTTP simulation đã đạt, nhưng chưa xác nhận với BE thật: SYS-01/SYS-02 chưa được triển khai trên develop, do #217 phụ trách. DTO và gateway routing còn cần đối chiếu khi #217 bàn giao.
  ```

1. Chạy gateway/backend theo hướng dẫn dự án, FE với `NEXT_PUBLIC_API_URL=<gateway-origin>`, đăng nhập ADMIN và mở `/backoffice/categories`, `/backoffice/warehouses`, `/backoffice/stock`. Cấu hình chỉ hoạt động thật sau khi #217 bàn giao API tương thích.
2. Trong `fe-project-nexus`, chạy `npm run test:unit`, `npm run test:admin-catalog`, `npm run lint`, `npm run typecheck`, `npm run generate:types:check`, `npm run build`. Trong `be-project-nexus/catalog-service`, chạy `.\mvnw.cmd verify '-Duser.timezone=UTC'`.
3.
   ```
   Danh mục được lưu và đọc lại đúng mô tả/parent; lỗi 400/409 hiển thị trong form; xóa 204 thành công.
   Kho được tạo/sửa/lọc theo trạng thái; nhập tồn cập nhật balances và ledger theo SKU/kho.
   SELLER và SUPPORT_STAFF không truy cập các màn hình Admin mới.
   Cấu hình hiển thị/sửa giá trị từ API; giữ giá trị đang sửa và hiện lỗi 400; API chưa có thì hiện unavailable/retry, không dựng dữ liệu giả.
   ```

- [x] `.\mvnw.cmd verify` passes in every service touched — catalog-service: 150 tests đạt với `'-Duser.timezone=UTC'`; lệnh không chỉ định UTC ban đầu lỗi vì PostgreSQL từ chối alias `Asia/Saigon` của JVM máy này.
- [x] The service starts against PostgreSQL with ddl-auto: validate — các integration test catalog khởi tạo Spring context với PostgreSQL và validate.
- [x] No secret, .env, .idea/ or log file in the diff — chỉ có mã nguồn, test fixture, schema và tài liệu; thông tin đăng nhập trong browser test là fixture tổng hợp.
- [x] New endpoints added to docs/api/gateway-permissions.md and to the service's public-endpoints when public — không thêm endpoint BE; các endpoint đã bàn giao có sẵn trong catalogue. SYS proposal chưa phải endpoint đã triển khai.
- [x] Branch is up to date with develop and has no conflict markers — đồng bộ `origin/develop`, kiểm tra `git diff --check`.

- Không triển khai BE cấu hình, persistence hoặc audit `SystemConfigUpdated`: #217 phụ trách. Phần Admin auctions thuộc #260.
- SYS DTO trong `docs/api/system-config-217-proposal.openapi.json` là đề xuất FE, chưa phải hợp đồng BE đã bàn giao. Chưa có bằng chứng browser-to-gateway thật cho các flow mới; browser evidence là HTTP simulation. Quyền và giới hạn nghiệp vụ vẫn do backend kiểm tra.
