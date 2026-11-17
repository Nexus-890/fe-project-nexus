Implements admin sale events and platform/event vouchers, seller shop vouchers and event participation, and buyer claim/wallet/voucher selection using the delivered #256 APIs. Cart, checkout, My Orders, order receipts and seller sales display server-confirmed discounts and funding; new screens follow the existing Admin/Shop design.

Closes #269

-
  ```php-template
  Admin and seller promotions: create/edit drafts, open/cancel events, review registrations, select products, activate/pause/cancel vouchers, accept versioned terms and inspect usages.
  ```
1.
   ```php-template
   Buyer promotions and checkout: replace sample claims, add My vouchers, share auth-scoped voucher selection, display eligibility reasons, retain voucher intent during idempotent retries, and show voucher codes/seller funding on orders.
   API and verification: validate delivered DTOs, refresh generated user types after develop integration, add HTTP/unit/Playwright coverage and update existing fixtures and keyboard/mobile checks.
   ```

Config keys: none.

- [x]
  ```php-template
  Cart pricing, checkout preview and place order return the same discount for the same cart and vouchers — Playwright HTTP simulation selects NEXUS50 + SHOP50: cart discount 100,000 VND; preview/order discount 100,000 VND; order total 4,710,000 VND including 10,000 VND shipping. HTTP tests verify identical preview/order voucher intent.
  ```
- [x]
  ```php-template
  A voucher below min_order_amount is not applied and the response says how much is missing — Playwright displays MIN_ORDER_NOT_MET and the missing 95,199,999 VND from the simulated pricing response.
  ```
- [x]
  ```php-template
  At most one platform/event voucher and one shop voucher per seller apply; a third returns STACKING — HTTP tests preserve STACKING; Playwright displays the second platform voucher rejection and permits one platform plus one shop voucher. Live server enforcement remains #256 verification.
  ```
- [x]
  ```php-template
  FE: Admin, Seller and Buyer flows above work end to end, and the order detail and My Orders pill show the discount — two Playwright scenarios exercise event registration/approval/terms, shop product selection, voucher activation/claim, cart/checkout, order codes/discount, usage and seller-funded amounts against explicit HTTP simulation; layouts checked at 375px and 1440px.
  ```
- [ ]
  ```
  Admin creates a mega sale event; sellers register while it is REGISTRATION_OPEN; Admin approves or rejects; the job moves the event to ACTIVE and ENDED on time — management UI and approval tested; scheduled job transitions still require live #256 verification.
  ```
- [ ]
  ```
  Admin creates a PLATFORM voucher and an EVENT voucher; an approved seller joins the event voucher and the accepted terms and funding percent are stored as a snapshot — UI and returned terms/funding snapshot tested; persistence inspection remains #256/#269 integration QA.
  ```
- [ ]
  ```
  A seller creates a SHOP voucher that applies only to their own products; another seller cannot read or edit it (403) — own-product UI and 403 propagation covered; live cross-seller authorization requires #256/#269 integration QA.
  ```
- [ ]
  ```
  A buyer claims a voucher once; a second claim returns 409; claims past claim_limit return 409 and never exceed the limit under 50 parallel requests — duplicate-claim feedback and conflict codes tested; concurrent DB enforcement remains #256 verification.
  ```
- [ ]
  ```
  Placing an order writes one RESERVED usage per order and one allocation per eligible order item; the sums match orders.discount_amount, and seller + platform funded amounts add up — UI reads usages/funding; SQL allocation checks remain #256 verification.
  ```
- [ ]
  ```
  Paid → REDEEMED and the customer voucher is USED; cancelled or expired payment → RELEASED or EXPIRED and the voucher can be used again while still valid — requires live payment/Kafka/database checks owned by #256.
  ```
- [ ]
  ```
  A refund writes the reversed amounts on the allocation rows and the usage becomes REVERSED — requires live refund/database checks owned by #256.
  ```
- [ ]
  ```
  usage_limit and discount_budget are never exceeded under concurrent orders — requires live concurrent orders/database checks owned by #256.
  ```
- [ ]
  ```
  OpenAPI covers every new operation and check-contract.mjs passes; privileges exist in the realm and the role seed — contract check passes for 175 delivered operations and realm privileges exist in source; live realm/role-seed verification remains #256/#269 integration QA. This MR adds no backend operation.
  ```

1. In `fe-project-nexus`, run `npm ci`; Chrome and Postman CLI must be available. The promotions test config starts Next and an explicit local HTTP simulation on ports 3110/3920; override with NEXUS_BACKOFFICE_APP_PORT/NEXUS_BACKOFFICE_API_PORT if needed.
2. Run `npm run test:promotions`, `npm run test:checkout`, `npm run test:unit`, `npm run generate:types:check`, `npm run lint`, `npm run typecheck`, then `npm run build` after browser runners finish.
3.
   ```
   Promotions: 2 Playwright scenarios pass; checkout/place-order: 24 pass; unit/HTTP: 427 pass.
   Generated types check, lint, typecheck and production build pass.
   Backend API contract inventory: 175 operations documented.
   Catalog/browser regression: 57 pass, 74 skipped by existing environment guards, one notification sign-in timeout; the notification case passes on isolated rerun. Changed mobile/menu/cart cases also pass targeted reruns.
   ```

- [ ] .\mvnw.cmd verify passes in every service touched — N/A: no backend service changed relative to develop; Maven not run.
- [ ] The service starts against PostgreSQL with ddl-auto: validate — not run: Docker unavailable; live checks remain #256/#269 integration QA.
- [x] No secret, .env, .idea/ or log file in the diff.
- [x] New endpoints added to docs/api/gateway-permissions.md and to the service's public-endpoints when public — N/A: consumes existing endpoints; no backend endpoint added.
- [x] Branch is up to date with develop and has no conflict markers — develop merged without conflicts; diff checked.

- Live concurrency, SQL allocations, payment/refund lifecycle and deployed permissions are deliberately left to #256/#269 integration QA. Simulation results do not establish those invariants.

Voucher selection stays in memory for the current account and clears on full reload or successful ordering. The delivered API has no seller-own registration/participation read, so mutation confirmations show registration/accepted funding snapshots; persistent seller status reads need a #256/#269 follow-up. Existing API/Keycloak configuration is reused. Next.js 16.4.0 emits a security upgrade reminder; dependency upgrades are outside this MR.
