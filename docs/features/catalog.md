# Catalog browsing and product detail

Search keeps earlier words as an adjacent phrase and treats the last normalized word as a prefix: `iph` finds `iPhone`, `ao th` finds `Áo thun`, and `Product 1` finds `Product 100`. Punctuation is literal input. `ShopSort`, the typed API sort map and URL validation share `catalogRequestType.ts`; no legacy listProducts type supplies the sort.


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

Search uses the canonical public `GET /api/v1/products/search` endpoint from #215: accent-insensitive phrase matching in the name or description, category/listing-type filters, and any ACTIVE SKU satisfying all price bounds. Sorting still uses the lowest ACTIVE SKU price; displayed prices retain the complete ACTIVE variant range. The service maps existing URL sort values to `relevance`, `newest`, `price_asc` or `price_desc`. The legacy `GET /products` preserves title-substring matching for older clients.

The URL retains query/category/sort/page, listing type and maximum price. Category changes, pagination, header searches and Advanced preserve independent selections and reset the page when a selection changes. Reload and history restore controls from the URL; removing a chip affects only that selection. Feature-owned optimistic state merges rapid changes while URL transitions settle. Invalid values fall back to safe defaults. Listing type follows persisted `auctionEnable`: auction means enabled and Buy Now means disabled; it does not claim a currently active auction. Seller trust, condition and seller rating have no catalog search data, so those controls are disabled and labeled “Not available yet”. Old links containing these unsupported fields are canonicalized without them. Category pages retain their existing separate preview controls.

The canonical `searchProducts` OpenAPI and controller accept `q`, `sort`, `listingType` and `maxPrice` alongside categoryId/page/size. Empty successful searches render “No products found” without an API error; malformed responses and failed HTTP requests remain errors. No client filtering of the current page or fallback products substitute for backend search.

On 2026-11-14, `ProductSearchTest` passed four Spring/HTTP/database scenarios against PostgreSQL 18.6 with Flyway migrations and `ddl-auto=validate`. These exercise literal/case-insensitive matching, visibility, combined filters, stable ordering, paging/counts, full variant ranges, unmatched queries and invalid parameters. Unit tests verify exact public service request serialization and URL normalization. Browser fixtures now apply search filters instead of returning a preselected empty response, while live browser evidence is recorded in the MR validation.

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

ProductCard requires `maxPrice` (nullable), matching ProductSummary and develop; callers provide the field explicitly. Browser evidence belongs on [issue #254](https://git.fsoft-academy.edu.vn/hcm26_cpl_java_11/hcm26_cpl_java_11_group_5/-/issues/254). Tests attach regenerated screenshots to ignored Playwright results rather than storing images in source control. Fixture results establish frontend behavior, not live full-dataset search/filter/sort or payment settlement.
