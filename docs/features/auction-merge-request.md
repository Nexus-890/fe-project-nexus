## Summary

Implement `/auctions/[id]` from the Auction room Figma frame with automatic price/countdown, bids, masked history and explicit settlement states. Follow the #253 reviewer contract (`/stream`, named `state`) with immediate validated push updates and silent-stream polling fallback. Add conditional winner address review, #172 shipping confirmation and payment navigation while keeping the missing live order-reference handoff explicit.

Related: #178, #179, #180 and frontend #267. #180 and live #267 acceptance remain incomplete pending the integration items below.

## Changes

- Add the responsive room, gallery, bid panel, history and direct homepage entry.
- Use server-clock countdowns, two-second fallback polling, `/stream` named-state updates without a push coalescing delay, and a five-second valid-state heartbeat deadline. Throttle supporting REST separately; prevent stale responses from regressing accepted state.
- Keep ENDED pending, reconcile delayed own/detail results, and show distinct verified winner, loser, failed and cancelled states.
- Preserve exact bid minimum/decimal validation and safe same-key retry after uncertain writes.
- Add a conditional winner address form and native review dialog. POST the verified #172 direct-address contract, show returned shipping/total/deadline, and open the existing payment route with the returned group id. Same-address recovery preserves an uncertain intent.
- Add shipping HTTP/service tests and expand Postman/browser fixtures for two contexts, raw state messages, silence, delayed settlement, winner payment handoff and all mobile control bounds/44px targets.
- Document the integration branch contract, missing auction-to-order reference and explicit live acceptance gaps.

## API

This frontend MR adds no backend endpoints. Delivered `develop` consumption:

| **Method** | **Path** | **Access** | **Success** | **Errors** |
| ---------- | -------- | ---------- | ----------- | ---------- |
| GET | `/api/v1/auctions/{id}` | Public | 200 | 400, 404 |
| POST | `/api/v1/auctions/{id}/bids` | BUYER + `AUCTION.BID` | 201 new / 200 replay | 400, 401, 403, 409 |
| GET | `/api/v1/bids/mine` | BUYER + `AUCTION.VIEW_BID_HISTORY` | 200 | 400, 401, 403 |

Integration targets, distinguished from delivery on this baseline:

| **Method** | **Path** | **Access** | **Success** | **Errors** |
| ---------- | -------- | ---------- | ----------- | ---------- |
| GET | `/api/v1/auctions/{id}/state` | Public, draft #168 | 200 draft | Missing read shows snapshot fallback; transient errors recover |
| GET | `/api/v1/auctions/{id}/bids` | Public, draft #169 | 200 draft page | Missing read shows history failure; transient errors recover |
| GET | `/api/v1/auctions/{id}/stream` | Public target from reviewer #253 | `text/event-stream`, named `state` | Errors or five seconds of silence restore polling |
| POST | `/api/v1/orders/{id}/shipping-confirmation` | BUYER + `CHECKOUT.START` + winner ownership, #172 branch `b17f3275` | 200 confirmation / identical-address replay | 400, 401, 403, 404, 409, 422, 500, 502, 503 |

Bid writes send numeric `{amount}` and UUID `Idempotency-Key`. Shipping confirmation sends direct `{recipientName,phoneNumber,addressLine,wardCode,provinceCode,countryCode:"VN"}` without an idempotency key. Its 200 data is `{orderGroupId,shippingFee,totalAmount,dueAt}`. Private calls use the scoped session; public REST/SSE send no Bearer or query token.

Config keys: none added. Existing API origin/proxy configuration is reused.

## Acceptance criteria

- [x] Price/countdown update automatically; server-clock and bid-minimum behavior was established in the prior local suite and retained in the revised implementation.
- [x] Two-second fallback uses TanStack Query; no SockJS or STOMP dependency.
- [x] Bid amount starts at `currentPrice + bidIncrement`; rejection minimum updates the form; uncertain retry retains amount/key.
- [x] Implement reviewer-requested `/stream` and named `state` handling with immediate state application; only supporting reads are throttled.
- [x] Implement five-second silent-stream recovery, stale snapshot rejection, pending ENDED and verified winner/loser states.
- [x] Implement conditional address review, #172 shipping confirmation, returned totals and payment-group navigation when a real order reference is supplied.
- [x] Revised local browser evidence: 25/25 scenarios, independent browser contexts in 78.60ms against HTTP fixtures, and all mobile controls including retries/pagination at 44px. This is separate from live T4.
- [x] Conditional winner address review, same-address recovery, preserved input through settlement/read failures, returned totals and navigation to the actual existing payment page with fixture QR.
- [ ] Live state/history/SSE integration and public gateway policy on the compatible backend.
- [ ] #267 T4 with two real backend users under one second; 1,000 concurrent live connections.
- [ ] Complete live #180 winner flow: backend must expose the auction's order reference and compatible settlement/payment capabilities. `b17f3275` supplies shipping confirmation but is unmerged and does not expose this reference.

## How to test

1. In `fe-project-nexus`, run `npm run test:auction` with installed Node/npm, Postman CLI 1.70+ and Chrome. The config starts Next on `http://127.0.0.1:3118` and HTTP/OIDC fixtures on `http://127.0.0.1:3928`.
2. Run generated-type drift, lint, typecheck, unit/auth and relevant browser regressions. Build with an isolated `NEXUS_TEST_DIST_DIR` as described in `docs/ai/task-workflow.md`.
3. Read `docs/features/auction-verification.md` for executed evidence. Reviewer revision: 25 auction browser scenarios passed in 2.1 minutes; 283 unit tests, generated-type drift, lint, fresh typecheck and production build passed. Full catalog passed 55 with 38 existing configuration skips and zero failures in 2.2 minutes. Two-context local latency was 78.60ms. The previous 14-browser/275-unit result is historical.
4. For live acceptance, connect the compatible backend and use two real buyers. Verify raw `state` updates, silence/reconnect/replay, delayed settlement, a genuine order reference, shipping confirmation and payment. Fixture measurements/screenshots cannot substitute for this step.

## Checklist

- [ ] `.\mvnw.cmd verify` passes in every service touched — not applicable; no Java service changed or Maven verification run here.
- [ ] Service starts against PostgreSQL with `ddl-auto: validate` — no new live backend startup performed.
- [ ] No secret, `.env`, `.idea/` or log file in the diff — checked during final packaging before push; retained unchecked for reviewer confirmation. Intentional PNG/timing evidence is documented.
- [ ] New endpoints registered in gateway/public policies — this MR adds none; #168/#169/#253 remain owning backend work. #172 registers its shipping policy on `b17f3275`.
- [ ] Branch is up to date with `develop` and free of conflict markers — baseline `09b3cf6f`; ancestry/diff checked during final packaging before push, retained unchecked for reviewer confirmation.

## Out of scope / follow-ups

- Merge/deliver #168/#169 and #253 backend streaming, replay and live performance evidence.
- #170/#171 settlement and auction-to-order reference exposure; integrate #172 branch `b17f3275` and the real payment lifecycle.
- Auction listing/My Bids screens and the existing Next security upgrade remain separate work.

## Notes for reviewers

- Keep draft status while unchecked live acceptance remains unresolved; this description does not close #180 or claim real T4 completion.
- Generated auction DTOs use delivered OpenAPI. Draft state/history, reviewer-selected SSE and the unmerged #172 application model are identified explicitly; no backend files or generated commerce DTOs are changed to pretend delivery.
- A winner without `orderId` gets an explicit waiting state. Neither SKU/name matching nor an unsupported order-filter request is used.
- Public masked names do not identify the buyer. `/bids/mine` owns verified leading/won flags and is searched across pages.
- The real Next app runs against local Postman HTTP fixtures. Test-only SVG imagery and subsecond fixture latency are not real backend evidence.
- The final run recorded 1,192 HTTP calls with zero unmodeled 501 responses and no `/events` requests. Six screenshots and the timing JSON are retained under `docs/features/auction-evidence/`. The existing payment page loads its QR from the fixture; no bank transfer is claimed.
- An earlier targeted regression exposed lost typed address during WON→SETTLED/private-read refresh. It was fixed and the final suite covers preservation. Production build and full catalog passed after unchanged retries of the existing Next advisory/startup shutdown. These interruptions are recorded separately in verification.
