# Guest cart and merge on sign-in (CRT-07, CRT-08)

The frontend starts from the Keycloak sign-in implementation in commit
`4c1139ab`. `CartProvider`, mounted inside `AuthSession` at the application
root, owns guest/add/merge operations and the shared header count. The cart page's `useCart` coordinates quantity edits and removals. Product pages use
`useGuestCart().addItem()`. The count sums item quantities, including repeated SKUs.

## Backend readiness

The current commerce controller implements authenticated `/api/v1/carts/me`
and its item operations only. `CartService.requireUserId` explicitly excludes
guests. The `allow-guest-cart` backend property and `guest_token` database column
exist, but guest endpoints, public gateway permissions, merge behavior and a
public feature-configuration endpoint are not implemented. Latest develop configures Keycloak JWT trust; live backend acceptance remains unverified.

The adapter below is a **proposed handoff contract**, exercised against a local
HTTP fixture. It is not a published or delivered backend API. Keep
`NEXT_PUBLIC_GUEST_CART_ENABLED=false` until the backend is available. Set it
to `true` and restart/rebuild Next to enable the guest flow; the value must agree
with the backend guest-cart setting. When disabled, Add to Cart asks anonymous
visitors to sign in without creating a guest cart. A guest API 401/403 also
shows the sign-in prompt.

Application cart calls receive the common configured `NEXT_PUBLIC_API_URL` through the provider's request context: the gateway routes `/api/v1/carts/**` to commerce-service. Direct service calls default to the empty `CART_API_BASE_URL` (same origin) unless their context overrides it. The obsolete `localhost:4010`
fallback has been removed. Authenticated cart decoding requires the delivered `{data, code, message}` envelope and current `CartResponse` fields. Prices normalize to decimal strings through the shared parser. The header sums quantities from the same scoped QueryClient cart used by the cart page; draft-only names, totals and timestamps are not required.

## Proposed guest API

Every successful response below wraps its payload in `{code,message,data}`; the payload column describes `data`. Bare payloads are rejected by the shared HTTP boundary.

| Request | Credentials | Successful response |
|---|---|---|
| POST `/api/v1/carts/guest`, body `{}` | Anonymous | 201 `{guestToken, cart}` |
| GET `/api/v1/carts/guest` | `X-Guest-Token` | 200 CartResponse |
| POST `/api/v1/carts/guest/items`, body `{skuId, quantity}` | `X-Guest-Token` | 201 CartResponse |
| POST `/api/v1/carts/me/merge`, body `{}` | Bearer, `X-Guest-Token`, `Idempotency-Key` | 200 merged CartResponse |

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
   access/ID tokens remain in memory, exactly as in #239.
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
npm run lint
npx tsc --noEmit
npm run build
```

The existing Postman simulation runs the real Next.js frontend at port 3103
against local API and Keycloak stand-ins at 3913. Browser tests cover guest
creation, repeated quantities, reload, mobile header count, token persistence
through Keycloak, one merge after callback, logout, guest-disabled 403, and retry
both before a write and after a simulated committed write whose response failed.
Unit tests additionally cover the frontend flag being off and stale responses.
The CLI is signed out, so owner mock discovery was skipped. Nothing is published
to an external Postman workspace. Fixture results establish frontend behavior
under the proposed contract; real guest/merge end-to-end verification remains
blocked by the backend gaps above.

Validated on 2026-11-03: 65 unit tests and 14 browser tests passed, along with
ESLint, TypeScript and the production build. The installed Next.js 16.4.0 still
reports its existing security advisory; startup/build retries succeeded without
changing dependencies. A dependency security upgrade remains separate work.
