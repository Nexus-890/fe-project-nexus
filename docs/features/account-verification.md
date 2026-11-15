# Account verification (#219 review correction)

The default develop backend does not implement verification. Keep
NEXT_PUBLIC_ACCOUNT_EXTENSIONS_ENABLED=false (the default): registration 201
continues to sign-in, Profile does not call OTP APIs and checkout does not read
saved addresses. Enable it only with the compatible #210 backend.

When enabled, registration 201 opens /check-email. A 502 with symbolic code
USER_VERIFICATION_EMAIL_FAILED also opens that screen, showing that the account
was kept and offering resend after the minute cooldown. It never repeats
registration or claims the initial email arrived. Resend does not expose whether
an account exists and accepts the backend's bodyless 204 success.

The source is backend #210 commit 1e480dda3a6519e97a132347e01db278dbd822e9:
controller/DTO checks match the pinned [OpenAPI snapshot](../api/account-210.openapi.json).
Generated aliases live in types/account210GeneratedType.ts; regenerate with
npm run generate:types. The snapshot is explicitly unmerged and does not change
the delivered develop contract.

| Operation | Request | Response |
| --- | --- | --- |
| POST /api/v1/auth/verification-email (public) | {email} | 204, no body |
| POST /api/v1/users/me/phone/verification | No body; uses profile phone | 202 envelope {phone,expiresAt} |
| POST /api/v1/users/me/phone/verification/confirm | {code} only | 200 envelope {phone,phoneVerifiedAt} |

Phone status comes from users/me.phoneVerifiedAt; there is no invented status
GET. Saving a changed phone uses PUT /api/v1/users/me {phone} first, which clears
verification server-side. A subsequent send targets that saved phone. The code
form is bound to the returned phone and expiresAt; confirmation refreshes the
profile. The browser never persists OTP values or locally fabricates verification.

The server owns the five-minute lifetime, hashed storage, a maximum of five attempts,
a maximum of three sends in 15 minutes, uniqueness and atomic phone changes. UI cooldowns and
modeled PHONE_CODE_INVALID/EXPIRED/RATE_LIMITED failures do not prove enforcement.
Resend handles USER_VERIFICATION_EMAIL_FAILED and USER_VERIFICATION_EMAIL_RATE_LIMITED.

The realm verifyEmail flag on develop is preserved; #210 must supply its realm,
seed and registration changes together. See [password pages](password-pages.md)
for live Keycloak/Mailpit evidence; that evidence is separate from the Next
frontend/Postman checks and does not prove #210 backend integration.
