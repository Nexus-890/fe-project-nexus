# Frontend rebuild verification — 2026-10-30

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
