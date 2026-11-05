# Frontend architecture

The layout follows the `nextjs-4/web-first` reference with flat source folders. Nexus retains the service functions and business helpers needed by the existing app. File moves must preserve behavior; removing a wrapper does not authorize removing a formatter, validator, or feature.

```text
app/             Next route tree, layouts and boundaries
components/      UI components and shared presentation helpers
configs/         api.ts and shared queryKeys.ts
features/        Page orchestration, form schemas and catalogUtils.ts
hooks/           useApi.ts and useAuth.ts
providers/       Provider.tsx
service/         authService.ts, catalogService.ts, cartService.ts
types/           Flat domain request/response types and *GeneratedType.ts
mocks/           Explicit development/test transports and fixtures
tests/           Unit, transport and browser tests
scripts/         Test, generation and smoke runners
docs/            ai, api, features, requirement and ui documentation
```

Production code folders contain files directly. Keep `app` route groups/dynamic segments, `docs` topic groups, `.storybook`, and resource directories when their purpose requires nesting. Avoid domain/request/response directory chains and repeated `type.ts` or `schema.ts` names.

## Request flow and ownership

```text
Client feature -> useApiQuery/useApiMutation -> service function -> configs/api.ts -> backend
Server feature --------------------------------> service function -> configs/api.ts -> backend
```

| Module | Owns |
| --- | --- |
| `configs/api.ts` | Common origin, Axios configuration, controlled request options, HTTP/error/envelope handling, cancellation |
| `service/*Service.ts` | Endpoint paths, request parameters/body, runtime validation, wire-to-model mapping; named async functions returning typed Promises |
| `hooks/useApi.ts` | TanStack query/mutation state, callback forwarding, cache controls; no catalog/cart business rules |
| `configs/queryKeys.ts` | Cache keys including all changing request parameters and private session identifiers |
| `providers/Provider.tsx` | Stable QueryClient, in-memory auth session, generation/cancellation and private-cache cleanup |
| `hooks/useAuth.ts` | Reading the auth context |
| `features/*.tsx` | Page state, request selection, orchestration, redirects and UI feedback |
| `components/*.tsx` | Rendering and local interaction through props |

`Provider.tsx` contains the outer QueryClient provider and an inner auth component. Query hooks must run below QueryClientProvider, including when both components share a file. The token is read from a scoped context at request time; never write it into Axios global defaults or server module state.

The generic hooks use a service callback to integrate the reference's request/options and invalidation conventions with Nexus services. Endpoint HTTP execution is not duplicated inside the hook. Auth uses a typed multi-step mutation executor so the mutation result is a user, not a token response.

## Server/client boundary

Only interactive features, the provider, and React hooks need a client boundary. `CategoryPage` remains a server feature: it loads categories, resolves slug/id, calls `notFound()` for an unknown category, and passes serializable data into the listing. It does not import runtime helpers from `hooks/useApi.ts`. Share service functions and key factories rather than a client barrel.

## Helpers and types

`components/formatPrice.ts` keeps the shared string-safe VND formatter. `features/catalogUtils.ts` keeps tree flattening/lookup, URL creation, query parsing and page validation. Endpoint parsers belong in the corresponding service. Components keep SKU, quantity and gallery helpers next to their owners.

Wire types come from the delivered OpenAPI generator. Domain response types can describe normalized UI models, with the difference documented in their declarations. Route/component props remain next to their owner when local; context/query/transport types are handwritten app contracts, not generated backend DTOs.

`components.json` must point at the flat component folder and the real utility export. File moves must update test runner root names, smoke imports, fixture paths and documentation links as well as application imports. Do not restore old wrappers, nested API folders, or compatibility export chains after migration.
