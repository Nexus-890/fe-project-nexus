# Place order — #151

The checkout action sends one purchase to `POST /api/v1/orders`, then opens
`/checkout/payment/<orderGroupId>`. One group contains one order per shop and
has a single payment destination. The response group total is authoritative;
the provisional #188 preview's shipping quote is not added to the order response.

This work starts from `develop` at `0d0a36a4` and includes the existing #150
checkout prerequisite (`5ee074e4`). Production folders follow the flat frontend
architecture: the order service extends `service/checkoutService.ts`; business
state lives in `features/useCheckout.ts`; the checkout page renders the action
and actionable errors. No second HTTP client or nested feature API wrapper is
introduced.

## Request and retry behavior

The body follows delivered commerce `CreateOrderRequest`: the full shipping
address with city/district/ward names, `countryCode: "VN"`, and
`paymentMethod: "SEPAY"`. Each attempt gets a UUID `Idempotency-Key`. An explicit
retry after an uncertain result keeps that key and the exact original body.
Address edits are locked while the request is pending or its result is uncertain.
The place-order action also has a synchronous guard against repeated clicks.
Mutations never retry automatically.

Successful creation (201) and idempotent replay (200) both navigate using
`data.orderGroupId`, preserving the seller orders as one purchase. The payment
route is a handoff for the order group; payment initialization and QR rendering
remain owned by the payment task.

A 409 `COMMERCE_PRICE_CHANGED` shows both `oldPrice` and `newPrice` in VND,
the server's detail and an explicit confirmation action. Only confirmation
starts another request, with a fresh key. The delivered backend updates the
reported cart price when rejecting that first attempt. Multiple changed prices
may therefore require successive confirmations.

A forced 409 `COMMERCE_INSUFFICIENT_STOCK` identifies the sold-out item from
the server name or its SKU's catalog metadata. The page asks the buyer to update
the cart. Unknown error codes still show `detail`; validation entries in
`errors[]` attach to the corresponding address fields.

## Verification and remaining integration work

Run `npm run test:checkout` to exercise address/quote regression scenarios and
the place-order scenarios against the repository's local Postman simulation.
The test fixture starts the simulation on port 3913; the actual Next.js
application runs separately on port 3103. The simulation serves only HTTP
dependencies. Browser requests use actual tokens issued by the local OIDC
fixture, and evidence records request keys, bodies, status codes and groups.

When those default ports already host a development session, use isolated
ports and build output without stopping it:

```powershell
$env:NEXUS_CHECKOUT_API_PORT = "3923"
$env:NEXUS_CHECKOUT_APP_PORT = "3113"
$env:NEXUS_TEST_DIST_DIR = ".next-checkout-151-run"
npm run test:checkout
```

The place-order scenarios cover prerequisites, double clicks and pending
controls, one group containing two sellers, a persisted order followed by a
503 and same-key 200 recovery, empty-cart/failed-quote refresh before retry,
price confirmation with a new key, malformed price details, stock names
from server and catalog, unknown 409 details, field correction, and logout
before a delayed response. Simulation run results are recorded in the
[context document](../../postman/simulations/checkout.context.yaml), preserving
the historical #150 evidence separately.

Verification on 2026-11-04 passed generated-type drift, fresh-route typecheck,
all 88 unit/service tests, all 30 default browser regressions, and the production
build including `/checkout/payment/[orderGroupId]`. Lint passed while excluding
the pre-existing `.next-profile-run` output. The final isolated checkout run
passed all 24 scenarios (13 address/quote regressions and 11 order scenarios)
in 59.4 seconds. Its Postman log records 14 actual order POSTs, including two
200 replays after persisted writes returned simulated 503 responses, with no
401 responses. Mobile checkout and the price-conflict screenshot were visually
reviewed. The installed Next.js 16.4.0 emitted its existing security upgrade
warning; no dependency upgrade was included in this task.

This simulation is not a live checkout or evidence of actual inventory
reservations. Delivered backend inventory currently uses a stub and has no
`COMMERCE_INSUFFICIENT_STOCK` branch; the forced stock body is an explicit
future-contract assumption. Shipping #201 and the #188 checkout preview remain
unmerged prerequisites. A reviewer other than the author still needs to complete
checkout against a compatible backend and record the resulting order group id
in the issue/MR. No such human review is claimed here.
