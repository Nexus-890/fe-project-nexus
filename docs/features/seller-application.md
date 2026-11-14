# Become a seller (#219 / merged #264)

`/become-a-seller` uses the existing Account layout, semantic design tokens and shared form components. The form collects company name, contact phone and an application note. Phone input is required and normalized before submission. A current token with the `SELLER` role can open the existing `/backoffice`; the frontend never assigns a role or offers approval controls.

Seller applications are disabled by default (`NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false`). With the flag disabled, opening the page displays a normal availability message and mounts no seller request hooks. Existing seller role navigation remains usable. Do not enable the flag in a production deployment until #210's seller controller and response DTO are agreed and deployed. The account test configuration explicitly opts into the issue model.

## Issue contract and delivery boundary

The [user supplied #210 snapshot](../api/seller-application-210.md) defines buyer `POST /api/v1/sellers/applications` with exactly `{companyName,phone,note}`, one open application, and `SELLER_APPLICATION_EXISTS` (409). Status names are `PENDING`, `ACTIVE`, `REJECTED`. The list `GET /api/v1/sellers/applications?status&page&size` and approve/reject resources are **Admin only**. No buyer own-status GET is defined, so this page never reads the admin list or invents a separate own-application resource.

The successful submission acknowledgement stays in the current session's private query cache. Navigating within that session preserves the submitted state; reloading clears that memory. A subsequent duplicate submission shows the already-open state from the defined 409 without attempting a forbidden status read. An existing `SELLER` token exposes the back-office link. Reading later rejection feedback or a later approval status as a buyer remains a #210 contract dependency; the frontend cannot infer that state from an admin-only list.

As of backend branch `1e480dda` and develop `09b3cf6f`, no seller-application controller/DTO/OpenAPI is delivered. The HTTP service uses the exact issue POST path/body and expects the minimal acknowledgement `{id,status}` in the shared envelope, using submitted input for local form details. It does not require an invented timestamp. Optional response `reason` is retained only as a provisional local UI field; its actual DTO name still needs agreement. Unknown/malformed responses are rejected. The app does not import or silently enable a production mock.

`queryKeys.account.sellerApplication(sessionId)` and private-query metadata scope submission acknowledgement to the current account. Mutations have an AbortController and check the session generation before changing cache or displaying feedback; switching accounts remounts form state and clears private data. Tokens are never persisted.

## Verification

`tests/seller-application.test.ts` checks the literal issue path/body and status vocabulary, current Bearer rotation, the absence of buyer GET calls, input allowlisting/normalization including required contact phone, cancellation, envelope/acknowledgement parsing and the defined 409 codes. Run it with the existing `npm run test:auth` unit runner.

The account browser suite models buyer submission, duplicate responses and existing seller role routing. Its POST acknowledgement is still a fixture assumption until the owning API delivers its DTO. Historical 2026-11-14 results before this correction used an unconfirmed path and are not evidence of compatibility with the #210 issue. Current verification is recorded in [simulation context](../../postman/simulations/account.context.yaml) after the corrected suite runs.

Backend #210 owns seller persistence, one-open enforcement, admin authorization, role assignment and an agreed way for buyers to read approval/rejection feedback. Those guarantees are not established by the local UI tests.
