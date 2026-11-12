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

Paginated buyer reads (with and without a status filter) and management/sales
reads fetch `orderGroup` through an entity graph. This lets `canCancel` read the
group status without an additional query for every pending order. The graph
fetches only the to-one group; items retain their existing batch loading so
database pagination and page counts remain intact.

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
During the initial feature checks Docker was unavailable, so PostgreSQL/Kafka
integration and a live payment/refund workflow were not exercised. The later
PostgreSQL read verification is recorded below. Local mock results do not
establish deployed service compatibility.

## Review follow-up — 2026-11-12

The pending-order list regression uses 45 distinct groups, page sizes 5/20 and
pages 0/1 across buyer reads, status-filtered buyer reads, management and sales.
Before the entity graph, buyer/management pages executed 8 SQL statements for
5 orders and 23 for 20, including one secondary group load per order. With the
graph restored, all 16 reads execute at most 3 statements with no secondary
`OrderGroup` fetches. The regression also checks items, stable ordering, total
counts, pagination and caller-specific cancellation eligibility.

The entire `OrderManagementReadTest` and the existing eligibility, controller
security, HTTP contract and status tests passed: 104 tests on an isolated real
PostgreSQL 18.6 instance. This ran Flyway's 12 migrations and Hibernate schema
validation. It establishes the order read/query behavior; Kafka refund delivery
and a full application startup remain separate checks.

The default database test still uses Testcontainers. An existing disposable
PostgreSQL database can run the same checks without Docker:

```powershell
mvn -o -f be-project-nexus/commerce-service/pom.xml "-Dtest=OrderManagementReadTest,OrderCancellationEligibilityTest,OrderResponseContractTest,OrderControllerSecurityTest,OrderStatusTest" "-Dnexus.test.postgres.url=jdbc:postgresql://127.0.0.1:5432/nexus_test" "-Dnexus.test.postgres.username=postgres" test
```

`nexus.test.postgres.url`, `.username` (default `postgres`) and `.password`
(default empty) are test-only system properties. Use a disposable test database;
the test owns and truncates its `commerce_management_reads` schema.

The 403 browser check now distinguishes a cancelled dev mount request from a
completed response: it requires exactly one completed 403, permits only explicitly
observed aborted attempts before that response, and rejects requests started
after the 403. The detail-503/manual-retry check likewise measures exactly one
additional GET after Retry. Ten repeated 403 runs and all 27 focused order
scenarios passed. The separate existing 401 scenario was unchanged. See the
simulation context for trace evidence and the limits of this local reproduction.

Review verification also passed all 253 FE unit tests, generated-type drift,
lint, typecheck and production build. The unchanged unit suite had an initial
cart-service worker failure, then all 253 passed on rerun. Existing Next security
reminders required unchanged browser/build command retries.

## Develop reconciliation — 2026-11-12

Merged `origin/develop` at `8a2ff658`, including #206 shipment tracking. The task
router retains both order-detail and shipment-tracking entries. The order page
keeps cancellation/refund/error behavior alongside the incoming tracking card and
its bounded polling policy. The commerce entity graphs and SQL regression remain
unchanged.

The local order-detail HTTP fixture now supplies the delivered successful empty
shipment list for its orders, with explicit authenticated lookup/query evidence.
It does not fabricate shipment tracking. The incoming shipment browser cases
continue to verify populated history, clipboard, errors and stopped polling.

Merge verification passed generated-type drift, lint, typecheck, 263 FE unit
tests, 104 commerce tests on PostgreSQL 18.6, all 55 general browser scenarios
and the isolated production build. The delivered controller/OpenAPI inventory
matched all 94 operations. Build startup required an unchanged retry after the
existing Next security reminder.

The focused suite passed 37/38: all 17 detail and 11 shipment cases passed.
The unchanged list-401 scenario still failed its known exact request-count
assertion (expected two, received three), including one unchanged targeted rerun;
its visible error/sign-in checks passed. That limitation is recorded without
altering the test. The general suite intentionally skips the 38 focused cases.
