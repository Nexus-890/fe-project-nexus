## Summary

Implement the buyer Auction room with server-clock countdowns, bids, masked history and verified end states. Follow #253's named `state`/`heartbeat` contract and expose the recorded settlement order to its winner through the existing private own-bids read, connecting the room to address confirmation and payment.

Related: #178, #179, #180, #198 and frontend #267. Live staging/load acceptance remains open.

## Changes

- `features/useAuctionState.ts`, `auctionStateReconciliation.ts`: receive transport `heartbeat` every 15 seconds, use a 30-second silence threshold, and apply validated `state` immediately. Keep native reconnect and two-second fallback; reject older/regressing snapshots.
- `auction-service/bidding/MyBidQuery.java`, `MyBidResponse.java`: add nullable `orderId`, `paymentDueAt`, `finalPrice` to `/bids/mine`, gated by authenticated recorded winner and WON/SETTLED/PAYMENT_TIMEOUT. Read stored columns; add no settlement write, endpoint or migration.
- `service/auctionService.ts`, generated/domain types, `AuctionRoomPage.tsx`: consume checkout references only from the private result. Poll the winner's own result every two seconds until its recorded order arrives; stop on loss, timeout, deadline or completed handoff.
- `AuctionWinnerCheckout.tsx`: review address, confirm shipping using #172's direct body, display returned totals/deadline, then open the existing payment page. Preserve uncertain retries and typed address across settlement refreshes.
- PostgreSQL/MVC privacy regressions and HTTP/browser fixtures cover recorded references, 15-second heartbeat timing, 30-second fallback and room-to-shipping-to-QR navigation. Evidence distinguishes database tests, HTTP stand-ins and live staging acceptance.

## API

No new endpoints. The existing private read receives additive nullable fields:

| **Method** | **Path** | **Access** | **Success** | **Errors** |
| ---------- | -------- | ---------- | ----------- | ---------- |
| GET | `/api/v1/auctions/{id}` | Public | 200 | 400, 404 |
| POST | `/api/v1/auctions/{id}/bids` | BUYER + `AUCTION.BID` | 201 new / 200 replay | 400, 401, 403, 409 |
| GET | `/api/v1/bids/mine` | BUYER + `AUCTION.VIEW_BID_HISTORY` | 200, winner-only nullable fields | 400, 401, 403 |
| GET | `/api/v1/auctions/{id}/state` | Public, #168 integration | 200 | Missing read shows explicit fallback |
| GET | `/api/v1/auctions/{id}/bids` | Public, #169 integration | 200 page | Missing read shows explicit history failure |
| GET | `/api/v1/auctions/{id}/stream` | Public target #253 | Named `state`, `heartbeat` every 15s | Error or 30s silence restores polling |
| POST | `/api/v1/orders/{id}/shipping-confirmation` | BUYER + `CHECKOUT.START` + winner ownership, #172 `b17f3275` | 200 / identical-address replay | 400, 401, 403, 404, 409, 422, 500, 502, 503 |

The private fields come from `auctions.order_id`, `payment_due_at` and `final_price`. Rivals/nonwinning states receive null; `orderId` stays null until #172's OrderCreated projection records it. Public AuctionResponse stays unchanged. Delivered OpenAPI and gateway documentation describe the visibility.

Config keys: none added. Existing API origin/proxy configuration is reused.

## Acceptance criteria

- [x] Automatic countdown, exact bid minimum, rejection feedback and same-key recovery are implemented.
- [x] `/stream` listens to named `state` and opaque transport `heartbeat`; heartbeat cannot mutate the auction snapshot or countdown.
- [x] Heartbeats at 15 seconds keep the stream healthy; 30 seconds of silence triggers fallback, preserving native reconnect.
- [x] Existing private API returns the actual stored order only to its winner. PostgreSQL integration verifies rivals get null and public detail exposes no checkout data.
- [x] Room waits for the private reference, then provides address review, shipping confirmation and payment-group navigation without inventing an order.
- [x] Mobile room controls include 44x44 minimum targets, including retries and pagination.
- [x] Revised local auction evidence: 26/26 browser scenarios, 289 unit tests, typecheck/lint/generated drift and production build passed. Same-connection heartbeat spacing was 15,012ms; the local push update measured 116.65ms. See verification for exact scope and remaining live checks.
- [ ] STAGING demonstration with two real backend users, real state/history/SSE, replay/reconnect and under-one-second updates.
- [ ] 1,000 live connections and resource/latency acceptance with backend.
- [ ] Actual settlement-to-stored-order-to-shipping-to-payment-provider integration on the compatible deployment.

## How to test

1. In `fe-project-nexus`, run `npm run test:auction` with Node/npm, Postman CLI and Chrome. Next uses 3118 and HTTP/OIDC stand-ins use 3928. Heartbeat cases observe actual 15-second emissions beyond 30 seconds and a separate silent interval longer than 30 seconds.
2. Run `npm run generate:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:auth`, `npm run test:catalog`, then an isolated build using `NEXUS_TEST_DIST_DIR`.
3. Run `AuctionMineIntegrationTest` with Docker or the existing `TEST_POSTGRES_ADMIN_URL` disposable database fixture. See `be-project-nexus/docs/testing/auction-mine.md` for executed commands and two Docker-only exclusions.
4. Expected: heartbeat keeps transport healthy without state pushes; silence restores two-second polling; `/bids/mine` returns null before order projection, then the stored real id to the winner only. Room uses that private id for shipping and the returned payment group for QR navigation.
5. For live acceptance deploy compatible #168/#169/#253 reads/stream and #172 settlement/shipping. Use two real buyers; fixture timing and seeded database settlement do not substitute for STAGING.

## Checklist

- [ ] `.\mvnw.cmd verify` passes in every service touched — selected auction-service verify passed 268 Surefire + 10 Failsafe tests. Unfiltered verify is not claimed: Docker is unavailable and two existing Docker-only fixtures were excluded.
- [ ] The service starts against PostgreSQL with `ddl-auto: validate` — focused Spring integration ran against disposable PostgreSQL 18.6; compatible staging startup remains to be verified.
- [ ] No secret, `.env`, `.idea/` or log file in the diff — checked at final packaging; intentional PNG/timing evidence is documented.
- [ ] New endpoints registered in gateway/public policies — no new endpoint; existing private row documents winner visibility. Stream/state/history runtime policy remains backend integration work.
- [ ] Branch is up to date with `develop` and has no conflict markers — checked at final packaging; left unchecked for reviewer confirmation.

## Out of scope / follow-ups

- Deploy and accept real #253 heartbeat/replay behavior, two real users and SSE load on STAGING.
- Merge compatible settlement/shipping workers from #172. This change only reads already stored settlement columns.
- Auction listing/My Bids, provider payment processing and the existing Next security upgrade remain separate work.

## Notes for reviewers

- The narrow backend read addition closes the winner-order contract gap. Public DTOs remain free of winner checkout references; there is no SKU/title matching or unbounded order discovery.
- Generated auction types follow the updated delivered spec. #168 reads were inspected at `ec75d5c0`; #172 shipping/settlement at `b17f3275`; neither commit is imported wholesale.
- PostgreSQL/MVC tests verify the real stored-reference read and privacy boundary with seeded settlement data. Browser evidence runs the actual Next app against explicit local HTTP/QR fixtures.
- Keep live #180/#267 acceptance open. Fixture screens do not prove STAGING settlement, provider readiness or a bank transfer.
- An earlier heartbeat timing assertion mixed StrictMode connections; the corrected harness measures spacing per connection and retains the 15-second requirement.
