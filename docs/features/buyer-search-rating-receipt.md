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

V15 adds/backfills the delivery window: historical COMPLETED orders are unchanged;
legacy DELIVERED orders receive a fresh seven-day window at migration. New
deliveries use the configured window. V16 adds the receipt hold. The latest
develop (`a686c099`) owns V13 for `order_payment_note`; V14 contains the exact
auction-reference uniqueness SQL from MR !171 (`b17f3275`). When !171 merges it
must reuse this V14 instead of reintroducing its old V13 auction script. Later config
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
for reproducible commands and exact evidence boundaries. V14's SQL is byte-for-byte
identical to !171's original auction migration; upgrades from V12, develop V13
and the consolidated V14 baseline are tested.

Final review verification on 2026-11-14 before synchronizing the new develop merge:

| Check | Result |
| --- | --- |
| Canonical !169 auction room with score/trust + bidding on the same route | 25/25 browser scenarios passed |
| Order/rating browser regressions | 48/48 passed |
| Frontend unit suite, lint, typecheck, generated type drift and production build | 300 passed; all gates passed |
| Commerce clean verify on native PostgreSQL 18 | 460 tests, zero failures/errors, five existing skips |
| V12 and the original shared auction migration baseline | Passed; repeated below with the latest develop migration sequence |
| Payment verify on a fresh native PostgreSQL database | 274 tests, zero failures/errors, three existing skips; embedded Kafka included |
| Actual commerce outbox → notification SMTP / payment eligibility acceptance | 5/5 passed |
| Config-service verify | 7 passed |

The default Docker environment remains unavailable. PostgreSQL runs and embedded
Kafka/SMTP evidence above are actual local tests; they do not claim a deployed
broker relay or real bank execution. An initial dirty `target/classes` retained
renamed Flyway scripts; `clean verify` resolves that build artifact and is the
required migration check. Framework security reminders required unchanged Next
command retries; no unrelated framework upgrade is included.

After synchronizing develop `a686c099`, commerce clean verify passed 475 tests
(zero failures/errors, five existing skips), payment clean verify passed 282
(zero failures/errors, three existing skips), and all five cross-service
acceptance scenarios passed again against the rebuilt service artifacts.
Migration compatibility covers V12, develop V13 and consolidated V14 through
V16. Regenerated DTOs, all 300 frontend unit tests, lint, typecheck and production
build also passed. The !169 room and buyer browser checks remain 25/25 and 48/48.

## Conflict reconciliation — 2026-11-15

Merged `develop` at `aa238638`, #205 at `6259d278`, then the newer develop
checkpoint `dc9a0207`. The shared auction room retains bidding, current
state/history/heartbeat handling and private winner-only checkout data together
with #220 seller reputation. #205 contributes `/auctions`, `/my-bids`, paginated
personal bids and explicit second-chance offer accept/decline/address/payment
flows. One `/auctions/[id]` route serves all room links; duplicate dynamic route
names were removed. Shared query keys retain account, reputation and all auction
features. The generator retains delivered rating/commerce types and the labeled
account integration snapshots.

Verification after reconciliation: generated-type drift, ESLint, typecheck and
all 336 frontend unit tests passed; production build passed with TypeScript
enabled. The browser suites passed 26 auction-room, 12 auction-list/My Bids/offer,
48 order/rating and 58 catalog/navigation cases against their explicit local HTTP
dependencies. These remain frontend fixture evidence, not live offer/broker or
bank integration. The final develop update adds a unit check for system stock
rejection and preserves the new `SYSTEM` cancellation actor. API-gateway verify
passed 85 tests; commerce, payment, auction and inventory packages compiled with
tests skipped after installing the merged shared libraries. Existing Next
security reminders required unchanged command retries. No receipt/payout business
logic or migrations were changed while resolving these frontend conflicts.

## Conflict reconciliation — 2026-11-16

Merged develop `0a92effe`, which already contains the canonical !169 room and
#205 auction list/My Bids work. Kept that room's independent heartbeat and private
winner checkout handling, and retained #220 seller score/trust. Home auction
cards still navigate to the same `/auctions/[id]` route. Resolved the shared
auction service by preserving upstream admin/list functions and #220 homepage
seller mapping; resolved the catalog contract test by retaining public search
and the new private seller status-filter signature. DTOs were regenerated from
the merged specifications.

All 353 frontend unit tests, generated-type drift, ESLint, typecheck and the
production build passed.
Browser suites passed 26 room, 12 list/offer, 48 order/rating, 58 catalog/navigation
and 17 admin/seller scenarios. The order/rating suite includes Home → room,
score/trust and bid controls together. The merged admin page now labels valid
SYSTEM cancellations as System, covered alongside Administrator/Seller labels.
Catalog verify passed 140 tests against PostgreSQL 18.6 with Flyway and Hibernate
validation; only the Docker/Kafka `CategoryOutboxIntegrationTest` was excluded.
API-gateway verify passed 85 tests and the merged auction package compiled.
Existing Next security reminders required unchanged command retries. These
browser results use explicit HTTP fixtures; they do not claim new live broker
or payout execution evidence.
