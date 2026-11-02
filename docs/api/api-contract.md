# Frontend API contract

## Canonical inputs and release status

Use the delivered [user-service](../../../be-project-nexus/docs/api/openapi/user-service.yaml), [catalog-service](../../../be-project-nexus/docs/api/openapi/catalog-service.yaml), and [commerce-service](../../../be-project-nexus/docs/api/openapi/commerce-service.yaml) OpenAPI files. Verify the owning controller/DTO when a discrepancy appears. The older API drafts outside `openapi` describe future behavior and do not override delivered responses.

[ADR-008](../../../be-project-nexus/docs/adr/ADR-008-api-contract.md) and the [backend API style guide](../../../be-project-nexus/docs/api/style-guide.md) still record approval and coordinated BE/FE release as pending. This frontend implements their delivered envelope. Deployment readiness needs an agreed compatible backend version and live checks; neither a checked-in spec nor a fixture pass grants that approval.

## Origin, auth and HTTP

`configs/api.ts` is the only API configuration module. Set `NEXT_PUBLIC_API_URL` to the common backend origin, such as `http://localhost:8080`, then restart Next. Paths supplied by services already include `/api/v1`. An absolute origin is required for server category lookup. The legacy `NEXT_PUBLIC_API_BASE_URL` is a fallback only while local configuration migrates.

The Cart task explicitly requests an empty service origin. `service/cartService.ts` defines `CART_API_BASE_URL = ""` and passes it through the shared HTTP boundary (explicit context baseUrl wins). Blank means browser same-origin; fill only the origin then restart/rebuild. Auth/catalog origin and single-client ownership are preserved. See [Cart configuration](../features/cart.md#api-configuration).

For same-origin local integration, leave NEXT_PUBLIC_API_URL blank and set server-only `API_PROXY_TARGET` to the gateway origin. Next rewrites `/api/v1/*` to it, while server-side catalog calls use it as their origin fallback. Public origins take precedence for common auth/catalog requests. Restart Next after changing this environment variable; the proxy is disabled when it is absent. Targets must be HTTP(S) origins without credentials, paths, query or hash.

Axios uses a 15-second default timeout and JSON Accept header. Caller options cannot redirect a protected request to another origin or replace URL/method/auth/adapter/parser settings. Controlled headers, timeout and parameter serialization remain configurable. Public login/register/catalog calls do not send Bearer; private requests read the current token from the provider-scoped request context. Never put a token in singleton defaults, query keys, or server module state.

Preserve endpoint status: reads/updates return 200, creation uses the endpoint's 201, and a 204 has no response body. Handle 204 before parsing JSON. Cancellation propagates separately from ordinary API errors.

## Success envelope and paging

Application JSON success is wrapped exactly once:

```json
{"code":0,"message":"response success","data":{"id":"example"}}
```

List responses keep metadata beside the data array:

```json
{"code":0,"message":"response success","data":[],"page":{"number":0,"size":12,"totalElements":0,"totalPages":0}}
```

The HTTP boundary validates the envelope and preserves numeric success `code` and string `message`. Backend defaults are 0 and `response success`. Services validate each endpoint's data and map it to the application's model. Do not unwrap twice or discard page metadata.

API page indices are zero-based. UI URLs are one-based; catalog helpers map page 1 to API page 0. The catalog list model used by components may retain `content/page/size/totalElements`; it is a frontend mapping, not the raw wire shape. Category tree has one logical complete-list page, counting roots rather than all descendants.

Backend catalog/cart monetary fields are JSON numbers serialized from BigDecimal. Services normalize monetary data into decimal strings where the UI model needs them. The display formatter is separate: it must preserve its current grouping, decimal and large-string behavior.

## Pure services and generic hooks

| Layer | Public contract |
| --- | --- |
| HTTP configuration | `requestApi` performs controlled HTTP and returns the validated envelope; failed requests reject with `ApiError` |
| Domain service | Named async functions such as `getProducts`, `getProduct`, `getCategoryTree`, `login`, `getMe`, `addCartItem` return parsed data/models |
| Query hook | `useApiQuery(request, options)` receives queryKey and a typed service callback; TanStack owns state/cache |
| Mutation hook | `useApiMutation(request, options)` receives a service callback or typed workflow executor plus mutation/cache options |

The reference supplies request/options separation, generic types, path/query/body concepts, callback forwarding and cache controls. Nexus connects the hook to a service callback so endpoint HTTP is implemented once and the same service can run on the server. Do not pass a second URL request that causes the hook to issue another HTTP call.

Example client query:

```tsx
const filters = { page: 0, size: 12 };
const products = useApiQuery({
  queryKey: queryKeys.catalog.products(filters),
  service: (signal) => getProducts(filters, { signal }),
}, {
  select: (page) => page.content,
});
```

Keep every changing request parameter in the key. `select` changes the observer's result, not the shared query data. Default query policy is staleTime 30 seconds, gcTime five minutes, no window-focus refetch and one retry for network/5xx; do not retry rejected 4xx. `/me` explicitly uses its own retry policy. Mutations default to retry 0.

Mutation variables use typed `body`, `pathParams`, `query` and controlled config/signal. A `never` generic means that request field is absent. `invalidateKey` and `removeKey` are the names from the new reference: each accepts fixed keys or a resolver based on result/variables. After success, await prefix invalidation with active-query refetch, remove exact keys, then call the caller's onSuccess with all arguments. Preserve onMutate/onError/onSettled and optimistic context. Mutation failure does not run success cache work.

Protected queries carry private-query metadata and session-specific keys. Protected mutations verify the session is still current before success cache work and UI callbacks. Auth's multi-step executor returns a user, so LoginResponse/token never becomes mutation result data. [Authentication](../features/authentication.md) describes the workflow.

## Frontend endpoint inventory

| Method/path | Consumer and access |
| --- | --- |
| POST `/api/v1/auth/register` | Sign-up, public; creation does not sign in |
| POST `/api/v1/auth/login` | Provider login workflow, public |
| GET `/api/v1/users/me` | Provider profile, Bearer |
| GET `/api/v1/categories/tree` | Home, shop navigation, category resolution, public |
| GET `/api/v1/products` | Category/search listing, public; delivered parameters categoryId/page/size |
| GET `/api/v1/products/{id}` | Product detail, public |
| POST `/api/v1/carts/me/items` | Add item, Bearer; request is `{skuId, quantity}` |
| GET `/api/v1/carts/me` | Shared page/header query; Bearer with CART.VIEW + CART.CREATE |
| PUT `/api/v1/carts/me/items/{lineId}` | Prepared quantity call `{quantity}`; provisional #111 draft, BE pending |
| DELETE `/api/v1/carts/me/items/{lineId}` | Prepared no-body removal expecting 204; provisional #111 draft, BE pending |

`q`/`sort` exist in UI URL state but are not implemented by the checked-out products controller. A fixture that returns filtered/sorted results does not establish the backend capability. Track the contract extension separately.

The table lists FE consumers/prepared calls, not every BE endpoint or a guarantee of availability. Cart update/remove still lack BE implementations here. Their service calls are provisional integration points authorized for this task; confirm final paths/responses/permissions when BE lands. POST is additive and reprices from the current SKU; it cannot substitute for an absolute edit. See the [Cart implementation report](../features/cart-page-implementation.md).

## Type generation and runtime checks

Run `npm run generate:types` after changing delivered OpenAPI. The pinned openapi-typescript 7.13.0 tooling produces flat `types/userGeneratedType.ts`, `catalogGeneratedType.ts`, and `commerceGeneratedType.ts` from their respective delivered specs. `npm run generate:types:check` detects drift. Domain request/response files expose wire aliases or explicitly normalized models. Do not hand-edit generated output or duplicate DTOs by hand. UI props, query/context types, form values and normalized money models are application code and remain distinct.

Generated types do not validate live JSON. Keep runtime guards/parsers for auth, trees, products, SKU/images, cart and paging. Update fixtures and parser tests in the same contract change. Do not keep a permissive dual wire-shape parser indefinitely to hide mismatched deployment versions.
