# Buyer auction room

Scope: the merged frontend Auction room task (#178, #179, #180 and the frontend portion of #267), based on `origin/develop` at `09b3cf6f`. `/auctions/[id]` renders the detail room from `03 · Buyer · Auction.png`; homepage auction cards enter that room. The auction listing and My Bids screens in the same design export are separate tasks.

## UI and behavior

The existing shop header/footer wrap a two-column desktop layout and a stacked mobile layout: product gallery and item details, title/status, countdown, bid panel, masked paginated history and item link. Product and auction responses supply the content. No Figma example prices, seller ratings, watcher counts or trust scores are synthesized. Monetary values are normalized decimal strings; arithmetic uses exact cents. The actual V2 database migration uses `numeric(19,2)`, superseding the attached V1 diagram's `bigint` price columns.

`useAuctionState` polls state/history at two-second intervals, pauses interval reads while hidden, and uses server time plus a monotonic clock for countdowns when the draft state read is available. The detail snapshot and private own-bid lookup reconcile every 15 seconds; end-time/status changes and accepted bids refresh the relevant reads immediately. If the state route is missing the detail snapshot takes over two-second polling and explicitly reports that live state is unavailable. Temporary 408/429 responses can recover on subsequent intervals.

Native public `EventSource` has no Bearer or query-string token. Events refetch validated state/history, coalesced at two seconds to limit burst traffic, and connection errors resume two-second polling. An open stream keeps 15-second reconciliation reads. Native reconnect retains `Last-Event-ID`. The stream closes on unmount, hidden tabs and terminal results. End-time extensions keep the server clock offset even while the richer detail read catches up. A stale public history row cannot receive a leading/You badge unless its amount matches the current market price.

The form starts at `currentPrice + bidIncrement`, which is the delivered backend minimum even before the first bid. A rejected bid shows the validated `AUCTION_BID_TOO_LOW.minimum`; new attempts receive new UUID keys. An uncertain network/5xx or malformed success keeps the same amount/key and locks amount editing until an explicit safe retry resolves it. A replay's accepted price is never used as the latest market price. Authentication and session generation guards apply to private requests; sign-out/remount clears attempt UI. Own leading/won flags come from the authenticated paginated `/bids/mine` read rather than comparing masked public names. Terminal changes trigger a final history and own-bid refresh before showing a loss.

## Delivered integration and explicit dependencies

Confirmed against Java controllers/DTOs and `be-project-nexus/docs/api/openapi/auction-service.yaml`:

- Public `GET /api/v1/auctions/{id}`.
- Private `POST /api/v1/auctions/{id}/bids`, numeric `{amount}`, UUID `Idempotency-Key`, creation 201/replay 200.
- Private paginated `GET /api/v1/bids/mine?page=...&size=100`. The room searches successive pages for its auction.

The following remain integration dependencies on this develop baseline:

- `GET /auctions/{id}/state` and public `GET /auctions/{id}/bids` appear in the **draft** `docs/api/auction-service.yaml`, but have no implementation/public gateway policies. Their models are explicitly marked provisional; generated detail/bid/mine DTOs use the delivered OpenAPI.
- #253 has not supplied an SSE contract or implementation. `/auctions/{id}/events` and named events `auction-state`, `bid-placed`, `auction-extended`, `auction-ended` are an explicit frontend integration proposal, exercised by the local fixture; default message events are also supported. Event payloads only trigger validated REST reads.
- Detail Java DTO currently omits `finalPrice`, `paymentDueAt` and `orderId`; these optional draft fields are parsed when delivered. Winner identity comes from the real own-bids contract. A winner sees an order link only when the server supplies an order id; otherwise the page reports preparation.
- `/orders/{id}/shipping-confirmation` has neither a delivered body/response contract nor an implementation. No shipping fee, payment total, order group id, address POST or payment request is fabricated. The existing payment route requires a real confirmed order group. Completing the winner shipping/payment UI requires that owning backend contract.
- Settlement is not implemented: the scheduler currently reaches `ENDED`, while `WON`/`FAILED` and payment transitions cannot be demonstrated against live develop. No artificial trust-score threshold is enforced by this frontend.

## Verification

`npm run test:auction` runs the real Next app against the dedicated local HTTP/Postman and OIDC fixtures. These scenarios establish frontend behavior against the declared fixture contracts, not live availability of the missing services. See the auction simulation/context, test spec and [verification record](auction-verification.md) for executed results.
