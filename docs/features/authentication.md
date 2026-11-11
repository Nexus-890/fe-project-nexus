# Authentication

## Routes and setup

/sign-in opens Keycloak using Authorization Code with PKCE S256, state and nonce validation. Passwords are entered only on the provider form. The frontend no longer posts credentials to /api/v1/auth/login. /auth/callback hands the code and PKCE verifier to the api-gateway (POST /api/v1/auth/session), loads the account and restores a safe application path. The gateway exchanges the code with Keycloak, keeps the refresh token in the HttpOnly cookie nexus_rt and returns only the access and ID tokens (#252). /login and /register remain aliases for /sign-in and /sign-up.

Configure NEXT_PUBLIC_API_URL as the common backend origin and NEXT_PUBLIC_KEYCLOAK_URL, NEXT_PUBLIC_KEYCLOAK_REALM and NEXT_PUBLIC_KEYCLOAK_CLIENT_ID from [.env.example](../../.env.example). Restart Next after public configuration changes. The local realm uses http://localhost:18080, nexus and the public nexus-web client. Its allowed redirect URIs must cover the frontend /auth/callback plus the configured post-logout destination. See the [realm setup](../../../be-project-nexus/infra/local-dev/keycloak/README.md).

The session calls in service/authService.ts (session, refresh, logout) send credentials and the X-Requested-With: nexus-web header the gateway requires against CSRF; their types come from the gateway OpenAPI spec (types/gatewayGeneratedType.ts). The browser never talks to the Keycloak token endpoint. The registration/profile endpoints use the delivered API envelope. configs/api.ts validates {code,message,data,page?} once, and service/authService.ts validates the nested UserResponse. GET /api/v1/users/me HTTP 200 and POST /api/v1/auth/register HTTP 201 must both contain data; a raw user, missing data or malformed nested user is rejected.

## Registration

Sign-up retains React Hook Form/Zod validation, password confirmation and terms checks. It submits fullName/email/phone/password/identityNumber/gender/address/dateOfBirth without assigning a role. Symbolic duplicate codes and Problem Details errors {field,code,detail} map to inputs, with form-level fallback. Successful registration navigates to sign-in and leaves the user anonymous. Backend provisioning of the new Keycloak account belongs to #238.

## Session lifecycle

The flat Provider.tsx owns QueryClientProvider and AuthSession. features/oidc.ts owns browser redirect/protocol behavior; it is safe to construct during server rendering. hooks/useAuth.ts reads the context. API services use the provider's scoped request context and current in-memory token. Profile data is owned by the shared query cache and keyed by a non-secret session generation.

| Event | Behavior |
| --- | --- |
| Start sign-in | Clear the previous local session/private cache and redirect to Keycloak |
| Callback succeeds | Exchange once through the gateway, load profile with the issued Bearer, wait for the cart's guest merge/load attempt, then restore returnTo |
| StrictMode repeats callback | Share the original exchange result |
| Profile network/5xx or malformed response | Retain the token, show failure and allow profile retry without exchanging the code again |
| Protected request returns 401 | Share one renewal through POST /api/v1/auth/refresh and replay once; a second 401 returns to the caller |
| Current profile remains 401 after replay | Clear local authentication and private cache; do not trigger remote logout implicitly |
| Renewal refused (cookie gone, revoked, or another user) | Clear authentication and private cache; suppress responses from the previous session |
| Renewal hits a gateway 503/504 or the network | Keep the session and cookie; the request keeps its 401 and the next 401 or timer tries again |
| Explicit logout | Clear token/private cache first, ask the gateway to clear the cookie and revoke the refresh token (a failure there does not block), then redirect to Keycloak end-session using the in-memory ID-token hint |
| Logout redirect fails | Remain locally signed out and expose explicit retry; retain only the in-memory logout hint |
| Account changes while a request is pending | Generation checks suppress late profile/cart success and private-cache restoration |
| Full reload | Show restoring and POST /api/v1/auth/refresh once; a live cookie gives a new access token (the refresh token rotates), otherwise the page is anonymous. The callback page skips this |
| StrictMode, the timer and parallel 401s refresh together | Share the in-flight refresh, so the rotated token is used once |
| Several tabs refresh at once | navigator.locks serializes the refresh; the waiting tab sends the newest cookie |
| Same-account token rotation | Retain the session generation, private cache and cart; do not merge guest items again |

Access and ID tokens are never persisted to localStorage, sessionStorage or mutation data/query keys, and JavaScript cannot read the refresh token. The OIDC transaction state, nonce and verifier use sessionStorage only until callback processing; unrelated entries remain intact. Logout needs no browser marker: the gateway clears the cookie, so a reload stays anonymous. Public catalog cache survives logout. External/auth return destinations are rejected.

The globally mounted CartProvider waits for authenticated profile state before merging saved guest items. A profile retry retains the guest credential and does not exchange the code again. A failed cart merge preserves the guest credential and idempotency key, then returns to the shop with an explicit merge retry. Only the guest-cart credential/key persist in localStorage; authentication tokens remain in memory. See [Guest cart](guest-cart.md) for the proposed guest API and storage/retry behavior.

## Verification and limits

Back-office access uses the flat `roles` claim in the current in-memory access token. `features/backofficeAccess.ts` does not infer access from privileges, profile roles or nested realm roles. SELLER, ADMIN and SUPPORT_STAFF default to `/backoffice` when no destination was requested; BUYER defaults to `/`. The OIDC transaction retains a separate `returnToRequested` flag so an explicit `/` remains the shop home. Allowed destinations are retained; role-forbidden destinations fall back to the role's home. The layout checks each protected route before mounting its feature; the backend independently enforces JWT privileges and ownership.

The shell reuses Seller product/sales views, provides ADMIN stock intake and labelled placeholder workspaces. Anonymous direct access redirects to sign-in with the path/query/hash. Session renewal, cart isolation and external/auth-return rejection retain their existing owners. Run `npm run test:browser -- --config playwright.backoffice.config.ts` for the explicit back-office HTTP simulation; its payment callback is a test-only stand-in, separate from the real webhook/Kafka acceptance check.

Run npm run test:auth for transport/query/mutation/protocol tests, npm run test:auth:browser for the dedicated OIDC browser suite, and npm run test:catalog for catalog/product plus the auth acceptance harness. The test-only injected OIDC adapter in AuthProbe uses fixture accounts/tokens to preserve pending-callback/profile/account-switch race checks. It is never part of production sign-in.

Profile edits use the provider updateProfile workflow and pure accountService through the shared HTTP boundary. Controlled requests abort on logout; generation checks prevent late saves from replacing a newer account. Successful PUT data replaces the same profile query used by the header. See [profile behavior](../profile-page.md).

The explicit auth stub supplies local registration/profile data and test-only injected adapters. Its credential helpers do not replace production Keycloak sign-in. Fixture state/tokens belong to that instance and are lost when it is recreated; a fixture token does not establish real JWT acceptance. Production rejects enabling the stub.

The dedicated browser suite runs the actual frontend against local Postman stand-ins derived from the committed realm and backend controllers/DTOs. It covers enveloped profile and registration responses, malformed profile recovery, PKCE/state/nonce, returnTo, reload restoration, renewal/replay limits, logout and storage behavior, plus the gateway session stand-in: the HttpOnly cookie and its path, refresh rotation and replay refusal, the CSRF header and cookie revocation on logout. [Simulation context](../../postman/simulations/oidc.context.yaml) preserves evidence and uncertainty. These checks do not establish live backend JWT trust, the real gateway CORS policy, Keycloak logout or account provisioning; the gateway side of #252 is covered by its own SessionControllerTest and SecurityConfigTest. Full real backend/Keycloak integration remains unverified; #237/#238 own backend migration.

## Session restoration and renewal

The provider exposes restoring while it asks the gateway for a new access token from the HttpOnly cookie. One in-memory coordinator renews 60 seconds before expiry (or on focus when the token is close to expiry) and shares one renewal across protected 401 responses; every renewal is the same POST /api/v1/auth/refresh. Successful rotation preserves session identity and private caches; a refused renewal clears them. See [session restore](session-restore.md) and [guest cart](guest-cart.md) for behavior and verification.
