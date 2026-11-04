# Payment status polling (#153) — 2026-11-04

Base: `fsa_ChungTQ/chore/152-fe-payment-page-qr-memo-code-and-countdown`
at `bbfcb7e8`, explicitly requested because #152 is not merged into develop.
Implementation lives on `fsa_ChungTQ/chore/153-fe-payment-status-polling`.

## Behavior

`features/usePaymentStatus.ts` orchestrates the existing generic query hook and
`service/orderService.ts`. It requests `GET /api/v1/orders/groups/{id}` immediately
after valid payment instructions load, then every 3 seconds. Services read the
single `ApiResponse.data` envelope and validate group identity, nonempty unique
orders and the consumed DTO fields. The existing generated commerce OrderGroup
schema supplies wire types; no parallel handwritten wire DTO was added.

Only `orders[].status` determines completion. The administrative PATCH changes
one child and may leave the group's own status at PENDING. All PAID children stop
polling and replace the payment route with `/orders?payment=confirmed&groupId=...`.
The destination lists the buyer's orders through the delivered paged GET endpoint
and shows confirmation only when the current session has a verified PAID group
in private query cache. A query string alone cannot manufacture confirmation.
The list refreshes on every mount to avoid showing previously cached PENDING rows.
All CANCELED children show a canceled state and remove QR/copy controls. Partial
or mixed states continue waiting; an empty group is rejected.

The hook shares #152's monotonic, server-derived countdown with the display.
Zero stops requests. A hidden tab cancels outstanding status reads and sends no
polls; becoming visible resumes immediately if the deadline is still open.
Dispatch and response guards also check visibility, deadline and AbortSignal,
so a delayed PAID response cannot navigate while hidden or after expiry.
Session-specific keys and protected-query metadata preserve provider cleanup
when signing out or switching accounts. The verified group stays in memory for
up to five minutes through navigation; nothing is persisted in browser storage.

Problem Details preserve code/detail/field errors. Network and 5xx failures can
recover on the next scheduled poll. Rejected 4xx and invalid responses stop
automatic polling and show their error. Payment initiation remains an idempotent
read on mount or explicit refresh, with no automatic POST loop.

## Verification

All commands were run locally on 2026-11-04 (Asia/Saigon).

| Check | Evidence |
| --- | --- |
| Baseline lint and unit tests | Passed before implementation; 80 tests |
| `npm run test:unit` | 87 passed, including seven real HTTP order-service tests |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed with isolated fresh route types |
| `npm run generate:types:check` | Passed; delivered OpenAPI was unchanged |
| `npm run test:payment` | 17 passed in the full run; the remaining cadence/confirmation case passed on a targeted rerun after correcting measurement sampling overhead |
| Browser acceptance | All nine polling scenarios and nine prior QR/countdown scenarios verified against local HTTP Postman stand-ins |
| `npm run test:catalog` | 29/30 passed; the remaining cart case passed unchanged on a targeted rerun after a native worker crash |
| `NEXUS_TEST_DIST_DIR=.next-polling-build npm run build` | Passed; payment and order-list routes present |

The event-based measurement confirms navigation within three seconds of the
final successful PATCH response, with both order rows shown as PAID while group
status stays PENDING. Other assertions cover cancellation, expiry, thirty real
seconds without hidden-tab polls, visibility resumption, partial/mixed/empty
groups, 503 recovery and late responses. Only the browser visibility boundary is
controlled for hidden-tab tests; elapsed time and HTTP calls run normally.

See the [confirmed and canceled mobile screenshots](payment-evidence/README.md)
and [simulation context](../../postman/simulations/payment.context.yaml) for
request-log counts, the initial timing-assertion correction and historical #152
results. Initial browser startup needed an unchanged retry after the existing
Next.js 16.4.0 dependency advisory.

Build verification ran after the browser harness removed its temporary
`app/auth-smoke` route. An earlier overlapping build correctly rejected that
test route's auth stub in production. The final sequential build passed after
an unchanged retry of the existing dependency advisory. No production auth
guard was disabled and no dependency upgrade was included in this task.

The generic browser suite's cart quantity-rollback case initially reported native
worker exit `3221226505` before executing. Its unchanged targeted retry passed in
12.5 seconds after running the sign-in/cart flow and rollback assertions. No
unrelated cart source or test assertion was changed. Installed Postman CLI 1.73.0
still does not support `postman status`; the actual simulation requests and log
inspection supply the verification evidence.

## Pending backend integration

#138 is absent from the delivered controller and OpenAPI. The explicit Postman
simulation models its required path using the existing OrderGroupResponse DTO.
Production always calls the real endpoint and surfaces failures; it never
silently substitutes fixture data. Merge/deliver #138 before validating live
polling. #156 is not required for this caller: the test fixture exposes a local
ADMIN PATCH trigger, and the polling algorithm stays the same when webhook
reconciliation arrives. The fixture's ADMIN identity does not establish deployed
Keycloak authorization. No live bank transfer or deployed backend was tested.
