# Authentication

## Routes and setup

/sign-in opens Keycloak using Authorization Code with PKCE S256, state and nonce validation. Passwords are entered only on the provider form. The frontend no longer posts credentials to /api/v1/auth/login. /auth/callback exchanges the code, loads the account and restores a safe application path. /login and /register remain aliases for /sign-in and /sign-up.

Configure NEXT_PUBLIC_API_URL as the common backend origin and NEXT_PUBLIC_KEYCLOAK_URL, NEXT_PUBLIC_KEYCLOAK_REALM and NEXT_PUBLIC_KEYCLOAK_CLIENT_ID from [.env.example](../../.env.example). Restart Next after public configuration changes. The local realm uses http://localhost:18080, nexus and the public nexus-web client. Its allowed redirect URI must cover the frontend /auth/callback and its post-logout destination. See the [realm setup](../../../be-project-nexus/infra/local-dev/keycloak/README.md).

Keycloak uses its own OIDC wire format; the application's registration/profile endpoints use the delivered API envelope. configs/api.ts validates {code,message,data,page?} once, and service/authService.ts validates the nested UserResponse. GET /api/v1/users/me HTTP 200 and POST /api/v1/auth/register HTTP 201 must both contain data; a raw user, missing data or malformed nested user is rejected.

## Registration

Sign-up retains React Hook Form/Zod validation, password confirmation and terms checks. It submits fullName/email/phone/password/identityNumber/gender/address/dateOfBirth without assigning a role. Symbolic duplicate codes and Problem Details errors {field,code,detail} map to inputs, with form-level fallback. Successful registration navigates to sign-in and leaves the user anonymous. Backend provisioning of the new Keycloak account belongs to #238.

## Session lifecycle

The flat Provider.tsx owns QueryClientProvider and AuthSession. features/oidc.ts owns browser redirect/protocol behavior; it is safe to construct during server rendering. hooks/useAuth.ts reads the context. API services use the provider's scoped request context and current in-memory token. Profile data is owned by the shared query cache and keyed by a non-secret session generation.

| Event | Behavior |
| --- | --- |
| Start sign-in | Clear the previous local session/private cache and redirect to Keycloak |
| Callback succeeds | Exchange once, load profile with the issued Bearer, wait for the cart's guest merge/load attempt, then restore returnTo |
| StrictMode repeats callback | Share the original exchange result |
| Profile network/5xx or malformed response | Retain the token, show failure and allow profile retry without exchanging the code again |
| Current profile returns 401 | Clear local authentication and private cache; do not trigger remote logout implicitly |
| Explicit logout | Clear token/private cache first, then redirect to Keycloak end-session using the in-memory ID-token hint |
| Logout redirect fails | Remain locally signed out and expose explicit retry; retain only the in-memory logout hint |
| Account changes while a request is pending | Generation checks suppress late profile/cart success and private-cache restoration |
| Full reload | Return to anonymous; restoration/renewal belongs to #184 |

Access and ID tokens are never persisted to localStorage, sessionStorage or mutation data/query keys. The OIDC transaction state, nonce and verifier use sessionStorage only until callback processing; unrelated entries remain intact. Public catalog cache survives logout. External/auth return destinations are rejected.

The globally mounted CartProvider waits for authenticated profile state before merging saved guest items. A profile retry retains the guest credential and does not exchange the code again. A failed cart merge preserves the guest credential and idempotency key, then returns to the shop with an explicit merge retry. Only the guest-cart credential/key persist in localStorage; authentication tokens remain in memory. See [Guest cart](guest-cart.md) for the proposed guest API and storage/retry behavior.

## Verification and limits

Run npm run test:auth for transport/query/mutation/protocol tests, npm run test:auth:browser for the dedicated OIDC browser suite, and npm run test:catalog for catalog/product plus the auth acceptance harness. The test-only injected OIDC adapter in AuthProbe uses fixture accounts/tokens to preserve pending-callback/profile/account-switch race checks. It is never part of production sign-in.

The dedicated browser suite runs the actual frontend against local Postman stand-ins derived from the committed realm and backend controllers/DTOs. It covers enveloped profile and registration responses, malformed profile recovery, PKCE/state/nonce, returnTo, logout and storage behavior. [Simulation context](../../postman/simulations/oidc.context.yaml) preserves evidence and uncertainty. These checks do not establish live backend JWT trust, browser CORS, Keycloak logout or account provisioning. Full real backend/Keycloak integration remains unverified; #237/#238 own backend migration.
