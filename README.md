# Nexus frontend

Next.js App Router frontend for the Nexus marketplace. The current UI includes registration, Keycloak OIDC sign-in with PKCE, editable profile details, an in-memory auth session, shop/category navigation, product listings/details, SKU/quantity/image selection, add-to-cart feedback and a Cart page with optimistic quantity/removal and a shared header count. See the [documentation index](docs/index.md) for architecture, contracts and feature scope.

Access, ID and refresh tokens stay in memory. On reload, the client checks the Keycloak SSO session with prompt=none, then loads the profile. One shared renewal coordinator renews before expiry and permits one retry after a protected 401. See [session restore](docs/features/session-restore.md) and [guest cart](docs/features/guest-cart.md).

## Guest cart

See [Guest cart and merge on sign-in](docs/features/guest-cart.md) for the shared header
count, persistence through Keycloak and merge retry flow. Guest carts are
disabled by default because the backend guest/merge endpoints are not yet
delivered. The document records the proposed API and local HTTP verification.

## Development

Use the repository's Node requirement and install the locked dependencies:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Keep the local defaults from `.env.example` in `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_API_BASE_URL=
API_PROXY_TARGET=http://localhost:8080
```

The browser calls relative `/api/v1/*` paths on Next, and Next forwards them to
the real gateway at port 8080. Server catalog reads use the same gateway target.
Leaving both public-origin settings blank selects this mode; an explicit public
origin takes precedence and makes browser calls directly to that origin. The
Cart service base URL intentionally remains blank; see [Cart configuration](docs/features/cart.md#api-configuration).

Start the local Buyer Shop Backend from this frontend directory:

```powershell
pwsh -File ../be-project-nexus/infra/local-dev/start-buyer-shop.ps1
```

The helper starts configuration/discovery, gateway (`8080`), catalog (`8082`)
and auction (`8084`), checks their availability and prepares the public demo
dataset. Docker infrastructure alone does not start these host-run Spring
services. The [repository startup guide](../README.md#running-it) documents the
manual service startup sequence. Then run:

```powershell
npm run dev
```

Open [localhost:3000](http://localhost:3000). Service paths already contain
`/api/v1`; do not add it to an origin. Restart Next after environment changes.
For direct cross-origin mode, set `NEXT_PUBLIC_API_URL` to the common Backend
origin, leave `API_PROXY_TARGET` empty and ensure Backend CORS permits the exact
frontend origin. The [existing UI/API inventory](docs/features/api-ui-integration.md)
separates connected flows from incompatible/undelivered Backend contracts or absent screens.

### Local data and connection checks

Buyer Shop demo data is persisted in the service databases. After applying the
service migrations and provisioning the standard demo accounts, initialize it
with `be-project-nexus/infra/local-dev/seed-buyer-shop.ps1`; the
[data/media report](../be-project-nexus/docs/buyer-shop-backend.md) documents the
dataset and repeatable seed/image commands. Restarting the web frontend does
not require recreating products or uploading images again.

Before checking the page, verify the same gateway endpoints it uses:

```powershell
Invoke-RestMethod 'http://localhost:8080/api/v1/categories/tree'
Invoke-RestMethod 'http://localhost:8080/api/v1/products?page=0&size=10'
Invoke-RestMethod 'http://localhost:8080/api/v1/auctions?status=ACTIVE&page=0&size=5'
```

A refused connection/5xx means the API path is unavailable; an empty successful
`data: []` means no matching records. Check gateway registration/routing when
catalog or auction works on its own port but the gateway call fails. For proxy
mode, `http://localhost:3000/api/v1/products?page=0&size=10` must also return the
same JSON envelope after Next restarts. No product/cart mock is needed for this
real database flow.

Configure `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM` and `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` from `.env.example`. Sign-in opens Keycloak; `/auth/callback` exchanges the code, loads the profile and restores the requested page. See [authentication](docs/features/authentication.md) for local setup and integration limits. Access tokens stay in memory; a full reload returns to anonymous.

Explicit auth/product/cart development fixtures are blocked in production. The auth stub supplies registration/profile responses to injected test adapters; it does not replace the Keycloak redirect flow or provision real accounts.

Signed-in users can open `/profile` from the header or My Nexus, edit supported
personal information and save to the shared profile/header query. The profile
links password management to Keycloak and includes a phone verification card.
The account menu also exposes seller applications and saved addresses for checkout.
The #210 email/phone/address APIs are pinned to backend commit `1e480dda` and
disabled by default (`NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED=false`). Seller
applications read the buyer's own status/rejection feedback using the proposed
#210 contract and remain disabled by default
(`NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false`) until its implementation and
response contract are implemented. See the [seller follow-up](docs/account-219-seller-followup.md).
Default registration continues to sign-in;
see [review corrections](docs/account-219-review.md). Also see
[account verification](docs/features/account-verification.md),
[seller applications](docs/features/seller-application.md) and
[address book](docs/features/address-book.md). Avatar, reputation and penalties
await backend support. See the
[profile page](docs/profile-page.md) and [verification](docs/profile-verification.md).

## Code layout

```text
app/          Route tree, layouts and boundaries
components/   UI and pure presentation helpers
configs/      Single api.ts and queryKeys.ts
features/     Page orchestration, schemas and catalog helpers
hooks/        Shared API/auth hooks and session-scoped Cart state
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
npm run test:cart
npm run test:profile
npm run test:account
npm run test:auth:browser
npm run build
```

`test:auth` retains the existing command name and runs the unit/transport suites, including catalog/product helpers. The browser runner prepares and cleans the auth-smoke route and runs the configured `tests/*.spec.ts` scenarios against isolated fixture servers. Check [task workflow](docs/ai/task-workflow.md) and actual runner output for scope. Browser checks require the configured installed browser. Typecheck regenerates route types in a dedicated output directory rather than trusting stale `.next` validators.

`npm run generate:types` uses pinned tooling against delivered backend OpenAPI and writes flat `userGeneratedType.ts`, `catalogGeneratedType.ts`, and `commerceGeneratedType.ts` files under `types`. The check command detects drift; edit the contract or domain model instead of generated output.

Verified rebuild on 2026-10-30: lint, regenerated-route typecheck, generated DTO drift check and production build passed; 51 unit tests and 13 browser scenarios passed, including 14 auth acceptance checks. An additional Postman HTTP probe passed against the documented stand-in. See the [verification report](docs/ai/verification.md) for exact commands, the historical baseline and remaining live-backend/release limits.

## Contracts and known limits

Use the [delivered API specs](../be-project-nexus/docs/api/openapi/), not the older future-operation drafts. The frontend consumes `{code,message,data,page?}` and Problem Details field entries `{field,code,detail}`. Cart reuses the shared HTTP boundary and delivered DTO fields. Its `CART_API_BASE_URL` in `service/cartService.ts` is intentionally blank for the user to fill. Delivered OpenAPI now includes GET/POST/PUT/DELETE and the controller wraps PUT in the shared envelope. Live authenticated Cart acceptance remains unverified; PUT/DELETE principal binding still differs from GET/POST. Read the [Cart handoff](docs/features/cart.md#api-configuration) and dated [implementation report](docs/features/cart-page-implementation.md). [ADR-008](../be-project-nexus/docs/adr/ADR-008-api-contract.md) still records coordinated release as pending.

The products controller currently accepts categoryId/page/size; real q/sort search remains a contract dependency even though the UI preserves those URL values. Cart UI is implemented; real update/remove and peer acceptance still require authenticated runtime verification. [Checkout address and quote review](docs/features/checkout.md) is implemented; shipping remains provisional under #201 and preview consumes merged #188. [Order placement](docs/features/place-order.md) supports safe retries and price confirmation. Password recovery uses the Nexus-themed Keycloak pages; live reset delivery still needs verification. Reload restores the gateway cookie session.

Product detail already consumes image URLs from its real GET endpoint. Product cards support optional list images, but the delivered product list response currently has none; those cards keep the placeholder until BE upload task #122 supplies image data. See [product image gallery](docs/features/product-image-gallery.md) for ordering, fallback, reserved media dimensions and verification scope. The API base URL still defaults to `""` when neither public API environment variable is set; service paths use the existing product endpoints.

Read [architecture](docs/ai/architecture.md), [coding rules](docs/ai/coding-rules.md), [feature flows](docs/features/index.md) and the [design system](docs/ui/design-system.md) before extending the app.
