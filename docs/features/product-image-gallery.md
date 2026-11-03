# Product image gallery

## Behavior and scope

Product detail renders a main image and selectable thumbnails from the product response. Images are sorted by ascending `sortOrder` without mutating the response; equal orders retain their input order. Clicking a thumbnail changes the main image locally. Previous/next buttons wrap, and left/right keyboard controls retain the existing behavior. Cards display the first ordered image supplied in their summary.

`components/ProductImage.tsx` provides the same placeholder for no URL and a failed image request, including HTTP 404. Main images, thumbnails and cards use that fallback. A failed URL must not trigger an endless replacement/retry loop or an uncaught page error. Browser network tooling can still report the failed HTTP request.

The gallery uses a black square main area with contained images and a horizontal thumbnail strip: 72px square on mobile, 80px from the small breakpoint. Media space is reserved before loading, including the card's existing media height. At 375px wide, loading, successful images and fallback states retain their bounds; the thumbnail strip scrolls within the gallery. This task covers gallery media and card images. Existing product information, SKU selection, quantity controls and page composition remain owned by the product detail feature.

## API readiness

Source audit on 2026-11-02:

| Capability | Delivered source | Frontend behavior |
| --- | --- | --- |
| Public product detail | `GET /api/v1/products/{id}` returns `images: [{id,imageUrl,sortOrder}]`; ProductService sorts by sortOrder then id | `getProduct` uses the existing endpoint and validates image records; gallery renders those URLs |
| Public product list | `GET /api/v1/products` returns ProductResponse without image fields | `getProducts` accepts validated optional `images`, normalizing omission to `[]`; current backend responses show card placeholders |
| Image upload and list images | BE task #122 adds upload support and batched list images, but is absent from the checked-out backend | No upload UI or fabricated image endpoint is added; card pictures depend on that backend response becoming available |

Evidence comes from [ProductController](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/controller/ProductController.java), [ProductService](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/service/ProductService.java), [ProductResponse](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/dto/response/ProductResponse.java), [ProductDetailResponse](../../../be-project-nexus/catalog-service/src/main/java/com/group5/catalogservice/product/dto/response/ProductDetailResponse.java) and the delivered [catalog OpenAPI](../../../be-project-nexus/docs/api/openapi/catalog-service.yaml). The gateway permits product list/detail GET requests publicly; image display does not require adding a Bearer token.

The optional summary image array is an application-model extension using the existing image record shape. It does not claim the delivered list DTO already contains images, and generated wire types remain tied to the delivered OpenAPI. Malformed supplied image records must still fail runtime validation.

`configs/api.ts` remains the single HTTP configuration boundary. `API_BASE_URL` resolves `NEXT_PUBLIC_API_URL`, then `NEXT_PUBLIC_API_BASE_URL`, then `""`. Product services keep their actual `/api/v1/products` paths. No additional media request is necessary: thumbnails and cards consume returned URLs directly. Do not issue one product-detail GET per card. Backend storage credentials belong on the backend and are not needed in the frontend.

## Ownership

| File | Responsibility |
| --- | --- |
| `service/catalogService.ts` | Product requests and runtime image validation/normalization |
| `types/catalogResponseType.ts` | Normalized summary/detail models and shared image type |
| `components/ProductImage.tsx` | Image rendering and empty/broken URL fallback |
| `components/productImageUtils.ts` | Shared stable, non-mutating image ordering |
| `components/ProductGallery.tsx` | Ordered main image, thumbnails and local selection/navigation |
| `components/ProductCard.tsx` | First ordered summary image and reserved card media area |
| `features/ProductDetailPage.tsx` | Product query and passing detail image data to the gallery |

## Acceptance and verification

Verify these scenarios against controlled image responses:

1. Three images supplied out of order render in ascending sortOrder; clicking each thumbnail selects its main image. Equal sort orders are stable.
2. A card displays the first ordered summary image without a product-detail request.
3. A product with no images shows placeholders on its page and card; omission of list images remains compatible with the delivered backend.
4. HTTP 404 images show the placeholder in the main area, thumbnail and card with no uncaught page error.
5. At 375px wide, delayed loading and fallback retain media bounds and do not create page overflow.
6. Wrapping arrow buttons and keyboard navigation continue to work.

Verification completed on 2026-11-03:

| Check | Result and scope |
| --- | --- |
| `npm run test:unit` | 54 passed, compared with 51 before the gallery edits; 55 passed with `NEXUS_SIM_ORIGIN` enabling the existing Postman HTTP check |
| `npm run typecheck` and `npm run generate:types:check` | Passed; regenerated route types and delivered wire DTOs remain consistent |
| `npm run lint -- --ignore-pattern '.next*/**'` | Passed; plain lint encounters 395 errors and 7,447 warnings solely in the pre-existing untracked `.next-cart-readiness-build` generated output, which was preserved |
| `npm run test:catalog` | All 20 browser scenarios passed: seven gallery and 13 existing scenarios |
| `npm run build` with `NEXUS_TEST_DIST_DIR=.next-verify-build` | Passed production build |
| Visual inspection | Mobile 375px and desktop gallery screenshots in `test-results` inspected; colored SVG fixtures retained the intended aspect bounds, ordering and thumbnail layout |

The first browser run passed 19 of 20 scenarios: the new request-count assertion assumed a single initial GET, while development Strict Mode mounted twice. The corrected assertion compares the count before and after gallery interactions; the final suite passed. Subsequent browser/build attempts initially stopped at the installed Next CLI's agent upgrade reminder. Final runs used `CI=true` and `__NEXT_AGENT_UPGRADE=security` for noninteractive execution without changing dependencies. The CLI's security-upgrade recommendation remains outside this gallery task's investigation and fixes.

These results establish frontend behavior against controlled responses, including current list responses without images and anticipated task #122 list images. Screenshots use red/green/blue test SVGs, not production artwork. No live backend integration was verified: local ports 8080, 8082 and 8083 were not listening. Live upload/storage readiness and live card pictures remain pending the backend/environment dependency described above.
