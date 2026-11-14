# Auction room verification — 2026-11-14

Base: `origin/develop` `09b3cf6f`; branch `fsa_ChungTQ/chore/178-fe-auction-room-state-and-countdown-bid-panel-bid-history-and-end-state-live-updates` in the attached `buyer-auction-room` worktree. The original checkout's three backend edits were preserved. The latest revision includes frontend fixes and an additive winner-only projection on the existing private own-bids read. It adds no endpoint or migration.

Develop advanced during final packaging to `a686c099`. It was merged without conflicts
after the verified implementation commit `b2cb4d03`; the merge changed no auction
service or frontend runtime source. Commerce/inventory/payment generated DTOs were
regenerated for that upstream API inventory. Generated drift, lint, fresh typecheck,
all 289 frontend unit tests and the isolated production build passed again; API
inventory now passes 101 operations. The build's unchanged retry passed after the
same installed Next security reminder.
The 26-case auction and 55-case catalog browser evidence below was recorded before
that upstream-only merge and remains scoped to those actual runs.

## Latest heartbeat and private projection revision

The reviewed #253 target uses `/stream`, named `state` and named transport `heartbeat` every 15 seconds. `open` starts a 30-second grace window; silence for 30 seconds or a stream error restores two-second polling. A heartbeat renews connection health only; its payload is opaque and cannot change state or reset the countdown. Valid matching state updates apply immediately, with supporting REST coalesced separately. Older/regressing snapshots and late REST completions cannot overwrite accepted state. ENDED remains pending until settlement.

The minimal backend change extends `MyBidQuery`, `MyBidResponse` and delivered OpenAPI with nullable `orderId`, `paymentDueAt` and `finalPrice`. SQL returns actual stored values only for the authenticated recorded winner in WON/SETTLED/PAYMENT_TIMEOUT. Other callers/statuses receive null; public AuctionResponse remains unchanged. The frontend uses only those private checkout fields and polls the private read every two seconds while a verified winner awaits the recorded order reference or personal final status. It stops once a current final result and actual order id exist, or on loss, timeout, deadline, hidden tab or permanent error. No order is guessed, created or settled by this read.

#172 branch `b17f3275` supplies the reviewed direct-address shipping endpoint and actual OrderCreated→stored order id/WON→SETTLED integration. It is not merged into this develop baseline. Its workers, payment provider and bank transfer have not been run here.

| Check on latest revision | Result |
| --- | --- |
| `npm run test:auth` | 289 passed; includes heartbeat liveness, private-order lag/reconciliation, nullable private parsing and shipping HTTP coverage |
| Focused `AuctionMineIntegrationTest` | 23 passed, zero failures/errors/skips, native disposable PostgreSQL 18.6 and Java 21.0.11 |
| Selected auction-service Maven verify | 268 Surefire + 10 Failsafe passed (278 total); exactly two existing Docker-only fixtures excluded because the daemon was unavailable; unfiltered verify not claimed |
| Delivered API inventory | 100 operations before synchronization; 101 operations passed after merging develop `a686c099` |
| OpenAPI lint | Redocly 2.72 passed |
| Full generated-type drift, lint, typecheck | Passed after the last private-projection/hook changes |
| Latest `npm run test:auction` | 26/26 passed, 3.2 minutes; no production changes followed this run |
| Named heartbeat cadence | Actual local HTTP heartbeat pair on the same connection: 15,012ms apart; stream stayed healthy during a 32,041ms observation with no changing state pushes |
| Silent stream fallback | Passed: connection stays healthy at 20 seconds, switches after 30 seconds, then two fallback reads arrive at two-second cadence |
| Private order handoff | Passed: public detail omits all settlement references; private WON has null order id, then SETTLED supplies stored id and the room continues through address confirmation to payment QR |
| Two browser contexts | 116.65ms bid-click to observer update against local HTTP stand-ins; not STAGING T4 |
| Production build | Passed using `.next-auction-heartbeat-build`; unchanged retry after the existing Next security reminder |
| Full catalog regression | 55 passed, 38 existing configuration skips, zero failures, 2.8 minutes; unchanged retry after the installed Next security reminder stopped the first startup |

The PostgreSQL regression covers all nine auction statuses, recorded winner versus rival, a caller-supplied bidderId that cannot change ownership, null winner, explicit nullable fields, WON waiting for order, SETTLED returning the stored real reference, no public-detail disclosure and no read-generated outbox rows. Stored settlement data is deliberate test input. This proves the actual private HTTP/database read, not Kafka settlement or a live #172 checkout. See the backend [auction-mine verification](../../../be-project-nexus/docs/testing/auction-mine.md) for commands and scope.

Current browser evidence includes six refreshed PNGs and [per-connection heartbeat timings](auction-evidence/heartbeat-contract-timing.json). The [push measurement](auction-evidence/two-context-push-timing.json) records 116.6478ms. The final HTTP log contained 1,233 requests (API 1,083; Keycloak 103; session 47), no unmodeled 501 responses and no `/events` calls. A successful room-to-payment flow uses the actual private read shape and actual Next payment page with an explicit fixture QR. The first revised suite exposed only an assertion mixing StrictMode connections; per-connection grouping corrected the harness, retaining the 15-second assertion. A later startup attempt stopped on Next's existing security reminder; its unchanged retry passed all 26.

## Prior reviewer checkpoint — 25 browser / 283 unit tests

At commit `6550d254`, before the latest heartbeat/private-order revision, the full local auction browser suite passed **25/25 in 2.1 minutes**, and unit/auth/service tests passed **283**. Generated-type drift, lint, fresh isolated route typecheck and production build passed. Full catalog regression passed 55 with 38 existing configuration skips and zero failures in 2.2 minutes. `git diff --check` passed before that packaging. These are historical checkpoints, not final checks for the later changes.

That suite used a superseded five-second valid-state liveness rule. It covered immediate named state, two browser contexts, silence fallback, invalid/foreign snapshots, delayed settlement, verified win/loss, 44px mobile controls, address review/POST, unchanged-address recovery, preserved input during WON→SETTLED/private-read 503, private timeout closure and navigation to the existing payment page's fixture QR. Its final bid-click→observer measurement was **78.5974ms** against local HTTP stand-ins. It recorded 1,192 HTTP calls (1,044 API, 102 Keycloak, 46 session), no unmodeled 501 responses, ten successful `/stream` connections and 26 deliberate 503 stream-fallback responses, with no `/events` calls.

The address-preservation regression failed in an earlier targeted attempt and was corrected before that 25/25 run. Next startup/build attempts stopped on the existing security advisory; unchanged retries succeeded. Full catalog also passed after an unchanged advisory/startup-shutdown retry. These environment interruptions are distinct from final passing runs. The latest 26-case first attempt's heartbeat telemetry assertion mixed StrictMode stream connections; the harness was corrected and the final full rerun passed 26/26.

Six refreshed images from the passing 26-case run show [desktop](auction-evidence/desktop.png), [leading](auction-evidence/leading.png), [mobile](auction-evidence/mobile.png), [winner](auction-evidence/won.png), [shipping review](auction-evidence/winner-shipping.png) and the [existing payment page](auction-evidence/winner-payment.png). The corresponding [timing JSON](auction-evidence/two-context-push-timing.json) and heartbeat timing file describe local HTTP evidence. Media and QR data are explicit fixtures and do not prove a real payment session or bank transfer.

## Initial revision evidence — 2026-11-13

Historical evidence at implementation commit `aebc78e3`: baseline generated-type check and 266 unit tests passed before implementation. The initial room passed 275 unit tests, 14 auction browser scenarios, lint, fresh route typecheck, generated-type drift, build and diff checks. Full catalog/browser regression passed 55 with 38 existing skips; focused homepage regression passed 1/1. These counts do not validate subsequent protocol, winner checkout or backend read changes.

The test media are SVG fixtures, not a production fallback. Earlier attempts stopped on Next's security reminder or the worktree's cross-drive dependency junction; unchanged retries and copying installed dependencies resolved the environment failures without changing the package lock.

## Live integration limits

- [ ] Real #168/#169 state/history and public gateway integration.
- [ ] Real #253 `/stream` named state/15-second heartbeat, native reconnect and replay evidence.
- [ ] #267 T4: two real backend users see a new bid in under one second.
- [ ] 1,000 concurrent live connections and resource/latency acceptance.
- [ ] Real settlement worker stores the private order reference; #180 winner address→#172 shipping→payment flow on a compatible staging deployment.

A read-only inspection on 2026-11-14 found no listening local services on the usual gateway/auction/commerce/Keycloak ports. The later disposable PostgreSQL tests exercised only the selected auction read integration with a mocked JWT decoder, not that service stack. No staging two-user/load run, settlement worker or bank transfer is claimed. #172's controller/service/OpenAPI was inspected at `b17f3275`; its real shipping endpoint was not invoked. Keep live #180/#267 acceptance open.

Installed Next 16.4.0 has an existing security reminder. A framework upgrade remains separate maintenance work.
