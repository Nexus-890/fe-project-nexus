# Product detail flow

The detail page uses the real catalog and commerce endpoints through the shared
API origin or Next gateway proxy.

```text
ProductCard (id + slug)
  -> /products/{slug}?id={id}
  -> useProduct(id)
  -> GET /api/v1/products/{id}
  -> ProductDetailResponse { ..., skus[], images[] }
  -> selected sku + quantity
  -> POST /api/v1/carts/me/items { skuId, quantity }
```

The catalog endpoint is public. The cart endpoint is private, so an anonymous
click only renders the sign-in prompt and does not send a request. For an
authenticated click, the selected `skuId` and the current quantity are sent in
one POST. The selected SKU is local React state, which is why changing it only
changes the displayed price and does not trigger another GET.

The Java backend serializes `BigDecimal` prices as JSON numbers. Both
`parseProductDetail` and `parseCart` accept numeric or string prices and normalize
them to strings before returning data to the UI.

The current commerce response is:

```text
CartResponse { id, userId, status, items[] }
CartItemResponse { id, productId, skuId, quantity, unitPrice }
```

The parser validates those fields and does not require additional product names,
totals, currency, or timestamps that the backend does not return.

## Run against the real backend

Start the backend services against the seeded databases, then run `npm run dev`
in `fe-project-nexus`. See `be-project-nexus/infra/demo/README.md` for database
setup and accounts. Product detail and cart always call the real backend.

For a separately launched frontend, configure `.env.local` and restart Next:

```text
NEXT_PUBLIC_API_URL=
API_PROXY_TARGET=http://localhost:8080
```

Both catalog and cart use `configs/api.ts`. With an empty public API URL, browser
requests go through `/api/...` on the Next origin, which forwards them to the
gateway. A gateway that supports browser CORS can instead be configured with
`NEXT_PUBLIC_API_URL` and an empty `API_PROXY_TARGET`.

Sign in, open the smartphone demo category, choose iPhone 15, select a variant,
and click **Add to Cart**. A successful real POST returns HTTP 201 and displays
"Added to cart." The access token is saved in localStorage under
`nexus.accessToken` and restored after hydration, so a valid session survives a
reload. Signing out or receiving a current-session 401 removes the saved token.

The seeded product can also be opened directly:

```text
http://127.0.0.1:3000/products/demo-iphone-15-128gb?id=6d260021-0000-4000-8000-000000000201
```

Product cards include the real UUID in the `id` query parameter. Direct URLs can
also include a UUID at the end of the slug. A link without either identifier
shows a product-link error and does not generate data locally. Backend failures
display the existing error/retry state.
