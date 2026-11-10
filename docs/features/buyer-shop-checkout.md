# Buyer Shop — cart, checkout and order completion

Base: fetched `origin/develop`, branch `codex/buyer-shop-completion`. Reference: `02 · Buyer · Shop.png`, panels 4–7. Work and checks dated 2026-11-10 (Asia/Saigon).

## Delivered UI

- Live Cart groups lines by actual catalog seller IDs, keeps prices/quantities from the Cart snapshot, displays optional snapshot names/images when catalog metadata is unavailable, and provides a local Save for Later marker. Marked items remain in the cart and its total; this is explained in the page.
- Cart includes the missing voucher panel and shipping/discount rows. The voucher is explicitly a preview and does not change real order totals.
- `/order/[orderId]` reads a protected order snapshot, renders item images/variants/prices, shows status progress and history, and submits cancellation with a required reason. Cancellation explains the effect on an unpaid payment group. Orders link to this detail page.
- `/checkout/result/[orderId]` derives paid/unpaid/canceled messaging from the real order status. URL flags cannot manufacture a payment confirmation. The existing SePay payment/polling and idempotent checkout flows are preserved.
- `/cart/preview`, `/checkout/preview`, and `/checkout/result/preview?state=paid|unpaid` provide the complete sample layouts where the reference uses unavailable capabilities. They include voucher application, seller groups, quantity/removal/save controls, saved-address selection/addition, Express/Standard delivery, card/VietQR choices, paid receipt and card-decline screens. A visible banner identifies sample data and states that no order or payment is created. Sample product photos load from the supplied Supabase public bucket.

## API comparison

| UI | Delivered backend source | Integration |
| --- | --- | --- |
| Cart | Commerce Cart controller and catalog product detail | Existing Cart mutations preserved; optional catalog decoration supplies seller grouping |
| Order detail | `OrderController`: GET `/api/v1/orders/{id}` | New service parses snapshot item fields and money; checks the requested order ID |
| Order timeline | GET `/api/v1/orders/{id}/history` | New protected query validates entries and handles retry |
| Cancel | POST `/api/v1/orders/{id}/cancel`, `{reason}` | New protected mutation validates the response group contains the canceled order, refreshes private order/payment queries, and displays server errors |
| Payment | Existing SePay initiation/status integration | Preserved |
| Saved addresses, card processor, vouchers, delivery choices | No corresponding delivered Buyer Shop contract | Explicit sample UI only |

The delivered Order DTO has no shipping-address snapshot, receipt-email status, payment-card details or `orderGroupId`. The detail page does not fabricate these fields. A payment link is shown only when an actual group reference is supplied. Order responses retain their exact snapshot total; item decoration cannot change it.

Shipping locality endpoints are absent from the current shipment service and the delivered checkout preview returns `shippingFee: null`. The live address/quote flow keeps this failure visible and does not convert an unavailable quote to a zero fee. The sample checkout remains fully usable to review the design while this backend dependency is outstanding.

## Checks actually executed

- Baseline: `npm run test:unit` — 206 passed before this work.
- After service changes: `npm run test:unit` — 209 passed at the time of execution, including protected HTTP detail/history/cancellation and malformed/mismatched response checks. Other parallel work can add tests subsequently.
- Focused ESLint on changed cart/order/services/routes/tests — passed with no warnings.
- Browser visual review through the in-app browser: sample Cart, Checkout, paid and unpaid screens render; Supabase images load. At 375 × 812, Cart and Checkout had `scrollWidth: 360`, within a 375px viewport. Adding a sample address, changing to the card choice and following its unpaid result were verified. Desktop Checkout was also inspected. The temporary QA server on port 3157 was stopped and its generated tsconfig additions were removed.

The browser review screenshots were viewed inline, not saved as files. `tests/buyer-shop-preview.spec.ts` supplies repeatable interaction/overflow checks and saves eight screenshots (375px and 1440px) under `docs/features/buyer-shop-evidence/` when run. Those files are evidence only after the browser suite actually executes. `tests/orders.spec.ts` adds a protected order-detail/history/cancellation scenario with deterministic response snapshots.

Root verification records the final global lint/typecheck/build and browser results after parallel changes finish. Local fixtures prove frontend behavior against those responses; this note does not claim a live carrier, card charge, payment transfer or production cancellation was exercised.
