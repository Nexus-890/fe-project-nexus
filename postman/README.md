# Frontend HTTP simulations

## Admin #227 verification

`npm run test:admin` runs the actual frontend against the existing back-office
simulation with the local `backoffice-gateway/admin.js` extension. It covers
Admin/Support user permissions, all user operations, seller review, full event
payloads, Admin-only audit and 10-second service/broker health polling. The
test server explicitly enables the existing seller-application feature flag.
See [Admin scope and API dependencies](../docs/features/admin.md) for commands,
screenshots and the distinction between delivered observability APIs, the
unmerged #211 snapshot and the proposed #210 lifecycle. This is local caller
verification; no backend persistence or identity-provider guarantee is implied.

## Buyer order detail and cancellation

```powershell
npm run test:browser -- --config playwright.orders.config.ts
```

The focused suite starts the real Next.js application, the existing OIDC/catalog
fixtures and the local Postman `order-list.sim.yaml` HTTP dependency. It now runs
both `tests/orders.spec.ts` and `tests/order-detail.spec.ts`; production code never
selects these mocks. The shared cart shell remains separately stubbed by the browser.

The order stand-in follows `OrderController`, `OrderService`, `OrderResponse` and
the delivered commerce OpenAPI on `develop` at `4f083ee0`, including the working-tree
`canCancel` addition. Detail, history and cancellation requests go over real HTTP,
with the shared Bearer/envelope/Problem Details handling. False or missing `canCancel`
must hide the cancellation action. Cancellation returns a group while the detail
and timeline refresh independently. The fixture models one order per group; it
does not establish multi-order cancellation behavior.

Test-only `/api/test/reset`, `/api/test/order`, `/api/test/detail-mode` and
`/api/test/evidence` control state, inject failures and record calls. The paid-refund
scenario advances state explicitly to exercise Awaiting refund, Refund requested
and Refunded without claiming that Kafka or a payment provider delivered an event.
These controls exist only in the local mock. Unmodeled endpoints return 501.

On 2026-11-12, all 27 focused cases passed (17 detail and 10 list). They cover
list-to-detail lines/total/status/history, permitted and withheld cancellation,
pending and paid cancellation, refund refresh, 409 feedback with refreshed
eligibility, foreign-order 403, independent read recovery and responsive layout.
Screenshots and traces are generated under ignored `test-results`; request events
are in `test-results/order-list-simulation.ndjson`. The simulation context preserves
contract evidence and integration limits in `simulations/order-list.context.yaml`.
After the final cart-cache and receipt adjustments, the two cancellation cases
passed again, including an assertion that cancellation refreshes the cart header.
The local mock was reused; the installed Postman 1.73.0 has no `postman status`
command, so an owner's published mock was not searched. This validates frontend
behavior against local stand-ins; deployed backend, authorization, asynchronous
refund delivery and production Keycloak remain separate integration checks.

## Notification read-status verification

This local simulation models notification reads from the delivered OpenAPI and
the bodyless PATCH/204 operations in `origin/develop`'s `NotificationController`.
It is synthetic and does not verify a running backend, gateway privileges or JWT
validation. Published owner mocks were not searched because the CLI is signed out.

From `fe-project-nexus`, start the dependency in one terminal:

```powershell
postman simulation run postman/simulations/notification.sim.yaml --port 3915 --output ndjson --no-history
```

In a second terminal, run the real notification service against that HTTP server:

```powershell
node scripts/verify-notifications.mjs
```

The script compiles the checked-out notification service and its shared HTTP
boundary into a temporary directory. It verifies newest-ten paging, read/count
refetch, idempotent reads, read-all, no PATCH body, current Bearer, encoded IDs and
400/401/403/404/503 handling with no hidden mutation retry. It resets the synthetic
state before each run. The simulation uses header routing because the service's
base URL accepts origins only; the runner supplies `x-mock-slug: notifications`.
Set `NEXUS_NOTIFICATION_SIM_URL` when using a different local port. Stop the
simulation with Ctrl+C when finished. Do not commit its NDJSON request logs.

## Profile browser simulation

`npm run test:profile` starts the real Next.js application on port 3103 and a
local Postman simulation on port 3913. Install the Postman CLI (1.70.0+) and
Google Chrome before running it. No Postman login, workspace, deployment, or
live backend is used.

The locally authored `mocks/profile-gateway` fixture follows the backend on
`origin/develop` (`0d0a36a4`, inspected on 2026-11-05):

- `be-project-nexus/lib/common-core/.../model/ApiResponse.java`
- `be-project-nexus/lib/common-web/.../exception/GlobalExceptionHandler.java`
- `be-project-nexus/user-service/.../iam/AuthController.java`
- `be-project-nexus/user-service/.../iam/UserController.java`
- `be-project-nexus/user-service/.../iam/dto/UserResponse.java`
- `be-project-nexus/user-service/.../iam/dto/UpdateProfileRequest.java`

GET/PUT profile success responses use
`{ "code": 0, "message": "response success", "data": ... }`. The unit-test auth
stub also uses this envelope for registration. Validation errors remain
`application/problem+json`, with `errors: [{ field, code, detail }]`; they are
not wrapped in a success envelope. Health and test control routes return their
own bare bodies. The shared shop shell uses minimal catalog/cart fixtures
with the success envelope and catalog page metadata; they do not establish
live catalog/cart compatibility.

This is our repository's API contract; the existing local fixture was reused
without a search for an external owner's published mock. The mock preserves the actual `/api/v1/...`
URLs: the simulation routes the first `/api` segment to the member, whose
handler receives `/v1/...`. User writes persist in namespaced `pm.state`,
and profile endpoints validate the token hash issued by the reused
`mocks/oidc-keycloak` member. Apart from the
minimal shop shell fixtures, unmodelled calls return 501.

Sign-in uses the application's code + PKCE redirect flow against that local
Keycloak fixture. Enter `lan.nguyen@example.com` / `Fixture-pass-123!` only on
the fixture provider's form; the application does not send passwords to an
API login endpoint. The fixture accepts the nonempty test password and does
not establish production Keycloak authentication behavior.
`GET /keycloak/test/reset` resets its protocol state; browser setup resets both members before each scenario.
`POST /api/__test/reset` resets state; `POST /api/__test/control` injects
`getDelayMs`, `getStatus`, or `putStatus`. `GET /api/__test/requests` exposes
the calls for request assertions. These routes exist only inside this local
fixture, never in the application.

`putStatus: 400` injects a phone field error to verify the FE error renderer.
The current backend does **not** accept phone in `UpdateProfileRequest`:
the page keeps it read-only, and tests assert it is omitted from PUT. This
injected error exercises a future backend extension and does not establish
that the current real backend validates phone during profile updates.

The suite covers OIDC sign-in, header navigation, authenticated GET on profile
entry, exact changed PUT fields, stateful saves, shared header updates, cancel,
client validation, phone error placement, loading skeleton, retryable failures,
session expiry, preservation of dirty fields during token renewal, and 375×812 layout.
Screenshots and traces are under `test-results/profile`; request events are
in `test-results/profile-simulation.ndjson`. Generated logs and browser output are ignored
by Git. Real backend connectivity remains a separate integration check.
Contract evidence, assumptions, and the scope of runtime verification are
recorded in `simulations/profile.context.yaml`.
