# Buyer auctions, My Bids and second chance offers (#205)

Based on `fsa_ChungTQ/chore/178-fe-auction-room-state-and-countdown-bid-panel-bid-history-and-end-state-live-updates` at `aebc78e3`, which includes fetched `develop` `09b3cf6f`. This task adds the list and My Bids frames from `03 · Buyer · Auction.png`, plus the buyer offer card merged from #268. It does not change Java services or the auction-room behavior owned by #178.

## Delivered list and bid integration

`/auctions` consumes public `GET /api/v1/auctions?status=ACTIVE|SCHEDULED|ENDED&page=0&size=8`. Cards show server titles, images, prices, bid counts and a ticking start/end badge, with server pagination and room links. The four-column desktop grid collapses on smaller screens. Local sorting explicitly says **Sort this page** because the delivered API sorts pages by `endAt,id` and offers no sort/filter parameters beyond status.

`/my-bids` uses protected `GET /api/v1/bids/mine?page=...&size=10`. It reads all pages before deriving status tabs/counts and then paginates the filtered results. It deduplicates auction references, forwards cancellation and uses the current provider session with protected query metadata. Authentication/session changes remount private UI; no token enters query keys. Public details enrich only visible rows. An unavailable/restricted detail never removes a private bid or invents its currency, image, price or deadline.

`leading` and `won` come from the private response. `ENDED` remains **Result pending**; the timed-out winner sees **Payment deadline passed**. The latest personal bid is labelled **Your bid**, because `MyBidQuery` does not guarantee a historical maximum if cancelled bids exist. A stale ACTIVE private snapshot cannot reopen bidding after the public detail closes. Reads reconcile every 15 seconds; countdowns are advisory client-clock displays, while room bidding and backend deadlines remain authoritative.

Figma adjustments follow available contracts: no fabricated category/price/seller-level/no-reserve filters, watcher controls, free shipping, seller rating, trust score or monthly sales totals. Summary cards use supported counts. `Ended` requests the exact ENDED status; it does not claim to aggregate every terminal state. The header, account sidebar and mobile navigation reach both new pages. No backend endpoint is added by this FE task.

## Provisional #208 offer seam

No offer controller, DTO, OpenAPI or database table is delivered in this baseline. The following explicit FE proposal is isolated in `auctionOfferService.ts` and the Postman stand-in; it must be reconciled with #208 before integration/merge:

| Method | Proposed path | Result |
| --- | --- | --- |
| GET | `/api/v1/auctions/offers/mine?page=0&size=10` | Private success envelope with `data: Offer[]` and sibling `page` |
| POST | `/api/v1/auctions/{auctionId}/offers/{offerId}/accept` | Private success envelope with accepted Offer |
| POST | `/api/v1/auctions/{auctionId}/offers/{offerId}/decline` | Private success envelope with declined Offer |

An Offer has UUID `id`, UUID `auctionId`, `title`, nullable `imageUrl`, ISO currency, numeric `amount`, `status` (`OFFERED`, `ACCEPTED`, `DECLINED`, `EXPIRED`), ISO `offeredAt`/`expiresAt`, nullable UUID `orderId` and nullable ISO `paymentDueAt`. ACCEPTED requires both order and payment references. Runtime parsers validate responses before publishing them and normalize money with the existing safe numeric boundary. Backend money is `numeric(19,2)` after V2, superseding the supplied V1 diagram's bigint fields.

Only returned offers render. Viewing My Bids never creates/sends an offer or derives one from a payment timeout. The UI displays the recipient amount unchanged, expiry, optional acceptance, penalty-free decline and an accepted order link with a fresh server deadline. Pending clicks are guarded synchronously; ambiguous writes are not retried. A status refresh can reveal a completed acceptance after a lost response. If the status is still unknown, actions remain blocked. Missing endpoints show a retry message, never fake offers or success. Offer expiry uses the local clock because this proposed response has no server-time reference; #208 must enforce actual eligibility/expiry on the server.

Acceptance links to the existing `/order/{orderId}` boundary. Address confirmation and a complete payment handoff are deliberately pending #172/#208: there is no delivered auction shipping-confirmation request/response, and no order-group ID, shipping fee, payment total or address endpoint is fabricated. Seller initiation, correct recipient/highest amount, one-open-offer constraints, 24-hour expiry/stock return, exclusion of the first winner, emails and paid settlement belong to #208 and related backend owners. FE tests cannot establish these database/cross-service invariants.

## Verification

Use `npm run test:auction-list` for the dedicated real Next + local Postman HTTP/OIDC suite. `npm run test:auction` checks the inherited room. Ports 3118/3928 are shared, so run these suites serially; also run production build after browser cleanup, because browser runners prepare/remove temporary auth routes. Existing mocks are extended without changing normal #178 scenarios. Local CLI is 1.73.0; `postman status` is unsupported, so the existing local simulation is reused without claiming an owner workspace lookup.

Results and screenshots are recorded in [auction-list-verification.md](auction-list-verification.md). The [merge request text](auction-list-merge-request.md) keeps live acceptance gaps unchecked.
