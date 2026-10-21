## Summary

Display catalog images returned by the backend, keep the navigation fixed to the supplied design, and persist authentication across reloads. Product cards now receive a primary `imageUrl` from PostgreSQL through the catalog API instead of rendering an empty image block.

This Buyer-only MR also aligns the cart response with the existing commerce API, removes application mock modes, prepares sample PostgreSQL data, and classifies backend APIs that are outside the Buyer application's scope.

Related to #185. Use `Closes #185` only after confirming that the issue's complete Buyer acceptance criteria are satisfied.

## Changes

- Render product-card images from `imageUrl`, with an explicit unavailable state for missing/broken images.
- Return the primary product image for public lists, category lists, Seller lists and product detail. List enrichment uses one batched image query per page.
- Restore the fixed design navigation: 11 header links and 10 Home icon categories. Search dropdowns and product filters continue to use backend data.
- Store the access token under `localStorage["nexus.accessToken"]`, restore the session through GET `/api/v1/users/me`, and clear the token on logout/current-session 401.
- Use the shared API origin and actual `CartResponse` for add-to-cart; preserve numeric price normalization.
- Remove product/cart mock branches, application auth stubs and the Postman profile simulation.
- Configure local datasource database names and seed sample products, SKUs and images in physical PostgreSQL databases.
- Document the 19 TRUE workbook endpoints. Nine uncalled endpoints are outside Buyer scope; own-profile/category viewing are already served by `/users/me` and the tree API.

## API

No new endpoint paths are added. Product responses gain nullable `imageUrl`.

| Method | Path | Current frontend usage |
|---|---|---|
| POST | `/api/v1/auth/register` | Sign-up |
| POST | `/api/v1/auth/login` | Sign-in and token persistence |
| GET / PUT | `/api/v1/users/me` | Profile read/update and session restoration |
| GET | `/api/v1/categories/tree` | Search dropdowns and category filters |
| GET | `/api/v1/products` | Public/category product listing with images |
| GET | `/api/v1/products/{id}` | Public ACTIVE product detail |
| POST | `/api/v1/carts/me/items` | Authenticated add-to-cart, HTTP 201 |

The following BE endpoints exist and were part of the direct API audit. Seller CRUD screens are a follow-up:

| Method | Path | Access | Success | Relevant errors |
|---|---|---|---|---|
| GET | `/api/v1/products/mine` | SELLER + PRODUCT.LIST | 200 | 400, 401, 403 |
| POST | `/api/v1/products` | PRODUCT.CREATE | 201 | 400, 401, 403, 404 |
| PUT | `/api/v1/products/{id}` | PRODUCT.UPDATE; owner or Admin | 200 | 400, 401, 403, 404 |
| PATCH | `/api/v1/products/{id}/status` | SELLER/ADMIN + PRODUCT.UPDATE; owner or Admin | 200 | 400, 401, 403, 404 |
| DELETE | `/api/v1/products/{id}` | SELLER/ADMIN + PRODUCT.DELETE; owner including Admin | 204 | 401, 403, 404, 409 |

These error lists describe known contract paths, not an exhaustive assertion that every possible database/runtime failure has been tested.

Config keys:

- Added: `USER_DB_NAME`, `CATALOG_DB_NAME`, `COMMERCE_DB_NAME`.
- Existing FE connection settings: `NEXT_PUBLIC_API_URL`, legacy `NEXT_PUBLIC_API_BASE_URL`, `API_PROXY_TARGET`.
- Removed application mode flags: `NEXT_PUBLIC_AUTH_STUB`, `NEXT_PUBLIC_PRODUCT_DETAIL_MOCK`, `NEXT_PUBLIC_CART_MOCK`.
- Browser storage key: `nexus.accessToken`; no password is persisted.

## Acceptance criteria

- [x] Product listing/card images come from real backend/PostgreSQL data.
- [x] Header/Home navigation follows fixed design labels/order and does not append database categories.
- [x] Login restores after reload; logout and current-session 401 remove the saved token.
- [x] Profile reads/updates and add-to-cart work against the real backend.
- [x] Application runtime does not substitute fake product/auth/cart responses.
- [x] Missing frontend integrations and backend editing-contract limitations are documented.

## How to test

1. Start Docker PostgreSQL, Kafka and Redis. Use `infra/local-dev/.env` with the seeded `nexus_demo_*` database names.
2. Start Config Server, Discovery, User, Catalog, Commerce and Gateway from their service directories. Commerce must be running on 8083 for add-to-cart.
3. In `fe-project-nexus`, run `npm run dev`, then open `http://localhost:3000`.
4. Check the fixed header and 10-icon Home strip. Database category names must not add extra navigation links or wrap the desktop header into another row.
5. Open Watches or another category. Product cards must display images, including the Seiko 5 product. Confirm the product-list response contains `imageUrl`.
6. Sign in with the sample Buyer, reload, open Profile, save an edited name and restore it. Logout must clear `nexus.accessToken`.
7. Open a product, select a SKU and add it to the cart. Confirm POST 201 and persisted cart quantity through the real cart API/DB.
8. Run `npm run test:profile -- --reporter=line` against the running FE/BE for the five real browser scenarios.

## Validation

- FE unit/transport/contract suite: 45/45 passed, including thumbnail preservation.
- FE full TypeScript check: passed after `next typegen` refreshed stale generated route types.
- ESLint: changed navigation and product-image frontend files passed.
- Focused catalog tests: 29/29 passed, including five thumbnail tests and existing delete/SKU tests.
- Catalog compile: passed; the running IDE service loaded the change.
- Live API: 23/23 listed ACTIVE products returned a nonempty `imageUrl`.
- Browser image/navigation QA: 12/12 first-page product images loaded; Seiko image loaded; fixed header stayed on one desktop row; mobile page had no horizontal overflow.
- Earlier real browser auth/profile/cart suite: 5/5 passed after localStorage changes. The latest image/navigation changes were checked separately above.

## Checklist

- [ ] Full `.\mvnw.cmd verify` passes in every touched backend service. Focused tests/compile are recorded above; full verify is not claimed.
- [x] Catalog starts against PostgreSQL with `ddl-auto: validate`.
- [ ] Final staged diff contains no secrets, `.env`, IDE files or generated logs.
- [x] No new endpoint path/security policy is introduced.
- [ ] Branch is refreshed against current remote `develop` immediately before submission.
- [x] Changed FE files pass targeted lint and the full TypeScript check.
- [ ] A fresh production FE build has been completed for the final diff.
- [x] Relevant real-backend integration evidence is recorded without tokens/passwords.

## Out of scope / follow-ups

- User/category administration and Seller product-management screens; these are outside this Buyer application, not unfinished Buyer acceptance criteria.
- Search/sort support for public product listing, and status/search/sort filtering for `/products/mine`.
- Owner-readable complete editing data for DRAFT/INACTIVE products: `/mine` lacks `description`/`auctionEnable`, while public detail only returns ACTIVE products.
- Backend authorization-rule changes, refresh-token APIs, checkout and a cart-management page.
- Replacing the existing backend `StubOrderReferenceChecker`: its default implementation always returns false, so a live delete-with-orders 409 scenario is not established by the current demo; the rejection path is covered by focused tests.

## Notes for reviewers

The static navigation is intentional presentation configuration requested by the designer/user. Product data, images, prices, profile data and cart mutations still use real APIs. Isolated unit-test transports do not provide data to the running application.

Review the final staged diff rather than staging generated logs or unrelated local work. Confirm issue #185's scope before changing `Related to` into an automatic closing reference.
