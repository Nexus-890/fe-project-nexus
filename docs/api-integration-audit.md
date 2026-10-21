# Đối chiếu API TRUE và FE — 21/10/2026

Nguồn: `E:\fsoft-project\nexus-api-endpoints.xlsx`, sheet `Endpoints`, các dòng endpoint 2–138. Cột H có 19 TRUE và 118 FALSE; H1 cũng là boolean FALSE, nên cột được hiểu theo yêu cầu của người dùng. File Excel được giữ nguyên.

Đã fetch `origin/develop` tại commit `7a1f6df` và kết thúc merge đang dở bằng commit `73ff2d5`, giữ commit profile local. Không push lên remote.

**19/19 API TRUE có controller BE. FE đã gắn 7 endpoint; 11 endpoint chưa có lời
gọi riêng từ FE; 1 JWKS là API hạ tầng.** Trong 11 endpoint chưa gọi, CAT-03 đã
có giao diện duyệt danh mục dùng CAT-04/tree; phần thiếu là GET theo ID, không
phải thiếu toàn bộ giao diện category. Ứng dụng này chỉ dành cho Buyer: 9 endpoint
chưa gọi thuộc quản trị/Seller, không phải yêu cầu thiếu của Buyer. USR-06 đã
được luồng hồ sơ `/users/me` đáp ứng; CAT-03 đã được luồng category tree đáp ứng.
Các kiểm tra direct API không đồng nghĩa đã có màn hình FE.

| Excel row | ID | Method/path | FE | Kết quả gọi từ FE |
|---|---|---|---|---|
| 2 | AUTH-01 | POST `/api/v1/auth/register` | `/sign-up` | Browser thật 201, đăng ký thành công |
| 3 | AUTH-02 | POST `/api/v1/auth/login` | `/sign-in` | Browser thật 200, chuyển vào app |
| 8 | AUTH-07 | GET `/.well-known/jwks.json` | Hạ tầng, không cần gọi từ browser | Gateway/service lấy key thành công 200 |
| 9 | USR-01 | GET `/api/v1/users/me` | Header/profile | Browser thật 200, form được điền |
| 10 | USR-02 | PUT `/api/v1/users/me` | Profile Save Changes | Browser thật 200, UI cập nhật; dữ liệu test đã khôi phục |
| 13 | USR-05 | GET `/api/v1/users` | Chưa có màn hình quản lý user | Chưa có call FE |
| 14 | USR-06 | GET `/api/v1/users/{id}` | Chưa gắn; profile dùng `/me` | Chưa có call FE |
| 50 | CAT-01 | POST `/api/v1/categories` | Chưa có create-category UI | Chưa có call FE |
| 51 | CAT-02 | PATCH `/api/v1/categories/{id}` | Chưa có edit-category UI | Chưa có call FE |
| 52 | CAT-03 | GET `/api/v1/categories/{id}` | Đã có category UI qua tree; chưa gọi endpoint này | GET theo ID chưa gắn; dự kiến dùng khi mở form sửa |
| 53 | CAT-04 | GET `/api/v1/categories/tree` | Home/header/category/search | API thật 200; Home dùng dải icon, bộ lọc vẫn dùng tree |
| 55 | CAT-06 | DELETE `/api/v1/categories/{id}` | Chưa có delete-category UI | Chưa có call FE |
| 56 | PRD-01 | POST `/api/v1/products` | Chưa có create-product UI | Chưa có call FE |
| 57 | PRD-02 | PUT `/api/v1/products/{id}` | Chưa có edit-product UI | Chưa có call FE |
| 58 | PRD-03 | GET `/api/v1/products/{id}` | Product detail | API thật 200, tên/2 SKU/2 ảnh từ PostgreSQL |
| 59 | PRD-04 | GET `/api/v1/products` | Search/category listing | Browser thật 200 và lọc categoryId; số sản phẩm phụ thuộc bộ seed hiện tại |
| 60 | PRD-05 | GET `/api/v1/products/mine` | Chưa có My products UI | Chưa có call FE |
| 61 | PRD-06 | PATCH `/api/v1/products/{id}/status` | Chưa có status UI | Chưa có call FE |
| 62 | PRD-07 | DELETE `/api/v1/products/{id}` | Chưa có delete-product UI | Chưa có call FE |

## Giao diện danh mục và phiên đăng nhập hiện tại

Home dùng dải ngang 10 danh mục theo thiết kế: **Phones, Laptops, Cameras,
Watches, Audio, Fashion, Gaming, Home, Books, Collectibles**. Mỗi ô icon 56×56,
desktop chia đều, mobile cuộn ngang trong dải. Theo yêu cầu mới nhất, nhãn/icon/link
được hardcode theo thiết kế, luôn hiển thị độc lập với response category. Thanh
header cũng cố định 11 mục theo bản thiết kế cũ, không chèn các tên từ DB.
Tree API vẫn dùng cho dropdown tìm kiếm và bộ lọc sản phẩm.
`seed-catalog.sql` có 10 danh mục gốc tương ứng và các sản phẩm/SKU/ảnh thật
để kiểm tra từng link.

Theo yêu cầu mới, AuthProvider lưu access token vào localStorage với key
`nexus.accessToken`, khôi phục sau hydration và gọi lại `/users/me`. Reload
trang giữ phiên còn hợp lệ; đăng xuất hoặc 401 của phiên hiện tại xóa token.
Lúc khôi phục, trạng thái là `authenticating` để `/profile` không chuyển về
sign-in trước khi kiểm tra xong. Nếu trình duyệt chặn localStorage, helper không
làm crash ứng dụng. Không lưu mật khẩu hoặc thêm API refresh-token giả.

## Cart và kết nối BE thật

`CRT-02` còn FALSE trong workbook nhưng develop đã có controller. FE trước đây mock=true, hardcode `localhost:4010` và yêu cầu response chứa các field BE không trả. Đã sửa FE dùng API origin chung, đọc `id/userId/status/items`, chuẩn hóa `unitPrice` số thành chuỗi, giữ auth token. Browser demo đã nhận POST 201, hiện `Added to cart.`; GET cart xác nhận quantity iPhone tăng 1 → 3 sau thêm 2.

Đã xóa module mock, các nhánh bypass HTTP, auth stub trong runtime và cờ mock
khỏi cấu hình. `.env.local` chỉ cấu hình API origin/proxy; `npm run dev` gọi
Spring BE thật. Postman profile server giả đã được xóa; `npm run test:profile`
hiện dùng ứng dụng và backend đang chạy.

Dữ liệu nằm trong các database PostgreSQL thật `nexus_demo_user_db`,
`nexus_demo_catalog_db`, `nexus_demo_commerce_db`. Các tên này đã được cấu hình
trong `infra/local-dev/.env` và datasource nhận khi chạy Maven/IDE thông thường.
Các DB gốc được giữ nguyên; `catalog_db` cũ bị lỗi Flyway thiếu V3 trước V4.

## Các giới hạn tìm thấy

- BE product list chỉ xử lý `categoryId/page/size`, bỏ qua `q/sort`. Browser gửi từ khóa không tồn tại vẫn nhận 200 và toàn bộ sản phẩm. Vì vậy HTTP 200 chưa chứng minh tìm kiếm/sắp xếp đúng.
- `USR-05` chưa có lọc `gender`; dùng `sort` và `direction` riêng; response thiếu `identityNumber` so với mô tả Excel.
- `PRD-05` chưa xử lý `status` filter. Product list đã được bổ sung `imageUrl` từ ảnh chính trong DB; detail vẫn có mảng ảnh riêng.
- Product DELETE yêu cầu caller là owner, kể cả ADMIN; khác mô tả Admin/Seller trong Excel.
- 11 endpoint chưa có lời gọi riêng gồm USR-05/06, CAT-01/02/03/06 và
  PRD-01/02/05/06/07. CAT-03 là thiếu standalone GET; category UI đã có qua tree.
- CAT-03 response hiện không có description. `/products/mine` thiếu
  description/auctionEnable, còn GET detail công khai chỉ trả ACTIVE; cần làm rõ
  contract trước khi hoàn thiện form quản trị/sửa DRAFT/INACTIVE.

Bản issue đã sửa theo phạm vi Buyer nằm trong [missing-fe-issues.md](missing-fe-issues.md).
Các bản nháp quản trị/Seller trước đây không còn là yêu cầu của ứng dụng Buyer.
Chỉ lưu nội dung để sao chép, chưa tạo issue trên hệ thống bên ngoài.

## Bằng chứng kiểm tra

- Unit/transport/contract: `npm run test:auth` **45/45 pass**, bao gồm localStorage và giữ thumbnail BE cho card. Full TypeScript check pass sau khi tạo lại route types; ESLint các file thay đổi pass.
- Browser sau cập nhật UI/localStorage: `npm run test:profile -- --reporter=line` **5/5 pass** trong 13,6 giây với Next/Spring/PostgreSQL thật. Gồm redirect anonymous, login/profile GET/PUT, product detail/cart lưu DB, reload giữ phiên, logout và token lỗi 401 xóa token. Không có route interception hoặc server thay thế.
- Visual QA mới nhất: header cố định 11 mục trên một hàng desktop; Home 10 icon; mobile không tràn trang. 12/12 ảnh sản phẩm trên trang đầu và ảnh Seiko tải thành công. Bằng chứng ở `%TEMP%\nexus-product-nav-fix-20261021`.
- Backend ảnh: 29/29 focused tests pass; API thật trả `imageUrl` cho 23/23 sản phẩm ACTIVE. Thêm một truy vấn ảnh theo lô mỗi trang, không gọi riêng từng sản phẩm.
- SQL thực tế: 23/23 sản phẩm ACTIVE có SKU ACTIVE giá dương. Mỗi nhóm trong 10 nhóm trên Home đều có sản phẩm mua được.
- Browser live demo: login/profile/category/list/detail/cart thành công, mobile 375px không tràn ngang; token và mật khẩu không ghi vào bằng chứng.
- Smoke API thật: **19/19 API TRUE pass**, tổng **33/33 checks**, **107 assertions**, exit 0. Gồm Admin CRUD danh mục, Seller create/update/status/detail/list/mine/delete sản phẩm, user list/detail, JWKS, register/login/profile, SKU và cart. Kiểm tra từ chối Buyer với API quản trị trả 403 đúng dự kiến. Các API chưa có FE vẫn chỉ được xác minh bằng direct HTTP.

Chạy lại bằng script [demo](../../be-project-nexus/infra/demo/README.md). Kết quả trạng thái HTTP, mapping 19 API và kiểm tra UI được tổng hợp trong tài liệu này. Báo cáo verification JSON và screenshot chi tiết giữ local, không đưa vào Git; screenshot của lượt kiểm tra nằm ở `%TEMP%\nexus-api-audit-20261021`.

Dùng `http://localhost:3000` với phiên Next dev hiện tại; hostname
`127.0.0.1` bị lỗi HMR và không hydrate. Các service do người dùng chạy trong IDE
được giữ nguyên. Commerce 8083 được bật tạm để kiểm tra rồi dừng; người dùng
cần chạy `commerce-service` khi muốn tự thêm giỏ hàng.
