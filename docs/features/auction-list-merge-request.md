Add buyer auction discovery and My Bids using the supplied Figma frames, with paginated data, countdowns and room links. Align second chance offer reads/actions with the reviewer-agreed #208 paths and continue accepted offers through address confirmation to the existing payment page. Merge current develop while preserving both auction browser suites and their evidence.

Closes #205

-
  ```php-template
  app/(shop)/auctions, features/AuctionsPage, components/AuctionListingCard/AuctionTimeBadge: ACTIVE/SCHEDULED/ENDED discovery, prices, countdowns, paging and room navigation.
  app/(shop)/my-bids, features/MyBidsPage: protected history across API pages and private final-price enrichment; SETTLED winners remain Won, and Awaiting order counts missing winner order references without inferring payment status.
  features/AuctionSecondChanceOffers, service/auctionOfferService: canonical GET /api/v1/auctions/offers/me and POST /api/v1/auctions/offers/{offerId}/accept|decline; preserve returned amount and validated accepted-order references.
  features/AuctionWinnerCheckout: reuse address review/shipping confirmation for accepted offers, then reach the payment page using the returned orderGroupId.
  ```
1.
   ```php-template
   configs/queryKeys/routes, components/HeaderTopBar/MobileAccountNavigation: scoped keys and desktop/mobile entry points.
   playwright.config.ts, postman/mocks/auction-api/default.js, postman/simulations/auction.context.yaml: resolve develop conflicts while retaining list/offer and heartbeat/private-winner/shipping scenarios and dated evidence.
   tests/auction-list*, docs/features/auction-list-*: canonical-route coverage, address/payment T5 and current validation with explicit backend integration limits.
   ```

Config keys: none.

- [x]
  ```php-template
  The list shows ACTIVE and SCHEDULED auctions with current price and time left, and opens #178's page — initial browser tests verified public status/page requests without Bearer, prices/decreasing countdown, page 2, scheduled cards and room links; current regression results are recorded in auction-list-verification.md.
  ```
- [x]
  ```php-template
  "My bids" shows each auction with leading or outbid and the final result — initial browser tests verified authenticated pages and leading/outbid/won/lost tabs. Source review confirms private flags, pending ENDED and preserved bids when public detail is unavailable; the merged API supplies private final-price/order references.
  ```
- [x]
  ```php-template
  F2 Buyer offer card with Accept and Decline. — real-HTTP service tests assert the canonical authenticated routes; the 12-case Next/Postman suite verifies recipient amount, accept/decline, expiry, repeated-click protection, interrupted-response reconciliation and mobile bounds. This is frontend evidence against stand-ins, not delivery of #208.
  ```
- [x]
  ```php-template
  T5 Playwright: seller offers, buyer sees the card and accepts, confirms the address and reaches the payment page. — passing local T5 models the explicit seller action, accepts once, reviews/edits the direct address, guards repeated confirmation clicks and opens the existing payment page/QR using the returned group id. Local frontend acceptance is complete; live provider integration remains separately unchecked below.
  ```
- [ ]
  ```
  Live #208 seller offer -> real order -> #172 shipping confirmation -> payment — not run against a compatible backend stack; #208 provider is absent from develop and #172 shipping remains on its separate branch.
  No email goes to any bidder until the seller taps "Offer to next bidder" — FE never initiates offers on reads or payment timeout; actual email requires #208/notification integration.
  The offer amount is the offered bidder's own highest bid, never the first winner's price — FE preserves the returned recipient amount; real selection belongs to #208.
  Only one open offer per auction; the seller can offer again after a decline or expiry, to the bidder after that — database uniqueness and seller sequencing require #208.
  Decline or no answer within 24 h costs the bidder nothing; the unit goes back to the seller's stock — FE handles decline/expiry; stock and penalty invariants require #208/inventory integration.
  Accept creates one order at the offer amount with a fresh payment deadline, and the auction ends SETTLED after payment — FE guards duplicate clicks and uses server order/deadline/totals; actual creation/payment require #208/commerce/payment. Current auction SETTLED means order creation, so final backend lifecycle agreement remains open.
  The timed-out first winner never receives an offer for the same auction — #208 owns recipient exclusion; FE never derives eligibility from bid history.
  auction, inventory, commerce and notification tests and the auction Playwright suite pass — FE results are recorded separately; this review does not establish a live cross-service run.
  ```

1. Start the frontend with its current API/session configuration. For local acceptance, `cd fe-project-nexus` and run `npm run test:auction-list`; real Next runs on 3118 with Postman/OIDC dependencies on 3928. No production mock fallback or new config key is enabled.
2. Run `npm run generate:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:auction-list`, `npm run test:auction` and `npm run test:catalog` serially. After browser cleanup, set `$env:NEXUS_TEST_DIST_DIR='.next-auction-205-review-build'` and run `npm run build`.
3.
   ```
   Current review: 318 unit/auth/service tests passed; the auction-list suite passed 12/12 in 1.4 minutes.
   Inherited auction-room regression: 26/26 passed in 3.1 minutes after an unchanged Next-reminder startup retry.
   Final My Bids/T5/mobile capture/assertion run: 3/3 passed in 26.8 seconds; seven refreshed PNGs are preserved.
   Full catalog/navigation regression: 55 passed, 38 existing configuration skips, zero failures in 2.8 minutes; no retry needed.
   Generated-type drift, lint, final serial typecheck and production build passed; the build required an unchanged retry after the installed Next reminder.
   Verified: canonical authenticated routes; only explicit returned seller offers appear; accept sends once and continues through address review, shipping confirmation and payment using the returned group id.
   Decline creates no order; expired offers cannot be accepted; interrupted acceptance resolves from a status read without repeating the write. Full new-suite HTTP evidence has no unmodeled 501 calls; final targeted evidence has no error outcomes.
   ```

- [ ] `.\mvnw.cmd verify` passes in every service touched — no new Java changes in #205 review; inherited backend changes come from develop, and no new Maven verification is claimed.
- [ ] The service starts against PostgreSQL with ddl-auto: validate — no new live backend/database startup performed.
- [ ] No secret, .env, .idea/ or log file in the diff — final candidate scan passed against develop; reviewer checklist remains open.
- [ ] New endpoints added to docs/api/gateway-permissions.md and to the service's public-endpoints when public — no backend endpoint added; #208 owns offer routes/policies and #172 shipping registration.
- [ ] Branch is up to date with develop and has no conflict markers — merges fetched aa238638; all three conflicts are resolved and marker/diff checks passed. Reviewer checklist remains open.

- Backend eligibility, seller initiation, notification, uniqueness, stock return and settlement are owned by #208 and the owning services. The actual #172 shipping provider is on a separate branch; FE follows its inspected direct-address contract. Live #253 streaming and real settlement/payment remain separate integration work.

Reviewer-selected offer paths replace the original proposal; provider response delivery remains pending #208. #178 is already in merged develop, so it is no longer an unmerged prerequisite. Your bid labels the latest personal bid rather than a fabricated maximum; unsupported filter/seller/trust/shipping data is omitted. Offer/list countdowns use browser time. Acceptance uses the server's fresh deadline, and shipping confirmation preserves it. Fixture success does not prove backend recipient, notification, stock or payment invariants.
