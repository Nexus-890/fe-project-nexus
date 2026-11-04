# Buyer order list — #154

`/orders` displays the buyer's order number, date, total and status. The status filter is stored in `?status=PENDING`; changing it resets the page. URL pages are one-based and API pages zero-based, with ten orders per page. Empty, loading, account and API failures have visible messages. Only pending orders offer payment navigation.

The implementation follows the repository's flat folders: `app/(account)/orders/page.tsx`, `features/OrdersPage.tsx`, `features/useOrders.ts`, `service/orderService.ts` and `components/OrderStatusBadge.tsx`. It reuses the HTTP boundary, scoped auth, generic query hook, generated commerce types, VND formatter and pagination component. The reference's search, date-range controls and unrelated order actions are outside #154.

## API readiness

Base: `origin/develop` at `0d0a36a4`, inspected 2026-11-04. The delivered OpenAPI, OrderController and OrderResponse provide protected `GET /api/v1/orders?status=&page=&size=` with `data[]` and sibling page metadata. The parser reads the fields used by the list and normalizes numeric money for display. The status filter uses the eight delivered enum values. Problem Details retain `code`/`detail`; unauthorized errors offer sign-in and forbidden errors do not retry.

Develop does **not** yet supply each order's `orderGroupId` (#138), and `/checkout/payment/[orderGroupId]` is not present on this base. The mock adds distinct group IDs as explicitly allowed by the task. A pending link uses that ID, never `orderId`. If the field is missing, the row remains visible with a disabled payment button. No backend or payment-page implementation is included.

The existing session keeps tokens in memory. Refresh preserves filter/page in the URL, but the user must sign in again; the sign-in return destination preserves that URL. This task does not change session persistence.

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
