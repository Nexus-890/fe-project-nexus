# Buyer auction room

Scope: the combined Auction room frontend work (#178, #179, #180 and the frontend portion of #267), based on `origin/develop` at `09b3cf6f`. `/auctions/[id]` follows the room frame in `03 · Buyer · Auction.png`; homepage auction cards enter that room. Auction listing and My Bids are separate tasks. The latest review also adds the minimal private winner read fields needed to connect the room to the recorded order. Live #180/#267 integration remains open.

Before push, develop advanced to `a686c099` and was merged without conflicts.
Its unrelated commerce/inventory/payment DTO additions were regenerated; the
auction implementation and frontend runtime source did not change in that merge.

## Buyer #220 integration

The develop merge at `aa238638` keeps this canonical auction room, including private winner handoff and the updated heartbeat/polling rules. The #220 seller reputation component remains in its Auction seller section and reads protected `GET /api/v1/reputations/{sellerId}`. Its returned score/trust appear beside the existing bid, history and winner controls. Missing aggregates remain unavailable. The bid browser scenario checks the seller score/trust before submitting a bid on this same route.

## UI and behavior

The shop header/footer wrap the desktop columns and mobile stack: product gallery, item details, title/status, countdown, bid panel and masked paginated history. Product and auction responses supply content. No Figma example prices, seller ratings, watcher counts or trust scores are synthesized. Money uses decimal strings and exact-cent arithmetic; V2's `numeric(19,2)` supersedes the attached V1 diagram's `bigint` columns.

`useAuctionState` uses server time plus a monotonic browser clock. Without a healthy stream, state/history poll every two seconds. Richer detail and the active private own-bid lookup reconcile every 15 seconds. Missing state enables two-second detail fallback. Hidden tabs pause interval reads; transient 408/429 responses can recover on subsequent intervals. End-time extensions update the timer while detail catches up.

The reviewer-specified #253 target is public native `EventSource` at `GET /api/v1/auctions/{id}/stream`, with named `state` and `heartbeat` events. A validated matching `state` payload updates price/countdown immediately; only supporting history/private/detail REST refreshes are coalesced at two seconds. The connection's `open` event starts a 30-second grace window. Named transport heartbeats arrive every 15 seconds and renew connection health without changing auction data or the countdown's server-clock anchor. No heartbeat data shape was supplied or found in inspected backend refs, so its payload is treated as opaque. Thirty seconds without accepted transport activity, or a connection error, restores two-second polling. Native reconnect preserves `Last-Event-ID`; the source remains open through silence/errors and closes on unmount, hidden tabs and final results. Late REST completions and stale/regressing or foreign push snapshots cannot replace accepted state or renew its liveness. Backend replay and runtime latency are still unverified.

The bid form starts at `currentPrice + bidIncrement`, matching the delivered backend even before the first bid. In the #253 queue flow, POST returns an immutable 202 receipt `{bidId, status: "QUEUED", requestedAt}`. The form remains pending while the owner-only `GET /api/v1/auctions/{id}/bids/{bidId}` returns QUEUED; it checks every 250 ms for up to 30 seconds. Only PLACED marks the bid accepted. REJECTED uses the validated reason and numeric `AUCTION_BID_TOO_LOW.minimum`; a corrected/new bid gets a new UUID key. An uncertain POST preserves amount/key for explicit retry. After the receipt is known, a result-read failure or queue deadline preserves bidId and retry resumes GET without another POST. Editing stays locked while processing or uncertain; unmount/account changes cancel the request and wait timer. Historical OUTBID/WON/CANCELLED results remain readable on replay. POST replay data never replaces current market price. Private requests use the current auth session; remounting on sign-out/account changes clears attempt UI. Authenticated `/bids/mine` supplies leading/won flags rather than identity guesses from masked names. A stale public history row cannot receive a leading/You badge unless its amount matches current price.

`ENDED` means settlement is pending. Bidding closes, the page says it is confirming the result, and state reconciliation continues. The last leading bidder is not declared the winner. A current private result controls explicit winner/loser states; FAILED/CANCELLED remain distinct. `SETTLED` means the order exists, not that it was paid, and the actual state machine permits `SETTLED → PAYMENT_TIMEOUT`.

## Private winner handoff

The original frontend scope exposed a missing handoff: public AuctionResponse has no order reference, and a client must not infer an order from a product, SKU, title or masked bidder name. This review closes that read-contract gap with an additive change to the existing authenticated `GET /api/v1/bids/mine` response. `MyBidQuery`, `MyBidResponse` and delivered auction OpenAPI now expose nullable `orderId`, `paymentDueAt` and `finalPrice` from the existing auction columns only when the current caller is the recorded winner in WON/SETTLED/PAYMENT_TIMEOUT. Other bidders and other statuses receive null. No new endpoint, gateway privilege, migration, settlement write or event is added; public detail remains unchanged.

The frontend consumes those private fields only for a verified winner and rejects malformed references, dates and money. It does not use public settlement fields. A winner with no stored order id sees an explicit waiting state; the private lookup continues every two seconds until the real reference arrives, the deadline closes, the tab is hidden, or a permanent access/response error occurs. A stale personal final status also keeps that reconciliation active. Polling stops for a verified final result with an order id, a confirmed loss/absence or timeout. This is one query interval, not a second manual retry timer.

On #172 integration branch `b17f3275`, commerce creates the auction order and publishes OrderCreated; the auction settlement projection stores its real order id and advances WON to SETTLED. That worker/integration branch remains separate from this minimal read addition. The local PostgreSQL integration tests seed the stored settlement fields to verify the read and privacy contract; they do not execute that Kafka workflow.

## Winner address and payment

A verified winner with the private server-supplied `orderId` can open the address form, review it in a native confirmation dialog, then submit shipping confirmation. The application service follows #172's implementation on integration branch `b17f3275`:

```text
POST /api/v1/orders/{id}/shipping-confirmation
body: {recipientName, phoneNumber, addressLine, wardCode, provinceCode, countryCode: "VN"}
200 data: {orderGroupId, shippingFee, totalAmount, dueAt}
```

The endpoint requires BUYER, `CHECKOUT.START` and winner ownership. The direct address body has no `shippingAddress` wrapper or `paymentMethod`. The service validates Vietnamese carrier phone/locality formats, trims fields and maps numeric money into exact decimal strings. The UI displays returned shipping/total/deadline before linking to the existing `/checkout/payment/{orderGroupId}` route. It never invents fees, a payment group or a fresh deadline. An uncertain response retries the same immutable address; #172 returns the saved result for an identical normalized address. The earlier of the original auction deadline and the confirmation deadline closes shipping/payment controls. A private PAYMENT_TIMEOUT also closes checkout while the public projection catches up.

Typed address and uncertain-confirmation state survive WON→SETTLED and transient private-read failures for the same order/session. Account/order changes reset them. Shipping confirmation remains an unmerged #172 integration dependency on this develop baseline; the read-contract closure does not deliver that endpoint or a real payment lifecycle.

## Delivered integration and dependencies

The room consumes public `GET /api/v1/auctions/{id}`, private numeric bid POST with UUID `Idempotency-Key` (202 acceptance and same-key replay), owner-only bid-result GET, and private paginated `GET /api/v1/bids/mine?page=...&size=100`. The lookup searches successive pages. This revision adds the winner-only nullable fields to that existing private response.

Still pending for live integration:

- The merged develop controllers/OpenAPI now deliver public `GET /api/v1/auctions/{id}/state` and `GET /api/v1/auctions/{id}/bids`. The existing runtime parsers validate these delivered DTOs.
- #253 `/stream`, named `state`, 15-second named transport `heartbeat` and 30-second silence fallback are the reviewer-specified target. No SSE implementation was found in inspected develop/integration refs. Real reconnect/replay, two real users seeing changes in under one second, and 1,000 concurrent connections remain unverified.
- Real #170/#171 settlement and #172 order/shipping/payment integration must be delivered together. The private read now exposes actual stored order data, but it does not create it.
- No hardcoded trust threshold is enforced by this frontend.

## Historical canonical verification

The pre-merge canonical checkpoint recorded 289 frontend unit/auth/service tests, and the auction browser suite passes 26/26 in 3.2 minutes. Actual local heartbeat spacing on one connection was 15,012ms; the unchanged stream stayed healthy for 32,041ms and silence beyond 30 seconds restored two-second polling. The additive private projection passed 23 focused PostgreSQL integration tests; expanded selected Maven verify passed 268 Surefire + 10 Failsafe tests with exactly two Docker-only fixtures excluded. Delivered inventory (100 operations), OpenAPI lint, frontend lint/typecheck/generated drift and production build passed. Catalog regression passed 55 with 38 existing skips. See [auction-verification.md](auction-verification.md) for timing evidence and limits. The prior 25-browser/283-unit checkpoint is historical. Fixtures establish caller behavior against local HTTP dependencies, not live #180/#267 acceptance.

The parent #220 handoff records verification rerun after conflict resolution; historical figures above do not claim a pass for the current merged worktree.
