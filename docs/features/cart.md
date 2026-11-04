# Add to cart

The current frontend implements adding a selected SKU from product detail. A complete cart screen, update/remove UI, checkout, shipping and payment flow are outside this implementation scope.

## Interaction

1. Load a validated product detail and choose a SKU and quantity.
2. An anonymous Add to Cart click shows a sign-in prompt and sends no private request.
3. An authenticated click invokes the shared mutation with the provider's current request context.
4. The service sends exactly `{skuId, quantity}` to POST `/api/v1/carts/me/items` through the common configured API origin.
5. A successful current-session response updates/invalidates that session's cart cache and shows feedback. A failure does not show success.

Quantity must be an integer greater than zero and skuId must be present. Pending state prevents duplicate button submissions in the current interaction. Mutation retry defaults to zero.

## Delivered response

The backend CartController already exists. Use its delivered OpenAPI and DTOs, wrapped in the shared success envelope:

- Cart: id, userId, status and items.
- Item: id, productId, skuId, quantity and numeric unitPrice on the wire.

Do not require draft fields such as productName, lineTotal, subtotal, currency or updatedAt when the backend does not emit them. Any future calculated/display model must state its data source and remain separate from a generated wire DTO. Preserve money validation/normalization when adapting the response.

There is no separate hardcoded commerce origin. `NEXT_PUBLIC_API_URL` configures the gateway shared with auth/catalog. The frontend does not bypass ownership or gateway permission checks.

## Session and mock boundaries

Cart keys carry the account/session identifier and private-query metadata. Verify the captured generation before success cache work and UI callbacks; a response that arrives after logout or account switch cannot repopulate private cache or report success to the new account. Cancellation helps stop network work but does not replace generation checks.

An explicit cart development fixture is useful for the detail interaction before a local backend is available. Select it in dev/test setup, model the delivered envelope, and block it in production. Keep fixture-only totals/helpers scoped to fixture behavior rather than pretending those fields are delivered.

Verification covers anonymous no-request behavior, authenticated Bearer/body/path, invalid quantity, backend/invalid-response failure, pending state, current-session cache work, and logout/account-switch during the request. Passing these fixture checks does not establish deployed authorization or backend availability.
