# Buyer shop browser evidence — 10 November 2026

## Review corrections — 11 November 2026

The review suite passed **8/8**: three navigation cases at375/768/1440px,
three shared sample journeys/layout cases and two seller form cases. Sample
screenshots were refreshed after the continuity correction; they are clearly
labeled design previews. They do not establish payment settlement.

| Sample screen | 375px | 1440px |
| --- | --- | --- |
| Cart | [cart](cart-375.png) | [cart](cart-1440.png) |
| Checkout | [checkout](checkout-375.png) | [checkout](checkout-1440.png) |
| Paid | [paid](paid-375.png) | [paid](paid-1440.png) |
| Unpaid | [unpaid](unpaid-375.png) | [unpaid](unpaid-1440.png) |
| Guest order detail | [detail](sample-order-375.png) | [detail](sample-order-1440.png) |

[Seller live upload evidence](seller-live-upload-20261111.json) records an
actual authenticated FE upload, new PostgreSQL row, public Supabase HTTP200
and matching SHA256. Browser success and the image/link were observed; raw
HTTP201 and a screenshot were not retained for that live operation. The two
seller form tests use explicit HTTP stand-ins for validation/multipart201,
ownership403 and storage503; these are separate from the live proof.

See [review response](../../../../docs/buyer-shop/review-response-20261111.md)
for scope exclusions, remaining Backend dependencies and the concurrent
localhost:3000 server limitation.

## Original catalog evidence

The catalog, product detail and gallery browser suite passed **22/22 cases**. After adding the visit watchlist case and final presentation countdown, the focused home/watchlist/detail run passed **3/3 cases**, covering **23 unique scenarios** in total. The existing runner stopped its fixture/dev servers and restored `tsconfig.json` after each run.

```powershell
$env:NEXUS_TEST_APP_PORT='3212'
$env:NEXUS_TEST_API_PORT='3921'
$env:NEXUS_TEST_PROVIDER_PORT='3923'
$env:NEXUS_TEST_DIST_DIR='.next-catalog-shop'
node scripts/test-browser.mjs tests/catalog.spec.ts tests/product.spec.ts tests/product-gallery.spec.ts
node scripts/test-browser.mjs tests/catalog.spec.ts tests/product.spec.ts --grep 'home renders live|product hearts share|detail information tabs'
```

Screenshots use the explicit local HTTP fixture. The fixture intentionally supplies missing-image placeholders or solid-color gallery images. They verify layout and interactions; they do **not** establish live Supabase media delivery or live backend compatibility. The task's live database/media evidence is recorded separately.

| View | Evidence |
| --- | --- |
| Home, 1440px | [home-desktop.png](home-desktop.png) |
| Home, 375px | [home-mobile.png](home-mobile.png) |
| Product detail, 1440px | [product-detail-desktop.png](product-detail-desktop.png) |
| Product detail, 375px | [product-detail-mobile.png](product-detail-mobile.png) |

Coverage includes campaign navigation, voucher state, public auction prices, live category-based products, query/category chip navigation, paging/history, independent loading/error/retry states, visit watchlist navigation/removal, keyboard-accessible detail tabs, SKU price/quantity changes, anonymous/member cart behavior, late-response/session guards, ordered media, failed-image fallbacks and stable gallery dimensions. Mobile catalog checks include overflow and minimum touch targets.

The installed Next runtime emitted an existing security advisory on startup and continued after retry. No dependency upgrade is included in this task.

## Live buyer login and cart — 11 November 2026

[buyer-live-cart-20261111.jpg](buyer-live-cart-20261111.jpg) is an actual local
FE/Keycloak/gateway/Commerce/catalog/DB screenshot, unlike the fixture screenshots
listed above. The user-requested buyer credential was synchronized in Keycloak
and local gitignored env, and the service account was given profile-read access.
Browser Authorization Code + PKCE completed and redirected to `/cart` with
**Hi Nexus Buyer**, three image-backed items and total **16.888.000 VND**.
No auth/cart mock was used. Five order fixtures remain available for list/detail
testing; their PAID sample state does not establish actual SePay reconciliation.

Seed behavior and verification: [buyer demo data](../../../../be-project-nexus/docs/buyer-shop-buyer-test-data.md).
