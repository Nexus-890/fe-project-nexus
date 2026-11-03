# Keycloak sign-in and in-memory session

## Configure and run

Copy `.env.example` to `.env.local`, configure `NEXT_PUBLIC_API_URL` as the common
backend origin, and keep these defaults for the supplied local realm:

```dotenv
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:18080
NEXT_PUBLIC_KEYCLOAK_REALM=nexus
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=nexus-web
```

`KEYCLOAK_URL` is the browser-visible server base URL, without `/realms/nexus`.
Use HTTPS outside loopback development. No client secret belongs in this public
browser client. Restart Next after changing public environment variables.

Run the realm using
[`keycloak/README.md`](../../be-project-nexus/infra/local-dev/keycloak/README.md),
then run `npm run dev` and open **http://localhost:3000**. The imported `nexus-web`
client permits that origin and its redirect paths. Another host or port requires
matching redirect URI, web origin and post-logout redirect settings in Keycloak.
Callback is `/auth/callback`; post-logout destination is `/`.

The #236 realm is present at develop `6e92bbac`. The committed backend defaults
still validate the old user-service issuer/JWKS; #237 must switch gateway and
resource servers to Keycloak before real tokens can load `/api/v1/users/me`.
Registration currently creates a local profile only; #238 must provision the
Keycloak account before a newly registered user can sign in. Existing seeded
Keycloak demo users use the same profile UUIDs. The browser tests below use
explicit local dependency fixtures and do not establish those backend changes.

## Flow and storage

1. `/sign-in` calls `useAuth().signIn(returnTo?)`. The browser leaves Nexus for
   Keycloak using Authorization Code, PKCE S256, random state and nonce.
2. Keycloak redirects to `/auth/callback`. `completeSignIn(originalUrl)` validates
   the transaction and exchanges the code directly with Keycloak. It verifies
   ID-token nonce, issuer, audience and expiry, and a live Bearer access token.
   The browser client relies on the configured provider's TLS token endpoint;
   backend resource servers remain responsible for validating JWT signatures.
3. The provider removes callback parameters from browser history, keeps the
   access token in memory, and calls `/api/v1/users/me` with its Bearer token.
   It then replaces the callback route with the original relative page, including
   query and fragment. External, malformed and auth destinations fall back to `/`.
4. Sign out immediately clears local auth state and private query caches, then
   navigates to Keycloak's end-session endpoint using the in-memory ID-token hint.
   A failed redirect has an explicit retry action. Keycloak may show confirmation
   when no hint is available. A provider/network failure is not proof of remote
   session termination.

Passwords are entered on Keycloak's page. The production auth service exposes
only `register` and `me`; no Nexus login call receives credentials. Registration
continues to POST `/api/v1/auth/register`, then routes to `/sign-in` without
creating a signed-in session.

`features/auth/oidc.ts` wraps `oidc-client-ts`. Its user store is
`InMemoryWebStorage`: access, ID and refresh tokens never enter localStorage,
sessionStorage or TanStack caches. Only pending transaction state, nonce,
PKCE verifier and safe return destination survive the redirect, in namespaced
sessionStorage entries. Callback processing consumes the transaction; stale
entries expire after ten minutes and are cleaned on later auth actions.
Unrelated storage entries are preserved.

Reloading starts anonymous. There is no automatic SSO check, refresh request,
silent renew or session restore; those belong to #184. The ID token is used for
logout only. The provider does not put tokens/codes into query keys or mutation
variables/data. Profiles are keyed by session generation. A 401 clears local
state. Transient profile errors offer retry without exchanging the code again.
Generation checks and query cancellation prevent pending work restoring a session
following logout. React StrictMode shares one code-exchange promise.

## Consumer API

```tsx
const { signIn, completeSignIn, signOut, register, user, status, api } = useAuth();
await signIn('/products/example?variant=blue'); // navigates to Keycloak
await signOut(); // clears local state and navigates to end-session
```

Redirect actions return `ApiResult<void>`; callback returns `ApiResult<string>`
with the safe destination. UI error messages never expose raw provider exceptions.
`retryProfile()` retains the existing typed result contract. `status` is
`anonymous`, `authenticating`, `authenticated` or `error`.

Private queries must use `meta: { requiresAuth: true }` so logout removes them.
`service/auth.ts` validates `UserResponse` at runtime. The shared Axios adapter
uses `configs/api.ts`, a 15-second timeout, and reads the latest in-memory token
only for protected relative requests. Registration is public. Backend validation
errors use `errors: Array<{field, message}>`; the adapter derives
`ApiError.fieldErrors` for form consumers.

`NEXT_PUBLIC_AUTH_STUB=true` only substitutes the registration/profile API fixture
for isolated UI development; it does not replace Keycloak and is disabled in
production. The legacy password-login operation exists solely inside historical
fixture regression tests. Use the OIDC browser simulation for full FE testing.

## Verification

```powershell
npm ci
npm run test:auth
npm run test:auth:browser
npx tsc --noEmit
npm run build
```

The browser suite requires Google Chrome and Postman CLI 1.73+ on PATH. It starts
Next on `127.0.0.1:3103` and a local Postman simulation on port 3913; it requires
neither Docker, real Keycloak, credentials nor Postman sign-in. The runner stops
its child processes after the tests. Fixture accounts and unsigned ID tokens are
for local tests only. The production application is exercised over real HTTP;
Keycloak and the backend API are stand-ins defined in `postman/mocks/`.

`tests/oidc.test.ts` checks the actual OIDC library's state/nonce/PKCE protocol and
storage behavior. `tests/browser/oidc.spec.ts` covers callback errors, redirects,
Bearer profile requests, logout, anonymous reload and registration. Simulation
assumptions and remaining real-service gaps are recorded in
`postman/simulations/oidc.context.yaml`. Browser traces/screenshots and simulation
logs are written under ignored `test-results/`.

The installed Next.js 16.4.0 reported a security advisory during verification.
Initial dev/build invocations stopped at its upgrade reminder; subsequent
invocations completed. A framework security upgrade remains separate work.
