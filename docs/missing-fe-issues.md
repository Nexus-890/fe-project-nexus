# [FE][Buyer] Validate and stabilize Buyer FE–BE integration

## Summary

Validate and stabilize Buyer workflows against existing backend APIs: registration,
login, own profile, catalog/category browsing, product detail and add-to-cart.
Ensure session persistence, actual product images, pagination and correct error
handling. This issue does not implement Admin/Support Staff or Seller interfaces.

## Changes

- **Authentication:** Register/login with real APIs, send Bearer tokens on protected
  requests, persist `nexus.accessToken`, restore valid sessions and clear them on logout/401.
- **Own Profile:** Read/update the current Buyer's supported profile fields using `/users/me`.
- **Catalog:** Read category tree for filters and product lists/details with real images,
  SKUs and prices; retain the fixed header/Home navigation from the supplied design.
- **Add to Cart:** Submit the selected SKU and positive quantity; display success only
  after a successful real backend response.
- **UI/Error Handling:** Handle loading, empty, retry, validation and applicable API errors.
- **Cache:** Refresh the current profile after successful edits and clear private data
  when the current session ends; retain only supported product query parameters.

## API

| Method | Path | Access | Success |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | 201 |
| POST | `/api/v1/auth/login` | Public | 200 |
| GET | `/api/v1/users/me` | Buyer + PROFILE.VIEW | 200 |
| PUT | `/api/v1/users/me` | Buyer + PROFILE.UPDATE | 200 |
| GET | `/api/v1/categories/tree` | Public | 200 |
| GET | `/api/v1/products` | Public | 200 |
| GET | `/api/v1/products/{id}` | Public; ACTIVE products | 200 |
| POST | `/api/v1/carts/me/items` | Buyer + CART.UPDATE | 201 |

FE connection settings: `NEXT_PUBLIC_API_URL` and `API_PROXY_TARGET`.
Local seeded DB selection: `USER_DB_NAME`, `CATALOG_DB_NAME`, `COMMERCE_DB_NAME`.
Browser storage key: `nexus.accessToken`; never persist passwords.

## Acceptance criteria

- Buyer can register and log in using real backend responses.
- Reload restores a valid session; logout/current-session 401 removes the token and private cache.
- Buyer can read/update only supported own-profile fields; changes persist after reload.
- Product/category pages display real product images, prices and SKU details.
- Category filtering uses `categoryId`; pagination sends 0-based `page` and supported `size`.
- Header/Home navigation stays fixed to the supplied design rather than expanding from DB categories.
- Add-to-cart sends only `skuId` and a positive integer `quantity`, receives 201 and persists correct cart data.
- Anonymous add-to-cart requires sign-in; failed requests do not show success or invent data.
- Loading, empty, validation, applicable 400/401/403/404/409 and network errors have appropriate UI states.
- Application runtime does not substitute mock auth, product or cart responses.

## How to test

1. Start PostgreSQL, required infrastructure and Config/Discovery/User/Catalog/Commerce/Gateway services.
2. Start FE with `npm run dev` and open `http://localhost:3000`.
3. Register a unique Buyer or sign in with the sample Buyer account.
4. Reload, open Profile, edit a supported field, save and verify persistence.
5. Browse categories/products, change pages and verify product images, prices and SKUs against API responses.
6. Select a SKU/quantity, add it to the cart and verify POST 201 plus persisted cart quantity using the real API/DB.
7. Log out and verify token removal. Test an invalid/expired token and confirm 401 clears the session.
8. Check applicable validation, empty, not-found and network-error states without fake backend responses.

## Checklist

- [ ] Frontend lint, type checking and production build pass for the final diff.
- [ ] Relevant tests pass in every modified backend service.
- [ ] No secrets, local `.env`, IDE files or generated logs are committed.
- [ ] Buyer scenarios are verified against real backend APIs/PostgreSQL.
- [ ] The final branch is up to date with `develop` and contains no conflicts.

## Out of scope / follow-ups

- Admin/Support Staff user management and category POST/PATCH/DELETE interfaces.
- Seller My products/create/edit/status/delete interfaces.
- Full cart-view/update/remove UI, checkout and orders; current scope is add-to-cart.
- Keyword search and sorting until BE supports `q`/`sort`; do not claim they work because HTTP returns 200.
- Avatar/password/reputation/penalty workflows without implemented contracts.

## Notes for reviewers

- A TRUE backend endpoint is not automatically a requirement for the Buyer frontend.
- Nine uncalled TRUE endpoints belong to Admin/Seller functionality. CAT-03 is public,
  but category viewing already uses the tree API; USR-06 self-read is already covered by `/users/me`.
- GET `/categories/{id}` must not be described as Admin-only.
- Phone is read-only in the current profile contract. Do not overwrite missing/unsupported fields with empty values.
- The cart header button/cart page is not implemented by the existing add-to-cart integration.
- The header search-category selection is not yet forwarded into the search URL; track that Buyer wiring gap separately.
- Do not mark unchecked build/verify/error scenarios as passed without evidence.

## Reviewer

TBD
