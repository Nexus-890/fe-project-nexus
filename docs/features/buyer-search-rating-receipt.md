# Buyer search, ratings and receipt confirmation — #220 review

The review of `0174be82` found that URL state and fixtures did not establish real
search, rating API integration or the #258 delivery wait. This revision adds the
owning backend behavior, delivered OpenAPI and generated frontend types.

## Search

Public `GET /api/v1/products` applies a trimmed, case-insensitive literal product
title search (`q`, maximum 255 characters), `categoryId`, `listingType` and
`maxPrice` in PostgreSQL before pagination. Relevance prefers exact/prefix title
matches, then newest; explicit newest/price sorts have a UUID tie-breaker and
unpriced products sort last. A price ceiling requires an affordable SKU without
truncating the product's displayed variant range. Inactive/deleted products stay
hidden. An unmatched query returns `data: []` with zero totals.

The header, category links, chips, sort and pagination preserve these supported
filters through reload/history. Unsupported seller trust, condition and rating
controls are disabled; old URL selections are removed instead of pretending to
filter products. These controls need a real catalog projection before enabling.

## Rating and auction seller information

Rating-service delivers protected `POST /ratings`, `GET /ratings?userId=` and
`GET /reputations/{userId}`. The request does not accept the caller identity.
Only the projected completed order's buyer can rate its seller, with score 1–5
and an optional comment up to 1000 characters. A pessimistic eligibility lock
and the existing unique constraint prevent concurrent duplicate ratings. The
rating and canonical `UserRated` outbox entry commit together. Reputation reads
the persisted aggregate; #213 owns score recomputation and policy.

The completed-order UI checks all seller rating pages before enabling the modal,
retains a submitted rating after reload, and refreshes after a duplicate conflict.
`/auctions/[auctionId]` reads the actual auction snapshot and product details,
shows seller information/score/trust, and is the destination of homepage auction
cards. Product detail uses the same reputation component. A missing aggregate
has an unavailable state; no fabricated score is shown. Bidding is outside #220.

## Delivery wait and receipt issue hold

Shipment delivery now commits `DELIVERED` and its history, without emitting
`OrderCompleted`. The first delivery stores `deliveredAt` and `autoCompleteAt`
from the committed history timestamp and configured confirmation window.

`POST /orders/{id}/confirm-receipt` requires BUYER + ORDER.VIEW and ownership.
It locks the order, requires DELIVERED, records one completion history row and
one `OrderCompleted` outbox entry in the same transaction. Replaying an already
completed own order returns its current snapshot without duplicate effects.
The scheduler uses the same lock and completion routine for due orders, records
the automatic completion reason and safely competes with buyer confirmation.
Administrative PATCH cannot bypass this completion routine.

The buyer can `POST /orders/{id}/receipt-issue` with a reason of 1–500 characters
while DELIVERED. It uses the same lock and persists a receipt hold; confirmation
and automatic completion are blocked while that hold exists. Repeated reporting
retains the original report. D11 owns investigation/resolution; this MR does not
invent a dispute-resolution API. The UI shows the report and paused completion.

V13 adds/backfills the delivery window: historical COMPLETED orders are unchanged;
legacy DELIVERED orders receive a fresh seven-day window at migration. New
deliveries use the configured window. V14 adds the receipt hold. Later config
changes do not move persisted deadlines. The UI only observes server
status/deadlines; a local timer never completes an order.

| Config | Default |
| --- | --- |
| `nexus.order.auto-complete-days` | `7`, must be positive |
| `nexus.order.auto-complete-interval` | `1m` |

Gateway policies and delivered catalog/commerce/rating specifications are
updated. New receipt writes are protected, so no public-endpoint entry is
added. Common envelopes, Problem Details, current-session Bearer,
cancellation, private cache keys and generation guards are retained.

## Verification scope

The original 266-test baseline and `0174be82`'s 280 unit / 57 catalog / 47 orders
fixture results are historical frontend evidence, not backend integration.
The review revision runs database/HTTP tests with PostgreSQL 18, Flyway and
`ddl-auto=validate`, including actual search results, signature-checked rating
writes, completion concurrency, rollback, history and outbox counts.

For machines without Docker, database tests accept an explicit isolated local
PostgreSQL URL through `-Dnexus.test.jdbc-url=... -Dnexus.test.jdbc-user=...`
and optional `-Dnexus.test.jdbc-password=...`. Default CI keeps Testcontainers.
The native database user must be able to create fresh test databases; never point
these test options at a shared or production database.

The live browser harness and its dependency boundaries are described in
[`tests/live-buyer`](../../tests/live-buyer/README.md). Authentication/provider
stand-ins and manual event projection must not be reported as live
Keycloak or Kafka integration. Final executed counts are recorded in the MR.

Review verification on 2026-11-14:

| Check | Result |
| --- | --- |
| Generated type drift, ESLint, isolated typecheck, production build | Passed |
| Frontend unit suite | 283 passed |
| Catalog/shop browser suite | 58 passed; 49 scenarios belong to separate order/live configs |
| Order/rating browser suite | 48 passed |
| Browser against real catalog/commerce/rating jars and PostgreSQL | Passed |
| Commerce `mvnw.cmd verify` with native PostgreSQL | 459 tests, zero failures/errors, five existing skips; embedded Kafka included |
| Rating `mvnw.cmd verify` with native PostgreSQL | 8 passed, including HTTP/auth/concurrency and offset validation |
| Catalog native PostgreSQL `verify` excluding `CategoryOutboxIntegrationTest` | 136 passed; excluded test needs Docker Kafka stop/restart controls |
| Config-service and API-gateway `mvnw.cmd verify` | 7 and 83 tests passed respectively |

Full default catalog verification remains limited by the unavailable Docker
engine; its baseline failed container startup before this change. No assertions
were weakened to bypass it. Next's installed version also reports an existing
security advisory; unchanged retries completed the frontend gates. Framework
upgrades, #213 recomputation, D11 resolution and email/payout transport remain
separate work.
