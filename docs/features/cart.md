# Cart

The frontend implements `/cart`, the header cart link/count, product-detail add-item, snapshot prices/totals, optimistic quantity/removal, rollback and empty/loading/error/auth states. Checkout stays disabled with a visible reason. Delivered OpenAPI covers GET/add. After merging the existing #129 remote history at `e2411ea4`, backend update/remove source also exists, but build, DTO, authentication binding and response-contract issues still block compatible integration. See the [implementation report](cart-page-implementation.md) for verification and the [initial readiness review](cart-page-readiness.md) for the original source audit.

## Interaction

1. Load a validated product detail and choose a SKU and quantity.
2. With `NEXT_PUBLIC_GUEST_CART_ENABLED=false` (the default), an anonymous Add to Cart click shows a sign-in prompt and sends no private request. The opt-in guest flow uses the [proposed guest contract](guest-cart.md), persisting only guest credentials across the Keycloak redirect.
3. Product-detail additions use `useGuestCart` and the shared CartProvider controller with the provider's current request context. The cart-page edit hook remains `features/useCart.ts`.
4. The service sends exactly `{skuId, quantity}` to POST `/api/v1/carts/me/items` through the Cart origin and common HTTP boundary.
5. A successful current-session add or merge updates the session cart cache and feedback. CartProvider and the cart-page query observe the same key, so optimistic page edits also update the header. A failure does not show success.

Quantity must be an integer greater than zero and skuId must be present. Pending state prevents duplicate button submissions in the current interaction. Mutation retry defaults to zero.

## Delivered response

The backend CartController already exists. Use its delivered OpenAPI and DTOs, wrapped in the shared success envelope:

- Cart: id, userId, status and items.
- Item: id, productId, skuId, quantity and numeric unitPrice on the wire.

Do not require draft fields such as productName, lineTotal, subtotal, currency or updatedAt when the backend does not emit them. Any future calculated/display model must state its data source and remain separate from a generated wire DTO. Preserve money validation/normalization when adapting the response.

## API configuration

Application cart calls use `NEXT_PUBLIC_API_URL` from the auth provider's scoped request context, sharing its current token and renewal coordinator. Direct service calls without a context origin use this fallback in [cartService.ts](../../service/cartService.ts):

```ts
export const CART_API_BASE_URL = "";
```

Supply only the origin (scheme/host/port), without `/api/v1`; endpoint paths already include that prefix. All Cart calls use the common `requestApi` Axios boundary for tokens, envelopes, errors and cancellation. A request-context baseUrl takes precedence over the fallback; without one, blank means browser same-origin relative requests. Changing the fallback does not override the provider's configured API origin or enable fixtures. Restart/rebuild after changing configuration.

| Service | Method/path | Request/success | Backend status |
| --- | --- | --- | --- |
| getCart | GET `/api/v1/carts/me` | No body; 200 Cart envelope | Delivered; CART.VIEW + CART.CREATE |
| addCartItem | POST `/api/v1/carts/me/items` | `{skuId, quantity}`; 201 Cart envelope | Delivered; CART.UPDATE; additive, not set-quantity |
| updateCartItem | PUT `/api/v1/carts/me/items/{lineId}` | `{quantity}`; FE expects 200 Cart envelope | Source mapping now exists, but returns bare CartResponse; absent from delivered OpenAPI and blocked by BE build/auth issues |
| removeCartItem | DELETE `/api/v1/carts/me/items/{lineId}` | No body; expects bodyless 204 | Source mapping now exists with CART.REMOVE_ITEM; absent from delivered OpenAPI and blocked by BE build/auth issues |

The merged [CartController](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/controller/CartController.java) matches the prepared PUT/DELETE method/path shapes, but its PUT returns a bare CartResponse instead of `{code,message,data}`. [CartService](../../../be-project-nexus/commerce-service/src/main/java/com/group5/commerceservice/cart/service/CartService.java) still imports old request/response packages after DTOs moved under `cart.dto`; unresolved symbols and repository-call mismatches also need correction. The controller references AuthenticationPrincipal without its import, and new update/remove CurrentUser binding differs from the established annotated pattern. A compatible BE build and authenticated runtime verification are required before claiming integration.

Configure the API origin and reconcile the delivered contract, body, response and privileges with the BE owner. A filled URL does not resolve these compatibility issues. Keep the strict shared success-envelope parser; do not accept a bare PUT DTO as a workaround. Calls make real HTTP requests and show failures/rollback when refused. Never substitute the additive POST for edits; it also refreshes snapshot price from catalog. `UpdateCartItemRequest` remains an application input because the delivered OpenAPI still lacks PUT/DELETE. Regenerate wire types when that contract is updated rather than hand-editing them.

## Page state and display

[useCart](../../features/useCart.ts) composes generic hooks/services for cart-page edits. [ShopLayout](../../features/ShopLayout.tsx) reads CartProvider's quantity, loading and merge-retry feedback; authenticated counts share the session cart key and protected metadata with the page. The badge sums quantities. Anonymous users send no private cart GET; with guests disabled, the page prompts for sign-in. The Cart header link is available on mobile. Guest additions/counts and merge after authentication are described in the [guest guide](guest-cart.md); the cart page still requires authentication for edits.

[cartUtils](../../features/cartUtils.ts) calculates exact line totals/subtotal with BigInt cents from normalized snapshot unitPrice; `formatVND` renders them. Optional catalog metadata supplies names/images/variants. Failed enrichment leaves a usable identifier/image fallback and Remove control; live catalog SKU prices never replace cart prices. No currency conversion, seller display name or shipping promise is fabricated.

The thin route delegates to CartPage with flat CartLine/CartSummary components. Desktop places the list beside the summary; mobile stacks them with wrapping and 44px targets. The supplied design guides layout. Coupons, Save for Later, seller trust, live price alerts, shipping/tax quotes and working checkout remain outside the task.

Before an edit, cancel the cart GET, snapshot the cache and optimistically patch quantity/removal. Totals/header count change immediately. Disable all cart line controls while the operation settles, including across page remounts, to serialize full-cart responses. PUT success uses the returned cart; DELETE success keeps the removal; settled operations refetch. On rejection, restore the snapshot only if that operation's optimistic value still owns the cache and announce the reason. Removing the last line shows the empty state/catalog link immediately; rejected removal restores it. Manual quantity entry commits on blur/Enter, while plus/minus commit immediately.

## Session and mock boundaries

Cart keys carry the account/session identifier and private-query metadata. Session-generation guards cover success, rollback, invalidation and feedback; an old response cannot repopulate private cache after logout/account switching. Leaving the page aborts pending writes and reconciles the current account. Cancellation does not replace generation checks.

An explicit cart development fixture is useful for the detail interaction before a local backend is available. Select it in dev/test setup, model the delivered envelope, and block it in production. Keep fixture-only totals/helpers scoped to fixture behavior rather than pretending those fields are delivered.

On full reload, the provider checks the Keycloak SSO session with `prompt=none` and reloads the profile before reading the account's cart. The cart page shows account loading during restoration; product additions wait until auth and cart readiness settle. Same-session token renewal preserves the cart cache and header count, and protected cart requests share one renewal and at most one replay after a 401. Renewal failure or explicit logout clears the private cache; explicit logout also prevents reload from restoring that session until the next sign-in. See [session restore](session-restore.md).

Guest credentials persist separately when the guest feature is enabled; access, ID and refresh tokens remain in memory. Tests/screenshots use explicit HTTP stand-ins and do not establish deployed authorization/database behavior. Peer real-API add/edit with a recorded cart ID remains pending compatible BE build/contract/auth behavior; see the implementation report for current evidence.
