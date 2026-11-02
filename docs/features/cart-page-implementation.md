# Cart page implementation — 2026-11-02

Branch: `fsa_ChungTQ/refactor/251-fe-rebuild-fe-project-nexus`, base `2a2147d1`. After the [initial readiness review](cart-page-readiness.md), the user authorized implementing the scoped frontend and service requests now, with the Cart base URL left blank for them to fill later. The backend is unchanged.

## Delivered frontend

- `/cart` delegates to CartPage with signed-out, loading, load-error/retry, populated and empty states.
- CartLine shows optional metadata, snapshot unit price, quantity, exact line total and Remove. Metadata failure retains a usable fallback line; current catalog prices never determine totals.
- CartSummary shows quantity/subtotal and disabled checkout with a visible reason. Coupons, discounts, shipping/tax, price alerts, seller trust and Save for Later are excluded.
- Header navigation/count is available at 375px and shares the page's private session cache.
- `features/useCart.ts` composes generic hooks/services: optimistic totals/count, serialized edits across remounts, rollback guarded by cache ownership, authoritative refetch and session-generation guards.
- Service/type/money helpers reuse the single HTTP boundary and generated Cart wire DTO. QuantityPicker adds optional disabled/item-label/commit-on-blur behavior while preserving product-detail defaults.

## API handoff

[cartService.ts](../../service/cartService.ts) intentionally contains `CART_API_BASE_URL = ""`. Fill only the Cart gateway origin when ready; `/api/v1` is already in endpoint constants. Blank resolves to browser same-origin. Explicit context baseUrl overrides it; tokens/signals/errors/envelopes still pass through the shared transport. Auth/catalog retain their existing common origin.

GET and POST match the delivered backend. PUT absolute quantity and bodyless DELETE use the older #111 draft paths as **provisional service contracts**. This backend still lacks both. Confirm/adapt constants, body, response and permissions when BE lands; future delivered contract changes must regenerate wire types. A URL alone cannot implement the missing endpoints. Until then calls may fail and the UI rolls back instead of faking success. See the [Cart integration guide](cart.md).

No fake cart is enabled in production. Browser tests explicitly intercept HTTP; service tests run the actual Axios boundary against local HTTP servers. The existing Postman catalog simulation is unrelated to future cart writes and was not presented as update/remove backend evidence.

## Task acceptance

| Requirement | Frontend behavior / evidence |
| --- | --- |
| Quantity 2 shows snapshot unit and line price | Implemented; service/browser scenarios verify it while catalog price differs |
| 150000 × 3 immediately shows 450000 | Optimistic cache and BigInt cents; delayed-response browser scenario |
| Rejected quantity restores quantity/subtotal and explains why | Cache rollback and normalized reason; delayed rejection browser scenario |
| Last-line removal gives empty state/catalog link | Optimistic state and DELETE 204 browser scenario |
| Refresh keeps contents | Server reread after same-account reauthentication; uninterrupted auth remains outside scope |
| 375×812 no overflow/clipping, targets ≥44px | Browser assertions and screenshots include long titles/missing metadata |
| Different reviewer adds/edits real API and records cart ID | Pending BE update/remove and a different human reviewer; fixtures do not satisfy this criterion |

## Verification

Checks run on 2026-11-02 (Asia/Saigon); the audit's earlier 51-unit/13-browser results are the pre-implementation baseline.

| Check | Result |
| --- | --- |
| Unit/service tests | 60 passed including native HTTP Cart methods/auth/errors/cancellation, parsing and exact money arithmetic |
| Lint | Passed after ignoring generated audit build output; source rules unchanged |
| Typecheck/generated DTO check | Passed with freshly generated isolated route types; delivered generated DTOs unchanged |
| Browser/UI checks | Initial Cart suite: 22 passed. Final API/SearchBar integration run: 21 passed + 2 label regressions; after fixing production label mapping, both unchanged scenarios passed on focused rerun (23 scenarios verified across runs, not one final all-green full invocation). All 9 Cart scenarios passed with proxy integration |
| Production build | Passed in `.next-verify-build` after the existing Next security reminder; `/cart` included in route output |
| Live BE integration | Through FE localhost:3000: login 200 + profile 200 for buyer, category tree 200 (3 roots), product list 200 (13 total), product detail 200, own Cart 200 (9 existing lines); real update/remove/peer write acceptance remains pending |

The audit-generated `.next-cart-readiness-build` remains locally after its cleanup command was rejected. Generated files are explicitly ignored by Git, ESLint and the isolated typecheck runner, consistent with `.next-verify-build`. No application source or fresh `.next-typecheck` route types are excluded. Final build verification uses the existing ignored `.next-verify-build` directory.

The installed Next.js 16.4.0 advisory remains a separate dependency follow-up. Browser startup initially stopped at the reminder; the unchanged retry passed. This feature does not upgrade the framework or deploy/merge the branch.

Screenshots were captured and visually reviewed with explicit HTTP fixture data in `test-results/cart-cart-displays-snapsho-ad989-isabled-checkout-at-desktop/cart-desktop-1440.png` and `cart-mobile-375x812.png`; the long-title/metadata-failure screenshot is `test-results/cart-cart-load-retries-and-be190-sing-metadata-remain-usable/cart-mobile-edge-cases.png`. The tests assert no horizontal overflow/clipped text and mobile targets at least 44px. These ignored local test artifacts can be attached to the merge request; they are not live backend evidence.

Before the focused rerun cleaned test-results, copies were preserved in the task's local visualization folder as `cart-desktop.png`, `cart-mobile.png` and `cart-mobile-edge.png`. A later browser run can regenerate the test output paths; these image files are local review artifacts rather than committed production assets.

## Login integration follow-up

The user reported real buyer login failure during implementation. Local configuration already had blank `NEXT_PUBLIC_API_URL` plus `API_PROXY_TARGET=http://localhost:8080`, but Next did not consume the proxy variable. `next.config.ts` now rewrites relative `/api/v1/*` requests to that configured origin; server catalog requests use the same server-only origin fallback when public API origins are blank. This preserves the requested blank Cart constant and avoids a browser cross-origin login call. Without API_PROXY_TARGET, no proxy is enabled.

Initial live probes then reached BE but returned 404 for login/register/JWKS on user-service itself, despite controller class files being present. That runtime mismatch is separate from a rejected password; real login recovery is checked separately below after synchronizing the running service. No account reset or auth fixture is used for that diagnosis.

DevTools reload of the existing user-service and commerce controller classes restored their stale mappings; no backend source changes or account reset were needed. Login through the real FE form succeeded and showed `Hi Nexus Buyer`. A subsequent HTTP check through FE returned 200 for login, `/users/me` and `/carts/me`. The existing cart ID read was `01a15922-444b-7e23-ac13-2421158ab411`, with 9 lines; no live add/edit/remove was performed by this verification.

Catalog was not running. It was compiled and started locally from current source with the existing configuration; gateway discovery then restored category/product responses and their existing FE screens. Standard startup Flyway automatically applied the already-present V5/V6 catalog migrations from the previous V4 database state. No seed/reset was run. Local catalog process logs are under `be-project-nexus/catalog-service/target/codex-local-run/` (ignored). The live browser also displayed the category list, category results, product detail/SKU selector and Cart metadata from this stack.

The header SearchBar's category choice previously stayed local and was discarded on submit. It now submits the category slug to SearchPage, which resolves the real categoryId before the products request; a regression covers nested-category selection, refresh and clearing. The [UI/API inventory](api-ui-integration.md) records delivered APIs with existing UI, pending integrations and capabilities with no matching frontend screen.
