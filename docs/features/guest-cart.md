# Guest cart and merge on sign-in (CRT-07, CRT-08)

The guest flow is integrated with the flat frontend structure and the shared
authentication provider. `CartProvider`, mounted inside `AuthSession` at the
application root, owns guest/add/merge operations and the shared header count.
Product pages use `useGuestCart().addItem()`; the cart page's `useCart` coordinates
quantity edits and removals. The header count sums item quantities, including
repeated SKUs, and links to `/cart`. Authenticated queries, optimistic edits and
private cache isolation remain in place.

## Backend readiness

The current commerce controller implements authenticated `/api/v1/carts/me`
and its item operations only. `CartService.requireUserId` explicitly excludes
guests. The `allow-guest-cart` backend property and `guest_token` database column
exist, but guest endpoints, public gateway permissions, merge behavior and a
public feature-configuration endpoint are not implemented. Keycloak JWT support
is configured in the merged gateway/user-service source; real backend and
Keycloak integration remains unverified.

The adapter below is a **proposed handoff contract**, exercised against a local
HTTP fixture. It is not a published or delivered backend API. Keep
`NEXT_PUBLIC_GUEST_CART_ENABLED=false` until the backend is available. Set it
to `true` and restart/rebuild Next to enable the guest flow; the value must agree
with the backend guest-cart setting. When disabled, Add to Cart asks anonymous
visitors to sign in without creating a guest cart. A guest API 401/403 also
shows the sign-in prompt.

All cart calls use the shared `configs/api.ts` HTTP boundary and the Cart
service's configured origin. Application calls receive `NEXT_PUBLIC_API_URL`
from the auth provider's scoped request context, including its shared token
renewal coordinator. Direct service calls fall back to the intentionally blank
`CART_API_BASE_URL` for same-origin requests unless their context supplies an
origin. See [Cart configuration](cart.md#api-configuration). There is no
`localhost:4010` fallback. Responses use the strict `{code,message,data}` envelope.
Cart decoding accepts the delivered IDs, quantity and numeric snapshot price;
draft-only names, totals and timestamps are not required. The header reads the
same scoped QueryClient cart used by the cart page.

## Proposed guest API

Every successful response below wraps its payload in `{code,message,data}`; the payload column describes `data`. Bare payloads are rejected by the shared HTTP boundary.

| Request | Credentials | Successful response |
|---|---|---|
| POST `/api/v1/carts/guest`, body `{}` | Anonymous | 201 envelope with `data: {guestToken, cart}` |
| GET `/api/v1/carts/guest` | `X-Guest-Token` | 200 CartResponse envelope |
| POST `/api/v1/carts/guest/items`, body `{skuId, quantity}` | `X-Guest-Token` | 201 CartResponse envelope |
| POST `/api/v1/carts/me/merge`, body `{}` | Bearer, `X-Guest-Token`, `Idempotency-Key` | 200 merged CartResponse envelope |

Guest tokens are server-generated opaque URL-safe strings, 16–255 characters.
They identify a server cart; prices and item lists are never stored in browser
storage. Guest calls explicitly omit Authorization. The backend must permit
anonymous guest routes, validate possession of the token, and allow the two
custom headers in CORS. Guest operations return 403 when disabled. Guest reads
and additions may return 404/410 when the cart no longer exists.

Merge must combine quantities for matching SKUs, validate server inventory and
limits, and atomically consume the guest cart. Repeating the same merge key
and token for the same authenticated user must not apply quantities again,
including when the first response was lost after a commit. Keys must be bound
to that user and guest cart; a token consumed by another user must not expose
their cart. The backend must define key retention long enough for retry after
a later sign-in. These are backend requirements, not guarantees provided by
frontend deduplication or the current backend.

## Redirect, persistence and retry

1. The first anonymous addition creates a guest cart. Before adding any items,
   FE writes `{token, mergeKey}` to the localStorage key `nexus.cart.guest`.
   A storage failure prevents the add, so a redirect cannot silently lose the
   only reference to the cart. Subsequent additions reuse the session.
2. Reload fetches the guest cart using the saved token. A missing/expired guest
   cart clears only that matching local session. Transient errors retain it.
3. Sign-in navigates to Keycloak. The guest session survives in localStorage;
   access, ID and refresh tokens remain in memory.
4. After code exchange and `/me`, `CartProvider` makes one automatic merge
   attempt. The callback waits for the cart attempt to settle before returning
   to the requested page. A valid merge response updates the shared count and
   removes the matching guest session.
5. On merge failure, FE preserves the token and merge key, loads the member
   count when possible, and displays **Retry merging cart** in the shop. Retry
   uses the same key. Additions to the member cart wait until this merge is
   resolved. Successful merges are not repeated on normal client navigation.

The controller serializes operations, deduplicates React StrictMode effect
replays, and ignores responses from a previous auth session. Web Locks also
serialize cooperating tabs where supported. Server idempotency is required
regardless. Lock acquisition times out after 15 seconds. A stale response cannot
delete a newer guest session. Signing out
immediately hides the member count; a successfully consumed guest token is not
restored. Session restoration after reload is handled by #184; token rotation
within the same authenticated session preserves the cart and does not merge it
again. Protected cart requests share the auth provider's renewal coordinator.

## Verification

```bash
npm run test:auth
npm run test:auth:browser
npm run test:browser -- --max-failures=1
npm run generate:types:check
npm run lint
npm run typecheck
npm run build
```

The existing Postman simulation runs the real Next.js frontend at port 3103
against local API and Keycloak stand-ins at 3913. Cart requests use the configured
API origin; the guest browser suite also forwards any same-origin cart requests
over HTTP to that simulation. Browser tests cover guest
creation, repeated quantities, reload, mobile header count, token persistence
through Keycloak, one merge after callback, logout, guest-disabled 403, and retry
both before a write and after a simulated committed write whose response failed.
They also cover a profile 503 followed by explicit account retry: the guest
credential remains saved, and merge starts only after the profile succeeds.
Unit tests additionally cover the frontend flag being off and stale responses.
The CLI is signed out, so owner mock discovery was skipped. Nothing is published
to an external Postman workspace. Fixture results establish frontend behavior
under the proposed contract; real guest/merge end-to-end verification remains
blocked by the backend gaps above.

Historical verification before this merge, on 2026-11-03, passed 65 unit tests,
14 browser tests, ESLint, TypeScript and the production build.

On 2026-11-05 the final merge verification passed 94 unit/transport tests,
17 auth browser scenarios (6 guest and 11 OIDC, 41.5 seconds) and 31 general
browser scenarios (57.0 seconds). The general suite includes all 9 Cart,
4 Product, 7 Gallery and 10 Catalog cases plus the auth acceptance harness;
the Product cases include navigation during a pending add. Generated DTO drift,
fresh route typecheck and lint also passed. Lint excluded the existing unrelated
`.next-profile-run/**` output. The production build passed with isolated
`NEXUS_TEST_DIST_DIR=.next-verify-build` output.

An earlier auth attempt overlapped source Hot Refresh; the stable final source
passed on rerun. The existing Next.js 16.4 security reminder required unchanged
startup/build retries. An inherited gallery 404 test initially stalled at
"Loading product…" and passed unchanged in the final general run. The two
general browser URL assertions were updated to the preserved sign-in return
destination, `/sign-in?returnTo=%2F`.

The final auth simulation log contained 236 request events before the general
runner cleaned that ignored log. The final general log contained 86 request
events and exercised only the Keycloak member; its application API responses
came from Playwright fixtures. `postman status` was attempted, but CLI 1.73.0
reported an unknown command; no Postman setup was changed. These results cover the local stand-ins; no
live backend or Keycloak integration was tested. The
[simulation context](../../postman/simulations/oidc.context.yaml) preserves
the historical runs, current evidence and unresolved backend requirements.
