# Session restore and silent renew with Keycloak (#184)

## Readiness

Implementation starts from `726da961`, including Keycloak sign-in #239 and guest
cart #194. The integration below merges `origin/develop` at `0d0a36a4`, including the flat frontend architecture, strict API envelopes and the cart page.

| Input | Evidence | Status |
|---|---|---|
| OIDC client and AuthProvider #239 | `features/oidc.ts`, `providers/Provider.tsx` | Available |
| In-memory session and API client #89 | `configs/api.ts`, `types/authType.ts` | Available |
| Realm/client #236 | `realm-nexus.json`: public `nexus-web`, code flow, PKCE S256, localhost wildcard redirect | Available |
| Token lifetime | Realm access lifespan 3600s, SSO idle 3600s, SSO max 36000s | Use a 120s test override for acceptance |
| Backend accepts Keycloak | Latest develop configures Keycloak issuer/JWKS | Source migration available; live verification pending |
| Reference Google Drive folder | External reference listed in issue | Not used as authority; contract established from repository and installed SDK |

The FE inputs are sufficient to implement and test. Full acceptance against the
real backend remains pending live verification against a running realm
configured for the chosen frontend origin. This change adds no backend refresh
endpoint, Nexus refresh cookie, or authentication-token persistence.

## Runtime flow

`AuthSession` initially exposes `restoring`. On a regular page load it calls
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

`features/tokenSession.ts` owns the current token, subject, expiry and one
shared renewal promise. The provider schedules renewal 60 seconds before expiry
(half the remaining lifetime for shorter tokens), and checks on focus/visibility
resume. The SDK's separate automatic renew loop remains off to avoid duplicate
renewals. Refresh grants use only the refresh token in memory and go directly
to Keycloak. If none is available, renewal uses the silent iframe.

Every protected API client receives the same coordinator through the scoped request context. Cart calls use the
same `configs/api.ts` HTTP boundary and coordinator. A token-bearing 401 triggers renewal and one replay
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
Other API callers receive their final typed 401. Successful auth responses require the delivered common-core
`{data, code, message}` envelope; historical bare profile fixtures are rejected.

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
npm run test:auth:browser
Remove-Item Env:NEXUS_TEST_SESSION_LONG
```

The browser runner temporarily generates the session probe and removes it after the run. It exists only for these browser checks, is enabled by the
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

## Develop integration verification — 2026-11-05

Merged develop at 0d0a36a4 into the session branch at 71bc1b6b. The flat provider/services, strict API envelope, profile retry and cart edit/remove behavior remain integrated. Session identity stays stable on rotation; late responses and retries cannot write into a newer account. The shared provider context supplies the configured API origin to cart calls. Header sign-in retains the return URL, guest API 401/403 prompts sign-in, and /cart displays loading during restore.

Executed from the isolated worktree with fresh npm ci dependencies:

| Check | Result |
| --- | --- |
| npm run test:auth | 131 passed |
| npm run test:auth:browser | 23 passed: OIDC, guest merge, restoration, simultaneous 401s, retry cap, failed renewal, modeled expiry, logout/storage |
| npm run test:catalog -- --max-failures=1 | 30 passed: 14-check auth harness, cart edits/removals/account switches, catalog, products and galleries |
| npm run lint | Passed |
| npm run typecheck | Passed with fresh isolated route types |
| npm run generate:types:check | Passed |
| NEXUS_TEST_DIST_DIR=.next-verify-build; npm run build | Passed optimized compilation, TypeScript and static generation |
| git diff --check and local documentation links | Passed |

Auth browser checks used NEXUS_OIDC_APP_ORIGIN=http://127.0.0.1:3134, NEXUS_OIDC_SIM_PORT=3944 and NEXUS_TEST_DIST_DIR=.next-oidc-verify to avoid other worktrees' servers. Postman 1.73.0 ran the committed HTTP stand-ins. Default browser checks also recorded provider discovery, authorization, token and logout requests in the ignored simulation log. Owner-mock discovery was skipped; this run reused the committed local fixtures. The installed CLI does not provide postman status (unknown command).

The harness waits for the outer application restore before recording its storage baseline; only the token-free session logout marker may change. Test routes are generated temporarily and removed after the browser runner. Production route output contains neither test probe.

Initial attempts hit a dependency junction unsupported by Turbopack, old generated output, Windows manifest file locks and Next's existing security reminder. Fresh local dependencies, isolated output and sequential final gates completed successfully. Next 16.4.0 still reports its existing security advisory; no dependency upgrade is included.

This run verifies the client against local fixtures. Live Keycloak/backend acceptance remains unverified; guest/merge endpoints remain proposed and disabled by default. The historical five-minute wall-clock run above was not repeated after this merge; the controlled-clock expiry scenario passed.

## Cart integration conflict resolution (2026-11-05)

Merged the session branch at `3a81af99` with develop's guest-cart integration at `d757d972`, then incorporated the backend-only develop updates through `cfe10dfa`. Kept develop's flat cart helpers, scoped readiness, shared private cache, stale-response guards and product navigation behavior. Kept this branch's silent restoration and shared renewal coordinator. Same-user token rotation retains the session generation, cart count and pending add/merge; a new login or logout invalidates them. Removed the redundant snapshot type/count helper after migrating its consumers.

Added coverage for token rotation during a pending guest merge. All earlier cart regression cases remain. Application cart requests use the provider's configured API origin and shared token-renewal context. Guest routes remain a proposed contract with the feature disabled by default.

| Check | Result |
| --- | --- |
| `npm run test:auth` | 133 passed |
| `npm run test:auth:browser` | 24 passed: OIDC, guest cart, restoration, concurrent 401s, retry cap, failure, modeled expiry and logout |
| `npm run test:catalog -- --max-failures=1` with isolated ports | 31 passed: auth acceptance, cart, catalog, gallery and product |
| `npm run generate:types:check` | Passed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed with fresh isolated route types |
| `NEXUS_TEST_DIST_DIR=.next-session-merge-build; npm run build` | Passed compilation, TypeScript and static generation; production routes contain neither test probe |
| `git diff --check` and documentation links | Passed |

Auth browser verification used app port 3137, simulation port 3947 and `.next-oidc-merge`. Inspected 447 simulation request events: 216 Keycloak and 231 API calls, including successful and rejected token/profile/protected requests, guest merge success/failure and registration. The general suite used temporary substitutions for app/catalog/simulation ports 3138/3948/3949 and `.next-catalog-merge`; all tracked test/config bytes were restored afterwards and assertions were unchanged. Its final simulation log contained 155 Keycloak events, including 15 successful token POSTs; application API calls used explicit HTTP fixtures.

Earlier attempts encountered Next's existing upgrade reminder, a category navigation timeout and default ports occupied by another worktree. Unchanged retries with isolated ports passed. The production build also passed on retry after the existing Next 16.4.0 security reminder; dependencies were not upgraded as part of this conflict resolution.

These checks verify frontend behavior against the existing local HTTP stand-ins. Live Keycloak/backend acceptance and the historical five-minute wall-clock scenario were not repeated. Detailed run scope is recorded in the `session-restore-cart-develop-merge` simulation fingerprint.
