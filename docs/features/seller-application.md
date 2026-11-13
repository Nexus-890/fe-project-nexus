# Become a seller (#219 / merged #264)

`/become-a-seller` uses the existing Account layout, semantic design tokens and shared form components. A buyer can submit shop details, see a pending application, read the rejection reason and apply again. The form is hidden while an application is pending. A duplicate POST (409) reloads the current application instead of presenting a successful submission. After approval, the page asks the user to sign in again; a token with the `SELLER` role exposes the existing `/backoffice` link. The frontend never assigns a role or offers approval controls.

Authentication comes from the scoped provider. Queries use `queryKeys.account.sellerApplication(sessionId)` with private-query metadata. Mutations have an AbortController and check the session generation before changing cache or displaying feedback; switching accounts remounts form state. Tokens are never persisted.

## Provisional integration boundary

At the `develop` baseline used for this change, neither the delivered [user-service OpenAPI](../../../be-project-nexus/docs/api/openapi/user-service.yaml) nor its controllers implement the #210 seller-application resource. The following boundary is explicit frontend preparation, not a claim that the backend has shipped. The application model is not a parallel generated DTO; replace the boundary with generated types after #210 delivers the agreed OpenAPI and #257 seller profile.

| Method / resource | Expected behavior |
| --- | --- |
| GET `/api/v1/users/me/seller-application` | Protected current-user application; `data: null` means no application |
| POST `/api/v1/users/me/seller-application` | Protected buyer submission `{shopName, description}`; trimmed input, 201 envelope; a second open application returns 409 |

JSON uses the common `{code,message,data}` envelope. Application data is `{id,shopName,description,status,rejectionReason,submittedAt}`. Status is `PENDING`, `APPROVED` or `REJECTED`; `submittedAt` is a parseable timestamp and a rejected application must include a nonblank reason. Unknown/malformed responses are rejected. A 404 is displayed as an API failure so a missing endpoint cannot silently appear as an empty application. No production mock or automatic success fallback is enabled. There are no new backend routes or config keys in this change.

Backend #210 owns ownership/authorization, duplicate enforcement, admin-only approval and rejection, persistence and assigning the Keycloak seller role. Real approval and new-sign-in acceptance remain dependent on that backend. #219 covers buyer UI and handling its responses.

## Verification

`tests/seller-application.test.ts` covers response parsing for all states, required rejection feedback, explicit empty state versus missing endpoint, request allowlisting/normalization, Bearer rotation, abort propagation, malformed envelopes, forbidden/duplicate errors and form validation. Run with the existing `npm run test:auth` unit runner. On 2026-11-14, `npm run test:account` passed all 16 browser scenarios, including buyer input validation, persisted pending state, rejected reapplication, duplicate refresh, API retry and approval followed by a new sign-in to seller back office. The [simulation context](../../postman/simulations/account.context.yaml) records exact scope; fixture evidence does not establish live #210 authorization or role assignment.
