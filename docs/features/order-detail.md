# Buyer order detail, history and cancellation

The buyer opens `/order/[orderId]` from the order number in `/orders`. The page
uses the shared shop shell, semantic theme tokens, VND formatter and status
labels. It renders purchased item snapshots, quantities, line amounts, total,
current status and the chronological status history. History has its own loading,
empty, error and retry states, so an unavailable timeline does not hide the order.
`/checkout/result/[orderId]` continues to reuse the receipt view.

## Backend contract

Based on `origin/develop` at `4f083ee0` on 2026-11-12, checked against
`OrderController`, `OrderService`, response DTOs and the delivered
[commerce OpenAPI](../../../be-project-nexus/docs/api/openapi/commerce-service.yaml).

- `GET /api/v1/orders/{id}` returns the order snapshot in the success envelope.
  The additive `canCancel` boolean reflects the current caller's `ORDER.CANCEL`,
  ownership or administrative role, and the order/group state. Pending orders
  require a pending parent group; paid orders are cancellable before shipment.
  The FE shows cancellation only for explicit `true`. Older responses without
  the field remain readable with cancellation hidden.
- `GET /api/v1/orders/{id}/history` returns a history array. Persisted history
  can have a null reason or actor; those entries remain visible with status/time.
- `POST /api/v1/orders/{id}/cancel` sends a trimmed reason of 1–500 characters.
  Cancelling a pending order cancels its unpaid group; cancelling a paid order
  affects only that order. A successful write invalidates order/payment queries
  in the current session and refreshes the snapshot and timeline. It also
  invalidates the shared cart so restored sibling items update the header/cart.

Eligibility is a read-time snapshot. Cancellation still checks the locked state.
A 409 displays the server's message and refreshes order data without replaying the
POST. The message remains visible if the refresh fails. A foreign order's 403
displays its server message and an All orders link, with no history request or
retry action. A 401 offers sign-in; retryable read failures have explicit retries.
All protected requests and caches retain the shared session generation guards.

## Refund status

Refund state comes from the order and its persisted history. A cancelled order
with a previous paid state shows **Awaiting refund**. `REFUND_REQUESTED` shows
**Refund requested**, and `REFUNDED` shows **Refunded**. The refresh action reloads
both snapshot and history. The browser does not infer a completed refund from a
cancellation response, a URL flag or elapsed time.

## Verification

```powershell
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:browser -- --config playwright.orders.config.ts
npm run test:browser
npm run build
```

The focused browser suite runs the real frontend against the existing local
Postman simulation. `tests/order-detail.spec.ts` exercises list-to-detail
navigation, snapshot/history reads, pending/paid cancellation, refund progression,
server eligibility, missing eligibility, terminal statuses, 409, foreign 403,
independent read recovery and responsive layout. Service tests additionally cover
nullable historical fields, strict parsing, current Bearer and single-write errors.
See the [simulation context](../../postman/simulations/order-list.context.yaml)
for the evidence and scope of those HTTP stand-ins.

On 2026-11-12 the following checks passed:

- Generated-type drift check, lint, typecheck and production build.
- All 253 FE unit tests and 93 focused BE tests.
- All 27 focused order browser scenarios (17 detail, 10 list), followed by both
  cancellation scenarios after the final cart invalidation/receipt changes.
- All 55 general browser scenarios in 2.3 minutes. The 27 focused order scenarios
  are intentionally skipped in this general run and are verified separately.

Desktop 1440px, mobile 375×812, refund and forbidden-state screenshots were
visually inspected. The cart follow-up asserts an additional cart read after
successful pending cancellation. The initial generated-type check found existing
commerce schema drift; regeneration also includes the already-delivered shipping
snapshot and invoice operations. Existing Next security reminders stopped initial
browser/build invocations; rerunning the unchanged commands completed successfully.
Docker was unavailable, so PostgreSQL/Kafka integration and a live payment/refund
workflow were not exercised. Local mock results do not establish deployed service
compatibility.
