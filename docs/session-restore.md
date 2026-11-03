# Session restore and silent renew with Keycloak (#184)

## Readiness

Implementation starts from `726da961`, including Keycloak sign-in #239 and guest
cart #194. Fetching `develop` and both task branches found no newer commits.

| Input | Evidence | Status |
|---|---|---|
| OIDC client and AuthProvider #239 | `features/auth/oidc.ts`, `providers/AuthProvider.tsx` | Available |
| In-memory session and API client #89 | `lib/api-client.ts`, `types/auth/type.ts` | Available |
| Realm/client #236 | `realm-nexus.json`: public `nexus-web`, code flow, PKCE S256, localhost wildcard redirect | Available |
| Token lifetime | Realm access lifespan 3600s, SSO idle 3600s, SSO max 36000s | Use a 120s test override for acceptance |
| Backend accepts Keycloak | Gateway/user/commerce still trust `user-service` issuer/JWKS | Blocked by backend migration #237/#238 |
| Reference Google Drive folder | External reference listed in issue | Not used as authority; contract established from repository and installed SDK |

The FE inputs are sufficient to implement and test. Full acceptance against the
real backend remains pending the token-validation migration and a running realm
configured for the chosen frontend origin. This change adds no backend refresh
endpoint, Nexus refresh cookie, or authentication-token persistence.

## Runtime flow

`AuthProvider` initially exposes `restoring`. On a regular page load it calls
`restoreSession()` once, including under StrictMode. The OIDC adapter opens an
iframe with `prompt=none`, fresh nonce and PKCE, using the provider's SSO cookie.
Keycloak redirects that iframe to `/auth/silent`; the page sends its response URL
to the parent with origin checks. The parent validates the transaction and
exchanges the code. After `/api/v1/users/me` succeeds the status is
`authenticated`. Expected `login_required` and interaction-required responses
settle to `anonymous`; the application never redirects to an interactive login
page for this check.

The silent callback does not start another restore, profile query or cart load.
The interactive `/auth/callback` keeps its existing code-exchange path. The
sign-in page displays restoration progress until the check settles and sends
an already authenticated user to the safe requested destination. Header actions
likewise show restoration progress instead of a transient sign-in action.

The installed `oidc-client-ts` 3.5.0 supports both silent iframe authorization
and refresh grants. Its user store stays explicitly `InMemoryWebStorage`.
`includeIdTokenInSilentRenew=false` prevents ID-token hints being copied into
persisted transaction state. On reload memory is empty; restoration always
checks the provider SSO session, not a saved token.

## Renewal and 401 replay

`features/auth/token-session.ts` owns the current token, subject, expiry and one
shared renewal promise. The provider schedules renewal 60 seconds before expiry
(half the remaining lifetime for shorter tokens), and checks on focus/visibility
resume. The SDK's separate automatic renew loop remains off to avoid duplicate
renewals. Refresh grants use only the refresh token in memory and go directly
to Keycloak. If none is available, renewal uses the silent iframe.

Every protected API client receives the same coordinator. Cart calls use the
auth provider's client too. A token-bearing 401 triggers renewal and one replay
of the captured method, body, params, headers and abort signal. Parallel 401s
share renewal; a late 401 from the earlier token reuses its successor within
the same session. A second 401 returns to the caller with no further replay.
Anonymous/public requests, 403s and network failures do not trigger renewal.
Cancellation stops that caller's replay without canceling another caller's
shared renewal.

Successful renewal publishes the replacement synchronously before retries run.
It must keep the same subject and have a valid unexpired token. Auth session
generation and profile cache keys remain stable across normal rotation; cart
count and pending merge are preserved. Logout or another login invalidates old
renewal work. An old response cannot overwrite or clear a newer session.

Renew failure clears in-memory credentials and private query caches, returning
to anonymous. A final 401 from the profile endpoint also clears the session.
Other API callers receive their final typed 401. Successful auth responses now
accept the delivered common-core `{data, code, message}` envelope as well as
the historical bare profile fixture.

## Logout and storage

Explicit logout clears local state immediately, then sends the in-memory ID
token hint to Keycloak end-session. A token-free sessionStorage marker
`nexus.auth.logged-out=1` prevents a reload from silently undoing an explicit
logout even if end-session navigation failed. The next explicit sign-in clears
that marker. Remote logout success still depends on the provider response.

Access, refresh and ID tokens, their JWT parts, and ID-token hints are never
written to localStorage/sessionStorage. Only pending PKCE verifier/state/nonce,
safe return data, the logout marker and the unrelated guest-cart credential
may be present. No new application auth cookie is created. A provider SSO
cookie belongs to Keycloak, not to the frontend token store.

## Browser/deployment constraints

The realm must allow `/auth/callback`, `/auth/silent`, the post-logout URI and
the actual frontend web origin. The checked-in localhost wildcard covers both
callbacks. Production must use HTTPS and matching settings. Provider cookies
must be available to the iframe and frame policy must permit this use. Browser
third-party-cookie restrictions or cross-site deployment can prevent silent
restore; the implementation fails to anonymous instead of looping or exposing
login in a hidden frame. No claim is made that blocked provider cookies can
restore a user.

## Verification

```powershell
npm run test:auth
npm run test:auth:browser
npm run lint
npx tsc --noEmit
$env:NEXUS_TEST_DIST_DIR = '.next-catalog-session-build'
npm run build
```

Unit tests use the actual installed SDK with local protocol endpoints and the
real Axios client with an injected transport. Browser tests run the real Next
application against the committed Postman API/Keycloak stand-ins, including an
HttpOnly provider SSO cookie, one-use PKCE codes, rotating refresh grants,
parallel 401s and failure controls. The provider fixture models the realm; it
does not establish deployed backend/Keycloak behavior. The signed-out CLI cannot
search the owner's published mocks, so that discovery was skipped.

The normal suite includes a controlled-clock five-minute token model. The
separate wall-clock run keeps the real browser active for at least 300 seconds
with tokens issued for 120 seconds and protected requests every 20 seconds:

```powershell
$env:NEXUS_TEST_SESSION_LONG = 'true'
npx playwright test --config playwright.auth.config.ts
Remove-Item Env:NEXUS_TEST_SESSION_LONG
```

The session probe exists only for these browser checks, is enabled by the
server-only `NEXUS_TEST_AUTH_PROBE=true` test configuration, and returns 404 in
production regardless of that flag. It exposes user/status/results, never raw
tokens. The app on port 3103 and simulation on 3913 are stopped by Playwright
after each run. Run logs and browser traces remain ignored under `test-results/`.

The five-minute wall-clock run passed on 2026-11-03 against the local stand-ins:
six tokens were issued with 120-second lifetimes, five refresh grants succeeded,
and all 45 protected GETs succeeded over 300 seconds. The same user remained
authenticated and browser storage contained no auth token. Production build,
TypeScript, ESLint, 100 unit tests and all 20 normal browser scenarios also
passed. Next.js 16.4.0 continues to
report its existing security advisory; build/startup retries completed without
changing dependencies. A framework security upgrade remains separate work.
