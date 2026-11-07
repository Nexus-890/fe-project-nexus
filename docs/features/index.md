# Frontend features

| Feature | Flow and implementation |
| --- | --- |
| [Authentication](authentication.md) | Sign-up, Keycloak OIDC sign-in, in-memory session, profile retry, logout and account isolation |
| [Session restore and silent renewal](session-restore.md) | Restore the provider SSO session on reload, renew in-memory tokens and replay a protected request once after 401 |
| [Profile](../profile-page.md) | Authenticated profile, supported partial updates, shared header data, validation and retry |
| [Catalog](catalog.md) | Home/category navigation, listings, URL filters/paging, product/SKU/image presentation |
| [Product image gallery](product-image-gallery.md) | Ordered detail images, thumbnails, card image fallback and the pending list-image backend dependency |
| [Cart](cart.md) | Shared header count, snapshot prices, optimistic edit/remove and rollback with session isolation; [implementation report](cart-page-implementation.md) separates dated evidence from pending live acceptance |
| [Checkout](checkout.md) | Address validation, locality selection and order summary; #201 shipping remains provisional |
| [Place order](place-order.md) | Idempotency key reuse, price confirmation, stock feedback and payment handoff |
| [Notifications](notifications.md) | Header unread count/latest ten, single-read/mark-all actions, list/count refetch and session isolation |

These pages document the frontend behavior that exists in source. They identify development fixtures and backend gaps explicitly. A backend service or a requirement reference does not mean its frontend feature is implemented. Payment execution, carrier booking, auction bidding and forgotten-password recovery are outside the current frontend implementation scope. Authentication tokens stay in memory; reload restoration uses the provider's SSO session.

Use [functional requirements](../requirement/functional.md) to assess coverage, [API contract](../api/api-contract.md) to check request/response behavior, and the owning feature/component source to confirm current details.

- [Guest cart and merge after sign-in](guest-cart.md)
