# Cart hooks and header count

Code follows the existing frontend structure: `service/cartService.ts` owns HTTP calls,
`hooks/useCart.ts` uses the shared `useApiQuery`/`useApiMutation`, `configs/queryKeys.ts`
owns the key, and `types/cartRequestType.ts` / `types/cartResponseType.ts` expose DTOs. The `/cart`
route delegates to `features/ShoppingCartPage.tsx`; UI stays in `components`.

ShopLayout, ProductDetailPage and ShoppingCartPage observe the same session cart.
The badge sums item quantities. A fresh cart is shared for 30 seconds, including
when entering the cart page. Successful writes replace the cached snapshot;
writes are serialized per session and cancel older reads. Sign-out removes the
private query and prevents late mutation responses from restoring it. Anonymous
rendering makes no cart request and shows no count. Tokens stay out of query keys.

The delivered contract comes from the Cart controller/DTOs on `develop` and
`be-project-nexus/docs/api/openapi/commerce-service.yaml`. The older
`docs/api/commerce-service.yaml` is a draft for frontend mocks.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/v1/carts/me` | 200; ApiResponse<CartResponse> |
| POST | `/api/v1/carts/me/items` | 201; ApiResponse<CartResponse>; body `{skuId, quantity}` |
| PUT | `/api/v1/carts/me/items/{id}` | 200; ApiResponse<CartResponse>; body `{quantity}` |
| DELETE | `/api/v1/carts/me/items/{id}` | 204; hook then gets the current cart |

All calls use the common authenticated API client and API origin/proxy. The common HTTP boundary validates the `{code, message, data}` envelope once; the cart
service validates its nested data.
The wire DTO contains only `{id, userId, status, items}`, with items shaped as
`{id, productId, skuId, quantity, unitPrice}`. `unitPrice` is a JSON number.

`parseCart` converts prices into decimal strings and derives line totals and
subtotal using integer cents. Currency is the shop's VND display convention;
the backend does not supply currency or an update timestamp. Display metadata
is optional: without a product name, the cart labels the item `Product <id>` and
links to its product page. No extra product requests are needed for the count.
Discounts, checkout and saved items belong to separate tasks.

## Test the buyer data locally

Cart GET/POST/PUT/DELETE are implemented on `develop`. Use
`NEXT_PUBLIC_CART_MOCK=false` (the default) for backend integration. For offline
UI development, explicitly set `NEXT_PUBLIC_CART_MOCK=true` in `.env.local`,
restart Next, sign in as `buyer@nexus.local` and open `/cart` via the header.
Authentication still uses the real backend unless its separate stub is enabled.

The committed development snapshot in `mocks/cart-seed.ts` contains ten catalogue
SKUs with quantity one, exported during the earlier local buyer seed run. It is
fixture data and does not establish the current database state.
Other accounts start with an empty mock cart. Mock edits persist in module memory
per account for the running browser document; they do not write to PostgreSQL.
A full reload also ends the existing in-memory authentication session.

To reset this buyer's active cart and regenerate the snapshot, run from the
repository root with the migrated `nexus-postgres` container running:

```powershell
powershell -ExecutionPolicy Bypass -File be-project-nexus/infra/local-dev/seed-buyer-cart.ps1
```

The script resolves the account by email, selects ten active VND SKUs, preserves
their cart-item IDs on reruns, and verifies ten lines/ten units. It changes only
this buyer's active cart. Restart Next or reload/sign in to reset a running mock.
The in-memory mock is a UI fixture; HTTP regression tests use the compact
backend response below instead.

## Verification

```powershell
npm run test:auth
npm run test:cart
npm run lint
npm run typecheck
npm run build
```

`test:cart` runs the real frontend against a local Postman HTTP simulation on
ports 3104/3913, with cart/product mocks disabled in the frontend. The simulation
is authored from the delivered backend Cart DTOs/envelope and the existing
auth/catalog fixtures. It checks quantity two from
product details, a single shared cart GET, update/remove (including DELETE 204),
anonymous requests, failed reads/writes, a late response after sign-out, and
mobile/desktop layout. Request evidence is in `cart-simulation.ndjson`;
screenshots and traces are under `test-results/cart`.
These are local simulation checks; they do not establish connectivity or
authentication against a running backend. See `postman/simulations/cart.context.yaml`
for contract evidence and remaining integration limits.
