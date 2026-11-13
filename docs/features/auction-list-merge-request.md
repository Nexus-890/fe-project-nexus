Add buyer auction discovery and My Bids using the supplied Figma frames, with paginated API data, live countdowns and links into the #178 auction room. Add the buyer second chance offer card with Accept/Decline, expiry and safe status reconciliation against an explicit provisional #208 contract. Keep this MR in draft until backend offer and address/payment dependencies are delivered and verified.

Closes #205

-
  ```php-template
  app/(shop)/auctions, features/AuctionsPage, components/AuctionListingCard/AuctionTimeBadge: public ACTIVE/SCHEDULED/ENDED discovery with page controls, prices, ticking start/end badges and room navigation.
  app/(shop)/my-bids, features/MyBidsPage: session-protected bid history across all API pages, accurate status tabs/counts, leading/outbid/pending/final states and visible-row detail enrichment.
  features/AuctionSecondChanceOffers, service/auctionOfferService, types/auctionOfferType: proposed #208 recipient-offer read/respond seam, server amount/deadline display, accept/decline/expired states, one-click guard and ambiguous-write reconciliation.
  configs/queryKeys/routes, components/HeaderTopBar/MobileAccountNavigation: central cache/session keys and desktop/mobile entry points.
  ```
1.
   ```php-template
   service/auctionService: validated public list and private bid pages using delivered DTOs; export shared money/page parsers for offer responses.
   tests/auction-list*, playwright.auction-list.config, postman/mocks/auction-api: eight new unit cases and nine real Next + HTTP/OIDC browser scenarios, preserving fourteen #178 regressions.
   docs/features/auction-list-*, postman/simulations/auction.context.yaml: API/database audit, explicit missing dependencies, visual evidence and verification record.
   ```

Config keys: none.

- [x]
  ```php-template
  The list shows ACTIVE and SCHEDULED auctions with current price and time left, and opens #178's page — verified public status/page queries without Bearer, price/countdown display and decrement, page 2, scheduled cards and /auctions/{id} links in the nine-case browser suite.
  ```
- [x]
  ```php-template
  "My bids" shows each auction with leading or outbid and the final result — browser verified authenticated page 0/page 1 reads and leading/outbid/won/lost tabs. Source review additionally confirms authoritative private flags, pending ENDED display and preservation of a bid when public details are unavailable.
  ```
- [x]
  ```php-template
  F2 Buyer offer card with Accept and Decline. — verified recipient amount, pending guard, one accept write/order under repeated clicks, decline without an order, expiry, retry and 375px controls against the provisional Postman dependency.
  ```
- [ ]
  ```
  T5 Playwright: seller offers, buyer sees the card and accepts, confirms the address and reaches the payment page. — buyer read/respond/order-link behavior is covered with an explicit seller-action stand-in; delivered seller initiation/order creation belongs to #208, and address confirmation/payment handoff requires #172/#208.
  ```
- [ ]
  ```
  No email goes to any bidder until the seller taps "Offer to next bidder" — FE never initiates an offer from page reads or payment timeout; actual email initiation requires #208 and notification integration verification.
  The offer amount is the offered bidder's own highest bid, never the first winner's price — FE preserves 4,800,000 from the mock response instead of the 5,000,000 winner price; real recipient/price selection must be verified with #208.
  Only one open offer per auction; the seller can offer again after a decline or expiry, to the bidder after that — database uniqueness and seller sequencing belong to #208; no offer schema/controller exists in this baseline.
  Decline or no answer within 24 h costs the bidder nothing; the unit goes back to the seller's stock — FE shows expiry/no-penalty and sends no order on decline; stock return and penalty invariants require #208/inventory integration.
  Accept creates one order at the offer amount with a fresh payment deadline, and the auction ends SETTLED after payment — FE guards duplicate clicks, reconciles a lost success response and renders the server order/deadline; actual order creation and settlement require #208/commerce/payment integration.
  The timed-out first winner never receives an offer for the same auction — recipient exclusion must be enforced by #208; FE does not derive eligible recipients from bid history.
  auction, inventory, commerce and notification tests and the auction Playwright suite pass — FE auction suites pass; backend cross-service guarantees are not demonstrated on this FE-only branch and remain with #208 and owning backend MRs.
  ```

1. Start the existing frontend against the gateway with its current API/session configuration. For repeatable local acceptance, `cd fe-project-nexus`; `npm run test:auction-list` starts real Next on 3118 and the Postman/OIDC stand-ins on 3928. No production mock flag or new config key is enabled.
2. Run `npm run generate:types:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:auction-list`, `npm run test:auction`, `npm run test:catalog` sequentially. After browser cleanup, set `$env:NEXUS_TEST_DIST_DIR='.next-auction-list-build'` and run `npm run build`.
3.
   ```
   New auction-list/My Bids/offer browser suite: 9 passed.
   Inherited auction-room browser suite: 14 passed.
   Unit/auth/service suite: 283 passed.
   Catalog/browser regression: 52 passed; the three changed navigation cases passed their targeted rerun; 38 existing skips.
   Generated DTO drift, lint, typecheck and production build: passed.
   No unmodeled 501 dependency calls in the new browser suite.
   Offers appear only after an explicit mocked seller action; accept sends once, decline creates no order, expired offers cannot be accepted, and interrupted acceptance resolves from a status read.
   ```

- [ ] `.\mvnw.cmd verify` passes in every service touched — no Java service touched; not run for this frontend-only change.
- [ ] The service starts against PostgreSQL with ddl-auto: validate — no new backend/database startup performed.
- [ ] No secret, .env, .idea/ or log file in the diff — candidate diff scan recorded in verification; reviewer checklist remains open.
- [ ] New endpoints added to docs/api/gateway-permissions.md and to the service's public-endpoints when public — this MR adds no backend endpoint. Proposed private offer routes and policies must be delivered by #208.
- [ ] Branch is up to date with develop and has no conflict markers — based on fetched develop 09b3cf6f via #178; final ancestry/diff checks recorded before push.

- Backend offer eligibility, seller initiation, notification, uniqueness, stock return and settlement are deliberately outside this FE task and owned by #208; winner address confirmation/payment handoff is owned by #172. State/history/SSE/settlement dependencies inherited from #178 remain with #168/#169/#170/#171/#253.

This branch includes the requested #178 commit aebc78e3; develop currently does not contain it, so its prerequisite changes also appear in the MR diff. Review #205 additions relative to that commit or merge #178 first. The provisional offer paths/models require agreement with #208 before integration. Your bid labels the latest personal bid rather than inventing a maximum; unsupported seller/filter/trust/shipping data is omitted. Offer/list countdowns use the browser clock and backend deadlines remain authoritative. Complete live address/payment and backend invariants are explicitly unchecked above.
