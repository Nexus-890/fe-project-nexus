# Cart

The frontend implements `/cart`, the header cart link/count, product-detail add-item, snapshot prices/totals, optimistic quantity/removal, rollback and empty/loading/error/auth states. Checkout stays disabled with a visible reason. Backend GET/add are delivered; update/remove service calls are prepared against provisional paths while the BE task remains outstanding. See the [implementation report](cart-page-implementation.md) for verification and the [initial readiness review](cart-page-readiness.md) for the original source audit.

## Interaction

1. Load a validated product detail and choose a SKU and quantity.
2. An anonymous Add to Cart click shows a sign-in prompt and sends no private request.
3. An authenticated click invokes the shared mutation with the provider's current request context.
4. The service sends exactly `{skuId, quantity}` to POST `/api/v1/carts/me/items` through the Cart origin and common HTTP boundary.
5. A successful current-session response invalidates that session's cart key and shows feedback. The header's active cart query rereads the count. A failure does not show success.

Quantity must be an integer greater than zero and skuId must be present. Pending state prevents duplicate button submissions in the current interaction. Mutation retry defaults to zero.

## Delivered response

The backend CartController already exists. Use its delivered OpenAPI and DTOs, wrapped in the shared success envelope:

- Cart: id, userId, status and items.
- Item: id, productId, skuId, quantity and numeric unitPrice on the wire.

Do not require draft fields such as productName, lineTotal, subtotal, currency or updatedAt when the backend does not emit them. Any future calculated/display model must state its data source and remain separate from a generated wire DTO. Preserve money validation/normalization when adapting the response.

## API configuration

The user requested an empty Cart base URL to fill later. Edit this single value in [cartService.ts](../../service/cartService.ts):

```ts
export const CART_API_BASE_URL = "";
```

Supply only the origin (scheme/host/port), without `/api/v1`; endpoint paths already include that prefix. All Cart calls still use the common `requestApi` Axios boundary for tokens, envelopes, errors and cancellation. An explicitly provided request-context baseUrl takes precedence; otherwise blank means browser same-origin relative requests. It does not fabricate a cart or enable fixtures. Auth/catalog keep their existing `NEXT_PUBLIC_API_URL` configuration. Restart/rebuild after filling the service constant.

| Service | Method/path | Request/success | Backend status |
| --- | --- | --- | --- |
| getCart | GET `/api/v1/carts/me` | No body; 200 Cart envelope | Delivered; CART.VIEW + CART.CREATE |
| addCartItem | POST `/api/v1/carts/me/items` | `{skuId, quantity}`; 201 Cart envelope | Delivered; CART.UPDATE; additive, not set-quantity |
| updateCartItem | PUT `/api/v1/carts/me/items/{lineId}` | `{quantity}`; expects 200 Cart envelope | Provisional #111 draft, not implemented by this BE revision |
| removeCartItem | DELETE `/api/v1/carts/me/items/{lineId}` | No body; expects bodyless 204 | Provisional #111 draft, not implemented by this BE revision |

Fill the origin and confirm methods/paths/body/response/privileges when BE is delivered. A filled URL alone cannot add missing backend operations. Calls currently make real HTTP requests and show failures/rollback when refused. Never substitute the additive POST for edits; it also refreshes snapshot price from catalog. `UpdateCartItemRequest` is a provisional application input, not a generated delivered wire DTO. Do not hand-edit generated types to claim future operations exist.

## Page state and display

[useCart](../../features/useCart.ts) composes generic hooks/services for business state. [ShopLayout](../../features/ShopLayout.tsx) observes the same session cart key and protected metadata; its badge is the sum of quantities. Anonymous users send no private cart GET and see a sign-in prompt. The Cart header link is available on mobile.

[cartUtils](../../features/cartUtils.ts) calculates exact line totals/subtotal with BigInt cents from normalized snapshot unitPrice; `formatVND` renders them. Optional catalog metadata supplies names/images/variants. Failed enrichment leaves a usable identifier/image fallback and Remove control; live catalog SKU prices never replace cart prices. No currency conversion, seller display name or shipping promise is fabricated.

The thin route delegates to CartPage with flat CartLine/CartSummary components. Desktop places the list beside the summary; mobile stacks them with wrapping and 44px targets. The supplied design guides layout. Coupons, Save for Later, seller trust, live price alerts, shipping/tax quotes and working checkout remain outside the task.

Before an edit, cancel the cart GET, snapshot the cache and optimistically patch quantity/removal. Totals/header count change immediately. Disable all cart line controls while the operation settles, including across page remounts, to serialize full-cart responses. PUT success uses the returned cart; DELETE success keeps the removal; settled operations refetch. On rejection, restore the snapshot only if that operation's optimistic value still owns the cache and announce the reason. Removing the last line shows the empty state/catalog link immediately; rejected removal restores it. Manual quantity entry commits on blur/Enter, while plus/minus commit immediately.

## Session and mock boundaries

Cart keys carry the account/session identifier and private-query metadata. Session-generation guards cover success, rollback, invalidation and feedback; an old response cannot repopulate private cache after logout/account switching. Leaving the page aborts pending writes and reconciles the current account. Cancellation does not replace generation checks.

An explicit cart development fixture is useful for the detail interaction before a local backend is available. Select it in dev/test setup, model the delivered envelope, and block it in production. Keep fixture-only totals/helpers scoped to fixture behavior rather than pretending those fields are delivered.

The backend persists cart data, but full refresh still loses the in-memory auth session. Sign back into the same account to reread its cart. This task adds no token storage, guest cart or auth-restoration protocol. Tests/screenshots use explicit HTTP stand-ins and do not establish deployed authorization/database behavior. Peer real-API add/edit with a recorded cart ID remains pending backend delivery; see the implementation report for current evidence.
