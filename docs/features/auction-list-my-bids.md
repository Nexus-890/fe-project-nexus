# Buyer auctions, My Bids and second chance offers (#205)

The original implementation at `6d5fb0ec` used #178 commit `aebc78e3`. The 2026-11-15 review merges `origin/develop` `aa238638`, which already contains the updated auction room, private winner references and public state/history reads. This task owns the list and My Bids frames from `03 · Buyer · Auction.png`, the buyer offer card merged from #268, and its accepted-offer address/payment handoff. It adds no backend endpoint or migration.

## Delivered list and bid integration

`/auctions` consumes public `GET /api/v1/auctions?status=ACTIVE|SCHEDULED|ENDED&page=0&size=8`. Cards show server titles, images, prices, bid counts and a ticking start/end badge, with server pagination and links to `/auctions/{id}`. The four-column desktop grid collapses on smaller screens. Local sorting explicitly says **Sort this page** because the delivered API sorts pages by `endAt,id` and has no additional sort/filter parameters.

`/my-bids` uses protected `GET /api/v1/bids/mine?page=...&size=10`. It reads all pages before deriving status tabs/counts, deduplicates auction references and paginates filtered results. Requests forward cancellation and use the current provider session with protected query metadata. Session changes remount private UI; no token enters query keys. Public details enrich visible rows. An unavailable or restricted detail never removes a private bid or invents its currency, image, current price or deadline.

Private `leading` and `won` flags control personal results. `ENDED` remains **Result pending**; the timed-out winner sees **Payment deadline passed**. The latest personal bid is labelled **Your bid**, because `MyBidQuery` does not guarantee a historical maximum when cancelled bids exist. The current private response contains nullable winner-only `orderId`, `paymentDueAt` and `finalPrice`; public detail does not expose these references. Final price display uses the private field. A recorded winner in SETTLED still displays **Won**, because SETTLED means order creation rather than proof of payment. The summary shows **Awaiting order**, counting verified WON/SETTLED winners without an order reference; it does not infer unpaid orders from auction status. A stale ACTIVE private snapshot cannot reopen bidding after public detail closes.

List and bid reads reconcile every 15 seconds; countdowns are advisory client-clock displays. Room bidding and backend deadlines remain authoritative. Current develop delivers `GET /api/v1/auctions/{id}/state` and public `GET /api/v1/auctions/{id}/bids`. The `/stream` transport remains a separate #253 integration dependency.

Figma adjustments follow available data: no fabricated category/price/seller-level/no-reserve filters, watchers, free shipping, ratings, trust score or monthly sales totals. Summary cards use supported counts. **Ended** requests exactly ENDED rather than all terminal states. Header, account sidebar and mobile navigation reach both new pages.

## Reviewer-agreed #208 offer contract

The 2026-11-15 review selects these canonical buyer paths, replacing the earlier frontend proposal. No #208 offer controller, DTO, OpenAPI or table is delivered in merged develop; the response model remains an explicit integration seam until that provider lands.

| Method | Agreed path | Result used by the frontend |
| --- | --- | --- |
| GET | `/api/v1/auctions/offers/me?page=0&size=10` | Private envelope with `data: Offer[]` and sibling `page` |
| POST | `/api/v1/auctions/offers/{offerId}/accept` | Private envelope with accepted Offer |
| POST | `/api/v1/auctions/offers/{offerId}/decline` | Private envelope with declined Offer |

An Offer has UUID `id`, UUID `auctionId`, `title`, nullable `imageUrl`, ISO currency, numeric `amount`, `status` (`OFFERED`, `ACCEPTED`, `DECLINED`, `EXPIRED`), ISO `offeredAt`/`expiresAt`, nullable UUID `orderId` and nullable ISO `paymentDueAt`. ACCEPTED requires order and payment references. Runtime parsers validate these fields and normalize money at the existing safe numeric boundary. Auction/bid money is `numeric(19,2)` after V2, superseding the supplied V1 diagram's bigint fields.

Only returned offers render. Viewing My Bids never creates/sends an offer or derives one from payment timeout. The UI preserves the recipient's returned amount, shows expiry and allows penalty-free decline. Synchronous pending guards prevent repeated clicks. Ambiguous writes are not repeated; a status read can reveal a completed acceptance after an interrupted response. If the result remains unknown, actions stay blocked. Missing endpoints expose retry feedback rather than invented offers or success. Offer expiry uses the local clock because the response has no server-time reference; #208 must enforce actual eligibility and expiry.

## Accepted offer through address confirmation to payment

An accepted offer with its real `orderId` and `paymentDueAt` opens the shared `AuctionWinnerCheckout` address flow on the card. The buyer edits the address, reviews it in a confirmation dialog and submits the direct body:

```text
POST /api/v1/orders/{orderId}/shipping-confirmation
{recipientName, phoneNumber, addressLine, wardCode, provinceCode, countryCode: "VN"}
200 data: {orderGroupId, shippingFee, totalAmount, dueAt}
```

This matches #172's controller/service/OpenAPI inspected at `b17f3275` and its later branch head `9fc3e5e6`. The endpoint requires BUYER, `CHECKOUT.START`, ownership and an unexpired PENDING AUCTION order. An identical normalized address replays its saved confirmation; a different address or closed order returns 409. The accepted offer gets its fresh deadline from #208; shipping confirmation preserves it rather than inventing another 24-hour window.

The card displays returned shipping, total and deadline, then links to the existing `/checkout/payment/{orderGroupId}` page using the returned UUID. It never guesses a group, fee, total or address endpoint. Uncertain confirmation retains the submitted address for explicit safe retry. The earlier server deadline closes shipping/payment controls; session/order changes clear private form state. The order link remains for inspection and is no longer the end of acceptance.

## Verification and integration limits

Run `npm run test:auction-list` for real Next against local Postman HTTP/OIDC dependencies and `npm run test:auction` for the merged room. Both use ports 3118/3928 and must run serially. Run build after browser cleanup because the runner temporarily creates auth probe routes. The resolved mock retains both suites' scenarios and historical context evidence.

The revised T5 performs a modeled seller offer, buyer acceptance, address review/confirmation and navigation to the existing payment page. This verifies frontend behavior against stand-ins. Real #208 eligibility, recipient/highest-price selection, uniqueness, seller sequencing, notification, expiry/stock return, order creation and payment settlement remain backend responsibilities. #172 shipping is implemented on a separate branch but not merged here. Fixture success establishes no live payment or cross-service database invariant.

See [verification](auction-list-verification.md) for dated results and [merge request text](auction-list-merge-request.md) for copied criteria and live gaps. Local CLI 1.73.0 has no `postman status` command; this task reuses checked-in simulation without workspace publication or claiming a verified provider mock.
