# Seller auctions, sales and payouts (#225)

This frontend extends the existing `/backoffice` workspace from `origin/develop` for the consolidated seller task #225: auctions, sales status/date filters, seller second-chance offer confirmation/history, bank accounts and payout history, plus the administrator payout action. It reuses the project's semantic tokens, SellerUi controls and role guards; `05 · Seller Portal.png` is the layout reference. The #225 implementation adds no backend behavior, database schema or gateway policy.

The previous integration on 2026-11-15 included develop `dc9a0207` and #220 at `c1dd33c5`. On 2026-11-16 this branch was synchronized with develop `13aa202e`, which now includes #220, #223 product editing and #260 admin auctions. No backend code was manually changed during either #225 conflict resolution, and backend Maven/live checks were not rerun. The [#220 review](buyer-search-rating-receipt.md) retains its historical verification evidence.

The shared `/backoffice/auctions` list/detail URLs mount the seller feature for SELLER-only accounts and the management feature for ADMIN/SUPPORT_STAFF. Mixed staff/seller accounts default to management and can switch to My auctions (`view=seller`); seller links and saved-draft redirects preserve that choice. The query parameter never grants a missing role, and `/auctions/new` still requires SELLER. Both sets of query keys, fixture handlers and access tests are retained. The auction product selector now passes the ACTIVE filter required by #223; deleting a product invalidates/removes its auction picker cache as well as product lists.

The shared auction DTO was regenerated from the merged OpenAPI rather than selecting one side of the generated-file conflict; the generator now lists auction-service once. Buyer and Seller query keys and the provider fixture's permission controls/token-rotation queue are preserved. Seller parsing and cancellation labels support the new `SYSTEM` audit source, and regression tests cover system stock cancellation and the new image/inventory creation rejections.

| Route | Access and behavior |
| --- | --- |
| `/backoffice/auctions` | SELLER: own auctions in every status, paging, scheduling and cancellation with a reason; current deadlines refresh from the server. |
| `/backoffice/auctions/new` | SELLER: choose an owned active auction-enabled product/SKU, enter prices and dates, save a draft or schedule. |
| `/backoffice/auctions/{id}` | SELLER owner: edit CREATED/SCHEDULED before the stored start; otherwise inspect the auction. PAYMENT_TIMEOUT offers and SETTLED offer history use the same confirmation dialog. |
| `/backoffice/sales` | SELLER: own order snapshots, status, paging and inclusive Vietnam calendar-day filters. Changing filters resets paging. |
| `/backoffice/bank-accounts` | SELLER: real account profile and `/profile` link, add an unverified bank account, display only the last four account digits. |
| `/backoffice/payouts` | SELLER: own payout history, masked receiving account and status. |
| `/backoffice/admin-payouts` | ADMIN: completed payable orders, verified account selection, review and explicit payout confirmation. |

Menus and direct routes use the flat JWT `roles` claim. The service must independently enforce privileges and ownership; a client guard is not authorization. Protected cache entries are isolated by auth session. Services use the existing HTTP boundary, strict response parsing, numeric wire money normalized for display, cancellation and stale-session checks.

## Delivered operations

The [delivered auction contract](../../../be-project-nexus/docs/api/openapi/auction-service.yaml) and owning controller provide these calls:

- `GET /api/v1/auctions/mine?status=&page=&size=` includes the JWT seller's drafts and restricted auctions; omitting status returns all statuses.
- `POST /api/v1/auctions` creates a draft; `POST /api/v1/auctions/{id}/schedule` schedules it.
- `PUT /api/v1/auctions/{id}` updates prices and the time window before the stored start; `POST /api/v1/auctions/{id}/cancel` submits a trimmed reason. The server controls limits, ownership and rejection of cancellation when valid bids exist.

Private detail is resolved through the own-auction list because public detail excludes drafts/restricted rows. Creation selects existing owner products/SKUs through the delivered catalog owner reads. No new seller catalogue or product-management workflow is introduced.

The [delivered commerce contract](../../../be-project-nexus/docs/api/openapi/commerce-service.yaml) provides `GET /api/v1/orders/sales?status=&from=&to=&page=&size=`. Seller identity comes from JWT, never a client seller selector. Dates use inclusive `00:00:00.000+07:00` through `23:59:59.999+07:00` for the selected days. Buyer contact and items come from immutable order snapshots.

## Proposed operations pending backend

These paths and DTOs are **frontend proposals**, not delivered backend contracts. Their local OpenAPI documents are deliberately separate from `be-project-nexus/docs/api/openapi` and delivered type generation. Backend owners must confirm paths, privileges, schemas and transactional behavior. Production requests use the real HTTP endpoint; unavailable/forbidden failures remain visible and never become local success.

| Proposal | Operations and required behavior |
| --- | --- |
| [Second-chance offers — #208](../api/seller-offers.openapi.yaml) | `GET/POST /api/v1/auctions/{id}/second-chance-offers`. GET only inspects candidate/history. Only explicit confirmation sends a bodyless POST with the reviewed `If-Match` version. Server selects the bidder and their own highest valid bid; caller sends no bidder/price/email. A stale version requires reconciliation and fresh confirmation; no automatic POST retry. |
| [Bank accounts and payouts — #261](../api/seller-payouts.openapi.yaml) | `GET/POST /api/v1/sellers/me/bank-accounts`, `GET /api/v1/sellers/me/payouts`, administrator `GET /api/v1/payouts/payable-orders` and `POST /api/v1/payouts`. Full account number is write-only; responses contain `last4`. New accounts start unverified. |

An administrator cannot select an unverified receiving account for payout. The backend must atomically enforce COMPLETED status, seller/account ownership, verified account, no refund and no prior payout. POST uses `{orderId,bankAccountId}` and a UUID `Idempotency-Key`; an explicit retry preserves the captured key and payload. The proposal requires same-key replay to return the same payout and distinct keys to remain protected by an order uniqueness constraint. Payout provider settlement and bank verification belong to #261; this frontend has no production verification or transfer-completion button.

Inherited #220 leaves delivered orders at DELIVERED until buyer confirmation or the automatic confirmation window completes them; a receipt issue holds that transition. Its [payout-eligibility projection](../../../be-project-nexus/docs/payment-payout-eligibility.md) is an internal durable handoff, with no bank-account or payout HTTP API. COMPLETED alone and a saved eligibility row do not authorize a transfer: #261 must revalidate current funding, refunds/cancellations and bank state when creating/executing a payout.

The second-chance proposal requires at most one open offer, 24-hour expiry, bidder progression only after decline/expiry, the bidder's own price, a fresh order payment deadline after acceptance, and SETTLED only after payment. Acceptance/order creation, stock handling, actual notifications and settlement belong to #208 and its backend dependencies. The seller frontend only inspects and explicitly requests an offer.

## Demo and configuration

For the real delivered auction/sales flow, run the existing local PostgreSQL/Keycloak/Config/Discovery/Gateway/Catalog/Inventory/Auction/Commerce stack with normal auth and `ddl-auto: validate`. Leave `NEXT_PUBLIC_API_URL` blank and set `API_PROXY_TARGET=http://localhost:8080` for the existing same-origin frontend proxy. Start the frontend with `npm run dev`. Use accounts/data prepared through supported APIs/UI; this task does not distribute credentials or seed production data.

The existing `nexus.auction.min-duration-minutes` default is **60**, mapped from `AUCTION_MIN_DURATION_MINUTES` in [auction-service.yml](../../../be-project-nexus/config-service/src/main/resources/config/auction-service.yml) and defaulted in [AuctionProperties.java](../../../be-project-nexus/auction-service/src/main/java/com/group5/auctionservice/shared/config/AuctionProperties.java). For a local three-minute demo, configure that existing key to **3** (`AUCTION_MIN_DURATION_MINUTES=3` in the auction configuration environment, or explicit auction-service argument `--nexus.auction.min-duration-minutes=3`) and restart the affected configuration/runtime. No new config key is introduced by #225; inherited #220 receipt-window/payout-eligibility keys are documented in its review above. The backend still owns duration and anti-sniping rules; a late bid can extend the deadline.

1. Sign in as Seller; open Auctions → Create Auction, choose an eligible owned product/SKU and use **Use 3-minute demo**. Save Draft, change a price/increment, then Schedule Auction. The helper schedules the start approximately 90 seconds ahead and the end three minutes after it; it does not change backend configuration.
2. Inspect Scheduled/Active/Ended/All; cancel a separate auction with no valid bids and provide a reason. Confirm that a started auction is locked for edits and server rejections stay visible.
3. Open Sales; combine status with From date/To date and verify snapshot buyer/items/totals plus inclusive day boundaries.
4. Until #208/#261 deliver, use only the explicit local HTTP simulation for offers/banks/payouts. Run `npm run test:browser -- --config playwright.backoffice.config.ts`; the runner starts the real frontend and existing Postman simulation with test-only seed/control routes.
5. In the simulated offer flow, inspect without sending, confirm one offer, decline/expire it via test setup, inspect the next bidder, then accept/pay through test setup. Simulated notification intents and orders are not real emails, live inventory changes or bank transfers.
6. In the simulated payout flow, add a seller account and confirm the displayed mask. Administrator review is disabled for an unverified bank. The test-only administrator setup verifies it, then payout confirmation creates one instruction which appears in the owning seller's history. The production UI contains no test verification control.

## Verification and remaining limits

Post-merge verification on 2026-11-16 against develop `13aa202e`: generated-type drift check, lint, typecheck and isolated production build passed; **379/379** unit tests passed. The combined back-office suite passed **25** cases, then the added deletion/cache case passed on its targeted rerun after correcting its unordered-product fixture; all **26** scenarios are covered, including the staff/seller shared routes and mixed-role create/edit/schedule flow. The general shop suite passed **58** with **54** configured skips. Browser checks used the actual frontend and explicit HTTP stand-ins with custom ports `3130/4940`. Backend source matches develop; Maven/live service checks were not rerun. Prior backend/second-chance/payout integration limits below still apply.

Post-merge verification on 2026-11-15: generated-type drift check, lint, typecheck and the isolated production build passed. The frontend unit suite passed **359/359**; browser suites passed **13** back-office cases, **48** order/rating/receipt cases, **58** general shop cases (**53** configured skips) and **12** buyer auction-list cases. Both develop `dc9a0207` and buyer #220 `c1dd33c5` are included by the merge. The sole generated-file conflict is resolved, and SYSTEM cancellation/image/inventory error regressions pass. These checks validate the frontend integration against its local HTTP stand-ins; inherited backend Maven/live startup checks remain unrun.

Historical verification on 2026-11-14, before the #220/develop integration: generated-type drift checking, lint, typecheck and the isolated production build passed. The unit suite passed **287/287** and the complete back-office browser suite passed **13/13**, including the four new seller scenarios. The general shop browser suite passed **55**, with **42** scenarios intentionally skipped by its configuration/feature flags; seller scenarios execute in the dedicated suite. Payout tests use native HTTP through the proposed stateful fixture and check own-seller scope, masked response rejection, unverified/noncompleted 409, same-key replay and one payout per order. Browser checks cover auction lifecycle responses, date filters, explicit offers, settled history, bank accounts and admin/seller payout visibility. Desktop 1440px/mobile 375px screenshots were reviewed without document overflow. Both proposed OpenAPI files compile with the installed OpenAPI tooling. These checks establish caller behavior against the supplied contracts/stand-ins; they do not validate the subsequently inherited backend changes or establish live #208/#261 enforcement. Post-merge verification is recorded separately.

Regression testing exposed a pre-existing race in the local Keycloak simulation: concurrent refresh grants overwrote shared `pm.state` token snapshots. The fixture now serializes requests. An exact-source concurrent-session test verifies both rotated sessions survive while consumed tokens remain rejected; removing the queue reproduces the failure. Production authentication is unchanged.

The installed Next.js version emitted a security-upgrade advisory and interrupted dev/build startup before retry. The successful final browser run used the installed CLI's CI behavior (`CI=1`, `__NEXT_AGENT_UPGRADE=security`) so the interactive upgrade workflow did not interrupt the test server. No dependency version, application security check or production configuration was changed. The advisory is an existing dependency follow-up outside #225. Postman 1.73.0 does not implement `postman status`; local simulation requests were observed directly and no mock was published.

Still pending against delivered backend implementations: real second-chance notification timing, offer expiry/progression, accepted-offer order/payment/SETTLED flow, original winner exclusion, inventory/commerce/notification integration suites, bank verification, all payout transaction rules and cross-seller authorization. Missing proposed endpoints produce the UI's unavailable state. Actual three-minute lifecycle acceptance requires the configured live auction environment and is separate from the accelerated HTTP fixture.
