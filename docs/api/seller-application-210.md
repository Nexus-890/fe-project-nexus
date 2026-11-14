# Seller application contract from issue #210

Source: the user supplied the #210 issue text during the review correction on 2026-11-14. This is an issue contract snapshot, not a delivered controller or generated OpenAPI response schema.

| Operation | Access | Request / behavior |
| --- | --- | --- |
| POST `/api/v1/sellers/applications` | BUYER | `{companyName, phone, note}`. At most one open application per buyer. |
| GET `/api/v1/sellers/applications?status&page&size` | ADMIN | List/filter seller applications. Buyers must not use this resource to read their own status. |
| POST `/api/v1/sellers/applications/{id}/approve` | ADMIN | Approve a pending seller application. |
| POST `/api/v1/sellers/applications/{id}/reject` | ADMIN | `{reason}`. Reject a pending application. |

Application data belongs on the existing seller row, reusing #257's seller profile. Its statuses are `PENDING`, `ACTIVE` and `REJECTED`. The issue defines `SELLER_APPLICATION_EXISTS` (409) for a second open application and `SELLER_APPLICATION_NOT_PENDING` (409) for deciding an application that is no longer pending.

The issue text does not define a buyer own-application GET resource or a complete response DTO, timestamp fields, pagination response or the field used to read a rejection reason. No such operation or field is treated as delivered by this frontend.

Repository inspection on 2026-11-14 found no seller-application controller, DTO or OpenAPI in `origin/develop` (`09b3cf6f`) or the backend #210 branch (`1e480dda`). All remote heads were inventoried; no #257/#264 seller-application branch was available. The seller feature therefore remains disabled by default while this contract is completed. The isolated browser fixture models a minimal POST acknowledgement `{id,status}` only; this response shape still needs confirmation against the eventual seller DTO.
