# Shipment tracking on the order page — #206 / SHP-05

Base: `origin/develop` at `5df6e46c`, inspected 2026-11-12.
Prepared on `fsa_ChungTQ/chore/206-fe-shipment-tracking-on-the-order-page` against
`origin/develop` at `4f083ee0`; the intervening changes affect auction only.

The buyer's `/order/[orderId]` page displays the carrier, copyable tracking code,
current shipment status and persisted shipping history. The card uses the existing
order-page surfaces, semantic tokens and responsive layout. Timestamps use
`Asia/Ho_Chi_Minh`, matching the order receipt. The checkout result page does not
load shipment tracking.

## Readiness and real API flow

Develop supplies the protected, ownership-filtered
`GET /api/v1/shipments?orderId={orderId}&page=0&size=1`. A successful empty list
means that the order has no visible shipment; the page renders no tracking card
and no error. Other HTTP failures are preserved and offer an explicit retry.

Develop's shipment snapshot did not include history. This change adds
`GET /api/v1/shipments/{shipmentId}/tracking`, with the existing
`SHIPPING.VIEW_SHIPMENT` privilege and the same buyer ownership checks as the
shipment read. It returns `ShipmentTrackingResponse` containing carrier,
nullable trackingCode, current status and `ShipmentHistoryResponse[]`. History
comes from `shipment_history`, ordered by `createdAt` and `id`. The client preserves
that order, including timestamp precision beyond JavaScript milliseconds; no status events
are manufactured. Empty history and a carrier that has not assigned a tracking
code have explicit waiting states. There are no schema migrations.

`service/shipmentService.ts` resolves the shipment by **order ID**, then loads
tracking by **shipment ID**. Both calls use the existing HTTP boundary, current
Bearer token, cancellation signal and strict runtime parsing. Responses for a
different order/shipment, invalid statuses/timestamps and duplicate history IDs
are rejected. Wire types are generated from the delivered shipment OpenAPI.

`OrderDetailPage` uses the shared query hook and a private session-scoped order
key. Each loaded order gets an initial lookup, including canceled/delivered orders
that may retain persisted shipment history. A successful empty result hides the
card and stops automatic requests; reload or revisit to discover a later shipment.
Only orders in `PAID` or `SHIPPED` with a successfully loaded shipment poll every
30 seconds while the page is visible. Shipment statuses `DELIVERED`, `RETURNED`
and `CANCELLED`, all other order statuses, and failed reads stop the timer.
`DELIVERY_FAILED` and `RETURNING` can still change, so they remain active.
Retries remain explicit after the ordinary bounded query retry. Window focus
and network reconnection do not restart a stopped query.

After resolving the shipment ID, refreshes call only
`GET /api/v1/shipments/{id}/tracking`; the initial list lookup is not repeated
on every tick. Account changes reuse the provider's private-query cleanup and
cancellation behavior. The UI renders history separately from the commerce
order timeline.

### Coordination with #203

This MR supplies the persisted `/tracking` read subset for #206. The #203 owner
(Tú) needs to review/reuse `ShipmentTrackingResponse`, `ShipmentHistoryResponse`
and the endpoint before merge so that the read is not implemented twice. Carrier
webhooks, polling ingestion, status updates and overrides remain owned by #203.
This note records the handoff needed; owner review/approval has not been recorded.

### Review correction — 2026-11-12

MR !164 identified unconditional polling on pending/canceled/delivered orders,
empty results and completed shipments. The refresh policy above replaces that
timer and reuses the resolved shipment ID, reducing each active poll from two
requests to one. The initial read remains available for historical shipment data.

Unit tests passed 259/259 after this correction. The focused order browser suite
passed 22/22, including simulated elapsed time beyond two polling intervals for
empty results, errors, inactive orders and terminal shipment statuses. It also
verifies that an active shipment refresh calls only `/tracking` and stops after
the response becomes `DELIVERED`. These tests use controlled HTTP fixtures; they
do not replace authenticated live-backend verification.

The correction also passed generated-type drift checking, lint, typecheck and
the isolated `.next-shipment-review-build` production build. The general browser
suite passed 55 scenarios and intentionally skipped the 22 focused order tests.
Browser/build startup required unchanged retries after the existing Next.js
security reminder. No backend implementation changed in this correction.

The branch incorporates `origin/develop` at `551f4744`. Those incoming changes
affect auction configuration/cancellation; they do not change the shipment API.

## Local setup

Use the real gateway through the existing same-origin proxy:

```dotenv
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_API_BASE_URL=
API_PROXY_TARGET=http://localhost:8080
```

Run the real Config Server, discovery, gateway, Keycloak, user, commerce and
shipment services with their PostgreSQL/Kafka dependencies, then run `npm run
dev` in the frontend. Sign in as the buyer that owns the order and open its
link from `/orders`. The account must have `SHIPPING.VIEW_SHIPMENT`.

Production tracking has no mock transport, fixture import or fallback data.
Carrier creation/webhook ingestion remains owned by the existing shipment
workflow; this task reads the persisted state and does not invent a carrier
tracking URL or manufacture carrier events.

## Verification

Executed on 2026-11-12. Initial frontend lint and the 249 existing unit tests
passed. The initial generated-type check found pre-existing commerce DTO drift
on develop; regeneration synchronizes that file with its delivered specification
alongside the new shipment types. No commerce API behavior was changed.

| Check | Result |
| --- | --- |
| `npm run generate:types:check` | Passed after regeneration |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:unit` | 258 passed, including 9 shipment tests |
| `npm run test:browser -- --config playwright.orders.config.ts` | 15 passed, including 4 shipment scenarios |
| `npm run test:browser` | 55 passed; 15 order scenarios intentionally skipped because they run in the focused suite |
| `NEXUS_TEST_DIST_DIR=.next-build-shipment npm run build` | Passed, using an isolated output directory and unchanged retry after the security reminder |
| Shipment targeted Maven tests | 47 passed: read service, controller/security, API architecture |
| Shipment `mvnw.cmd -q -DskipTests package` | Passed; new PostgreSQL integration test compiled |
| `node docs/api/check-contract.mjs` from BE | Passed: 91 operations matched |
| Redocly 2.63.0 shipment OpenAPI lint | Passed |

The focused browser suite checks real request paths/current Bearer, carrier/code,
chronological history, copy feedback/clipboard, 375px and 1440px overflow, the
empty shipment result, null tracking code/empty history and explicit retry after
403. Service tests also cover cancellation, malformed/mismatched data and
preservation of history order for timestamps within one JavaScript millisecond.
Screenshots are Playwright attachments named `shipment-tracking-mobile-375x812.png`
and `shipment-tracking-desktop-1440.png`. These browser/service fixtures establish
client behavior; they do not establish live backend availability.

Next.js 16.4.0 emitted its existing security upgrade reminder and interrupted
initial browser/build attempts. Unchanged retries passed. Dependencies
were not upgraded as part of this shipment task; the framework's security patch
recommendation remains separate work.

### Live environment limits

The real Config Server, discovery and gateway started from this worktree's JARs.
Config/discovery health returned HTTP 200/UP. Both shipment list and tracking
routes returned the expected HTTP 401/UNAUTHENTICATED for anonymous requests.
Frontend dev runs on port 3000 with the real gateway proxy and no mock flags.

Authenticated data verification and the PostgreSQL history integration test
remain blocked: Docker Desktop fails while initializing the inference runtime
socket `Docker/run/dockerInference`. Supported stop/start/restart attempts did
not resolve it; the model-runner disable command cannot reach the crashed
settings API. Automatic approval review rejected socket deletion with
`blocked by policy`, and no deletion, database reset or Docker settings change
was performed. PostgreSQL, Keycloak, commerce and shipment therefore could not
be started for an authenticated end-to-end check.

The existing backend also lacks GHN shipment booking and carrier webhook/polling
ingestion. Local GHN credentials are absent and the carrier remains `NONE`.
This task reads persisted shipment data, including whatever tracking/history
the owning shipment workflow supplies. No FAKE carrier was enabled to claim a
live result.
