# Catalog browsing and product detail

## Routes and responsibilities

| Route | Behavior |
| --- | --- |
| `/` | Campaign carousel, sample vouchers, root category tiles, live products, active auctions and category-based picks |
| `/categories/[slug]` | Server category resolution, then client product listing |
| `/category/[slug]` | Preserved redirect alias |
| `/search` | URL-controlled query/category/sort/page and API-backed listing |
| `/products/[slug]?id=...` | Product detail by explicit id; UUID suffix links remain supported |

`CategoryPage` uses the pure catalog service on the server. Resolve category by public slug or id in the nested tree, including existing `slug=` compatibility links. Unknown category calls `notFound`; an API failure goes to the route error boundary. Client hooks do not run in server category resolution.

The shop layout owns auth/category query state and passes props to the header/navigation. UI components do not call transport functions. Category tree loading/errors and product loading/errors remain independent, with explicit retry.

Homepage category tiles display only the roots returned by the tree API. They do not
render child links below the root label; recursive descendants remain available in
the listing sidebar and category picker. Product cards reserve equal media, two-line
title and price areas, stretch within their grid, and show `Price unavailable` when
the API has no price so missing data does not collapse the card.

## Listing and URL helpers

Services call public category/product endpoints and validate returned data before rendering. Product requests use API page zero-based and catalog size 12. URL page starts at 1; invalid, zero, negative, fractional, exponent, array or overflowing page values fall back to 1 according to `parsePage`.

`features/catalogUtils.ts` preserves:

- Recursive `findCategory` matching slug or id.
- Depth-first `flattenCategories` with depth metadata and no mutation of the input tree.
- `readQueryValue` selecting the first array item, trimming, and using an empty-string fallback.
- Encoded category path segments and search query parameters.
- Pagination/filter links and browser history; page 1/query-empty URL conventions remain stable.

Page-out-of-range, empty results, malformed response and API failure have distinct UI states. Catalog data stays API backed; a failed catalog call never falls back to fake products. The buyer shop design task explicitly authorizes hardcoded presentation for APIs that are not delivered: campaigns, sample vouchers, sample seller profile and sample ratings/reviews. Those previews are labeled and do not change checkout prices or claim a real discount.

The search UI retains q/category/sort in URL state. The delivered products controller currently supports categoryId/page/size only. Real text search and price/newest sorting require a backend contract extension; mock filtering or URL changes alone do not establish those capabilities. The search results and sidebar now show that limitation, including price/rating/condition/trust preview controls. Query/category chips can be removed independently.

For Buyer Shop #254, a separate Category sort control and complete URL/chip persistence for the additional preview filters are explicitly excluded. Full-database search/filter/sort remains the PRD-08 API dependency; the current URL state is not evidence that the backend applies those options.

Homepage products use one ten-item public query, shared between campaigns, featured products and the initial picks tab. Switching a picks category uses its real categoryId. Active auctions use public `GET /api/v1/auctions?status=ACTIVE&page=0&size=5`, validated against `AuctionController` and `AuctionResponse`, normalized into a separate homepage view model and sorted by closing time. They refresh every 30 seconds and their countdowns stop at zero. Cards link to the catalog item; bidding is not implemented. Auction loading/failure/empty states remain separate from catalog states.

## Detail, money and media

Product cards link using id and slug. The product service validates detail, SKU and image data, normalizing monetary numbers into the UI's decimal-string representation. Existing optional/null rules are retained unless a contract update explicitly requires a change.

The selected SKU is local state. Changing it updates displayed price without issuing another product GET. The selected id falls back to the first available SKU according to the existing helper. Quantity remains an integer of at least 1. The latest develop integration also retains the API's minPrice/maxPrice variant range on product cards/detail alongside the selected SKU price. Variant ranges do not decompose shipping, discounts or fees.

The [product image gallery](product-image-gallery.md) orders images by `sortOrder`, displays a main image and selectable thumbnails, and preserves wrapping arrows and keyboard navigation. `ProductImage` supplies the shared empty/broken-image placeholder. The main image reserves a black square; thumbnails reserve 72px on mobile and 80px from the small breakpoint, so loading and failures do not change media dimensions. Product cards use the first ordered image when one is supplied.

Both delivered detail and list endpoints return `images`: `ProductService.attachImages` batches list media reads and `ProductResponse.images` is recorded in the OpenAPI Product schema. The list parser still accepts omission for older compatible responses, normalizing it to `[]`. Cards use those public Supabase URLs directly and never fetch detail separately for each card. Existing public product GET paths and the shared empty-string base URL fallback stay in place.

Product detail includes keyboard-accessible description/specification/review/shipping tabs. Specifications and description come from the live detail; reviews and seller statistics are explicitly sample content. Recommendations use the current category and exclude the current item. Buy Now performs the existing add-to-cart workflow, then opens checkout only on a current-session success. Product cards save to the shared visit-only watchlist; the shared layout clears it across auth session changes.

The #254 scope keeps the selected SKU price and the labeled sample rating breakdown. A full price breakdown beyond the SKU price and a separate Favorite control on Product Detail are explicitly excluded; the Save/Watchlist control on ProductCard remains part of this task.

`components/formatPrice.ts` preserves string-safe VND formatting. For example `"150000"` becomes `"150.000 ₫"`, `"150000.5"` becomes `"150.000,50 ₫"`, and `"001000.125"` becomes `"1.000,125 ₫"`. It does not round long decimal strings or convert a large integer string through Number. Null/invalid values keep the existing unavailable-price fallback.

`formatVNDRange` compares normalized decimal strings for equality, retaining distinct DECIMAL(19,2) values beyond JavaScript Number precision. Equal values with different leading/trailing zeros collapse to one price without rounding the original boundaries. Product Detail compares the formatted range rather than converting its endpoints to Number; long prices wrap within the available width. The separate `product-price-range.spec.ts` run passed 1/1 for endpoints differing by 0.01, exact selected SKU pricing and no 375px overflow.

## Development and evidence

Product-detail fixtures are explicit development/test setup. Mock mode must be blocked in production and must not require commenting out service code to switch to the real endpoint. Fixtures model the delivered envelope and domain DTO; fake product data is not silently substituted after a real backend failure.

Tests cover tree/page/URL helpers, runtime validation, money normalization, detail request paths, category boundaries, history, mobile overflow and product interactions. Check real backend product/category behavior separately from fixture scenarios and retain the search/sort limitation in the handoff.

The 11 November #254 review run passed all eight focused navigation/preview/media browser scenarios before the last develop merge. The branch first merged `14e4cdae` as `39283809`, then `da482b76` as `4bfcbe7b`; the ProductCard/ProductDetail conflicts preserve aligned cards/Watchlist/sample content/tabs/recommendations while adopting live variant price ranges and selected SKU pricing. After that merge, FE units passed 220/220, inventory passed 128 Surefire plus 10 Failsafe tests and the API contract check passed 82 operations. The broad browser rerun passed 54/54 in 3.9 minutes with 11 dedicated order cases skipped by the default configuration; earlier dedicated-order evidence is historical. The added range-precision UI case passed separately 1/1, rather than as a full 55-case rerun. Final production build, lint, typecheck and generated-type checks passed after the final fixes. Navigation checks cover 375px/768px mobile account/watchlist destinations, focus and dismissal plus the desktop 1440px regression. These results do not establish full-database search/filter/sort. See the repository's [verification report](../../../docs/buyer-shop/verification.md) and [review response](../../../docs/buyer-shop/review-response-20261111.md) for the exact fixture/live evidence boundaries.
