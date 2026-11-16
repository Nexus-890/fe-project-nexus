# Seller operations (#225)

The seller auction/sales screens use delivered APIs. Shop profiles, bank accounts and automatic payouts follow the 2026-11-16 versions of issues #257/#261 supplied by the user; second-chance progression follows #208. Those backend implementations are still missing from develop. Production sends real requests and shows unavailable/errors; no fixture is imported by production.

## Routes and access

- `/backoffice/auctions` and `/{id}` preserve seller ownership flows and Admin/Support management. Mixed-role sellers can choose My auctions (`view=seller`); `/new` requires SELLER.
- `/backoffice/sales` shows immutable sales snapshots with status and inclusive Vietnam calendar-day filters.
- `/backoffice/payouts` shows Seller shop profile, bank accounts and payout history/detail. ADMIN sees payout filters/retry and the bank verification queue. Mixed ADMIN/SELLER accounts can choose My payouts.
- `/backoffice/bank-accounts` retains the seller bank/profile screen; the old administrator URL redirects to `/backoffice/payouts`.

JWT roles select one feature; parameters never grant access. Protected queries/mutations retain scoped tokens, cancellation and session guards. Backend ownership/privilege checks remain mandatory.

## Issue-aligned boundaries

| Resource | Calls |
| --- | --- |
| Shop profile | GET/PUT `/api/v1/sellers/me`, writing only companyName/contactPhone. |
| Bank accounts | POST `/api/v1/payments/seller-bank-accounts`; GET `/me`; PUT `/{id}`; POST `/{id}/default`; ADMIN GET list and POST `/{id}/verify`. |
| Automatic payouts | SELLER GET `/api/v1/payments/payouts/me`; ADMIN GET `/api/v1/payments/payouts` with repeated status/seller/date/paging filters; owner/Admin GET `/{id}` with history; ADMIN POST `/{id}/retry`. |
| Seller offers | Owner GET/POST `/api/v1/auctions/{id}/second-chance-offers`; bodyless POST, OFFERED/ACCEPTED/DECLINED/EXPIRED. |

The [accounts](../api/seller-accounts.openapi.yaml), [payout](../api/seller-payouts.openapi.yaml) and [offer](../api/seller-offers.openapi.yaml) YAML describe the issue-derived frontend/HTTP simulation boundary separately from delivered OpenAPI. Complete response DTOs are not provided by those issues. In particular #208 specifies an owner history list but no candidate-preview metadata: the existing `{auctionId,canOffer,candidate,offers}` projection remains pending backend DTO agreement. There is no version/If-Match requirement. These are not claims of delivered endpoints.

Seller profile now edits the seller resource rather than the personal account. Bank numbers are write-only, preserve leading zeros and are cleared after completion. Reads reject full/encrypted numbers and show accountLast4 only. Editing bank details resets UNVERIFIED; active default selection, VERIFIED/REJECTED state and ON_HOLD warning are visible. Admin can verify/reject with a reason. The supplied operation table includes edit/default but no DELETE, so no unsupported delete endpoint is added.

## Automatic payout behavior

No UI creates a payout or requests a payable list. The backend creates exactly one payout after funded COMPLETED/no-refund/positive-net checks. Verification of an active default bank releases held payouts automatically. The inherited [eligibility projection](../../../be-project-nexus/docs/payment-payout-eligibility.md) alone does not authorize a transfer.

List/detail display orderAmount, shippingFee, platformFeeRate, platformFee, netAmount, currency, attempt count and receiving snapshot. Decimal-string arithmetic checks the breakdown without floating-point loss. Statuses are ON_HOLD, PENDING, PROCESSING, UNKNOWN, SUCCEEDED, FAILED, RETURNED. Needs action selects exactly ON_HOLD/UNKNOWN/FAILED/RETURNED. Provider acknowledgement stays PROCESSING; UNKNOWN explains reconciliation and offers no retry. Confirmed success requires an attempt, receiving mask and provider reference.

Newest-first history shows amount, mask, actor/time and sanitized provider/error fields. Every simulated step has a Simulated badge. ADMIN retries FAILED/RETURNED using one captured UUID per action; interrupted retries reuse the key until authoritative reconciliation establishes progress. A later distinct attempt gets a new key. Retry never reports transfer success. Later bank edits cannot change a sent payout snapshot.

## Second-chance behavior

Reads never send notifications; explicit confirmation shows the masked bidder and their own highest bid. The server selects/rechecks eligibility. Only OFFERED counts as open. Old ACCEPTED history does not imply a currently unpaid order: after B accepts and its order times out, C can receive an offer while B stays ACCEPTED in history. Multiple accepted historical orders are valid. The server's canOffer/candidate controls current eligibility. Previously offered bidders are rejected; original-winner exclusion is a backend rule.

History remains accessible in WON/SETTLED. No send control appears without a candidate, and auctions without bids omit the action. Actual order creation, deadlines, stock holds/releases, penalties and notifications remain #208 responsibilities; the fixture models these only for caller verification.

## Verification and remaining dependencies

Native HTTP tests cover paths/bodies/auth, masks, partial/malformed responses, exact money/history, repeated filters, idempotency and cancellation. Browser tests cover B accept/timeout/C offer, profile/bank/default/edit/verification, automatic ON_HOLD release, amount/history display and retry behavior. Run the actual frontend against the explicit local simulation with `npm run test:browser -- --config playwright.backoffice.config.ts`; ports are configurable with NEXUS_BACKOFFICE_APP_PORT/API_PORT. Ignored logs/screenshots contain test data only and are not committed. Final command counts are recorded in the MR description after execution.

Executed on 2026-11-16: generated-type drift check, lint, typecheck and isolated production build passed; **387/387 unit tests**, **27/27 back-office browser tests**, and **58 general shop browser tests** passed (**55** configured skips). All three local contract YAML files compiled with the installed OpenAPI tooling. The full browser run used the real frontend and Postman dependencies on ports3130/4940. Desktop1440/mobile375 screenshots of held automatic payouts, fee/history details and accepted-B/offered-C history were reviewed without document overflow. During iteration two new browser selectors were corrected to use the actual input label and stable bank-card identity; production assertions were retained. These results concern the supplied HTTP scenarios, not a live backend or provider.

No real bank transfer, email or production data is used. No backend source is manually changed by these fixes. Live #208/#257/#261 checks and complete DTO agreement remain pending delivery. Existing auction/sales can use the real local PostgreSQL/Keycloak stack and proxy. The three-minute preset requires the existing nexus.auction.min-duration-minutes (default60) set to3 via AUCTION_MIN_DURATION_MINUTES=3; FE adds no production config keys.
