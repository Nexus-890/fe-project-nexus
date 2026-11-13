## Summary

Implement the buyer Auction room at `/auctions/[id]` with the supplied Figma layout, automatic price/countdown updates, bid submission, masked history, extension notices and end states. Connect delivered auction APIs and provide explicit fallback feedback for the state/history/SSE and winner-checkout capabilities still awaiting backend delivery.

Closes #178

## Changes

- `app/(shop)/auctions/[id]/page.tsx`, `features/AuctionRoomPage.tsx`: add the responsive room, product gallery, bid panel, history and conditional winning-order link; homepage auction cards now enter the room.
- `features/useAuctionState.ts`: add server-clock countdowns, two-second state/history polling, slower supporting reads, extension refreshes and public SSE lifecycle with coalescing/fallback.
- `features/useAuctionBid.ts`: default to the backend minimum, validate exact decimal amounts, display rejected-bid errors and preserve the amount/key after an uncertain response.
- `service/auctionService.ts`, `types/auctionRoomType.ts`, `types/auctionGeneratedType.ts`: validate/map delivered reads and writes, generate delivered DTOs, and explicitly separate provisional state/history models.
- `configs/api.ts`, `configs/queryKeys.ts`, `components/Auction*.tsx`, `components/PriceDisplay.tsx`: keep HTTP/SSE configuration and cache keys centralized; render shared price, countdown and history components.
- `tests/auction*`, `playwright.auction.config.ts`, `postman/`: add real HTTP/Postman browser scenarios and `npm run test:auction`.
- `docs/features/auction-room.md`, `auction-verification.md`, `auction-evidence/`: document integration limits and preserve desktop/mobile/leading/winner evidence.

## API

This frontend MR adds no backend endpoints. Delivered API consumption:

| **Method** | **Path** | **Access** | **Success** | **Errors** |
| ---------- | -------- | ---------- | ----------- | ---------- |
| GET | `/api/v1/auctions/{id}` | Public | 200 | 400, 404 |
| POST | `/api/v1/auctions/{id}/bids` | BUYER + `AUCTION.BID` | 201 new / 200 replay | 400, 401, 403, 409 |
| GET | `/api/v1/bids/mine` | BUYER + `AUCTION.VIEW_BID_HISTORY` | 200 | 400, 401, 403 |

Provisional integration targets; these rows do **not** assert backend delivery:

| **Method** | **Path** | **Access** | **Success** | **Errors** |
| ---------- | -------- | ---------- | ----------- | ---------- |
| GET | `/api/v1/auctions/{id}/state` | Public, proposed #168 | 200, draft | 404 while unavailable; transient HTTP errors handled |
| GET | `/api/v1/auctions/{id}/bids` | Public, proposed #169 | 200, draft | 404 while unavailable; transient HTTP errors handled |
| GET | `/api/v1/auctions/{id}/events` | Public, frontend proposal pending #253 | 200 `text/event-stream`, proposed | Missing/error stream falls back to polling |

Bid writes send numeric `{amount}` and UUID `Idempotency-Key`. Public calls omit Bearer; private calls use the current scoped session.

Config keys: none added. The room reuses existing `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` (default: empty, same origin) and existing optional `API_PROXY_TARGET` for local API rewrites.

## Acceptance criteria

- [x] "Price and countdown update by themselves." — verified changing price/history and decreasing server-clock countdown in browser scenarios, including a browser clock one hour ahead.
- [x] "2-second polling with TanStack Query, no SockJS and no STOMP" — verified state/history request cadence; no SockJS/STOMP dependency added.
- [x] "The input starts at the lowest amount the server will accept" — verified `currentPrice + bidIncrement`, numeric POST body and one-click submission.
- [x] "a refused bid says what the minimum is now" — verified `AUCTION_BID_TOO_LOW.minimum` updates the form and a corrected attempt uses a new key.
- [x] "who has bid, what happens when the end moves, and what the page shows once it is over" — verified masked history, extension notice/countdown changes, closed controls and authenticated winner/order-link behavior against local fixtures.
- [x] "Polling stays as the fallback." — verified SSE event refresh, disconnect fallback and burst coalescing against the local HTTP simulation.
- [x] Same-key retry does not create a duplicate bid — simulated a write followed by a lost success response; two POST attempts produced one write.
- [x] UI follows the Auction room frame — reviewed desktop/mobile screenshots; controls fit a 375px viewport and the mobile form precedes item details.
- [ ] Live state/history and SSE integration — backend #168/#169 and SSE contract #253 are not delivered on this `develop` baseline. Current evidence establishes frontend behavior against documented stand-ins.
- [ ] Complete winner address confirmation and payment handoff — settlement #170/#171 and shipping-confirmation #172 remain backend dependencies. No request body, order group, shipping fee or payment total is fabricated.

## How to test

1. In `fe-project-nexus`, use the installed Node/npm dependencies, Postman CLI 1.70+ and Chrome. Run `npm run test:auction`; its config starts Next at `http://127.0.0.1:3118` and the Postman/OIDC dependency simulation at `http://127.0.0.1:3928`.
2. Run `npm run generate:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:auth` and `npm run test:catalog`. For the production build in PowerShell, run `$env:NEXUS_TEST_DIST_DIR='.next-auction-build'; npm run build`.
3. Expected results from the recorded run:

   ```text
   Auction browser: 14 passed.
   Unit/auth/service: 275 passed.
   Catalog/browser regression: 55 passed, 38 existing skips, zero failures.
   Generated DTO drift, lint, typecheck and production build: passed.
   Countdown, extension, minimum correction, safe retry, terminal UI,
   missing-endpoint feedback, SSE fallback and mobile bounds behave as asserted.
   ```

4. For manual live checks, start the existing frontend with its normal API/session configuration and open `/auctions/<public-auction-uuid>`. On the current backend, unavailable draft reads must show explicit fallback feedback; do not interpret fixture winner/SSE screenshots as proof of live delivery.

## Checklist

- [ ] `.\mvnw.cmd verify` passes in every service touched — not applicable; no Java service was changed or Maven verification run.
- [ ] The service starts against PostgreSQL with `ddl-auto: validate` — not applicable to this frontend-only MR; no new live database startup was performed.
- [ ] No secret, `.env`, `.idea/` or log file in the diff — candidate scan passed; left unchecked for reviewer confirmation as requested by the checklist template. Committed PNGs are intentional UI evidence.
- [ ] New endpoints added to `docs/api/gateway-permissions.md` and to the service's `public-endpoints` when public — no backend endpoints are introduced here; proposed state/history/SSE registration belongs to #168/#169/#253.
- [ ] Branch is up to date with `develop` and has no conflict markers — based on fetched `origin/develop` `09b3cf6f`; ancestry and diff checks passed before push. Left unchecked for reviewer confirmation as requested by the checklist template.

## Out of scope / follow-ups

- Backend state and public history delivery/public routing: #168 and #169.
- Final SSE route, event names, replay and gateway behavior: #253; this MR covers the frontend portion of #267.
- Winner settlement and payment lifecycle: #170/#171; winner shipping-confirmation contract/implementation: #172.
- Auction listing and My Bids screens in the same Figma export remain separate from the room task.
- Existing Next 16.4.0 security upgrade: separate maintenance work; no dependency upgrade is included here.

## Notes for reviewers

- Keep the MR in draft while the live integration dependencies remain unresolved. `Closes #178` links the requested issue; the unchecked criteria above must be resolved or explicitly accepted before merge.
- `docs/api/openapi/auction-service.yaml` is the delivered contract. The separate `docs/api/auction-service.yaml` is a draft; state/history/SSE and settlement evidence are clearly identified as simulated/provisional.
- The attached V1 schema shows `bigint`, but V2 migrates money to `numeric(19,2)`. Frontend arithmetic uses exact decimal cents and rejects values that cannot safely cross the numeric JSON boundary.
- Public masked names do not prove the buyer's identity. Own leading/won flags come from authenticated `/bids/mine`, searching successive pages; stale history cannot incorrectly label a previous bidder as "You".
- Supporting reads reconcile more slowly than state/history to limit gateway traffic. Terminal changes and accepted bids refresh authoritative data; an idempotent replay is never treated as the latest market price.
- Local browser tests run the actual Next app against Postman HTTP dependencies. Screenshots use explicit test-only SVG product media; production uses API product images and has no silent mock fallback.
- Installed Next sometimes stopped dev/build to display its existing security reminder; unchanged retries passed. See `docs/features/auction-verification.md` for executed checks and limits.
