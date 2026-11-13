# #205 verification — 2026-11-13

Baseline: unmodified #178 (`aebc78e3`) unit suite passed 275 tests. Implementation is frontend-only; no database startup or Maven verification is claimed.

| Check | Result |
| --- | --- |
| `npm run generate:types:check` | Passed; delivered OpenAPI unchanged |
| `npm run test:unit` | 283 passed, including eight new service/parser cases |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test:auction-list` | 9 passed; final capture run 37.6 seconds |
| `npm run test:auction` | 14 passed |
| `npm run test:catalog` plus targeted navigation rerun | 52 passed; three outdated navigation assertions updated and rerun: 3 passed; 38 existing skips |
| `NEXUS_TEST_DIST_DIR=.next-auction-list-build npm run build` | Passed on unchanged serial retry; compilation, TypeScript and all 27 static pages completed |

The first inherited room browser attempt lost its dev server when installed Next stopped to show its existing security reminder; an unchanged retry passed all 14. Catalog/navigation and the final capture run also required an unchanged retry after the same reminder. The catalog run then had 52 passes and three assertions still expecting the old homepage auction anchor. Those expectations were updated to `/auctions`, My Bids navigation checks were added without removing keyboard/dismissal assertions, and the three changed scenarios passed in 17.4 seconds. Its 38 pre-existing skips remain explicit.

The first production build compiled successfully but failed during TypeScript because concurrent browser cleanup removed `auth-smoke` and `session-probe` while build scanned them. The subsequent serial build completed compilation, TypeScript and prerendering but the installed Next security reminder returned exit 1 at the end; the same command then passed unchanged. No framework upgrade, check weakening or business-rule change is included in this task. The existing Next 16.4.0 upgrade recommendation is recorded as separate maintenance work.

The dedicated #205 browser suite exercises public ACTIVE/SCHEDULED paging and room links, ticking countdowns, authenticated own-bid reads across multiple pages, leading/outbid/final tabs, seller-only appearance, recipient price, one acceptance under repeated clicks, decline without an order, uncertain acceptance reconciliation, expiry, unavailable endpoints/retry and 375px bounds. Tests run real Next and the normal HTTP/auth boundary against Postman dependencies, not production-imported mocks.

Simulation evidence is ignored under `test-results/auction-list-simulation.ndjson`; inspected UI captures are preserved under `auction-list-evidence/`. Test media is explicitly generated fixture imagery. This establishes frontend behavior against the proposed stand-ins only. Backend #208 notification/uniqueness/eligibility/stock/order/settlement and #172 address/payment end-to-end remain unverified.

Final hygiene: fetched `origin/develop` is still `09b3cf6f` and is an ancestor of the branch; `git diff --check` passed. Generated temporary auth routes and tsconfig changes were cleaned. No backend source, secret, `.env`, `.idea/` or runtime log is included in the #205 diff. The original workspace's unrelated backend edits were preserved in its existing checkout. Local Postman 1.73.0 still reports `unknown command 'status'`; verification used the checked-in local simulation, without publishing a workspace.
