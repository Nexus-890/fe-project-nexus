# Seller status review follow-up (#219 / #264)

The review of `8a86cf26` correctly identified that a submission acknowledgement
in the query cache cannot show later rejection feedback after reload. The user
chose **frontend and contract only; backend #210 implements the API**.

The buyer page now reads `GET /api/v1/sellers/applications/me` on entry, reload,
window focus and explicit **Check status**. Only `200` with `data: null` shows
the initial form; a missing route or failed read shows retry feedback. The read
uses the scoped Bearer and no caller-supplied user ID or Admin list operation.

Both own read and POST use the complete server resource, including company,
phone, note, status and rejection reason. A `REJECTED` result must include a
nonblank reason; the UI displays it and offers **Submit new application**.
The proposed resubmission retains the application ID, returns `PENDING` and
clears the reason. A duplicate POST refetches the authoritative own resource.
The cache no longer acts as the source of application status.

Private session keys, read cancellation and generation checks preserve account
isolation. Submission cancels older reads before and after POST so a stale read
cannot overwrite the new result. While a status read fails or is pending, the
page does not expose a potentially stale submission form.

The [OpenAPI proposal](api/seller-application-210.openapi.json) defines the new
own read, full DTO, explicit null state, no-store response, duplicate handling
and rejected resubmission. Generated aliases are separate from delivered DTOs.
See the [backend handoff](api/seller-application-210.md) for #210 responsibilities.
This is a proposed integration contract, not a shipped backend endpoint.
`NEXT_PUBLIC_SELLER_APPLICATION_ENABLED` remains false by default.

On 2026-11-14, all 286 unit tests and generated DTO drift checks passed. The
account browser suite passed 23 scenarios, including ten seller cases: reload
without another POST, stored rejection and resubmission with the same ID,
navigation away/back, manual status refresh, read and write retries, duplicate
refresh, approval/new sign-in, existing seller access and two distinct JWT
subjects seeing separate records. The stateful Postman handler models backend
responses and an explicit test-only decision control; it does not exercise a
real Admin rejection endpoint or database persistence/authorization.

OpenAPI response validation also accepts the explicit null and complete-record
examples and rejects incomplete/non-record values. Final lint, regenerated-route
typecheck, generated DTO drift check and production build passed. The catalog
regression passed 55 scenarios with 38 existing configured skips. Reviewed mobile
rejection/reapplication and desktop pending-after-reload screenshots match the
existing account styling. No temporary test routes/config files are committed.

No backend service source, migration or gateway permission is changed. #210 must
implement and verify the own read and full lifecycle before live acceptance.
