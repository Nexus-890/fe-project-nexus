# Group payment page — 2026-11-04

Base: freshly fetched `origin/develop` at `0d0a36a4`. That revision delivered payment initiation in the backend but had no payment route, service, countdown or copy controls in the frontend. Work is isolated on `codex/payment-qr-countdown`; the original checkout branch and its running services are preserved.

## Behavior

`/checkout/payment/[orderGroupId]` uses the existing shop shell, Geist typography, orange primary token, borders and responsive cards. Route modules delegate to `features/CheckoutPaymentPage.tsx`; reusable controls live in the existing flat `components/` folder. This follows the current repository architecture rather than introducing the screenshot's older nested service/UI directories.

The authenticated page calls `POST /api/v1/payments` with only `{orderGroupId}`. It reads one resource from `ApiResponse.data` through the existing HTTP boundary. It displays one QR for the group amount supplied by the backend, preserving account leading zeros and whole-VND precision. Account, amount and memo are selectable text with independent copy buttons; copying amount produces unformatted digits. Clipboard failure leaves a manual-copy message.

The backend now supplies `serverNow` from its injected `Clock`. The frontend subtracts server time from `expiresAt`, conservatively deducts the HTTP round trip, then uses elapsed `performance.now()` for ticks. It never compares expiry against the laptop's wall clock. At zero, the QR disappears, copy controls disable and an explicit expired state appears. Manual refresh reads the existing session without creating a new memo or extending its deadline. Visibility/page restoration recomputes elapsed time instead of assuming every interval fired.

The backend also supplies `transferContent`, the exact bank-transfer description placed in the QR, including the configured SePay bank prefix. The transfer memo field copies this full content; the immutable `memoCode` remains selectable as the payment reference. This keeps manual transfers consistent with scanning the QR.

Requests use the current scoped token and a session-specific private query key. Anonymous users receive a sign-in link preserving the return URL. A full reload may require sign-in again because existing auth deliberately keeps credentials in memory. No payment/token is persisted in browser storage. Problem Details show server `detail` and field errors. Failed refreshes remove previous instructions until a valid response arrives, including when retries fail with a different error.

## Acceptance evidence

| Requirement | Evidence |
| --- | --- |
| One QR plus selectable account, amount and memo | Payment browser suite and real HTTP service tests |
| Copy each payment field | Browser clipboard boundary checks, including denied permission fallback |
| Device clock one hour ahead still shows about ten minutes | Browser and service tests using serverNow and monotonic elapsed time |
| Zero produces expired state | Short-deadline browser scenario, QR removal and disabled-copy assertions |
| Refresh/reload preserves memo | Explicit refresh and reload/sign-in scenarios backed by persistent mock session |
| Two shops use group total | Browser fixture total `200000 + 150000 = 350000`; actual backend controller test uses two instructions and validates QR amount |
| QR visible at 375×812, no horizontal scrolling | Browser QR bounds/overflow assertions and captured mobile screenshot |

Run `npm run test:payment` for the dedicated browser suite. It starts the real Next app and a local Postman simulation on separate ports (3104/3914) so existing checkout sessions on 3913 are preserved. See the simulation context beside `postman/simulations/payment.sim.yaml` for fixture assumptions. Mock results establish frontend behavior against those contracts; they do not establish deployed backend availability.

Screenshots: [375×812 mobile](payment-evidence/payment-mobile-375x812.png), [desktop](payment-evidence/payment-desktop-1440.png), [expired](payment-evidence/payment-expired-375x812.png). These use a deterministic fixture image to check layout; the production page uses the provider's QR URL.

## Executed checks

Commands were run on 2026-11-04 (Asia/Saigon) from the isolated checkout.

| Check | Result |
| --- | --- |
| Baseline frontend lint / unit | Passed; 73 unit tests before payment tests |
| `npm run generate:types` / `npm run generate:types:check` | Passed; four generated delivered-service DTO files |
| `npm run lint` | Passed, including new source and fixtures; isolated payment build outputs ignored |
| `npm run typecheck` | Passed with fresh isolated route types |
| `npm run test:unit` | 80 passed, including seven new real HTTP payment service tests |
| `npm run test:payment` | 9 passed in 33.2 seconds against real local HTTP stand-ins |
| `NEXUS_TEST_DIST_DIR=.next-payment-build npm run build` | Passed after the unchanged retry of Next's security advisory; payment route present in production output |
| Baseline `PaymentControllerTest` | 20 passed before backend changes |
| Maven `PaymentControllerTest,SepayPaymentProviderTest` | 33 passed after server clock and transfer content changes |
| Maven `-DskipTests test-compile` | Passed for the updated backend tests, including database test source |
| `git diff --check` | Passed |
| Full `npm run test:catalog` | Could not start: an existing unrelated server answers `3913/keycloak/health`; preserved that session |

The final Postman simulation log was inspected and recorded 179 dependency requests, including successful payment reads, malformed-response scenarios, 503 recovery and 409 rejection. Environment lint passed. Installed CLI 1.73.0 reports `postman status` as unsupported; the local simulation itself ran successfully. No remote workspace publication was needed.

## Integration limits

Deploy the new frontend together with the backend fields `serverNow` and `transferContent`; responses without them fail validation. This is an additive backend response change and requires no database migration. Existing ADR-008 owner/release approval remains pending.

The `develop` base does not yet deliver the checkout/order-creation frontend handoff; this work implements the payment destination for a supplied order-group UUID. Success polling/confirmation and replacement expired sessions are outside this issue. The backend deliberately rejects paid, canceled and expired sessions rather than issuing a fresh QR.

The local Docker daemon is unavailable, so payment database/Kafka integration suites and a live end-to-end bank transfer have not been verified. Existing Next.js 16.4.0 tooling reported a dependency security advisory during build; the unchanged retry completed. Framework upgrades are outside this payment change.
