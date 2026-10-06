# Auth client và phiên trong memory

## Phạm vi và contract

Đây là plumbing cho sign-up/sign-in/header, không phải implementation các trang.
Access token chỉ nằm trong memory của `AuthProvider`. Không dùng localStorage,
sessionStorage, Redux persist hoặc TanStack cache persister. F5 trở về anonymous;
refresh-token flow và revoke token phía server chưa nằm trong issue này.

Contract Sprint 1 viết tay tạm thời theo issue và catalogue. Đây là ngoại lệ cho
quy tắc generate types từ OpenAPI trong CONTRIBUTING.md; khi BE có OpenAPI cần
đối chiếu/generate lại types và cập nhật fixtures cùng lúc.

| Method/path | Kết quả |
| --- | --- |
| POST `/api/v1/auth/register` | 201 `UserResponse`, không tự đăng nhập |
| POST `/api/v1/auth/login` | 200 `{accessToken, expiresIn, tokenType: "Bearer"}` |
| GET `/api/v1/users/me` | 200 `UserResponse`, bắt buộc Bearer |

RegisterRequest có `identityNumber`, `address` và các field yêu cầu khác; response
không có password/passwordHash/identityNumber. FE không chọn hoặc gửi default role.
Enum gender/roles/status chưa chốt nên giữ wire values là string, không tự áp enum DB.
`fieldErrors: Record<string, string[]>` là extension RFC7807 tạm thời của fixture;
parser chuẩn hóa `errors` dạng record nếu BE dùng tên đó, không giả định mọi backend
đều có cùng shape. Core lỗi có `type`, `title`, `status`, `detail`, `instance`,
extension `traceId`; HTTP status thực tế là nguồn xác định mã lỗi.

Nguồn:
- [Catalogue](https://drive.google.com/file/d/1KIJsr87F-6TWieBbie9CVzgCBTPsM4Zk/view)
- [Business Rules](https://docs.google.com/spreadsheets/d/1x2ulrpa9n5Xmgb8G7b3zJ9sisHjYJG7wGycalQGHB-U/edit)
- [SRS](https://drive.google.com/file/d/1nw7_WwZoWhjgA1WiZJzu37ps_MisI5Ls/view)

## Mỗi file làm gì?

| File | Trách nhiệm |
| --- | --- |
| `types/api.ts` | Request/response, RFC7807, typed error và `ApiResult<T>` |
| `lib/api-client.ts` | HTTP GET/POST; đọc token mới nhất từ getter, parse response/error |
| `configs/api.ts` | Re-export factory mới; bỏ client Vite/Redux/refresh chưa hoàn thiện |
| `lib/api-result.ts` | Chuyển failure result thành rejected Promise cho TanStack |
| `hooks/api-query-options.ts` | Cấu hình GET chung dùng được bởi hook và `fetchQuery` |
| `hooks/useApiQuery.ts` | Custom GET hook mỏng, không tự quản lý loading/cache |
| `features/auth/api.ts` | `register`, `login`, `me`; kiểm tra response runtime |
| `features/auth/useMeQuery.ts` | Query profile theo session generation; không tự gọi khi chưa có token |
| `features/auth/AuthProvider.tsx` | Sở hữu token; login/register mutations; clear phiên và cache khi logout |
| `features/auth/useAuth.ts` | Cho component truy cập auth context, báo lỗi khi thiếu provider |
| `providers/AppProviders.tsx` | Tạo QueryClient ổn định và compose hai Provider |
| `app/layout.tsx` | Chỉ mount provider, không đặt fetch/state logic tại route |
| `features/auth/testing/stub.ts` | Backend giả trong memory để build UI trước API thật |
| `tests/auth-api.test.ts` | Transport, endpoint, fixture và typed error regression tests |
| `tests/auth-query.test.ts` | Query cache, enable/disable, cancellation và error adapter |
| `tests/browser/AuthProbe.tsx` | Consumer React kiểm thử session trong browser, không phải auth page production |
| `tests/browser/auth-acceptance.mjs` | Suite Playwright kiểm tra 14 hành vi session, storage và race condition |
| `scripts/test-auth.mjs` | Typecheck riêng auth rồi chạy Node tests, không cần thêm test dependency |
| `scripts/auth-smoke.mjs` | Tạo/dọn route smoke tạm để tái hiện acceptance tests |

## Quy trình hoạt động

```text
Root layout → AppProviders → QueryClientProvider → AuthProvider → feature

GET: useMeQuery → useApiQuery → useQuery → authApi.me → apiClient.get

Login: useAuth.signIn → useMutation → authApi.login
       → Provider cập nhật token trong memory → GET /me qua QueryClient
       → user trong query cache → useAuth.user

Register: useAuth.register → useMutation → authApi.register
          → ApiResult<UserResponse> cho caller, không đổi phiên

Logout: vô hiệu generation → abort login → clear token/context
        → cancel/remove private queries → reset mutation observers
```

Token getter đọc ô memory của Provider ngay tại thời điểm request; `lib/api-client.ts` không gọi
React hook. Context chỉ sở hữu token, còn profile lấy từ Query cache để tránh hai
bản user state lệch nhau. Query key dùng generation không bí mật, không dùng token.
Late response của phiên cũ không được phép cập nhật phiên mới.

Transport trả `{ok:true,data}` hoặc `{ok:false,error}`. Query/mutation adapter throw
typed error object để TanStack nhận biết thất bại. `useAuth.signIn/register` bắt lại
typed error thành `ApiResult` cho page; không throw chuỗi, không toast/redirect từ client.
Cancellation giữ semantics AbortSignal. Login mutation chỉ trả UserResponse, không
đưa LoginResponse chứa token vào MutationCache. Mutation observers reset sau khi xong;
`gcTime: 0` loại dữ liệu credentials khi mutation không còn được dùng.

## Sử dụng trên trang auth

```tsx
"use client";
import { useAuth } from "@/features/auth/useAuth";
import type { LoginRequest } from "@/types/api";

export function useSignInForm() {
  const { signIn, status, user, signOut } = useAuth();
  async function submit(credentials: LoginRequest) {
    const result = await signIn(credentials);
    if (!result.ok) {
      // Map result.error.fieldErrors vào form; detail là lỗi toàn form.
      return result.error;
    }
    // Trang sign-in quyết định redirect, không phải transport/provider.
    return result.data;
  }
  return { submit, status, user, signOut };
}
```

`status` là `anonymous | authenticating | authenticated | error`; `user` và `accessToken`
bằng null khi signOut. Không đọc token trên server để render header: signed-in
header phải là Client Component dùng `useAuth()`. Nếu login đã cấp token nhưng
`/me` lỗi mạng/5xx, giữ token và báo `error`; gọi `useAuth().retryProfile()` để lấy profile.
GET hook không tự gọi lại initial error trước khi người dùng retry.
Chỉ 401 của phiên hiện tại mới làm hết phiên; signIn fail trước khi có token vẫn anonymous.

## Cấu hình và stub

`NEXT_PUBLIC_API_BASE_URL` là API **origin**, ví dụ `http://localhost:8080`.
Endpoint đã có `/api/v1`; không thêm prefix đó lần thứ hai. Mặc định gọi cùng origin.
Nếu FE/BE khác origin, backend cần cấu hình CORS cho Authorization header.

Để dựng UI trước API thật:

```bash
NEXT_PUBLIC_AUTH_STUB=true npm run dev
```

Stub không có tài khoản mặc định: gọi register trước, rồi login với dữ liệu form đó.
Token giả sinh runtime. Stub nằm trong memory, reload xóa cả dữ liệu fixture.
Không bật stub trong production; Provider báo lỗi thay vì giả vờ đăng nhập thành công.
Props transport/baseUrl của Provider là cấu hình khởi tạo; remount nếu cần đổi.

## Kiểm thử

```bash
npm run test:auth
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`test:auth` typecheck cả Provider/hooks/API nhưng không kiểm tra UI/Storybook unrelated.
Không dùng kết quả targeted suite để tuyên bố toàn repo build sạch.

Browser smoke có thể tái hiện bằng route tạm:

```bash
node scripts/auth-smoke.mjs prepare
npm run dev
# Mở /auth-smoke, dùng controls và state/evidence JSON để kiểm tra.
# Sau kiểm thử:
node scripts/auth-smoke.mjs cleanup
```

Để chạy suite tự động bằng Playwright runner có sẵn, import
`runAuthAcceptance` từ `tests/browser/auth-acceptance.mjs`, rồi gọi
`await runAuthAcceptance(page, "http://localhost:3101")` với Playwright `Page`.
Server dùng port tương ứng: `npm run dev -- --port 3101`.
Không thêm Playwright vào dependency ứng dụng chỉ để chạy smoke.

Acceptance cần kiểm tra storage không bị auth thay đổi, /me có đúng Bearer,
public endpoints không có Bearer, typed 400, signOut clear user/token/cache,
logout trong login/me pending không hồi sinh phiên, chuyển user không lấy cache
cũ, 401 hết hạn clear phiên và F5 trở về anonymous.

### Kết quả xác minh (2026-10-06)

- `npm run test:auth`: 16/16 tests pass, strict typecheck auth pass.
- ESLint trên toàn bộ file auth thay đổi: pass.
- Playwright: 14 checks pass, không có browser console/page errors; gồm
  logout lúc request pending, chuyển account, 401 và retry sau 503.
- Toàn repo chưa lint/typecheck/build sạch: stories có lỗi quote và UI/Storybook
  thiếu dependency từ baseline. Không sửa những phần unrelated trong issue này.

In-memory loại việc lưu token trong web storage; không có nghĩa runtime JavaScript
của trang hoàn toàn không thể bị truy cập khi xảy ra XSS.
