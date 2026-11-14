# Auction room verification — 2026-11-14

Base: `origin/develop` `09b3cf6f`; branch `fsa_ChungTQ/chore/178-fe-auction-room-state-and-countdown-bid-panel-bid-history-and-end-state-live-updates` in the attached `buyer-auction-room` worktree. The original checkout's three backend edits were preserved. This revision changes frontend room behavior, tests and documentation; it does not merge or change backend/schema code.

## Reviewer revision

The 2026-11-14 changes replace `/events` with reviewer-specified `/stream` + named `state`, apply validated push snapshots immediately, retain two-second throttling only for supporting reads, and restore two-second polling after five seconds without valid state. Reconciliation rejects stale REST/push data. ENDED stays pending; confirmed settlement and a current own-bid response control explicit winner/loser UI.

Winner checkout has an address form, native review dialog and POST shipping confirmation, followed by returned totals/deadline and the existing payment route. Its pure service follows #172 integration branch `b17f3275`; the form remains conditional on an actual server-supplied order id. The branch is not merged and does not expose that reference in its auction/order read DTOs.

| Check on reviewer revision | Result |
| --- | --- |
| `npm run test:auth` | 283 passed, including four new shipping HTTP tests and state reconciliation tests |
| `npm run generate:types:check` | Passed against delivered DTOs |
| `npm run lint` | Passed |
| `npm run test:auction` | 25/25 passed in 2.1 minutes against the real Next app and local Postman HTTP/OIDC dependencies |
| Two browser contexts, named state and subsecond update | Passed; final bid-click→observer measurement 78.60ms against the fixture |
| Open but silent stream, invalid/foreign messages and fallback | Passed; 5.6-second silent interval followed by two fallback polls; malformed/foreign state rejected |
| Delayed settlement, stale own win, missing order reference | Passed; ENDED waits, final winner/loser is verified, missing reference never triggers guessed checkout |
| Address review/POST/payment, same-address recovery, expiry | Passed through existing payment page QR; typed address survives WON→SETTLED and own-read 503; private PAYMENT_TIMEOUT closes CTA |
| Every mobile room control has a 44px target | Passed, including history pagination and retry controls, within 375px viewport |
| `npm run typecheck` | Passed against fresh isolated route types |
| `NEXUS_TEST_DIST_DIR=.next-auction-review-build npm run build` | Passed after unchanged retry of the installed Next security-advisory halt |
| Full `npm run test:catalog` | 55 passed, 38 existing configuration skips, zero failures, 2.2 minutes; unchanged retry after Next advisory/startup shutdown |
| `git diff --check` | Passed on the revised files before push; final staged packaging checks follow |

The fixture received a bid from one independent browser context and pushed it to the observer context. [The recorded measurement](auction-evidence/two-context-push-timing.json) is 78.5974ms from bid click to observer price change. This establishes the changed frontend's local push path, not #267 T4 with real auction-service users. HTTP evidence counted 1,192 calls (1,044 API, 102 Keycloak, 46 session), zero unmodeled 501 responses, ten successful `/stream` connections and 26 intentional 503 stream-fallback responses; no `/events` calls remained.

Six PNGs capture [desktop](auction-evidence/desktop.png), [leading](auction-evidence/leading.png), [mobile](auction-evidence/mobile.png), [winner](auction-evidence/won.png), [shipping review](auction-evidence/winner-shipping.png) and the [existing payment page](auction-evidence/winner-payment.png). Media and payment QR data are explicit fixtures. The test navigates the actual payment page; it does not prove a real payment session or bank transfer.

The first targeted reviewer run exposed lost typed address state during WON→SETTLED/private-read refresh. The implementation was corrected to preserve that intent and the regression is covered in the final 25/25 run. Next startup and production-build attempts also stopped on the existing security advisory; unchanged retries started and built successfully. Full catalog passed on an unchanged retry after the same advisory/startup shutdown and initial connection refusal. These earlier failures are distinct from the final passing runs.

## Prior revision evidence

Historical evidence from 2026-11-13 at implementation commit `aebc78e3`: baseline generated-type check and 266 unit tests passed before implementation. The initial room passed 275 unit tests, 14 auction browser scenarios, lint, fresh route typecheck, generated-type drift, build and diff checks. Full catalog/browser regression passed 55 with 38 existing skips; focused homepage regression passed 1/1. These counts are superseded for the changed room and do not validate the new stream protocol or winner checkout.

The six current screenshots supersede the prior room screenshots and continue to use explicit test-only SVG media, not a production fallback. Earlier Next startup/build attempts stopped on its existing security reminder or the worktree's cross-drive dependency junction; unchanged retries and copying installed dependencies resolved those environment failures without changing backend source or the package lock.

## Live integration limits

- [ ] Real #168/#169 state/history and public gateway integration.
- [ ] Real #253 `/stream` named-state contract, reconnect and replay evidence.
- [ ] #267 T4: two real backend users see a new bid in under one second.
- [ ] 1,000 concurrent live connections and resource/latency acceptance.
- [ ] Auction-to-order reference exposure and real #180 address→#172 shipping→payment flow.

Read-only inspection on 2026-11-14 found no listening local services on the usual gateway/auction/commerce/Keycloak ports. This does not replace live verification. #172's `b17f3275` controller/service/OpenAPI supplies the direct-address contract and identical-address replay, but no request was made to that real branch. Development state/history/SSE and settlement remain absent on `09b3cf6f`. Do not mark #180 fully complete from the conditional fixture flow.

Installed Next 16.4.0 has an existing security reminder. A framework upgrade remains separate maintenance work.
