# Non-functional requirements

These constraints come from the existing frontend implementation and the agreed rebuild. They are acceptance constraints rather than invented SLA or production performance claims.

| Area | Requirement | Evidence to collect |
| --- | --- | --- |
| Architecture | Flat source folders; one API config, shared generic hooks, pure service functions | Import/tree checks, architecture review |
| Type safety | Strict TypeScript, generated wire DTOs, runtime JSON validation | Type generation drift check, full regenerated-route typecheck, malformed-response tests |
| Session isolation | In-memory scoped token; no token in persistence/query key/mutation result; stale responses ignored | Auth/browser race, storage and cache checks |
| Transport | Common origin, 15-second timeout, controlled config, current-token headers | Real HTTP/fixture transport checks including timeout and unsafe override cases |
| Reliability | Bounded transient GET retry; no default mutation retry; cancellation preserved | Query/mutation failure, signal and callback tests |
| Contract | Shared success envelope/page metadata, Problem Details code/fields, bodyless 204 | Parser/transport tests and matching BE integration |
| Precision | Preserve decimal strings and display formatter output without unnecessary Number conversion | Money/format utility regression cases, large-string examples |
| Accessibility | Visible focus, labeled controls, keyboard interactions, status/error semantics | Component/browser checks; Storybook demo a11y settings are not app-wide proof |
| Responsive UI | Keep current mobile layout, readable content and usable controls | Existing viewport/overflow/control-size browser checks |
| Navigation | Preserve public URLs, redirects, one-based URL paging and browser history | Route/category/search browser scenarios |
| Cache/performance | Stable QueryClient, keyed requests, no redundant wrapper fetching, appropriate stale/gc defaults | Query-cache reuse/key separation checks; inspect duplicate HTTP requests |
| Maintainability | One implementation per shared helper, meaningful flat filenames, task-routed docs | Source/function inventory, stale import/link search |
| Development safety | Mocks explicit and disabled in production; no production import from tests | Bootstrap/production-guard tests, dependency search |
| Verification | Lint, full typecheck, utility/transport/auth/browser suites and production build | Actual dated command outputs with scope and limits |

Default query settings are staleTime 30 seconds, gcTime five minutes, no refetch on window focus and one transient network/5xx retry. Mutation retry is zero. Auth profile has its explicit retry policy. These settings are implementation behavior, not guaranteed service response times.

Keep the existing 4px spacing grid, radius levels, font choices and focus behavior from the [design system](../ui/design-system.md). Do not redesign the palette or introduce a dark theme as part of the structural rebuild. Existing mobile scenarios use a 375×812 viewport and inspect horizontal overflow and control sizes; a passing scenario only covers the routes and states actually exercised.

For [product images](../features/product-image-gallery.md), reserve the main square, thumbnail squares and card media height before images load. At 375px wide, delayed responses and HTTP 404 fallback must preserve those media bounds and avoid page overflow. The thumbnail strip may scroll within its own container. Image selection stays local and must not issue another product GET; listing images must not cause a detail GET for every card.

The access token's in-memory scope avoids web-storage persistence; it does not make browser JavaScript immune to XSS. Backend authorization, ownership, gateway CORS and deployed security still need their own checks. Do not log credentials or tokens in test evidence or commit real environment secrets.

## Verification status

Historical baseline on 2026-10-30: lint passed; the old-wire-contract unit runner passed 36 checks; full TypeScript validation failed on stale generated references to absent account routes. Those results preceded the new implementation and do not establish current success. Use the final execution report attached to the change for current lint/typecheck/unit/browser/build results and any unavailable backend evidence.

Deployment/cutover approval and real q/sort capability remain dependencies described in [API contract](../api/api-contract.md). Do not mark them complete from simulation or source comparison alone.
