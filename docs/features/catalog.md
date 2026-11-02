# Catalog browsing and product detail

## Routes and responsibilities

| Route | Behavior |
| --- | --- |
| `/` | Public category navigation/tree |
| `/categories/[slug]` | Server category resolution, then client product listing |
| `/category/[slug]` | Preserved redirect alias |
| `/search` | URL-controlled query/category/sort/page and API-backed listing |
| `/products/[slug]?id=...` | Product detail by explicit id; UUID suffix links remain supported |

`CategoryPage` uses the pure catalog service on the server. Resolve category by public slug or id in the nested tree, including existing `slug=` compatibility links. Unknown category calls `notFound`; an API failure goes to the route error boundary. Client hooks do not run in server category resolution.

The shop layout owns auth/category query state and passes props to the header/navigation. UI components do not call transport functions. Category tree loading/errors and product loading/errors remain independent, with explicit retry.

## Listing and URL helpers

Services call public category/product endpoints and validate returned data before rendering. Product requests use API page zero-based and catalog size 12. URL page starts at 1; invalid, zero, negative, fractional, exponent, array or overflowing page values fall back to 1 according to `parsePage`.

`features/catalogUtils.ts` preserves:

- Recursive `findCategory` matching slug or id.
- Depth-first `flattenCategories` with depth metadata and no mutation of the input tree.
- `readQueryValue` selecting the first array item, trimming, and using an empty-string fallback.
- Encoded category path segments and search query parameters.
- Pagination/filter links and browser history; page 1/query-empty URL conventions remain stable.

Page-out-of-range, empty results, malformed response and API failure have distinct UI states. Do not inject demo products or promotional data to make a page look populated.

The search UI retains q/category/sort in URL state. The delivered products controller currently supports categoryId/page/size only. Real text search and price/newest sorting require a backend contract extension; mock filtering or URL changes alone do not establish those capabilities.

## Detail, money and media

Product cards link using id and slug. The product service validates detail, SKU and image data, normalizing monetary numbers into the UI's decimal-string representation. Existing optional/null rules are retained unless a contract update explicitly requires a change.

The selected SKU is local state. Changing it updates displayed price without issuing another product GET. The selected id falls back to the first available SKU according to the existing helper. Quantity remains an integer of at least 1. The gallery preserves image selection, previous/next wrapping, keyboard controls and empty-media placeholder.

`components/formatPrice.ts` preserves string-safe VND formatting. For example `"150000"` becomes `"150.000 ₫"`, `"150000.5"` becomes `"150.000,50 ₫"`, and `"001000.125"` becomes `"1.000,125 ₫"`. It does not round long decimal strings or convert a large integer string through Number. Null/invalid values keep the existing unavailable-price fallback.

## Development and evidence

Product-detail fixtures are explicit development/test setup. Mock mode must be blocked in production and must not require commenting out service code to switch to the real endpoint. Fixtures model the delivered envelope and domain DTO; fake product data is not silently substituted after a real backend failure.

Tests cover tree/page/URL helpers, runtime validation, money normalization, detail request paths, category boundaries, history, mobile overflow and product interactions. Check real backend product/category behavior separately from fixture scenarios and retain the search/sort limitation in the handoff.
