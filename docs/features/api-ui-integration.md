# Existing UI and delivered API integration

Reviewed on 2026-11-02 (Asia/Saigon) on `fsa_ChungTQ/refactor/251-fe-rebuild-fe-project-nexus`. This inventory covers UI already present in the frontend and endpoints verified against backend controller source and delivered OpenAPI. A wired service is not evidence that a live deployment passed acceptance.

## UI with API calls

| Existing UI | Backend operation | Frontend owner | Status |
| --- | --- | --- | --- |
| Sign-up form | POST `/api/v1/auth/register` | [SignUpPage](../../features/SignUpPage.tsx), provider and [authService](../../service/authService.ts) | Wired; success routes to sign-in; no role is submitted |
| Sign-in and signed-in header | POST `/api/v1/auth/login`, then GET `/api/v1/users/me` | [SignInPage](../../features/SignInPage.tsx), [Provider](../../providers/Provider.tsx), authService | Wired with in-memory token, profile retry and session isolation |
| Home/header category navigation, category filter | GET `/api/v1/categories/tree` | [HomePage](../../features/HomePage.tsx), [ShopLayout](../../features/ShopLayout.tsx), [CategoryPage](../../features/CategoryPage.tsx), [catalogService](../../service/catalogService.ts) | Wired; server category resolution and client navigation share the contract |
| Product listing, category selection and pagination | GET `/api/v1/products?categoryId=...&page=...&size=...` | [SearchPage](../../features/SearchPage.tsx), [CategoryListing](../../features/CategoryListing.tsx), catalogService | Wired; the header category selection now submits its slug, which SearchPage resolves to the category ID |
| Product details, image gallery and SKU selector | GET `/api/v1/products/{id}` | [ProductDetailPage](../../features/ProductDetailPage.tsx), catalogService | Wired; embedded images/SKUs already support local selection, so no extra SKU GET is needed |
| Add to Cart | POST `/api/v1/carts/me/items` with `{skuId, quantity}` | ProductDetailPage, [cartService](../../service/cartService.ts) | Wired to the delivered additive operation; preserves the returned snapshot price |
| Cart page and header quantity badge | GET `/api/v1/carts/me` | [useCart](../../features/useCart.ts), [CartPage](../../features/CartPage.tsx), ShopLayout | Wired; private requests require the authenticated session |
| Cart quantity and Remove controls | Provisional PUT/DELETE `/api/v1/carts/me/items/{lineId}` | useCart and cartService | Prepared service calls only; these methods are absent from this backend revision. Rejection restores the optimistic change and explains the failure |

Backend source: [AuthController](../../../be-project-nexus/user-service/src/main/java/com/group5/userservice/iam/AuthController.java), [UserController](../../../be-project-nexus/user-service/src/main/java/com/group5/userservice/iam/UserController.java), [CategoryController](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/category/CategoryController.java), [ProductController](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/controller/ProductController.java), [SkuController](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/controller/SkuController.java), [CartController](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/controller/CartController.java). The matching delivered [user](../../../be-project-nexus/docs/api/openapi/user-service.yaml), [catalog](../../../be-project-nexus/docs/api/openapi/catalog-service.yaml) and [commerce](../../../be-project-nexus/docs/api/openapi/commerce-service.yaml) specifications define the success envelope and generated DTOs.

## Existing controls with remaining dependencies

| Control or backend capability | Why it is not an additional working integration |
| --- | --- |
| Text search, Newest/price sorting, listing type, seller trust and condition filters | The product list controller accepts only categoryId/page/size. URL or local checkbox changes do not implement the missing query/filter behavior |
| Advanced search | Existing button has no search-panel flow or delivered advanced query contract |
| Google sign-in/sign-up, Forgot password, Remember me | No matching social/recovery/persistent-session flow is implemented by the delivered auth controller. Existing login token remains in memory |
| Header Notifications | Backend delivers GET `/api/v1/notifications` and `/unread-count` with NOTIFICATION.VIEW. The header currently has a placeholder bell and no list panel or unread state; this requires its own UI/data flow rather than calling an endpoint without presenting its result |
| Watchlist, Saved, vouchers/deals, shipping destination | Existing controls are placeholders; no matching delivered business API/controller was found in this revision |
| My Nexus/profile edit | GET/PUT `/api/v1/users/me` exist; current header renders the fetched user but there is no profile editing form to submit PUT |
| Seller/admin product, SKU and category management | Backend CRUD/status operations exist, but no corresponding management screen/form exists in this frontend |
| Order creation/list/detail/status/history | [OrderController](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/order/controller/OrderController.java) exists, but checkout/order screens are absent. The Cart task explicitly keeps checkout disabled with a visible reason |

Notification evidence: [NotificationController](../../../be-project-nexus/notification-service/src/main/java/com/group5/notificationservice/notification/NotificationController.java), [delivered notification specification](../../../be-project-nexus/docs/api/openapi/notification-service.yaml). No notification panel, new management screen or checkout flow is added by this integration work.

## API origins and verification

[next.config.ts](../../next.config.ts) accepts `API_PROXY_TARGET` as a server-side HTTP(S) origin and forwards `/api/v1/*` to it. Browser requests can use same-origin paths; [configs/api.ts](../../configs/api.ts) uses the same target for server-side catalog reads when no explicit `NEXT_PUBLIC_API_URL` is supplied. An explicit public API origin or request-context origin still takes precedence. Configure the actual gateway origin and restart the frontend when changing proxy settings. Do not append `/api/v1` to an origin value.

The user-requested `CART_API_BASE_URL = ""` remains in cartService. A blank Cart origin uses same-origin browser paths and therefore the configured proxy; filling that constant overrides this path without adding the missing update/remove backend methods. Explicit development fixtures remain opt-in and must not replace a failed live request.

The header category regression scenario checks that selection reaches the products request as categoryId, survives URL refresh, and clears when All Categories is submitted. Live gateway/auth/catalog/cart evidence and the commands actually executed belong in the task's implementation report. Pending backend operations and unsupported filters remain explicit even when fixture tests pass.
