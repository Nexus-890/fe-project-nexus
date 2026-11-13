# Account verification (#219)

After registration, `/check-email?email=...` explains verification and offers a
public resend action. The email can be corrected; responses avoid revealing
whether an account exists. The UI waits at least one minute between sends and
honors a longer server cooldown. It does not sign the user in after registration.

Profile includes a separate phone verification card. It reads authoritative
verification status, sends a code to a normalized phone and confirms the code
against the same phone. Changing the number hides that code form and removes
the verified indicator. Confirmation refreshes the profile; the browser never
marks a phone verified locally. OTP values are transient form state only.

These operations are **proposed integration boundaries for backend #210**,
which is absent from the delivered user-service controller and OpenAPI on the
develop base `09b3cf6f`. They use the existing shared API origin/envelope; no
backend endpoints, database fields or generated DTOs are invented here.

| Operation | Proposed request | Envelope data |
| --- | --- | --- |
| POST `/api/v1/auth/verification-email/resend` (public) | `{email}` | `{retryAfterSeconds,expiresInSeconds}` |
| GET `/api/v1/users/me/phone-verification` | None | `{phone,verified}` |
| POST `/api/v1/users/me/phone-verification/send` | `{phone}` | `{retryAfterSeconds,expiresInSeconds}` |
| POST `/api/v1/users/me/phone-verification/confirm` | `{phone,code}` | `{phone,verified}` |

Protected calls use the current session; error responses keep Problem Details
and status codes. Missing APIs show a retryable error and never become fake
success. An invalid code/expiry remains a server rejection. The server owns
the 5-minute lifetime, hashed storage, 6th-attempt refusal, 4th-send refusal in
15 minutes, phone uniqueness and atomic phone-change/verification behavior.
`confirm` is proposed to commit the new phone only after a successful code.
The FE currently assumes six numeric digits; #210 must confirm that contract.

No `verifyEmail` change is made to the local realm: #210 must enable verification
for new accounts, preserve verified seeded demo users, send one-use links and
enforce resend throttling. Flipping the realm flag alone would strand new users
without the backend resend operation. Keycloak password recovery/theme setup
is documented in [password pages](password-pages.md).

Run `npm run test:auth` for transport/parser regressions and `npm run test:account`
for the real frontend against the explicit Postman stand-ins. Simulation results
do not establish Mailpit delivery, real OTP storage/limits, identity ownership,
or live sign-in gating. Those remain acceptance work with #210.
