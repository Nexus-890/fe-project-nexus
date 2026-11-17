Triển khai giao diện Admin cho cây danh mục, quản lý kho, nhập tồn, số dư và sổ biến động theo SKU theo style Figma. Bổ sung `description` trong phản hồi danh mục để sửa đúng dữ liệu đã lưu; cấu hình hệ thống sử dụng contract BE #217 đã bàn giao.

Closes #228

-
  ```php-template
  FE AdminCategoriesPage / adminCatalogService: tạo, sửa, chuyển parent, xóa danh mục; hiển thị lỗi 400/409; xử lý DELETE 204.
  ```
1.
   ```php-template
   FE AdminWarehousesPage / AdminStockPage / AdminStockLedger: quản lý kho, chọn kho theo tên, nhập tồn, xem balances và phân trang movement ledger; không có form adjustment.
   FE AdminConfigurationPage / adminConfigService: lọc theo service, hiển thị applyMode/configuredValue, read-only khóa Keycloak; parse GET đầy đủ và PUT {key,value} riêng, refetch sau lưu.
   BE catalog-service / delivered OpenAPI: trả description đã lưu, không đổi migration hoặc endpoint.
   Tests / generated DTOs / docs: kiểm thử transport và browser; sinh lại DTO, gồm drift commerce/shipment có sẵn trên develop.
   ```

Config keys: none. Dùng lại cấu hình origin FE hiện có (`NEXT_PUBLIC_API_URL` / `API_PROXY_TARGET`).

Validation lượt review: 419 unit/transport test, 9 browser Admin, 58 browser regression đạt (72 skip theo môi trường). Config-service verify đạt 46 test, nhóm category security/response-contract đạt 17 test. Probe FE -> config-service thật đạt; Keycloak/owner refresh có kiểm soát. Lint, typecheck, DTO check và Webpack build đạt. Full catalog verify còn 39 lỗi môi trường Docker/Testcontainers.

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
- [x]
  ```
  The keys with their values; editing one shows the backend's 400 for a wrong type — 9 browser scenarios và probe FE service -> config-service thật đã đạt: GET 57 khóa, PUT 200, đọc lại giá trị đã lưu, backend 400 CONFIG_VALUE_INVALID.
  ```

1. Chạy gateway/backend theo hướng dẫn dự án, FE với `NEXT_PUBLIC_API_URL=<gateway-origin>`, đăng nhập ADMIN và mở `/backoffice/categories`, `/backoffice/warehouses`, `/backoffice/stock`. Mở thêm /backoffice/configuration với config-service và Keycloak được cấu hình theo hướng dẫn #217.
2. Trong `fe-project-nexus`, chạy `npm run test:unit`, `npm run test:admin-catalog`, `npm run lint`, `npm run typecheck`, `npm run generate:types:check`, `npm run build -- --webpack`. Build jar trong `be-project-nexus/config-service` bằng `.\mvnw.cmd verify`, rồi chạy FE `npm run test:admin-config-live`. Full catalog verify cần Docker.
3.
   ```
   Danh mục được lưu và đọc lại đúng mô tả/parent; lỗi 400/409 hiển thị trong form; xóa 204 thành công.
   Kho được tạo/sửa/lọc theo trạng thái; nhập tồn cập nhật balances và ledger theo SKU/kho.
   SELLER và SUPPORT_STAFF không truy cập các màn hình Admin mới.
   Cấu hình hiển thị/sửa giá trị từ API; giữ giá trị đang sửa và hiện lỗi 400; API chưa có thì hiện unavailable/retry, không dựng dữ liệu giả.
   ```

- [ ] `.\mvnw.cmd verify` passes in every service touched — lượt review: config-service đạt 46 test; catalog 99 pass/39 errors do Docker/Testcontainers không khả dụng. Kết quả 150 catalog test ở lần triển khai đầu là bằng chứng lịch sử.
- [ ] The service starts against PostgreSQL with ddl-auto: validate — lần review hiện tại không xác nhận lại được vì Docker/Testcontainers không khả dụng.
- [x] No secret, .env, .idea/ or log file in the diff — chỉ có mã nguồn, test fixture, schema và tài liệu; thông tin đăng nhập trong browser test là fixture tổng hợp.
- [x] New endpoints added to docs/api/gateway-permissions.md and to the service's public-endpoints when public — không thêm endpoint BE; các endpoint đã bàn giao có sẵn trong catalogue. SYS endpoints đã bàn giao trong #217.
- [x] Branch is up to date with develop and has no conflict markers — đồng bộ `origin/develop`, kiểm tra `git diff --check`.

- Không triển khai BE cấu hình, persistence hoặc audit `SystemConfigUpdated`: #217 đã bàn giao. Phần Admin auctions thuộc #260.
- DTO cấu hình sinh từ OpenAPI config-service đã bàn giao. Browser evidence là HTTP simulation; probe FE -> config-service thật dùng Keycloak/refresh có kiểm soát, chưa xác nhận gateway/realm triển khai.

Review fix: 419 unit/transport + 9 browser Admin tests đạt; probe FE service -> config-service thật đạt, bao gồm hai response 200 và lỗi sai kiểu 400. Chạy `npm run test:admin-config-live` sau khi build jar config-service để tái lập.
