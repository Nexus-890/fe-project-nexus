# Buyer search, seller rating and receipt confirmation — #220

Based on `origin/develop` at `09b3cf6f72fce255a0c6984978c50ffa2c1706f1`, inspected on 2026-11-14.
Scope is frontend #220, including the merged frontend requirements from #221 and #266.

## Interface

The Account PNG supplied for this task defines the shared account sidebar, order
detail columns and rating modal. `/order/[orderId]` now uses the account shell;
the checkout result remains in the shop shell. Existing design tokens, borders,
typography, orange actions and accessible native dialogs are reused. The missing
receipt confirmation dialog follows the same style.

Search retains query, category, sort and visible filter selections in the URL.
Header submissions, category links, chips, pagination and browser history preserve
that state. An empty successful result displays the existing empty state.
The delivered products API supports only `categoryId`, `page` and `size`: full
dataset text search, price/rating/condition/trust filters and sorting still need
the PRD-08 backend contract. URL persistence does not establish server filtering.

Only the authenticated buyer of a `DELIVERED` order can confirm receipt. The UI
keeps that status until a successful server response; it never completes an order
with a client timer. Optional `deliveredAt` and `autoCompleteAt` come from the
server, with no invented waiting period. Refetching observes server completion
and refreshes history. The list links delivered orders to their receipt action
and completed orders to seller rating.

Only a completed order offers rating. The feature reads every page of the seller's
ratings to find this buyer/order before enabling submission, retains server
ratings after reload, refreshes after a 409, and refuses to enable rating when the
lookup fails. The server must enforce uniqueness and completed-order eligibility.
Product detail and the existing live auction cards share seller reputation,
including loading, unavailable and retry states. Reputation reads require sign-in
per the gateway permission catalogue; missing scores never fall back to samples.

## Provisional API dependencies

The checked-out backend has no receipt confirmation operation or rating/reputation
controllers/OpenAPI. The frontend uses explicit provisional boundaries and local
HTTP simulation, as allowed by the issue's condition. No backend endpoint, schema,
scheduler, gateway authorization rule or generated wire DTO is added here.

| Operation | Provisional boundary / owner |
| --- | --- |
| POST `/api/v1/orders/{id}/confirm-receipt` | No request body; `ApiResponse.data` is the completed Order. Optional detail timestamps: `deliveredAt`, `autoCompleteAt`. Confirm with #258. |
| POST `/api/v1/ratings` | `{orderId,toUserId,score,comment}`; creation returns one rating in `data`. Caller identity is read from the current session, never sent as `fromUserId`. #212 / #242. |
| GET `/api/v1/ratings?userId={sellerId}&page=0&size=100` | Rating `data[]` and sibling `page`; all remaining pages checked before allowing a rating. #212 / #242. |
| GET `/api/v1/reputations/{sellerId}` | `{userId,score,trustLevel,totalTransaction,successfulTransaction,failedTransaction}` in `data`. #213 / #242. |

Rating resources contain `id`, `fromUserId`, `toUserId`, `orderId`, `score`,
nullable `comment` and `createdAt`. Scores are 1–5; reputation scores are 0–100
and trust levels follow the persisted `NEW`, `BASIC`, `TRUSTED`, `TOP` values.
The three rating/reputation paths already appear in
[`gateway-permissions.md`](../../../be-project-nexus/docs/api/gateway-permissions.md).
#258 owns receipt permissions/public-endpoint classification and the final contract.
Replace these provisional types with generated wire aliases once those owners
publish OpenAPI. Runtime validation rejects malformed or mismatched resources.

All requests use the common HTTP boundary, protected session keys, current Bearer,
cancellation and session generation guards. No new `nexus.*` config keys.

## Verification

Baseline: 266 frontend unit tests passed before implementation. The focused
existing search browser baseline passed 2/2. Final checks on 2026-11-14:

| Command | Result |
| --- | --- |
| `npm run generate:types:check` | Passed; delivered DTOs unchanged |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:unit` | 280 passed |
| `npm run test:catalog` | 57 passed; 47 order-only scenarios intentionally skipped in this config |
| `npm run test:browser -- --config playwright.orders.config.ts` | 47 passed in 2.2 minutes |
| `npm run build` | Passed, with TypeScript enabled |

Browser runs used isolated app/API/provider ports and Next output directories.
Next's existing security advisory initially stopped commands; unchanged retries
completed, and upgrading the installed framework remains separate work. An
existing order 401 assertion counted canceled development-mount requests as
retries; it now checks exactly two completed 401 responses, one refresh and no
request after the terminal replay, while recording genuine cancellations.
An intermittent session-restoration stall passed in the final unchanged run.
Desktop/mobile search, order detail, receipt and rating captures were inspected.

The existing local
[`order-list` simulation](../../postman/simulations/order-list.sim.yaml) now models
receipt confirmation and ratings; production never imports these fixtures.

HTTP simulation establishes frontend behavior against the stated assumptions.
It does not establish live PostgreSQL validation, the backend waiting period,
one `OrderCompleted` event/history transaction, receipt email/payout timing,
real gateway privileges or live search/rating availability. Backend #258 and
#212/#213/#242, and the PRD-08 search API, remain integration dependencies.
