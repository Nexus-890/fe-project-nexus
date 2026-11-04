# Functional requirements and coverage

This is the source-backed frontend scope. The owning feature and delivered API define current behavior; upstream product requirements need reconciliation before expanding scope. Status refers to implementation in source, not a claim that a deployed backend has passed acceptance.

| ID | Requirement | Current coverage/source |
| --- | --- | --- |
| AUTH-01 | Register an account with client validation and typed server errors | Implemented: SignUpPage, signUpSchema, auth service |
| AUTH-02 | Registration does not automatically authenticate | Implemented: provider/form workflow |
| AUTH-03 | Sign in, load current user and render authenticated header actions | Implemented: Provider, useAuth, SignInPage, shop/header |
| AUTH-04 | Retry a profile failure without discarding a valid token on network/5xx | Implemented: provider retryProfile behavior |
| AUTH-05 | Clear session/private cache on logout or current-profile 401 | Implemented: provider generation and private-query cleanup |
| AUTH-06 | Preserve account isolation across pending login/profile/cart requests | Implemented with generation guards; requires runtime regression checks |
| AUTH-07 | Persist a session, refresh a token, recover a password or use social login | Outside current implementation; UI references are not an implemented API flow |
| CAT-01 | Browse the public category tree and navigate nested categories | Implemented: home/shop/category UI, catalog service |
| CAT-02 | Resolve category slug or id on the server; unknown category gives 404 | Implemented: CategoryPage, findCategory, route boundary |
| CAT-03 | List products by category with loading/error/empty states and paging | Implemented frontend; delivered API supports categoryId/page/size |
| CAT-04 | Preserve query/category/sort/page in search URL and navigation history | Implemented UI state/helper behavior |
| CAT-05 | Execute real free-text search and newest/price sorting | Backend contract gap: delivered ProductController does not accept q/sort |
| CAT-06 | Display product detail, images, SKU options and selected price | Implemented: ProductDetailPage and gallery/SKU components |
| CAT-07 | Keep product link resolution and quantity integer/minimum rules | Implemented: detail helpers and QuantityPicker |
| CAT-08 | Show all product images in sortOrder with selectable thumbnails and wrapping/keyboard navigation | ProductGallery; detail API supplies images; see [gallery scope and evidence](../features/product-image-gallery.md) |
| CAT-09 | Show the first ordered image on a product card | Frontend supports optional summary images; delivered list API has no images, so live cards retain placeholders until BE #122 provides them |
| CAT-10 | Show a placeholder for absent images and broken image URLs on detail and cards | Shared ProductImage fallback; acceptance includes HTTP 404 and no uncaught page error |
| CART-01 | Anonymous add-item click requests sign-in without sending a private API call | Implemented: product detail interaction |
| CART-02 | Authenticated add-item request sends skuId and quantity only | Implemented frontend mutation/service; real authorization/contract needs integration evidence |
| CART-03 | Use current-session cache/feedback only; show request failures accurately | Implemented mutation/session policy; tested scenarios determine evidence |
| CART-04 | Render a cart, edit/remove items and synchronize the header count | Implemented: ShoppingCartPage, shared useCart and cart services |
| CART-05 | Checkout and pay | Outside current frontend scope |
| ROUTE-01 | Preserve `/login`, `/register` and `/category/[slug]` aliases | Implemented route redirects |
| DEV-01 | Build UI with explicit auth/product/cart stand-ins | Development/test only, blocked in production |
| OTHER-01 | Auction bidding, order management, payment, shipment and notification screens | Not implied by backend service existence; separate frontend features |

## Rules preserved by the rebuild

- Keep every existing useful formatter, tree/URL/page helper, parser, form schema and UI interaction; a deleted wrapper/file must have an equivalent destination.
- Preserve `formatVND` decimal-string precision and current null/invalid fallback. Money normalization at the wire boundary and display formatting are different operations.
- Keep API page zero-based while URLs remain one-based. Invalid page values follow the existing fallback to page 1.
- Keep category-id links and encoded slugs, SKU fallback, gallery empty/keyboard behavior and quantity at least 1.
- Keep public catalog browsing independent of authentication. Protect cart/auth data by session.
- Keep client form-only confirmation/terms behavior separate from the delivered registration wire DTO.

## Sources and change control

See [feature flows](../features/index.md), [API contract](../api/api-contract.md), source in `features/components/service/providers`, and the generated types from delivered OpenAPI. The repository's [main README](../../../README.md) describes the broader system, not a guarantee of frontend feature coverage.

The previous auth documentation linked the [API catalogue](https://drive.google.com/file/d/1KIJsr87F-6TWieBbie9CVzgCBTPsM4Zk/view), [business rules](https://docs.google.com/spreadsheets/d/1x2ulrpa9n5Xmgb8G7b3zJ9sisHjYJG7wGycalQGHB-U/edit), and [SRS](https://drive.google.com/file/d/1nw7_WwZoWhjgA1WiZJzu37ps_MisI5Ls/view). These remain upstream references; this rebuild does not claim they were reapproved or that all their requirements are implemented. Record discrepancies as needs-decision with a concrete source before changing behavior.
