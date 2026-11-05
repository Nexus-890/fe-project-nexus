# Frontend features

| Feature | Flow and implementation |
| --- | --- |
| [Authentication](authentication.md) | Sign-up/sign-in forms, in-memory session, profile retry, logout and account isolation |
| [Catalog](catalog.md) | Home/category navigation, listings, URL filters/paging, product/SKU/image presentation |
| [Product image gallery](product-image-gallery.md) | Ordered detail images, thumbnails, card image fallback and the pending list-image backend dependency |
| [Cart](cart.md) | Shared header count, snapshot prices, optimistic edit/remove and rollback with session isolation; [implementation report](cart-page-implementation.md) separates dated evidence from pending live acceptance |
| [Profile](../profile-page.md) | Read/edit supported profile fields and synchronize the header |

These pages document the frontend behavior that exists in source. They identify development fixtures and backend gaps explicitly. A backend service or a requirement reference does not mean its frontend feature is implemented. Order checkout, payment, shipping, auction bidding, forgotten-password recovery and persistent/refresh-token login are outside the current frontend implementation scope.

Use [functional requirements](../requirement/functional.md) to assess coverage, [API contract](../api/api-contract.md) to check request/response behavior, and the owning feature/component source to confirm current details.

- [Session restore and silent renewal](session-restore.md)
- [Guest cart and merge after sign-in](guest-cart.md)
