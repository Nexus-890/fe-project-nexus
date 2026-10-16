# Product detail flow

The task's detail page uses the backend contract already present in the catalog
service and keeps the unfinished commerce contract behind a small adapter.

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

The Java backend serializes SKU `BigDecimal` values as numbers in a normal
Jackson setup. `parseProductDetail` accepts either a number or a string once,
then normalizes money to strings before the UI renders it. Cart money remains
strings as required by `docs/api/commerce-service.yaml`.

Commerce has database migrations but no cart controller/service or gateway
route yet. Until that sprint lands, copy the following lines into `.env.local`
to run the page with the nested fixture in `mocks/product-detail.ts`:

```text
NEXT_PUBLIC_PRODUCT_DETAIL_MOCK=true
NEXT_PUBLIC_CART_MOCK=true
# Optional: use the existing in-memory auth flow to test an authenticated POST.
NEXT_PUBLIC_AUTH_STUB=true
```

Then open
`http://localhost:3000/products/ipad-mini-2021-starlight-00000004-1111-4111-8111-111111111111`.
This URL uses the fixture directly, so it does not need a seeded catalog
database.

Remove or set both values to `false` to call the real endpoints. The temporary
cart URL is declared at the top of `service/cart.ts` and should be replaced
when the commerce route lands. If you prefer a code-only switch, comment the
`MOCK START` branch in `service/catalog.ts` and `service/cart.ts`; leave the
real `GET`/`POST` immediately below it unchanged. The fixture is not imported
by the injected-client tests, so those tests still verify the real request paths
and payload shape.

## BE hand-off checklist

When the BE is ready, use the following two URLs:

| UI flow | URL to point at | Change |
| --- | --- | --- |
| Product detail | `NEXT_PUBLIC_API_URL` + `/api/v1/products/{id}` | Set `NEXT_PUBLIC_API_URL` to the gateway origin. No service code change. |
| Add to cart | `http://localhost:4010` + `/api/v1/carts/me/items` | Replace `TEMP_COMMERCE_API_URL` in `service/cart.ts` with the deployed commerce/gateway origin. |

Then remove or set `NEXT_PUBLIC_PRODUCT_DETAIL_MOCK` and
`NEXT_PUBLIC_CART_MOCK` to `false`. The payload remains
`{ skuId, quantity }`, so the UI and cart service do not need to change when
the real endpoint returns the documented `Cart` object.
