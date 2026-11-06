# Buyer order list — #154

`/orders` displays the buyer's order number, date, total and status. The status filter is stored in `?status=PENDING`; changing it resets the page. URL pages are one-based and API pages zero-based, with ten orders per page. Empty, loading, account and API failures have visible messages. Only pending orders offer payment navigation.

The implementation follows the repository's flat folders: `app/(account)/orders/page.tsx`, `features/OrdersPage.tsx`, `features/useOrders.ts`, `service/orderService.ts` and `components/OrderStatusBadge.tsx`. It reuses the HTTP boundary, scoped auth, generic query hook, generated commerce types, VND formatter and pagination component. The reference's search, date-range controls and unrelated order actions are outside #154.

## API readiness

Base: `origin/develop` at `0d0a36a4`, inspected 2026-11-04. The delivered OpenAPI, OrderController and OrderResponse provide protected `GET /api/v1/orders?status=&page=&size=` with `data[]` and sibling page metadata. The parser reads the fields used by the list and normalizes numeric money for display. The status filter uses the eight delivered enum values. Problem Details retain `code`/`detail`; unauthorized errors offer sign-in and forbidden errors do not retry.

Develop does **not** yet supply each order's `orderGroupId` (#138), and `/checkout/payment/[orderGroupId]` is not present on this base. The mock adds distinct group IDs as explicitly allowed by the task. A pending link uses that ID, never `orderId`. If the field is missing, the row remains visible with a disabled payment button. No backend or payment-page implementation is included.

The current gateway session keeps access tokens in memory and the refresh token in an HttpOnly cookie. Refresh preserves filter/page in the URL while the provider restores the session. The list displays its account loading state during restoration. If the session has ended, the sign-in return destination preserves that URL.

## Develop reconciliation — 2026-11-06

Merged `origin/develop` at `49a7caa8` while retaining the current account layout, sidebar/footer, notification cache keys and gateway cookie session. Orders now uses that shared account layout and activates its Orders navigation entry. The delivered `OrderResponse` and list OpenAPI still omit `orderGroupId`, so the safe disabled payment state remains necessary for that backend response. The focused local fixture forwards gateway session request bodies, cookies and CSRF headers, and the reload scenario expects session restoration.

Reconciliation verification: generated-type drift check, lint, typecheck and all 177 frontend unit tests passed. All nine focused order browser scenarios passed in 39.2 seconds, including restored filter/page state, one 401 refresh/replay and the shared account layout at desktop/mobile sizes. The simulation log confirms order HTTP requests with successful and rejected responses. Existing Next upgrade reminders required unchanged command retries; a local dependency copy was needed because cross-volume `node_modules` junctions could not run Next. These checks exercise local HTTP stand-ins, not live backend services.

## Integration after payment polling — #153 → #154

The account `/orders` route now combines the full filtered list with #153's paid-group confirmation. It shows the confirmation only when this session's cached group read has all children `PAID`; URL flags alone never establish payment. Filter and page links retain `payment`/`groupId` parameters. Group polling and the list share the strict order parser while preserving the list's optional group-payment link. The duplicate shop `/orders` route was removed. Both the order-list and group-service test suites remain present.

On 2026-11-06, generated-type drift, lint, typecheck and all 191 unit tests passed. All ten focused order browser scenarios passed in 39.7 seconds, including a new assertion that a forged confirmation query remains unconfirmed through filtering and session restoration.

The stacked payment check passed the thirty-second hidden-tab pause and resumed to this list with verified confirmation. The strict all-PAID navigation check exceeded its three-second timeout in exercised runs, while the payment page had reached its confirmed state. Warming the browser destination did not remove that timing failure; the final test retains the original HTTP warmup and now measures navigation commit explicitly with `waitUntil: "commit"`. That final check also exceeded 3000ms. No production polling interval or timing limit was changed. These local results do not establish a reliable three-second navigation bound.

## Verification

Baseline: lint, typecheck and 73 unit tests passed before implementation. Focused service tests cover real HTTP serialization/current Bearer, paging/envelopes, money, missing group IDs, malformed responses, Problem Details and cancellation.

Final checks on 2026-11-04: generated-type drift check, lint, typecheck, 79 unit tests, nine focused order browser tests, 30 existing browser regression tests and production build passed. The general browser run skips the nine order tests because they run separately with their dedicated HTTP simulation. Next's existing security reminder initially stopped browser/build startup; repeating the unchanged commands succeeded. No dependencies were changed.

Run the focused browser checks with:

```powershell
npm run test:browser -- --config playwright.orders.config.ts
```

This starts the real Next frontend against a local Postman order simulation plus the existing OIDC/catalog fixtures. The simulation context is [order-list.context.yaml](../../postman/simulations/order-list.context.yaml). Browser tests exercise three rows, URL filter/refresh, paging, empty/error/retry, the pending group destination and responsive overflow. This establishes behavior against the stand-ins; live backend compatibility and the payment destination page remain unverified dependencies.

Screenshots for the merge request:

- [Desktop, 1440px](order-list-evidence/orders-desktop-1440.png)
- [Mobile, 375×812](order-list-evidence/orders-mobile-375x812.png)
- [Mobile, long order number](order-list-evidence/orders-mobile-long-number-375x812.png)
