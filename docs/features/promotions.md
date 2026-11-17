# Promotions (#269)

The UI consumes the delivered #256 commerce controllers and OpenAPI. No new backend endpoint, database migration or production configuration key is introduced.

- Admin: `/backoffice/promotions` has event and platform/event voucher tabs. `/backoffice/vouchers` opens voucher management directly. Create/edit drafts, schedule registration opening, cancel events, approve/reject registrations with a note, set voucher limits/funding/products, activate/pause/cancel, and inspect paged usage/funding.
- Seller: `/backoffice/vouchers` manages owned SHOP vouchers and lists available events. Register/withdraw, then review an EVENT voucher's terms version and seller funding percentage before accepting. The server checks approval, ownership, timeline and terms version; conflicts are displayed without automatic retries.
- Buyer: home/product pages load public claimable vouchers without Bearer. Claims require a buyer account. `/vouchers` shows the paged wallet filtered by CLAIMED/USED/EXPIRED.
- Cart and checkout share an in-memory, auth-scoped list of voucher codes. It survives client navigation, clears after successful ordering and is removed with private cache at account changes. A full browser reload starts with no selection. Explicit `voucherCodes: []` clears the backend's legacy cart-code fallback for that request.
- Pricing comes from the backend. Each wallet candidate is evaluated independently against the current selection. The picker shows MIN_ORDER_NOT_MET (including missing amount), NOT_CLAIMED, EXPIRED, LIMIT_REACHED, NOT_ELIGIBLE and STACKING. Inapplicable selected vouchers must be removed before ordering.
- Preview and order creation serialize the same address/payment/voucher intent. An uncertain order retry retains the original intent and idempotency key. A changed voucher selection requires address review again and a new attempt.
- My Orders price details and order receipts show voucher codes and actual discount. Seller sales show each voucher's seller-funded amount. This UI never calculates or asserts database allocations itself.

The new screens reuse the existing Admin/Shop shell, semantic tokens, bordered tables, orange actions, compact forms and responsive overflow from the supplied Admin design. Product selection supports paged catalog/owned-product checkboxes and optional manual IDs. Event vouchers reference the event ID displayed in management.

## Run and verify

From `fe-project-nexus`, install with `npm ci`. Use the existing `API_PROXY_TARGET` (gateway origin) or `NEXT_PUBLIC_API_URL`, and the existing Keycloak configuration for live integration. Start with `npm run dev`.

```powershell
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:browser -- --config playwright.promotions.config.ts
npm run test:checkout
npm run test:catalog
npm run build
```

The dedicated Playwright config runs the real Next application against the explicit local Postman backoffice simulation, including the existing OIDC/session fixture. Chrome and Postman CLI must be installed. Test ports default to 3110/3920, overridable by `NEXUS_BACKOFFICE_APP_PORT`/`NEXUS_BACKOFFICE_API_PORT`. Browser screenshots are generated in the OS temporary folder `nexus-promotions-269-evidence` at 375px and 1440px; fixtures and screenshots are not live-backend evidence.

Run production build after browser runners finish: browser runners temporarily create auth probe routes that intentionally cannot render in production.

## Integration limits

The shared acceptance criteria concerning scheduled transitions, simultaneous claims/orders, database usage/allocation sums, payment redemption/release/expiry and refund reversal require the live #256 stack and PostgreSQL. Keep those checks pending until verified there. Docker was unavailable during this task; FE simulation does not prove these invariants. Backend authorization and privilege seeding also remain server responsibilities.

The delivered API has no seller-own registration/participation read. Registration and accepted funding snapshots are shown from successful mutation responses; after reload, the server remains authoritative for duplicate registration, approval, joining and withdrawal. Admin can inspect registration status. An additional seller status read belongs to the #256/#269 integration follow-up.

## Verification on 2026-11-17

- Generated types check, lint, typecheck and production build passed.
- Unit/HTTP suite: 427 passed, including promotion serialization, public/private auth, rejected claims, malformed responses, explicit clearing, voucher eligibility and checkout intent/idempotency. A prior run hit an unrelated seller-accounts test-process failure; the final complete unit run passed.
- Promotions Playwright: admin events/approval/terms and admin/seller/buyer voucher purchase scenarios passed against the explicit HTTP simulation. It verifies duplicate claim feedback, buyer route denial, selected products, minimum spend, stacking, cart-to-checkout selection, 100,000 VND discount, order codes, usage and seller funding. Screenshots were inspected at 375px and 1440px.
- Checkout/place-order Playwright: 24 passed, including ambiguous retries, consumed-cart recovery, price/stock conflicts and logout races.
- Catalog/browser regression run: 57 passed, 74 skipped by existing environment guards, one notification sign-in timeout. That notification case passed on isolated rerun. Mobile targets, menu keyboard order and the cart pricing assertion were updated for the new flow and passed targeted reruns.
- `node be-project-nexus/docs/api/check-contract.mjs`: all 162 delivered operations documented. No backend source/spec changed.
- The installed Next.js 16.4.0 emitted a security upgrade reminder and required command retries; dependency upgrades are outside #269.
