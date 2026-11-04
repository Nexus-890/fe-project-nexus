# Nexus frontend

Next.js App Router frontend for the Nexus marketplace. The current UI includes registration/login, an in-memory auth session, shop/category navigation, product listings/details, SKU/quantity/image selection, add-to-cart feedback and a Cart page with optimistic quantity/removal. See the [documentation index](docs/index.md) for architecture, contracts and feature scope.

## Development

Use the repository's Node requirement and install the locked dependencies:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` to the common backend origin, normally `http://localhost:8080`, then run:

For same-origin local integration, use `NEXT_PUBLIC_API_URL=` and `API_PROXY_TARGET=http://localhost:8080` instead. Next proxies browser `/api/v1/*` calls and uses the target for server catalog reads, avoiding browser cross-origin requirements. The Cart service base URL intentionally remains blank; see [Cart configuration](docs/features/cart.md#api-configuration).

```powershell
npm run dev
```

Open [localhost:3000](http://localhost:3000). Configure an absolute backend origin either through the proxy or the public direct origin. Service paths already contain `/api/v1`; do not add it to the origin. Restart Next after environment changes. Direct cross-origin browser calls require backend CORS support. The [existing UI/API inventory](docs/features/api-ui-integration.md) separates connected flows from incompatible/undelivered backend contracts or absent screens.

For explicit local fixtures, use the documented `NEXT_PUBLIC_AUTH_STUB`, `NEXT_PUBLIC_PRODUCT_DETAIL_MOCK` and `NEXT_PUBLIC_CART_MOCK` flags in development. These are stand-ins, are blocked in production, and do not prove live API compatibility. The auth fixture has no default account; register first. Access tokens are kept only in memory; a full reload returns to anonymous. Refresh tokens/persistent login are outside current scope.

## Code layout

```text
app/          Route tree, layouts and boundaries
components/   UI and pure presentation helpers
configs/      Single api.ts and queryKeys.ts
features/     Page orchestration, schemas and catalog helpers
hooks/        useApi.ts and useAuth.ts
providers/    Provider.tsx
service/      Pure domain API functions and parsers
types/        Flat generated DTOs, domain types and application contracts
mocks/        Explicit development/test stand-ins
tests/        Unit, transport and browser regression tests
scripts/      Type generation and verification runners
docs/         Task-routed project documentation
```

Client requests follow feature → shared API hook → service → API config. Server category resolution uses the same pure service directly. Services return typed data or reject normalized errors; the HTTP boundary consumes the backend envelope once while preserving paging metadata. [API details](docs/api/api-contract.md) describe the service-callback integration with the web-first sample.

## Verification

```powershell
npm run generate:types
npm run generate:types:check
npm run lint
npm run typecheck
npm run test:auth
npm run test:catalog
npm run build
```

`test:auth` retains the existing command name and runs the unit/transport suites, including catalog/product helpers. The browser runner prepares and cleans the auth-smoke route and runs the configured `tests/*.spec.ts` scenarios against isolated fixture servers. Check [task workflow](docs/ai/task-workflow.md) and actual runner output for scope. Browser checks require the configured installed browser. Typecheck regenerates route types in a dedicated output directory rather than trusting stale `.next` validators.

`npm run generate:types` uses pinned tooling against delivered backend OpenAPI and writes flat `userGeneratedType.ts`, `catalogGeneratedType.ts`, and `commerceGeneratedType.ts` files under `types`. The check command detects drift; edit the contract or domain model instead of generated output.

Verified rebuild on 2026-10-30: lint, regenerated-route typecheck, generated DTO drift check and production build passed; 51 unit tests and 13 browser scenarios passed, including 14 auth acceptance checks. An additional Postman HTTP probe passed against the documented stand-in. See the [verification report](docs/ai/verification.md) for exact commands, the historical baseline and remaining live-backend/release limits.

## Contracts and known limits

Use the [delivered API specs](../be-project-nexus/docs/api/openapi/), not the older future-operation drafts. The frontend consumes `{code,message,data,page?}` and Problem Details field entries `{field,code,detail}`. Cart reuses the shared HTTP boundary and delivered DTO fields. Its `CART_API_BASE_URL` in `service/cartService.ts` is intentionally blank for the user to fill. Merged BE #111 source now has PUT/DELETE mappings, but stale DTO imports/build issues, authentication binding and the bare PUT response still block compatible integration; delivered OpenAPI still documents only GET/POST. Read the [Cart handoff](docs/features/cart.md#api-configuration) and [implementation report](docs/features/cart-page-implementation.md). [ADR-008](../be-project-nexus/docs/adr/ADR-008-api-contract.md) still records coordinated release as pending.

The products controller currently accepts categoryId/page/size; real q/sort search remains a contract dependency even though the UI preserves those URL values. Cart UI is implemented; real update/remove and peer acceptance still require compatible BE build/contract/auth behavior. Working checkout, payment, auction bidding and password-recovery UI remain outside scope. Full refresh requires signing back in because auth stays in memory.

Product detail already consumes image URLs from its real GET endpoint. Product cards support optional list images, but the delivered product list response currently has none; those cards keep the placeholder until BE upload task #122 supplies image data. See [product image gallery](docs/features/product-image-gallery.md) for ordering, fallback, reserved media dimensions and verification scope. The API base URL still defaults to `""` when neither public API environment variable is set; service paths use the existing product endpoints.

Read [architecture](docs/ai/architecture.md), [coding rules](docs/ai/coding-rules.md), [feature flows](docs/features/index.md) and the [design system](docs/ui/design-system.md) before extending the app.
