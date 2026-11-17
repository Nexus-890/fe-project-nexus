# Become a seller (#219 / merged #264)

The #227 Admin review queue at `/backoffice/seller-applications` uses the same feature flag and proposed application resource. Only a current `ADMIN` token mounts it. Administrators filter by pending/approved/rejected status, page through business details, confirm approvals, and reject with a required buyer-visible reason. Success refreshes the queue; a 409 decision conflict refreshes the authoritative list and prevents repeating that stale decision. The queue has loading, empty, error/retry and unavailable states and follows the existing Admin semantic colors and compact table style. See the [#210 handoff](../api/seller-application-210.md) for the still-undelivered backend requirements.

`/become-a-seller` uses the existing Account layout, semantic design tokens and shared form controls. The buyer form collects company name, required contact phone and an application note. The frontend reads the current user's application from the API, displays pending/active/rejected state, shows the stored rejection reason and permits a rejected applicant to submit again. It does not depend on the previous page session's submission memory.

Seller applications are disabled by default (`NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false`). With the flag disabled, the page displays a normal availability message and mounts no buyer application request hooks. A token already carrying `SELLER` can still open the existing `/backoffice`. Enable the feature only after #210 implements the compatible contract; the dedicated account tests opt into the proposed API fixture explicitly.

## Frontend flow

The [contract handoff](../api/seller-application-210.md) combines the original issue's buyer `POST /api/v1/sellers/applications` with the proposed authenticated own read `GET /api/v1/sellers/applications/me`. Both return the full application `{id,companyName,phone,note,status,reason}` inside the shared envelope. Status is `PENDING`, `ACTIVE` or `REJECTED`. The frontend maps wire `reason` to its `rejectionReason` UI property and validates the server resource instead of filling missing response fields from the submitted form.

On page entry, the session-scoped query performs the own read. An explicit null response shows the application form; an unavailable route, denied read or malformed body shows an error with retry. Pending state hides the form and allows a fresh status read. Rejected state displays the nonblank reason and offers reapplication. A duplicate POST (`SELLER_APPLICATION_EXISTS`, 409) refreshes the own resource so another tab's pending application is displayed. `ACTIVE` asks the user to sign in again; the existing `SELLER` token opens the back office. The Admin list and approve/reject operations remain inaccessible from the buyer UI.

`queryKeys.account.sellerApplication(sessionId)` and private-query metadata isolate application data to the current account. Queries forward cancellation; mutation AbortControllers and session generation checks prevent late responses from changing a newer account's UI/cache. Profile authentication and tokens remain owned by the existing provider; tokens and application state are not written to web storage.

## Scope and backend dependency

The user explicitly chose frontend and contract work, leaving implementation to backend #210. The [proposed OpenAPI](../api/seller-application-210.openapi.json) and its generated types are a reviewable handoff, separate from the delivered backend specs. No seller controller, migration, database operation or Admin workflow is added by this change. #210 must implement the own read, stored feedback, rejected resubmission, duplicate/ownership enforcement and approval/role assignment before live acceptance can pass.

Historical browser results before this correction covered a submission-only session cache and cannot establish reload or later rejection feedback. Current local tests exercise the proposed complete resource and refresh path. They remain fixture evidence until the real backend is available; see [simulation context](../../postman/simulations/account.context.yaml).

## Verification

`tests/seller-application.test.ts` covers the literal own-read path, current private Bearer rotation, explicit null versus HTTP errors, complete resource parsing and rejected reason, later rejected response on a fresh read, exact allowlisted POST body, server-returned fields instead of submitted fallback, cancellation, defined 409 errors and required phone validation. Run with `npm run test:auth`.

On 2026-11-14, the focused TypeScript compile and Node test execution passed all eight seller transport/schema cases; ESLint passed for that test file. This run exercised the HTTP service against controlled responses, not a live backend.

The account browser suite exercises page reload, fresh rejection feedback and reapplication against a stateful HTTP fixture. Those tests establish what the frontend does under the proposed contract; the backend task must separately prove persistence and authorization. The enclosing verification report records the commands actually executed after this correction.
