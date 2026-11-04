# Cart and shared header count

The /cart route renders the current account's cart with quantity updates, removal, derived totals and typed error/retry states. Product details, the header badge and cart page share one query keyed by session generation. Anonymous visitors make no cart request and see a sign-in prompt. Checkout and payment remain separate work.

Pure functions in service/cartService.ts call the single configs/api.ts boundary for GET /api/v1/carts/me, POST /api/v1/carts/me/items, PUT /api/v1/carts/me/items/{id} and bodyless DELETE 204. The HTTP boundary validates the success envelope; services validate its data and derive decimal-string line totals/subtotal using integer cents. Wire DTOs remain generated from the delivered commerce OpenAPI.

hooks/useCart.ts owns the shared query and serialized writes through useApiQuery/useApiMutation. Writes cancel older reads before and after completion, replace the confirmed snapshot and retain originating session guards. Logout/account changes remove private data; late responses cannot restore the badge or report success for another account. Count sums quantities without extra product requests.

Explicit cart fixture selection stays at the HTTP boundary, is disabled in production, and preserves separate carts for development accounts. Normal operation uses the configured common backend origin. See [cart setup and contract details](../cart-flow.md) and [simulation context](../../postman/simulations/cart.context.yaml).
