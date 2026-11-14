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
`/auctions/[auctionId]` now uses the canonical MR !169 room (`6550d254`),
preserving bidding, SSE/polling, history, winner reconciliation and checkout.
Seller information/score/trust is rendered in that same room and homepage cards
enter it. Product detail uses the same reputation component. A missing aggregate
has an unavailable state; no fabricated score is shown. The room's state/stream
and winner API dependencies remain those documented by !169.

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

V14 adds/backfills the delivery window: historical COMPLETED orders are unchanged;
legacy DELIVERED orders receive a fresh seven-day window at migration. New
deliveries use the configured window. V15 adds the receipt hold. V13 is the exact
auction-reference uniqueness migration shared with MR !171 (`b17f3275`), so the
two branches do not define competing V13 scripts. Later config
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

Verification at `19e97e0f` on 2026-11-14 (before the final review below):

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
upgrades, #213 recomputation and D11 resolution remain separate work.

## Completion effects and final review

The cross-service acceptance module reads actual committed commerce outbox
envelopes and feeds production notification/payment consumers. DELIVERED and
held orders produce no completion envelope, email or payout eligibility. Buyer
confirmation and scheduled completion each produce one HTML receipt through the
real JavaMail sender to a local TCP SMTP inbox. Replay and a refused SMTP attempt
are exercised, retaining the persisted retry/attempt evidence.

Payment now records a durable completion projection and creates one
`payout_eligibility` row only when that completion agrees with a funded PAID
instruction/session, successful normal payment, buyer/group/seller identities,
version and absence of refund/cancellation. Early completion delivery waits for
funding; the retry job rechecks the same conditions under the payment-group lock.
V5 adds this projection and seller identity to the payment instruction. Historical
instructions with no seller remain ineligible until a verified manifest replay
provides that identity. `nexus.payment.payout-eligibility.cron` defaults to
`*/30 * * * * *`.

This is a durable handoff to #261, not a bank-transfer operation. #261 must
revalidate financial eligibility when creating/executing its payout instruction;
the queue row is not a claim that money has moved or that a later refund cannot
occur. No bank accounts, fees or transfer provider are invented here. The module
tests the committed outbox-to-consumer boundary directly; a separate embedded
Kafka payment test proves PAID/delivery events do not qualify, completion does,
and replay/concurrent delivery does not duplicate eligibility. SMTP provider,
recipient lookup and bank execution are not live external integrations.

See [completion acceptance](../../../be-project-nexus/infra/receipt-completion-acceptance/README.md)
for reproducible commands and exact evidence boundaries. V13 is byte-for-byte
identical to !171's migration; upgrades from both V12 and !171's V13 are tested.

Final review verification on 2026-11-14:

| Check | Result |
| --- | --- |
| Canonical !169 auction room with score/trust + bidding on the same route | 25/25 browser scenarios passed |
| Order/rating browser regressions | 48/48 passed |
| Frontend unit suite, lint, typecheck, generated type drift and production build | 300 passed; all gates passed |
| Commerce clean verify on native PostgreSQL 18 | 460 tests, zero failures/errors, five existing skips |
| V12 and !171 V13 upgrade compatibility | Both cases passed; exact V13 blob preserved |
| Payment verify on a fresh native PostgreSQL database | 274 tests, zero failures/errors, three existing skips; embedded Kafka included |
| Actual commerce outbox → notification SMTP / payment eligibility acceptance | 5/5 passed |
| Config-service verify | 7 passed |

The default Docker environment remains unavailable. PostgreSQL runs and embedded
Kafka/SMTP evidence above are actual local tests; they do not claim a deployed
broker relay or real bank execution. An initial dirty `target/classes` retained
renamed Flyway scripts; `clean verify` resolves that build artifact and is the
required migration check. Framework security reminders required unchanged Next
command retries; no unrelated framework upgrade is included.
