# Seller application contract for #210

This document distinguishes the original issue requirements from the proposed frontend contract addition needed by #219/#264. On 2026-11-14 the user explicitly selected **frontend and contract only; backend implementation belongs to #210**. No seller backend implementation or live acceptance is claimed here.

## Operations from the issue

The user supplied these #210 operations during review:

| Operation | Access | Request / behavior |
| --- | --- | --- |
| POST `/api/v1/sellers/applications` | BUYER | `{companyName, phone, note}`. At most one open application per buyer. |
| GET `/api/v1/sellers/applications?status&page&size` | ADMIN | List/filter seller applications. Buyers must not use this resource to read their own status. |
| POST `/api/v1/sellers/applications/{id}/approve` | ADMIN | Approve a pending application. |
| POST `/api/v1/sellers/applications/{id}/reject` | ADMIN | `{reason}`. Reject a pending application. |

The issue places application data on the seller row, reusing #257's seller profile, with statuses `PENDING`, `ACTIVE` and `REJECTED`. It defines `SELLER_APPLICATION_EXISTS` (409) for a second open application and `SELLER_APPLICATION_NOT_PENDING` (409) for deciding an application that is no longer pending.

The original issue does not define a buyer own-application read or a complete response DTO. A submission acknowledgement stored in browser memory cannot satisfy reading the review result after reload. Calling the Admin list as a buyer would violate the issue's authorization boundary.

## Proposed own-application contract

The [proposed OpenAPI](seller-application-210.openapi.json) adds the following read and defines a complete resource returned by the read and submission. This file is a frontend handoff proposal for #210, separate from the delivered backend OpenAPI. Generated `sellerApplication210GeneratedType.ts` types reflect this proposal; they do not certify that a controller is deployed.

| Operation | Proposed response / access |
| --- | --- |
| GET `/api/v1/sellers/applications/me` | Authenticated current subject only. `200 {code,message,data:null}` if there is no application; otherwise the full resource below. It accepts no caller-supplied owner id. |
| POST `/api/v1/sellers/applications` | Existing buyer operation. Return the complete application resource after creation or rejected-application resubmission. |

The application resource is `{id,companyName,phone,note,status,reason}`. `reason` is nullable for `PENDING`/`ACTIVE`; `REJECTED` requires a nonblank reason so the buyer can act on the feedback. No timestamp is required. Application reads and submissions use the existing Nexus success envelope. A missing operation (404), denied access or malformed response remains an error; none is interpreted as an empty application.

The buyer page reads this resource on load and supports explicit refresh, including after a duplicate submission. It renders rejection feedback and permits reapplication after an authoritative `REJECTED` read. Approval remains distinct from the current token's role: after reading `ACTIVE`, the user signs in again before using seller back office. The frontend never calls the Admin list/decision resources.

## Backend #210 work still required

Repository inspection found no seller application entity/table/controller/DTO/OpenAPI in `origin/develop` (`09b3cf6f`), the fetched #210 branch (`1e480dda`), #211 (`d277baee`), or the 95 available merge-request head refs. The issue's #257 profile is therefore a dependency to reuse when delivered; this frontend does not invent a replacement backend table.

#210 must implement and persist the issue lifecycle plus the proposed own read, including authenticated-subject ownership, one-open enforcement under concurrent submission, stored rejection reason, rejected-to-pending resubmission, Admin-only decisions and Keycloak seller role assignment. The owning backend must publish the final OpenAPI and verify the contract against its controller/DTOs and database. Keep `NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false` until that compatible implementation is deployed.

Local transport and browser tests demonstrate frontend behavior against the explicit contract fixture. They do not establish real persistence, cross-user authorization, administrative rejection or approval, role provisioning or release readiness.
