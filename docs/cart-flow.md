# Cart hooks and header count

Code follows the existing frontend structure: `service/cart.ts` owns HTTP calls,
`hooks/cart/useCart.ts` uses the shared `useApiQuery`, `configs/query-keys.ts`
owns the key, and `types/cart/{request,response}/type.ts` owns DTOs. The `/cart`
route delegates to `features/cart/ShoppingCartPage.tsx`; UI stays in `ui/components`.

ShopLayout, ProductDetailPage and ShoppingCartPage observe the same session cart.
The badge sums item quantities. A fresh cart is shared for 30 seconds, including
when entering the cart page. Successful writes replace the cached snapshot;
writes are serialized per session and cancel older reads. Sign-out removes the
private query and prevents late mutation responses from restoring it. Anonymous
rendering makes no cart request and shows no count. Tokens stay out of query keys.

The contract comes from `be-project-nexus/docs/api/commerce-service.yaml`:

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/v1/carts/me` | Cart |
| POST | `/api/v1/carts/me/items` | Cart; body `{skuId, quantity}` |
| PUT | `/api/v1/carts/me/items/{id}` | Cart; body `{quantity}` |
| DELETE | `/api/v1/carts/me/items/{id}` | 204; hook then gets the current cart |

All calls use the common authenticated API client and API origin/proxy.
Money remains decimal strings and the UI displays VND. Optional seller/image/
variant metadata is used when provided; the documented minimal DTO still works.
Discounts, checkout and saved items belong to separate tasks.

## Test the buyer data locally

The checked-out commerce service has database migrations and draft OpenAPI but
no cart controllers yet. Keep `NEXT_PUBLIC_CART_MOCK=true` in `.env.local` for
Sprint 1, restart Next, sign in as `buyer@nexus.local` and open `/cart` via the
header. The existing local/staging environment files contain the demo password.
Authentication still uses the real backend unless its separate stub is enabled.

The buyer's active PostgreSQL cart contains ten real catalogue SKUs, each with
quantity one. Its initial mock snapshot is exported to `mocks/cart-seed.ts`.
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
Once BE cart endpoints land, set `NEXT_PUBLIC_CART_MOCK=false`; no service path
changes are needed.

## Verification

```powershell
npm run test:auth
npm run test:cart
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

`test:cart` runs the real frontend against a local Postman HTTP simulation on
ports 3104/3913, with cart/product mocks disabled in the frontend. The simulation
is authored from the repository's draft cart DTOs and auth/catalog contracts;
it does not verify an implemented BE cart service. It checks quantity two from
product details, a single shared cart GET, update/remove (including DELETE 204),
anonymous requests, failed reads/writes, a late response after sign-out, and
mobile/desktop layout. Request evidence is in `cart-simulation.ndjson`;
screenshots and traces are under `test-results/cart`.
