# Buyer auction room

The canonical room from MR !169 (`6550d254`) is integrated into `/auctions/[auctionId]`, preserving its bidding, state/SSE reconciliation, masked history and winner address/payment flow. Homepage cards enter this same route. The #220 seller reputation component now appears in its Auction seller section; it reads the actual rating-service aggregate. Auction listing and My Bids remain separate tasks.

## UI and behavior

The shop header/footer wrap the desktop columns and mobile stack: product gallery, item details, title/status, countdown, bid panel and masked paginated history. Product and auction responses supply content. No Figma example prices, seller ratings, watcher counts or trust scores are synthesized. Seller score and trust level come from protected `GET /api/v1/reputations/{sellerId}`; anonymous visitors can sign in and missing aggregates remain unavailable. Money uses decimal strings and exact-cent arithmetic; V2's `numeric(19,2)` supersedes the attached V1 diagram's `bigint` columns.

`useAuctionState` uses server time plus a monotonic browser clock. Without healthy push data, state/history poll every two seconds, while richer detail and the private own-bid lookup reconcile every 15 seconds. Missing state enables two-second detail fallback. Hidden tabs pause interval reads; transient 408/429 responses can recover on subsequent intervals. End-time extensions update the timer while detail catches up.

Following the 2026-11-14 reviewer clarification for #253, public native `EventSource` uses `GET /api/v1/auctions/{id}/stream` and the named `state` event. A validated matching payload updates state/price/countdown immediately; push updates have no two-second coalescing delay. Supporting history/private/detail REST refreshes are throttled separately to two seconds. Only accepted state messages prove liveness: an open connection alone is insufficient. Five seconds without valid current state restores two-second polling; errors do the same. Native reconnect preserves `Last-Event-ID`; the stream closes on unmount, hidden tabs and final results. Late REST completions and stale/regressing push data cannot replace newer accepted state. Backend replay and runtime latency are still unverified.

The bid form starts at `currentPrice + bidIncrement`, matching the delivered backend even before the first bid. A rejected bid uses validated `AUCTION_BID_TOO_LOW.minimum`; a corrected/new bid gets a new UUID key. An uncertain network/5xx or malformed success locks amount editing and preserves the amount/key for explicit retry. POST replay data never replaces current market price. Private requests use the current auth session; remounting on sign-out/account changes clears attempt UI. Authenticated `/bids/mine` supplies leading/won flags rather than identity guesses from masked names. A stale public history row cannot receive a leading/You badge unless its amount matches current price.

`ENDED` means settlement is pending. Bidding closes, the page says it is confirming the result, and state reconciliation continues. The last leading bidder is not declared the winner. Confirmed public settlement and a current private result produce explicit winner/loser states; FAILED/CANCELLED remain distinct. Supporting final reads reconcile delayed private/detail results before presenting a win or loss.

## Winner address and payment

A verified winner with a server-supplied `orderId` can open the address form, review it in a native confirmation dialog, then submit shipping confirmation. The application service follows #172's implementation on integration branch `b17f3275`, not a guessed request shape:

```text
POST /api/v1/orders/{id}/shipping-confirmation
body: {recipientName, phoneNumber, addressLine, wardCode, provinceCode, countryCode: "VN"}
200 data: {orderGroupId, shippingFee, totalAmount, dueAt}
```

The endpoint requires BUYER, `CHECKOUT.START` and winner ownership. The direct address body has no `shippingAddress` wrapper or `paymentMethod`. The service validates Vietnamese carrier phone/locality formats, trims fields and maps numeric money into exact decimal strings. The UI displays returned shipping/total/deadline before linking to the existing `/checkout/payment/{orderGroupId}` route. It never invents fees, a payment group or a fresh deadline. An uncertain response retries the same address; #172 returns the saved result for an identical normalized address. An expired known deadline closes shipping/payment controls.

Branch `b17f3275` is not merged into the `develop` baseline. It implements shipping confirmation but its AuctionResponse still omits `orderId`, `finalPrice` and `paymentDueAt`, and OrderResponse exposes no `referenceId`/`auctionId`. A winner without an order reference sees an explicit waiting state. No SKU/title matching or speculative order lookup is performed. This missing auction-to-order handoff prevents claiming the full live #180 acceptance criterion complete.

## Delivered integration and dependencies

Confirmed against `develop` Java/controllers and `be-project-nexus/docs/api/openapi/auction-service.yaml`:

- Public `GET /api/v1/auctions/{id}`.
- Private `POST /api/v1/auctions/{id}/bids`, numeric `{amount}`, UUID `Idempotency-Key`, 201 creation / 200 replay.
- Private paginated `GET /api/v1/bids/mine?page=...&size=100`; the room searches successive pages. `won` applies to WON/SETTLED/PAYMENT_TIMEOUT when stored winner matches.

Still pending for live integration:

- #168 state and #169 public history exist in the separate draft `docs/api/auction-service.yaml`, with no implementation/public gateway policy on this baseline.
- #253 `/stream` + named `state` is the reviewer-specified frontend target; no backend implementation was found in inspected develop/MR refs. Reconnect/replay, two real users seeing changes in under one second, and 1,000 concurrent connections have not been demonstrated against real services.
- #170/#171 settlement is absent from develop. #172 branch `b17f3275` adds commerce settlement/shipping confirmation and WON→SETTLED handling, but does not supply the room's missing order reference.
- Optional settlement fields are parsed only when supplied. No hardcoded trust threshold is enforced.

## Verification

`npm run test:auction` runs the canonical 25-scenario suite against the actual Next application with explicit HTTP/Postman and OIDC fixtures. The signed-in bid scenario also verifies that the same room displays the returned seller score/trust before placing a bid. It covers polling/SSE fallback, safe bid replay, final-result reconciliation, conditional winner checkout and mobile control targets. These fixture checks establish frontend behavior, not live readiness of draft state/history/SSE or the complete winner flow.

After integration, `npm run test:unit` passed 300 tests and `npm run typecheck` passed. The parent task records the current browser/build evidence alongside the #220 report.
