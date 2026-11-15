# #219 review corrections (2026-11-14)

The seller portion has a [follow-up correction](account-219-seller-followup.md):
the buyer now performs a proposed own-application read on entry, reload and
refresh, displays the server rejection reason and can resubmit. The user chose
frontend and contract only; #210 must implement that API. Seller remains off by
default until a compatible backend is available. The submission-only behavior
described below records the earlier `8a86cf26` correction and is superseded.

Reviewer feedback on 44db51eb was correct: fixtures validated invented account
routes and registration could strand users on develop. Earlier simulation
success does not establish backend compatibility. This report supersedes the
original verification report's contract claims.

Changes:
- Default develop registration 201 returns to sign-in. With the #210 integration
  enabled, 201 opens check-email. USER_VERIFICATION_EMAIL_FAILED also opens a
  recovery screen explaining the account exists and offers resend without
  another registration.
- Email resend POST /api/v1/auth/verification-email accepts 204 with no data.
- OTP send POST /api/v1/users/me/phone/verification has no body; 202 carries
  phone/expiresAt. Confirm sends only {code} and reads phone/phoneVerifiedAt.
  Status comes from profile; changing phone first saves through profile PUT.
- Saved-address wire phone maps to UI phoneNumber; timestamps and page metadata
  are parsed. Default uses POST. Validation follows backend address limits.
- Seller form sends companyName/phone/note to /api/v1/sellers/applications.
  No buyer GET is invented: issue #210 only defines an Admin list. Later buyer
  status/rejection reads and the response DTO remain contract dependencies.
- Existing seller token access is preserved. No admin approval UI/API is added
  here (#227 owns that frontend scope).

Source: backend branch #210 commit 1e480dda3a6519e97a132347e01db278dbd822e9 and
the issue #210 text provided by the user. Exact selected OpenAPI is pinned in
[account snapshot](api/account-210.openapi.json), generated independently from
delivered develop DTOs. No backend commits are merged into this frontend branch.

Configuration: NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED=false by default;
NEXT_PUBLIC_SELLER_APPLICATION_ENABLED=false by default. Enable only with an
agreed compatible backend. The account simulation enables both explicitly.
The real user-service on develop has neither extension, so registration and
manual checkout remain usable without unsupported requests.

Lint, typecheck and 283 unit tests passed. The corrected account browser suite
passed 18 scenarios, including 502 recovery with exactly one registration, a
bodyless 204 resend, exact seller POST/no Buyer GET, profile phone changes and
POST default-address requests. These exercise the actual frontend against
source-aligned Postman dependencies, not the real user-service.

Live native Keycloak 26.7.5/Mailpit 1.31 acceptance passed six check groups:
SMTP reset delivery, themed policy rejection, reset/new-password sign-in and
old-password refusal, consumed/expired action handling, validated account-console
referrer, and verification email setting the real user's emailVerified flag.
The isolated test used temporary processes/data and cleaned them up.

Live Keycloak/Mailpit results
are recorded separately in [password pages](features/password-pages.md). These
checks do not prove live backend #210 OTP storage/rate limits, cross-user address
isolation, GHN pricing or Admin seller role assignment.

Default configuration browser check passed: no unsupported account API request
and a usable sign-in path. The existing checkout regression passed 24 scenarios.
The other 25 auth scenarios passed in the combined run; the new default guard
case passed on its focused rerun after waiting for session response completion.
The catalog rerun was interrupted by the existing Next startup advisory; its
previous 55 passes/38 configured skips remain historical, not a current pass.

Final lint, regenerated-route typecheck, generated DTO drift check and production
build passed. The build generated 28 pages; no temporary test routes/configs are
included. Next's existing startup/security advisory required an unchanged build
retry; no dependency version or advisory handling was altered in this task.
