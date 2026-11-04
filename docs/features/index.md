# Frontend features

| Feature | Flow and implementation |
| --- | --- |
| [Authentication](authentication.md) | Sign-up/sign-in forms, in-memory session, profile retry, logout and account isolation |
| [Catalog](catalog.md) | Home/category navigation, listings, URL filters/paging, product/SKU/image presentation |
| [Product image gallery](product-image-gallery.md) | Ordered detail images, thumbnails, card image fallback and the pending list-image backend dependency |
| [Cart](cart.md) | Cart page/header count, snapshot prices, optimistic edit/remove and rollback; [implementation report](cart-page-implementation.md) records merged BE source mappings and remaining build/auth/response compatibility blockers |
| [Checkout](checkout.md) | Validated address form, locality selectors, snapshot order summary and shipping preview; #188/#201 remain provisional dependencies |

These pages document the frontend behavior that exists in source. They identify development fixtures and backend gaps explicitly. A backend service or a requirement reference does not mean its frontend feature is implemented. Order placement, payment execution, carrier booking, auction bidding, forgotten-password recovery and persistent/refresh-token login remain outside the current frontend implementation scope.

Use [functional requirements](../requirement/functional.md) to assess coverage, [API contract](../api/api-contract.md) to check request/response behavior, and the owning feature/component source to confirm current details.
