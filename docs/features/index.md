# Frontend features

| Feature | Flow and implementation |
| --- | --- |
| [Authentication](authentication.md) | Sign-up/sign-in forms, in-memory session, profile retry, logout and account isolation |
| [Catalog](catalog.md) | Home/category navigation, listings, URL filters/paging, product/SKU/image presentation |
| [Cart](cart.md) | Anonymous sign-in prompt and authenticated add-item request |
| [Notifications](notifications.md) | Header unread count/latest ten, session isolation and intentionally pending read-status URLs |

These pages document the frontend behavior that exists in source. They identify development fixtures and backend gaps explicitly. A backend service or a requirement reference does not mean its frontend feature is implemented. Order checkout, payment, shipping, auction bidding, forgotten-password recovery and persistent/refresh-token login are outside the current frontend implementation scope.

Use [functional requirements](../requirement/functional.md) to assess coverage, [API contract](../api/api-contract.md) to check request/response behavior, and the owning feature/component source to confirm current details.
