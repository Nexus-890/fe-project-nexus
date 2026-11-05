# Frontend rebuild verification — 2026-10-30

The dated sections below record checks against their named revisions. The 2026-11-05 Cart merge combines the existing OIDC session lifecycle, optimistic Cart page and shared hooks/header count; earlier absent-operation, bare-PUT-response and credential-login descriptions are historical. Current behavior and integration limits are in the [Cart guide](../features/cart.md) and [authentication guide](../features/authentication.md). This merge's checks are recorded in the final section separately from earlier runs.

Branch: `251-fe-rebuild-fe-project-nexus`. The branch was fetched, checked out with its remote tracking branch and fast-forward pulled before edits. Starting revision: `93415a0c`; the working tree was clean. This report describes the locally verified rebuild, not a deployed release.

## Comparison with the agreed architecture

| Agreed requirement | Implemented result |
| --- | --- |
| Rebuild around the `nextjs-4/web-first` sample | Flat app/component/feature/config/hook/provider groups, reference function/export conventions and generic query/mutation mechanisms |
| Keep service functions | `service/authService.ts`, `catalogService.ts`, `cartService.ts` contain named async API functions; no React hooks or JSX |
| One API configuration module | `configs/api.ts` owns Axios, scoped request options, HTTP/envelope/error handling and server-safe path resolution |
| Shared hooks | `hooks/useApi.ts` exports query/mutation hooks; `useAuth.ts` reads context; no direct query/mutation hooks in consumers |
| Mutation cache behavior from sample | `invalidateKey` prefix invalidation/active refetch, `removeKey` exact removal, awaited success callbacks and optimistic context forwarding |
| Remove unnecessary intermediate layers | Old API client/result/query adapter/domain-hook files and `lib`/`ui` trees removed after callers migrated |
| Flat types | Named `*RequestType.ts`/`*ResponseType.ts`, flat generated wire files and separate app context/model types; local props next to their owner |
| Keep useful old functions | Shared VND formatter, money normalization, tree lookup/flattening, URL/query/page helpers, form schemas, error mapping, SKU/quantity/gallery behavior retained |
| Consolidated provider | One `Provider.tsx` entrypoint, outer QueryClientProvider and inner AuthSession; in-memory session and generation guards retained |
| Documentation scaffold from sample | Populated `docs/{ai,api,features,requirement,ui}`, task routers, short English AGENTS, CLAUDE forwarding and one design-system source |
| Preserve routes/UI behavior | Existing URLs/aliases, server category 404 vs API failure, one-based URL paging, SKU/price/quantity/gallery and sign-in/cart flows preserved |

The sample itself has no complete Nexus auth or service implementation. The agreed service-callback integration and typed auth executor are intentional adaptations: HTTP runs once through the pure service and common config, while the generic hook owns TanStack behavior. The old sample's module-scope hook calls and internal Next error type are not copied. This is architecture/convention parity, not a byte-for-byte copy of demo code.

Useful helpers were relocated, not discarded to match the scaffold. `formatVND` remains string-safe and keeps decimal precision, grouping, null/invalid handling and large-number behavior. Tree/query/page/URL helpers are shared in `features/catalogUtils.ts`; wire parsers stay in their service. `readQueryValue([])` now safely returns an empty string instead of calling `trim` on an absent first element.

## Executed checks

All commands were run from `fe-project-nexus` on 2026-10-30 (Asia/Saigon).

| Command/check | Result and scope |
| --- | --- |
| `npm run lint` | Passed across the repository frontend |
| `npm run typecheck` | Passed full source validation with freshly generated Next route types in `.next-typecheck` |
| `npm run generate:types:check` | Passed: three delivered OpenAPI outputs match the pinned generator |
| `npm run test:unit` | 51 passed, zero failed/skipped: transport, native HTTP, query/mutation hooks/cache, auth, helpers, schemas, catalog/cart and production mock guards |
| `npm run test:browser` | 13 scenarios passed: one auth scenario containing 14 session/storage/race acceptance checks, nine catalog scenarios and three product/cart scenarios |
| `$env:NEXUS_TEST_DIST_DIR='.next-verify-build'; npm run build` | Passed optimized production compilation, TypeScript, static generation and route output in an isolated build directory |
| Optional unit run with Postman simulation | 52 passed, including the additional live-HTTP stand-in probe; five mock request events confirmed the dependency path |
| Structural/source scan | No nested code groups in the agreed flat folders, old runtime imports, internal Next ApiError, module-scope hooks or cart localhost:4010 configuration |
| Markdown links and `git diff --check` | Passed local-link/whitespace review; old documentation entrypoints and duplicate design files removed |

The generated account-route references in the historical `.next` directory belonged to absent routes. Typecheck regenerates route types in its own directory, and build checks its active output directory using a temporary configuration; neither disables TypeScript nor deletes another dev server's output. Runners restore the checked-in tsconfig and remove their temporary config/smoke route.

The original catalog test helper applied the 44px mobile touch-target assertion to the desktop header, although the original UI deliberately uses `lg:min-h-9`. The suite now keeps the unchanged 44px assertion at the 375px mobile viewport and applies the same overflow/clipping checks at desktop width. No header redesign or reduction in mobile coverage was made. Existing stale home-product assertions were corrected to the actual tree-only home feature; product loading/error scenarios run on the search feature that owns that behavior.

Next's installed security reminder interrupted initial test-server startup. Retrying the same command continued normally, and the complete browser suite subsequently passed. No framework security upgrade was performed in this structural rebuild; Next 16.4.0 still reports a known security advisory and requires a separately reviewed dependency update.

## Reproduce the Postman HTTP probe

The frontend reuses the repository's existing catalog mock, derived from the delivered catalog OpenAPI, through a small header-routed simulation. No mock/workspace was pushed or deployed. The local Postman CLI version was 1.73.0.

Terminal 1:

```powershell
postman simulation run tests/catalog.sim.yaml --port 4958 --output ndjson --no-history
```

Terminal 2:

```powershell
$env:NEXUS_SIM_ORIGIN='http://127.0.0.1:4958'
npm run test:unit
Remove-Item Env:NEXUS_SIM_ORIGIN
```

Stop the simulation after the run. The probe calls the real `getProduct` service and common Axios boundary for product success and SKU success/404/503/malformed-envelope cases. The simulation log recorded those five requests. [Simulation context](../../tests/catalog.context.yaml) records the evidence and its limits. Browser fixtures independently exercise login/profile/category/product/cart flows, including account changes during pending requests.

## Release limits

- Mock isolation is not complete: `configs/api.ts` still selects the catalog/cart mock transport, `Provider.tsx` imports the auth stub, and `ProductDetailPage.tsx` imports mock product data for development slug resolution. Services are separate, but these runtime dependencies remain. The hooks use the documented service-callback adaptation rather than the sample's direct URL-request interface.
- No live gateway/catalog/commerce stack was available on local ports 8080/8082/8083. Fixture and simulation success do not prove live database behavior, gateway authorization or full deployed BE/FE integration. That acceptance item remains pending.
- ADR-008/#248 still records approval and coordinated cutover as pending. This rebuild consumes the delivered envelope; release requires the compatible backend and actual coordination.
- Delivered product listing does not implement `q` or `sort`; preserving those UI URL values is not evidence that backend search/sort works.
- Storybook demo files were retained. They are not full visual/a11y coverage of every Nexus component.
- Git publication does not imply merge, deployment or completion of the remaining release items.

## Pre-push verification — 2026-11-02

The target branch was fetched and had no remote commits beyond the local base before publication. `npm run lint`, `npm run typecheck`, `npm run generate:types:check` and all 51 unit tests passed again. Browser, production-build and Postman results above remain the recorded 2026-10-30 evidence; those checks were not rerun for this publication-only step. No additional mock-isolation or hook-interface change is included in this commit.

## Cart hooks/header count conflict resolution — 2026-11-04

Branch fsa_ChungTQ/chore/fe-cart-hooks-header-cart-count started at 05bc5a10. The branch carried both cart and profile UI. Merged origin/develop and migrated those existing features into its flat source structure, keeping the single requestApi boundary and generic API hooks. No changes from the separate Keycloak feature branch are included.

Cart services now validate envelope data, derive exact decimal totals and support GET/POST/PUT/DELETE204. The shared useCart workflow preserves one current-session snapshot for the header/detail/cart page, serialized writes, read cancellation and guards against late account data. Profile PUT retains its allowlisted generated request type, stable profile retry, aborted updates on logout and shared-cache/header synchronization. Explicit per-account offline cart behavior is selected at the HTTP boundary and remains blocked in production.

Executed on 2026-11-04:

| Check | Result |
| --- | --- |
| npm run test:auth |66 unit/transport/query/mutation tests passed, including stateful offline account isolation with no network calls |
| npm run test:cart |9 browser scenarios passed against the local Postman cart gateway |
| npm run test:profile |9 browser scenarios passed against the local Postman profile gateway |
| npm run test:catalog |20 browser scenarios passed, including auth races, catalog/gallery and authenticated cart behavior |
| npm run lint |Passed with zero warnings after excluding generated build output and normalizing mock lint configuration |
| npm run typecheck |Passed with freshly isolated Next route types |
| npm run generate:types; npm run generate:types:check |Passed after resyncing inherited catalog/commerce DTO drift against develop's delivered specs |
| NEXUS_TEST_DIST_DIR=.next-verify-build npm run build |Passed optimized build, TypeScript and all production page generation; no temporary smoke route |

The earlier unit assertion that subtotal must be absent described the old add-only model; it now asserts exact computed subtotal/line total/currency. All previous wire/body/auth assertions remain. The test-only API/profile fixtures now emit the common envelope, sibling paging metadata and field/code/detail errors. Browser simulations verify caller behavior and do not establish live gateway/auth/commerce connectivity. Historical live profile evidence remains dated separately in docs/profile-verification.md.

Next.js emitted its existing security reminder on first test-server startup; unchanged retries completed the checks. No framework upgrade is included. Temporary auth-smoke routes and tsconfig changes were cleaned by the runners. Preexisting local build/simulation files were preserved and excluded from publication. The parent develop contains intentional Markdown hard-break whitespace in a database document; whitespace verification is scoped to this branch's diff against origin/develop.
## OIDC review corrections and develop integration — 2026-11-04

Source branch: fsa_ChungTQ/refactor/239-fe-sign-in-with-keycloak-oidc-pkce, starting at 4c1139ab. Merged origin/develop 0d14ca45 and resolved the frontend rebuild conflicts into its flat structure. The branch now uses configs/api.ts and service/authService.ts; obsolete nested HTTP/auth wrappers were removed after moving the OIDC behavior into Provider.tsx and flat features.

The review finding was confirmed against the committed backend controllers and ApiResponse: GET /api/v1/users/me HTTP 200 and POST /api/v1/auth/register HTTP 201 return {code,message,data}. The old client validated the wrapper as a user. The merged implementation validates the envelope centrally and then validates response.data. Fixtures now emit the actual envelope and delivered field/code/detail validation errors. Native HTTP regressions and browser assertions cover both successful statuses and malformed nested data; callback retries never repeat a successful code exchange.

Executed locally on 2026-11-04:

| Check | Result |
| --- | --- |
| npm run test:auth | 64 passed, including native HTTP envelope regressions and OIDC protocol checks |
| npm run test:auth:browser | 11 passed against local Postman API/Keycloak stand-ins |
| npm run test:catalog | 20 passed, including the auth acceptance harness, catalog/gallery and authenticated cart/account-switch scenarios |
| npm run lint | Passed |
| npm run typecheck | Passed with newly generated isolated route types |
| npm run generate:types; npm run generate:types:check | Passed after regenerating catalog/commerce DTOs that had drifted from develop's already committed OpenAPI |
| NEXUS_TEST_DIST_DIR=.next-verify-build npm run build | Passed production compilation, TypeScript and all page generation; no temporary auth-smoke route in production output |

The initial main browser run passed 19/20. The logout/account-switch test interacted before the full provider redirect finished loading; it now waits for the document load before using the normal sign-in Link. All three product cases passed in a focused run, followed by all 20 main scenarios in a full run. The injected auth harness continues to exercise in-memory generation/private-cache races; real provider logout intentionally navigates to a new document.

Installed Next.js 16.4.0 emitted its existing security upgrade reminder. Unchanged retries completed the browser/build checks; no framework upgrade is included. An overlapping temporary smoke-route cleanup invalidated an earlier build attempt, so the final production build was run separately after all fixture servers stopped. Runners restored the checked-in tsconfig and removed the temporary route. Local logs/traces and preexisting cart build output were excluded from Git.

Simulation evidence establishes frontend behavior against locally modeled dependencies. Real backend JWT trust/CORS, live Keycloak authentication/logout and new-account provisioning remain unverified. See the [OIDC simulation context](../../postman/simulations/oidc.context.yaml). Postman CLI 1.73.0 ran the simulation; its status subcommand is unavailable. No mock was published or deployed.

## Shared Cart hooks and develop merge — 2026-11-05

Starting revision: `78168f44` on `fsa_ChungTQ/chore/fe-cart-hooks-header-cart-count`.
Merged `origin/develop` at `0d0a36a4` without rewriting history. Checks below ran
against the uncommitted merge in an isolated worktree; the original profile
checkout and its unfinished merge were preserved.

The merged implementation retains Keycloak OIDC, scoped profile updates, the
optimistic Cart page and blank Cart origin while sharing cart query/count/writes
through `hooks/useCart.ts`. The Cart-page wrapper owns feedback; shared writes
serialize optimism and rollback, guard session generations and reconcile an
aborted same-session operation even after its page unmounts. Delivered PUT and
DELETE now appear in the spec, and PUT returns the common envelope; earlier
contract blockers in dated sections do not describe this merged contract.

| Check | Result and scope |
| --- | --- |
| Baseline `npm run test:unit` before merging | 66/66 passed at `78168f44` |
| `npm run generate:types:check` | Passed against the merged delivered OpenAPI |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed with freshly generated isolated route types |
| `npm run test:unit` | 87/87 passed, including two additional reconciliation/serialization regressions |
| `npm run test:browser` | 30/30 passed in 1.2 minutes, including retained Cart page, product, catalog and auth acceptance coverage |
| `npm run test:cart` | 9/9 passed in 47.3 seconds through the local OIDC/Cart HTTP simulation |
| `npm run test:profile` | 9/9 passed in 38.0 seconds through the local OIDC/profile HTTP simulation |
| `npm run test:auth:browser` | 11/11 passed in 42.6 seconds through the dedicated OIDC API/Keycloak simulation |
| `NEXUS_TEST_DIST_DIR=.next-verify-build npm run build` | Passed optimized production compilation, TypeScript and all 12 page generations; no temporary auth-smoke route |

The focused Cart suite now lives in `tests/cart-shared.spec.ts`; the main
`tests/cart.spec.ts` retains the separate optimistic page scenarios. Header and
page share one initial GET. The combined PUT/DELETE scenario expects three GETs:
the shared initial read and one authoritative reconciliation after each edit.
The Cart simulation log confirmed GET 200 (12)/503 (2), POST 201 (2), PUT 200 (2)/
503 (1), DELETE 204 (1), and eight successful Keycloak token exchanges. Request
counts summarize the fixture run and are not claims about the live backend.

Initial browser startup encountered the installed Next security reminder and a
Turbopack rejection of a cross-drive dependency junction. Existing locked
dependencies were copied into the isolated worktree and unchanged application
checks then passed; no application configuration or framework version changed
for those environment failures. The first production-build invocation stopped
at the same installed Next advisory after page generation; an unchanged retry
completed with exit code zero. The framework advisory remains a separate
dependency follow-up.

The profile simulation confirmed GET 200 (23)/503 (2), PUT 200 (2)/400 (1)/401
(1)/503 (1), and eight successful provider token exchanges. Save-time 401 clears
local authentication and returns to sign-in without an implicit remote logout.
The [profile context](../../postman/simulations/profile.context.yaml) separates
this current fixture evidence from historical password-login/live-backend runs.

The dedicated OIDC log contained one listening event and 125 requests, including
profile 200 (7)/401 (1)/503 (1), registration 201 (1), token 200 (6)/400 (1) and
logout 302 (1). The [OIDC context](../../postman/simulations/oidc.context.yaml)
preserves earlier runs and the current merged-state evidence separately.

All 86 local Markdown links in the edited guides resolve and the scoped staged
diff passes whitespace checks. These documentation checks preserve the dated
evidence rather than treating earlier revisions as current acceptance.

No live backend or backend test suite was run for this conflict resolution.
PUT/DELETE principal binding still differs from GET/POST and needs authenticated
runtime verification. Peer Cart-ID acceptance and coordinated release remain
pending; fixture success does not establish either. Current simulation evidence
is recorded in the [Cart context](../../postman/simulations/cart.context.yaml).

## Cart hooks after the guest-cart develop update — 2026-11-05

The earlier resolution at `b0fc9331` was clean against `0d0a36a4`. On this
follow-up, fetch found seven newer commits through `ff2a4986`, including the
guest-cart integration. A real local merge reproduced nine conflicted files.
Merging the old source into a separate checkout of the subsequently published
`cfe10dfa` target reproduced the same nine conflicts; that test was aborted.
The source branch now incorporates `ff2a4986` and resolves the overlap.

CartProvider/controller owns additions, guest persistence, callback merging and
header state. The authenticated page keeps its optimistic edit/rollback logic
in `features/useCart.ts`; it shares the provider's private query key and waits
for guest synchronization or pending additions. Both queries reuse fresh data
and pause reads during edits; edits cancel stale reads and hold the lock through
reconciliation. The obsolete `hooks/useCart.ts` was removed after its callers
and regression tests migrated. The provider passes the current account identity
to the explicitly enabled development mock. Profile updates and OIDC session
guards are preserved. Header sign-in preserves the current return destination,
and guest counts are visible when the opt-in guest feature is enabled.

| Check | Result |
| --- | --- |
| Exported pre-merge baseline at `b0fc9331` | 87/87 unit tests passed |
| `npm run test:unit` after integration | 108/108 passed |
| `npm run test:browser -- --max-failures=2` | 31/31 passed in 2.1 minutes |
| `npm run test:auth:browser -- --max-failures=2` | 17/17 passed in 2.2 minutes, including all six guest cases |
| `npm run test:cart -- --max-failures=2` | 9/9 passed in 47.5 seconds; header/page still share one initial GET |
| `npm run test:profile -- --max-failures=2` | 9/9 passed in 42.5 seconds |
| `npm run typecheck` | Passed with fresh isolated route types |
| `npm run lint`; `npm run generate:types:check` | Passed |
| `NEXUS_TEST_DIST_DIR=.next-verify-build npm run build` | Passed compilation, TypeScript and all 12 pages; no auth-smoke route |

The installed Next.js security reminder stopped initial fixture servers;
unchanged retries produced the passing runs. No framework upgrade is included.
Simulation evidence is appended to the Cart, profile and OIDC contexts without
replacing prior histories. Guest endpoints remain a proposed contract behind
an opt-in flag; no live backend or backend tests were run for this merge.

The production build also passed after the unchanged advisory retry. All 59
local Markdown links in the changed guides resolve, the three simulation
context YAML files parse, and staged whitespace checks pass.

## Cart hooks after the session-restoration update — 2026-11-05

While the follow-up was being verified, develop advanced again from `cfe10dfa`
to `1dd23dd3`, adding session restoration and renewal. The already published
`e0149a94` merged cleanly against `cfe10dfa`; the post-push fetch identified
12 new conflicts against the newer target. This subsequent merge preserves
both integrations instead of reverting the session work.

The common HTTP boundary keeps captured requests, same-session renewal and a
single protected replay after 401. CartProvider keeps its cancellation signals,
current mock identity, query freshness and edit locks. Header/cart loading waits
for restoration. Profile update retains its abort registry, generation guards,
stable retry callback and cache publication, using the new token coordinator.
Successful token rotation keeps the same generation; renewal failure aborts
profile work and clears private caches. Profile saves use the same renewal path.

| Check | Result |
| --- | --- |
| `npm run test:unit` | 147/147 passed |
| `npm run test:auth:browser -- --max-failures=2` | 24/24 passed in 1.4 minutes: OIDC, guest merge and session cases |
| General browser runner with isolated ports | 31/31 passed in 1.7 minutes |
| Focused Cart runner with isolated ports | 9/9 passed in 42.9 seconds |
| Focused profile runner with isolated ports | 9/9 passed in 42.6 seconds |
| `npm run lint`; `npm run generate:types:check` | Passed |
| `npm run typecheck` | Passed with fresh route types |

Auth verification used environment-supported ports 3141/3951. The general,
profile and Cart runners temporarily substituted only ports/output directories,
restoring every tracked file byte afterwards. Their app/simulation ports were
3142/3952 (catalog 3953), 3143/3954 and 3144/3955 respectively. Assertions were
unchanged. Default ports overlapped another worktree's server; new output
folders also required unchanged retries after Next's existing advisory.

Simulation contexts retain all earlier histories and append the current
`shared-cart-session-reconciliation` fingerprint. The optional five-minute
wall-clock scenario was not repeated; controlled-clock expiry and renewal
passed. No real backend or backend tests were run for this frontend integration.

Final production build passed with `NEXUS_TEST_DIST_DIR=.next-verify-build`
after the unchanged advisory retry, including TypeScript and all 13 page
generations. Production output contains `/auth/silent` and neither temporary
probe route. All 48 local links in the changed guides resolve, simulation
contexts parse, and whitespace checks pass.
