# Authentication

## Scope and routes

`/sign-up` and `/sign-in` are outside the shop chrome. `/register` and `/login` remain redirect aliases. Forms use React Hook Form and Zod; their schemas live in flat feature files. The frontend does not assign a role in registration.

Registration submits the delivered request, including fullName/email/phone/password/identityNumber/gender/address/dateOfBirth. Confirmation password and terms acceptance are form concerns unless the delivered API explicitly changes. Preserve trimming, required/email/phone rules, password checks, matching confirmation and terms validation when moving schemas.

Register success routes to sign-in and does not automatically authenticate. Server field validation and duplicate symbolic codes are mapped to the correct inputs, preserving aliases and form-level fallback. The sign-in form submits credentials and delegates session ownership to the provider.

## Session workflow

```text
Root layout -> Provider -> QueryClientProvider -> inner auth session -> feature

signIn -> login service -> generation check -> memory token
       -> profile service through shared query cache -> generation check -> user result
```

Only the provider owns the token/session generation. The profile is query data; do not maintain a divergent second profile store. The token getter reads current scoped memory at request time. Private query keys include a non-secret session identifier and metadata for cleanup.

The shared mutation executor supports the complete login/profile sequence. Its result is UserResponse rather than LoginResponse, keeping the access token out of mutation result data. Credential mutations use gcTime 0 and reset after completion. Do not serialize generation or AbortController into the JSON login request.

| Event | Required behavior |
| --- | --- |
| Register succeeds | User remains anonymous; go to sign-in |
| Login/profile succeed | Show current user and authenticated actions |
| Login fails before a token is issued | Remain anonymous with typed error feedback |
| `/me` network/5xx fails after login | Retain the token, expose profile error and explicit retry |
| `/me` returns 401 for the current session | Sign out and remove private data |
| Logout | Increment generation, abort pending login, clear token/user, cancel/remove private queries, reset credential mutation state |
| Switch accounts while work is pending | Late response from the old generation cannot restore user/token or populate private cache |
| Full page reload | Return to anonymous |

Public catalog cache is retained on logout. Only private data is canceled/removed. Client code, including the signed-in header, reads `useAuth`; a server component cannot read an in-memory browser token.

## Deliberate limits

The access token is not stored in localStorage, sessionStorage, a persisted query cache, or Redux persistence. The remember-me checkbox does not introduce persistent login. Refresh tokens, password recovery, social login, server-side token revocation and a persistent session protocol are separate features.

An explicit development auth stub supports register/login/profile without a real auth backend. It has no default account: register before signing in. Fixture state/tokens are local to its instance and are lost when that setup is recreated. Production must reject enabling the stub. A fake token is not a real JWT acceptance test.

## Verification

The auth API/query tests and browser acceptance harness cover header rules, field errors, storage behavior, account switching, pending logout/login/profile races, 401 cleanup and recovery after 503. Ensure the browser runner actually calls the acceptance suite; file presence alone provides no coverage. Report current commands/results in the implementation handoff, separately from historical test counts and live backend validation.

Profile edits use the provider updateProfile workflow and pure accountService through the shared HTTP boundary. Controlled requests abort on logout; generation checks prevent late saves from replacing a newer account. Successful PUT data replaces the same profile query used by the header. See [profile behavior](../profile-page.md).
