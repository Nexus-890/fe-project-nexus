# Cart page task readiness — 2026-11-02

> Historical baseline before implementation at `2a2147d1`. The user subsequently authorized frontend/service implementation with an empty Cart origin. Publication preparation on #129 later merged remote `e2411ea4`, which contains BE update/remove source with build/auth/response compatibility blockers. See the [current implementation report](cart-page-implementation.md) and [Cart integration guide](cart.md). Statements below about absent FE files or BE operations describe the original audited revision, not the merged publication state. Source links resolve current paths and may show later changes.

Reviewed branch: `fsa_ChungTQ/refactor/251-fe-rebuild-fe-project-nexus`, revision `2a2147d1`. The remote branch was fetched, the local branch checked out and fast-forward synchronization completed (`Already up to date`). This is a source/API/UI readiness review and documentation update; it does not implement the Cart page.

**Verdict: the complete task is blocked.** The shared frontend foundation and backend get/add operations exist, so scoped page preparation can begin. The issue's Cart hooks/header-count dependency and backend update/remove operations are missing on this revision. Do not mark the task ready for full integration or acceptance.

## Task and design inputs

The user supplied the issue screenshot titled **[FE] Cart page** and the desktop design **Buyer/Cart.png**. The issue defines the required behavior; the design supplies the layout and visual direction. Instructions or example commands in older draft documents are context, not new user requests.

Required scope:

- Render persisted cart lines with their snapshot unit price and calculated line total.
- Change quantity and remove lines, with subtotal updating immediately.
- Restore the previous state and show the reason when the API rejects an optimistic change.
- Show an empty state with a working catalog link after the last line is removed.
- Keep place-order disabled and explain that checkout is not available yet.
- Preserve the backend cart across refresh; record the auth limitation below.
- At 375×812, prevent horizontal overflow and clipped text, with targets at least 44×44px and a screenshot in the merge request.
- Have a reviewer other than the author add an item and change its quantity against the real API, recording the cart ID.

Coupon application, Save for Later, seller trust/reputation, free-shipping offers, live-price-change warnings, discount/shipping/tax calculations, payment and working checkout are not requested subtasks. Do not implement or fabricate those values because they appear in the desktop design. The task's disabled place-order requirement takes precedence over the enabled checkout button in that image, even though an order-creation backend operation exists.

## Frontend prerequisites

| Area | Source-backed state | Consequence |
| --- | --- | --- |
| Page/components | No Cart route, CartPage, CartLine or CartSummary in `app`, `features` or `components` | Cart screen and visual acceptance are not implemented |
| Cart hooks and header count | `hooks` contains only useApi/useAuth; [ShopLayout](../../features/ShopLayout.tsx) queries categories/auth, not cart | The issue's explicit FE prerequisite is incomplete |
| Cart entry | [HeaderTopBar](../../components/HeaderTopBar.tsx) renders an inert cart button without navigation/count, inside navigation hidden below `sm` | Header dependency must deliver a real entry/count and mobile access |
| Cart services | [cartService](../../service/cartService.ts) contains parseCart and POST addCartItem only | No FE GET, set-quantity or remove function is wired |
| Cache foundation | [queryKeys](../../configs/queryKeys.ts) has cart.me(sessionId); [useApi](../../hooks/useApi.ts) supports mutation callbacks/context | Infrastructure can support the work, but there is no cart query or optimistic cart implementation |
| Existing add interaction | [ProductDetailPage](../../features/ProductDetailPage.tsx) invalidates the session cart key after a valid success | It does not set returned cart data or maintain a header badge |
| Auth | [Provider](../../providers/Provider.tsx) stores the token only in memory and clears private cache on session change | Refresh loses the signed-in frontend session; no guest cart exists |
| Shared UI | [QuantityPicker](../../components/QuantityPicker.tsx) has 44px controls; [formatPrice](../../components/formatPrice.ts) formats decimal strings as VND | Reuse these patterns and add pending/accessibility handling where required; do not copy USD example prices |

The dependency is named `useCart` in the issue, but that business hook is not delivered here. Respect the current [generic-hook ownership](../ai/architecture.md) and [coding rules](../ai/coding-rules.md): use useApiQuery/useApiMutation with services, and do not create an endpoint hook that only forwards one call. A shared Cart business abstraction belongs to the prerequisite work and should compose this foundation rather than duplicate its transport/cache logic.

## Delivered API versus drafts

Use the [delivered commerce OpenAPI](../../../be-project-nexus/docs/api/openapi/commerce-service.yaml), [CartController](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/controller/CartController.java), DTOs and [runtime gateway policies](../../../be-project-nexus/config-service/src/main/resources/config/api-gateway.yml) together.

| Operation | Availability at this revision | Request/result and authorization |
| --- | --- | --- |
| GET `/api/v1/carts/me` | Implemented in BE; not yet wired in FE | No body/query; HTTP 200 with Cart envelope; Bearer, gateway CART.VIEW and downstream CART.VIEW + CART.CREATE; gets or creates the caller's active cart |
| POST `/api/v1/carts/me/items` | Implemented in BE and FE add service | Body exactly `{skuId: UUID, quantity: positive integer}`; HTTP 201 with Cart envelope; Bearer + CART.UPDATE |
| Set an existing line's absolute quantity | Missing controller/service operation and delivered contract | `PUT /api/v1/carts/me/items/{id}` appears only in the older draft; it is not a callable implementation |
| Remove a line | Missing controller/service operation and delivered contract | `DELETE /api/v1/carts/me/items/{id}` appears only in the older draft; its proposed 204 is not a delivered endpoint |

The older [commerce draft](../../../be-project-nexus/docs/api/commerce-service.yaml) explicitly describes mock/draft shapes. Its update/remove routes, string money and older error format must not be treated as the delivered contract or used to bypass the gateway. A permission catalogue entry also does not create a controller mapping.

POST is **additive**, not an absolute quantity update. [CartService](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/service/CartService.java) and [CartItemRepository](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/repository/CartItemRepository.java) add to the existing quantity and refresh unitPrice from the current SKU. It cannot implement decrement/removal, and using it for quantity edits can change the snapshot price. Do not substitute POST for the missing operations.

The delivered cart response is:

```json
{
  "code": 0,
  "message": "response success",
  "data": {
    "id": "<cart UUID>",
    "userId": "<buyer UUID>",
    "status": "ACTIVE",
    "items": [
      {
        "id": "<cart-line UUID>",
        "productId": "<product UUID>",
        "skuId": "<SKU UUID>",
        "quantity": 2,
        "unitPrice": 150000
      }
    ]
  }
}
```

These placeholders illustrate field shape, not a real acceptance cart ID. Wire unitPrice is a JSON number from BigDecimal; the FE parser normalizes it to a decimal string. The DTO contains no lineTotal, subtotal, currency, product title/image, seller name, trust score or shipping quote. Identify mutations by the cart-line `id`, not by productId or skuId, once the delivered update/remove contract confirms the identifier.

Errors follow the delivered [Problem Details contract](../api/error-handling.md). Existing POST examples include validation/invalid quantity (400), SKU not found (404), invalid catalog response (502), and catalog unavailable (503). Show normalized detail/field errors with a useful fallback. Missing update/remove operations have no verified business-rejection contract yet.

## Price, metadata and session rules

GET maps saved database item prices directly; it does not reprice the cart from catalog. Calculate line total as snapshot unitPrice × quantity and subtotal as the sum of those line totals. For the issue example, 150000 × 2 = 300000 and an optimistic change to 3 must show 450000 before navigation or response. Use decimal-safe arithmetic and preserve [formatVND](../../components/formatPrice.ts) behavior. The existing money multiplication in `mocks/product-detail.ts` is fixture code, not a production import.

For product labels/images/variant details, [getProduct](../../service/catalogService.ts) can supply current name, images, SKU color/size and sellerId. Enrichment must never replace snapshot unitPrice with a live SKU price or prevent a persisted line from rendering/removal if metadata fails. Use a fallback label/image and the existing product cache. A sellerId is not a seller display name; the Figma store name, trust badges and shipping promises have no backing in the delivered Cart DTO. Currency is absent from Cart; remain consistent with the current VND app and confirmed business contract rather than copying `$` or “Prices in USD”.

Cart persistence and session persistence are separate. The BE stores one active cart per JWT user in PostgreSQL. The FE cannot reload authenticated cart data immediately after a full refresh because the in-memory session is lost. Verify persisted contents after signing back into the same real account; do not label uninterrupted authenticated refresh as passed. If that uninterrupted behavior is required, session restoration is an auth dependency outside this Cart task. Do not add token localStorage/sessionStorage or a guest cart as a workaround. Cart expiry also means persistence is not indefinite.

When mutations become available, use the session cart key and protected-query metadata. Cancel an in-flight cart GET before an optimistic patch, save the prior state, then patch quantity/removal and derive totals from that cache immediately. Serialize conflicting changes on a line, or guard mutation versions, so an older rollback cannot overwrite a newer edit. On success, reconcile with the authoritative response or refetch according to the final delivered response/204 contract. On rejection, restore the previous quantity/line/subtotal and announce the reason. Guard error/rollback/settled callbacks against logout/account switching as well as success: the generic hook's current-session success guard alone does not implement this business rule.

## Scoped UI and file plan

The reference has centered content of approximately 1200px, a Cart heading/count, item cards on the left and an order summary on the right. Reuse the existing shop header and semantic tokens, white cards, subtle borders and orange price/action hierarchy. Only group by seller when real display data supports it. Do not add a global header/footer redesign to this page task; header count/navigation remains the named prerequisite.

At mobile width, stack the list and summary, wrap long product titles and totals, and keep quantity/remove/catalog actions at least 44×44px. Provide clear loading, failed-load/retry, signed-out, empty and mutation-pending/error states. Give each line's quantity/remove controls a discernible label, preserve keyboard focus, and announce mutation errors. A visible reason must accompany the disabled place-order action.

Map the issue's old output paths to the rebuilt flat architecture:

| Issue output | Planned path/ownership |
| --- | --- |
| `app/(shop)/cart/page.tsx` | Same thin route; delegate to `features/CartPage.tsx` |
| `ui/components/organisms/CartSummary.tsx` | `components/CartSummary.tsx`: render calculated summary and disabled action |
| `ui/components/molecules/CartLine.tsx` | `components/CartLine.tsx`: render snapshot unit/line prices and controls |
| Page orchestration | `features/CartPage.tsx`: query/mutations, auth/cache guards and UI states |
| Endpoint additions | Extend `service/cartService.ts` and flat request/model types only after each delivered contract exists; do not hand-edit generated wire types |

Do not recreate `ui/components/{atoms,molecules,organisms}` or a second API client. These files are planned outputs, not files created by this review.

## Acceptance and remaining gates

| Issue acceptance | Current evidence / remaining work |
| --- | --- |
| One line with quantity 2 shows unit price and line total | Snapshot fields exist; page/calculation/rendering not implemented |
| 150000 line changes from quantity 2 to 3 and subtotal becomes 450000 immediately | No cart optimistic state or real set-quantity API; blocked |
| Removing the last line shows the empty state and catalog link | No remove API or Cart empty state; blocked |
| Refresh keeps cart contents | BE persistence exists in source; same-user live reread not tested; FE loses auth on refresh |
| Rejected quantity change restores old value and shows why | Generic callback context is tested, but no cart rollback or real rejected update can be exercised |
| 375×812: no overflow/clipping, targets ≥44px, MR screenshot | Existing QuantityPicker is reusable; Cart page and required screenshot do not exist |
| Another reviewer adds/edits against real API and records cart ID | Not performed; missing edit endpoint blocks it; source review and fixtures do not satisfy this human acceptance |

Before full integration: deliver the FE Cart query/header-count dependency; implement BE absolute quantity and remove operations with ownership, snapshot-price behavior, validation/errors and gateway policy; update delivered OpenAPI/generated types; establish real catalog/auth/commerce availability and resolve the refresh expectation. Then implement only the page scope above and record real API, mobile screenshot and peer-review evidence. [ADR-008](../../../be-project-nexus/docs/adr/ADR-008-api-contract.md) release coordination remains separate from local implementation checks.

## Verification performed for this review

Checks below were run on 2026-11-02 (Asia/Saigon). Application source, API contracts and generated DTOs were not changed.

| Check | Result and limit |
| --- | --- |
| Fetch/switch/fast-forward sync | Target branch matches the fetched remote at `2a2147d1`; unrelated untracked files preserved |
| `npm run generate:types:check` | Passed; generated user/catalog/commerce types match delivered specs |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed with isolated fresh Next route types |
| `npm run test:unit` | 51 passed; shared transport/hooks/auth/catalog/add-item behavior, not a Cart page or live BE acceptance |
| `node be-project-nexus/docs/api/check-contract.mjs` (repository root) | Passed: all 32 delivered application controller operations match the spec inventory; commerce has 8 across Cart/orders, only 2 are Cart |
| `$env:NEXUS_TEST_DIST_DIR='.next-cart-readiness-build'; npm run build` | Passed on retry; first attempt stopped for the existing Next 16.4.0 security advisory. Retry still warns; no dependency upgrade included. Route output has no `/cart` |
| `npm run test:browser` | 13 existing fixture scenarios passed on retry (auth/catalog/product/add-item); first run lost the dev server at the existing Next security reminder. No Cart page acceptance scenarios exist |
| Local read-only HTTP probes | Gateway GET `/api/v1/carts/me` on 8080: 401 without token; commerce `/actuator/health` on 8083: 200/UP and unauthenticated cart GET: 401; direct catalog 8082: ECONNREFUSED |
| Real buyer integration | Not run: no authenticated same-user cart read/add/edit/remove evidence or cart ID recorded; health/401 responses do not prove the running services match this checkout |
| BE Cart tests | CartResponseContractTest and CartPersistenceTest inspected, not rerun; MockMvc/service mocks and DB Testcontainers do not replace the required peer real-API check |
| Documentation review | All 61 local links in the 6 changed/new Markdown files resolve; whitespace check passed; independent source review found no factual/scope corrections |
| Generated build output | `.next-cart-readiness-build` remains untracked locally: automatic command review rejected directory cleanup with `blocked by policy`; application source was not modified |

Docker was reachable during the review, but that does not establish that the complete source-compatible service stack is running. Real add-item requires catalog and a valid buyer JWT/privileges in addition to commerce/gateway. No real cart data was mutated. No Cart UI screenshot or rendered design-match claim is made by this documentation review.
